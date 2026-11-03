#!/usr/bin/env python3
"""OpenDesigner review helper: plan what to look at, check what the page measured, report with evidence.

Standard library only, Python 3.10+, no network. It never opens a browser: the agent captures screenshots and runs
probe.js (in Playwright, Chrome DevTools MCP, Claude in Chrome, the in-app browser or any console); this script does
the bookkeeping and the arithmetic. Work goes in ./opendesigner/review/ (or --dir).

    review.py probe [--print]                     where probe.js is (--print writes it to stdout, to paste into a browser tool)
    review.py serve [--port 7788] [--minutes 60]   loopback helper for browser-tool hosts: serves probe.js to the page and saves what
                                                   the page posts back into review/, so nothing large passes through your context
    review.py plan --url URL [--routes /,/x] [--viewports 320,390,768] [--themes light,dark] [--project P] [--edges] [--wide]
                                                   the coverage matrix (route x viewport x theme, plus the tasks that need a
                                                   real browser state), all "todo", in review/plan.json and review/ledger.json
    review.py mark CELL done|skipped|blocked [--evidence PATH ...] [--why "reason"]     (CELL from plan; "task:" cells too)
    review.py check PROBE.json|DIR [...] [--project P] [--json]
                                                   findings from probe runs (and focus-walk files) against the accessibility
                                                   floors and, when the project has an OpenDesigner system, its tokens;
                                                   prints what got fixed and what is new since the last check. A folder
                                                   (the review folder) stands for every probe and capture file in it
    review.py finding "what you saw" --severity error|warn|info --basis seen|operated|inferred --evidence PATH
                     [--where "route, viewport, theme"] [--expected "..."] [--fix "..."] [--case CV-01]
                                                   record something you judged by looking or by operating the page
    review.py report [--name N]                    review/REPORT.md: verdict, what was not checked, findings with evidence
    review.py sheet [DIR] [--open]                 review/sheet.html: every screenshot on one page, in order, with its name
    review.py compare --before B.png --marks marks.json --after A.png [--after-marks M.json] [--title T] [--open]
                                                   review/compare.html: the page today, the audit drawn on it (a dashed box and a
                                                   number on each issue) and the fix, switched with the house variant picker; each
                                                   fix says what it gives the person. marks.json comes from __od.marks() in probe.js
    review.py cases [--when motion,forms] [--group time] [--id CV-01] [--full]
                                                   the catalogue of things reviews miss (65 cases), filtered to what applies to this page

Every finding says how it is known: measured (a number from the page), operated (you did it and saw the result), seen
(you looked at pixels), inferred (reasoned, not observed). Findings that are not measured are less certain; the report
says so. The verdict is never "looks good": it is FAIL, INCOMPLETE, or NO ERRORS FOUND in the cells that were checked.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import html
import json
import math
import os
import re
import secrets
import sys
import webbrowser
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
PROBE = HERE / "probe.js"
CASES = HERE.parent / "references" / "cases.json"
STATE_DIR = "opendesigner"
SEV = {"error": 0, "warn": 1, "info": 2}
BASIS = ("measured", "operated", "seen", "inferred")

# Floors that never move (guardrails.md section 4). Everything else compares with the project's own system.
FLOOR_TARGET = 24            # WCAG 2.2 SC 2.5.8, CSS px
TOUCH_TARGET = 44            # Apple's default control size in pt (its minimum is 28 pt); warned on coarse-pointer viewports
CONTRAST_TEXT, CONTRAST_LARGE = 4.5, 3.0
MAX_MEASURE_CH = 80          # WCAG 1.4.8 (AAA) upper bound
UI_MOTION_MS = 300           # STD-easing-duration-06: UI motion under 300 ms unless justified
TIGHT_LINE_HEIGHT = 1.3

DEFAULT_VIEWPORTS = [(320, 640), (390, 844), (768, 1024), (1024, 768), (1440, 900)]
WIDE_VIEWPORT = (1920, 1080)


# ----------------------------------------------------------------------------------------------------- files
def die(msg):
    raise SystemExit(msg)


def review_dir(args):
    d = Path(args.dir) if getattr(args, "dir", None) else Path(args.project if getattr(args, "project", None) else ".") / STATE_DIR / "review"
    return d


def read_json(path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        if default is not None:
            return default
        die(f"{path} not found")
    except json.JSONDecodeError as e:
        die(f"{path} is not valid JSON: {e}")


def write_json(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def load_cases():
    try:
        return json.loads(CASES.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {"cases": [], "groups": []}


# --------------------------------------------------------------------------------------------- the system
def load_system(project):
    """What the project's design system says the page should use, or None when it has no OpenDesigner system.
    Reads opendesigner/tokens/opendesigner.meta.json and build/css/tokens.css; anything missing is left out."""
    base = Path(project) / STATE_DIR
    meta = base / "tokens" / "opendesigner.meta.json"
    if not meta.exists():
        if (Path(project) / "tokens" / "opendesigner.meta.json").exists():   # an example folder or a system dir passed directly
            base, meta = Path(project), Path(project) / "tokens" / "opendesigner.meta.json"
        else:
            return None
    m = read_json(meta)
    prefix = m.get("prefix") or "ds"
    sysm = {"name": m.get("name"), "prefix": prefix, "modes": m.get("modes") or ["light", "dark"],
            "type_sizes": [float(x) for x in (m.get("type") or {}).get("sizes") or []],
            "line_heights": [float(x) for x in (m.get("type") or {}).get("lineHeights") or []],
            "min_size": (m.get("type") or {}).get("minSize"),
            "ladder": [float(x) for x in (m.get("space") or {}).get("ladder") or []],
            "unit": (m.get("space") or {}).get("unit") or 4,
            "target": ((m.get("space") or {}).get("targets") or {}).get("pointer") or FLOOR_TARGET,
            "breakpoints": (m.get("space") or {}).get("breakpoints") or {},
            "radii": sorted({float(v) for v in (m.get("shape") or {}).values() if isinstance(v, (int, float))}),
            "durations": sorted({float(v) for v in ((m.get("motion") or {}).get("durations") or {}).values() if isinstance(v, (int, float)) and v}),
            "faces": [((f or {}).get("face") or "") for f in ((m.get("type") or {}).get("faces") or {}).values()],
            "weights": sorted({int(v) for v in ((m.get("type") or {}).get("weights") or {}).values() if isinstance(v, (int, float))}),
            "palette": {}, "radius_ladder": []}
    css = base / "build" / "css" / "tokens.css"
    if css.exists():
        text = css.read_text(encoding="utf-8")
        for name, hx in re.findall(r"--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?\s*;", text):
            sysm["palette"].setdefault(hx.lower(), name)
        sysm["radius_ladder"] = sorted({float(v) for v in re.findall(rf"--{re.escape(prefix)}-radius-(\d+):", text)})
    # faces reference each other ("=textFace"); keep the real names only
    sysm["faces"] = [f for f in sysm["faces"] if f and not f.startswith("=")]
    return sysm


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def nearest(value, options):
    return min(options, key=lambda o: (abs(o - value), o)) if options else None


def nearest_color(hx, palette):
    if not palette:
        return None
    r = hex_rgb(hx)
    best = min(palette, key=lambda p: sum((a - b) ** 2 for a, b in zip(r, hex_rgb(p))))
    return best, palette[best], math.sqrt(sum((a - b) ** 2 for a, b in zip(r, hex_rgb(best))))


def fmt(n):
    return f"{n:g}" if isinstance(n, (int, float)) else str(n)


# ---------------------------------------------------------------------------------------------- findings
class Findings:
    """Findings merged by (case, key): the same defect at three viewports is one finding with three places."""

    def __init__(self):
        self.items = {}

    def add(self, case, sev, title, where, measured=None, expected=None, evidence=None, fix=None, std=None, key=None, basis="measured"):
        k = (case, key or title)
        f = self.items.get(k)
        if not f:
            f = self.items[k] = {"id": "", "case": case, "severity": sev, "basis": basis, "title": title, "where": [], "measured": measured,
                                 "expected": expected, "evidence": [], "fix": fix, "standard": std, "status": "confirmed"}
        if where and where not in f["where"]:
            f["where"].append(where)
        for e in evidence or []:
            if e and e not in f["evidence"] and len(f["evidence"]) < 6:
                f["evidence"].append(e)
        if SEV[sev] < SEV[f["severity"]]:
            f["severity"] = sev

    def done(self):
        out = sorted(self.items.values(), key=lambda f: (SEV[f["severity"]], f["case"], f["title"]))
        for f in out:
            f["id"] = "M-" + re.sub(r"[^A-Z0-9]+", "", f["case"].upper()) + "-" + f"{abs(hash_str(f['case'] + '|' + f['title'])) % 10000:04d}"
        return out


def hash_str(s):
    h = 5381
    for c in s:
        h = ((h << 5) + h + ord(c)) & 0xFFFFFFFF
    return h


def where_of(p):
    u = urlparse(p.get("url") or "")
    route = (os.path.basename(u.path) or "/") if u.scheme == "file" else (u.path or "/") + (("#" + u.fragment) if u.fragment and u.fragment.startswith("/") else "")
    v = p.get("viewport") or {}
    theme = (p.get("mode") or {}).get("theme") or (p.get("media") or {}).get("colorScheme") or "light"
    extra = ""
    if p.get("stress"):
        extra = " · stress: " + "+".join(p["stress"])
    if (p.get("media") or {}).get("reducedMotion"):
        extra += " · reduced motion"
    if (p.get("media") or {}).get("forcedColors"):
        extra += " · forced colors"
    return f"{route} · {fmt(v.get('w'))}x{fmt(v.get('h'))} · {theme}{extra}"


# -------------------------------------------------------------------------------------------- the checks
def check_probe(p, sysm, F):
    w = where_of(p)
    vp = p.get("viewport") or {}
    stressed = bool(p.get("stress"))
    stress_txt = " under " + "+".join(p["stress"]) if stressed else ""
    # text spacing (1.4.12) and 200% text (1.4.4) are requirements; long words, +40% text and RTL are robustness tests
    stress_sev = "error" if (not stressed or set(p["stress"]) & {"textSpacing", "text200"}) else "warn"
    doc, media = p.get("doc") or {}, p.get("media") or {}
    # a stress pass changes sizes and spacing on purpose, and forced colors swaps every color: judge drift on normal runs only
    judge_drift = not stressed and not media.get("forcedColors")

    # --- floors --------------------------------------------------------------------------------------------
    if doc.get("hOverflow", 0) > 0:
        offenders = [o["sel"] for o in (p.get("overflow") or {}).get("list", [])[:4]]
        F.add("CV-05", stress_sev, f"The page scrolls sideways{stress_txt}", w, f"{fmt(doc['hOverflow'])} px wider than the viewport ({fmt(vp.get('w'))} px)",
              "no horizontal scroll (WCAG 1.4.10 at 320 px)", offenders,
              "find the widest element listed and let it wrap, shrink (min-width: 0, max-width: 100%) or scroll inside its own box", "WCAG 1.4.10",
              key="hscroll" + ("-stress" if stressed else ""))
    elif (p.get("overflow") or {}).get("list"):
        o = p["overflow"]["list"]
        F.add("CV-05", "error" if doc.get("rootClipsX") else "warn", "Elements extend past the viewport edge" + (" and the page hides it" if doc.get("rootClipsX") else ""), w,
              f"{len(o)} element(s); the widest is {fmt(o[0]['over'])} px past the edge", "everything inside the viewport unless it scrolls in its own box",
              [x["sel"] for x in o[:4]], "content can be cut off with no way to reach it: remove overflow-x: hidden from html/body and fix the wide element", "WCAG 1.4.10", key="past-edge")
    for c in (p.get("overflow") or {}).get("clipped", []):
        if c.get("ellipsis"):
            F.add("ST-04", "info", "Text is cut with an ellipsis", w, f"{c['sel']}: {c['text']!r} needs {fmt(c['sw'])} px, has {fmt(c['cw'])} px",
                  "intentional, with the full text reachable (title, tooltip, expand)", [c["sel"]], "confirm the full value can be read elsewhere", "WCAG 1.4.4", key="ellipsis:" + c["sel"])
        else:
            F.add("ST-04", stress_sev if stressed else "warn", f"Text is clipped and cannot be read{stress_txt}", w,
                  f"{c['sel']}: content {fmt(c['sw'])}x{fmt(c['sh'])} px in a {fmt(c['cw'])}x{fmt(c['ch'])} px box", "no content lost when text grows",
                  [c["sel"]], "let the box grow (min-height, not height; overflow: visible) or wrap the text", "WCAG 1.4.4 / 1.4.12", key="clip:" + c["sel"] + ("-stress" if stressed else ""))

    ct = p.get("contrast") or {}
    for c in ct.get("failing", []):
        need = CONTRAST_LARGE if c.get("large") else CONTRAST_TEXT
        unsure = c.get("backdrop") in ("image", "gradient")
        F.add("MS-04", "info" if unsure else "error", f"Text contrast {c['ratio']}:1 is below {need}:1" + (" (background is an image or gradient: sample the pixels)" if unsure else ""),
              w, f"{c['fg']} on {c['bg']}, {fmt(c['fs'])} px, {c['n']} element(s)", f"{need}:1 (no rounding up: 4.49 fails)", [c["sel"]],
              "darken the text or lighten the surface with a token pair that passes; check the same pair in dark mode", "WCAG 1.4.3", key=f"contrast:{c['fg']}:{c['bg']}:{c.get('large')}")

    tg = p.get("targets") or {}
    small = [s for s in tg.get("small", []) if not s.get("spacingException")]
    if small:
        F.add("MS-06", "error", f"Targets smaller than {FLOOR_TARGET}x{FLOOR_TARGET} px with another target close by", w,
              f"{len(small)} target(s): " + "; ".join(f"{s['sel']} {fmt(s['w'])}x{fmt(s['h'])}" for s in small[:4]),
              f"at least {FLOOR_TARGET}x{FLOOR_TARGET} CSS px, or {FLOOR_TARGET} px of clear space around each (WCAG 2.5.8)", [s["sel"] for s in small[:4]],
              "raise min-width and min-height, or add padding to the hit area", "WCAG 2.5.8", key="target-small")
    if tg.get("coarse") and tg.get("small"):
        ts = tg["small"]
        F.add("IN-04", "warn", f"Touch targets under {TOUCH_TARGET} px", w, f"{len(ts)} target(s), e.g. {ts[0]['sel']} at {fmt(ts[0]['w'])}x{fmt(ts[0]['h'])}",
              f"Apple's default control size is {TOUCH_TARGET} pt (minimum 28 pt); Android recommends 48 dp", [s["sel"] for s in ts[:3]], "enlarge the hit area on touch (padding, or an ::after inset)", "Apple HIG, Android accessibility guide", key="touch-target")
    if tg.get("noName"):
        nn = tg["noName"]
        F.add("IN-03", "error", "Controls with no accessible name", w, f"{len(nn)} control(s): " + "; ".join(n["sel"] for n in nn[:4]), "every control has a name a screen reader can say",
              [n["sel"] for n in nn[:4]], "add aria-label, visible text, or a <label>", "WCAG 4.1.2 / 1.1.1", key="noname")

    hf = tg.get("hiddenFocusable") or []
    if hf:
        real_hidden = [h for h in hf if h["why"] != "outside the page"]
        if real_hidden:
            F.add("IN-08", "warn", "Controls a keyboard can reach but nobody can see", w, f"{len(real_hidden)}: " + "; ".join(f"{h['sel']} ({h['why']})" for h in real_hidden[:3]),
                  "focusable things are visible when focused", [h["sel"] for h in real_hidden[:3]], "hide with display: none or inert until they are meant to appear", "WCAG 2.4.7 / 1.3.2", key="hidden-focusable")
        off = [h for h in hf if h["why"] == "outside the page"]
        if off:
            F.add("IN-08", "info", "Controls placed outside the page box", w, "; ".join(h["sel"] for h in off[:3]), "a skip link that appears on focus is fine; anything else is off-canvas content", [h["sel"] for h in off[:3]], "Tab to it and confirm it appears", None, key="offcanvas")
    lb_all = (p.get("labels") or {}).get("broken") or []
    lb, seen_lb = [], {}
    for x in lb_all:   # the same button in every table row is one finding with a count
        k = (x["sel"], x["text"])
        if k in seen_lb:
            seen_lb[k]["n"] += 1
        else:
            seen_lb[k] = dict(x, n=1)
            lb.append(seen_lb[k])
    if lb:
        def says(x):
            return (f"{x['sel']}: \"{x['text']}\" on {x['lines']} lines" + (" (inside a word)" if x.get("midWord") else "")
                    + (f", {x['n']} times" if x["n"] > 1 else ""))
        F.add("MS-15", "error", "Labels break across lines" + stress_txt, w, "; ".join(says(x) for x in lb[:4]) + (f" (+{len(lb) - 4} more)" if len(lb) > 4 else ""),
              "every button, tab, chip and tag label on one line", [x["sel"] for x in lb[:4]],
              "keep the label on one line (white-space: nowrap) and give it room: widen the column, drop the icon or shorten the label; let the row wrap, never the label",
              None, key="label-break" + ("-stress" if stressed else ""))
    ph = (p.get("content") or {}).get("placeholders") or []
    if ph:
        F.add("ST-06", "warn", "Placeholder or broken template text on the page", w, "; ".join(f"{x['sel']}: {x['match']!r}" for x in ph[:4]), "real content", [x["sel"] for x in ph[:4]], "replace lorem ipsum; undefined, NaN, null and {{ }} mean data did not arrive or a template did not render", None, key="placeholders")
    if doc.get("blocksZoom"):
        F.add("EN-01", "error", "The page stops people from zooming", w, f"viewport meta: {doc.get('viewportMeta')}", "no user-scalable=no and no low maximum-scale",
              ["meta[name=viewport]"], "remove user-scalable=no and maximum-scale", "WCAG 1.4.4", key="zoom-blocked")
    if not doc.get("lang"):
        F.add("IN-03", "error", "The page does not declare its language", w, "<html> has no lang", "<html lang=\"en\"> (or the real language)", ["html"], "set lang", "WCAG 3.1.1", key="lang")
    a = p.get("a11y") or {}
    hd = a.get("headings") or {}
    if hd.get("levels") and hd.get("h1", 0) == 0:
        F.add("IN-03", "warn", "No level-1 heading", w, f"headings: {hd['levels'][:12]}", "one h1 that names the page", ["h1"], "make the page title an h1", "WCAG 2.4.6 (best practice)", key="no-h1")
    if hd.get("h1", 0) > 1:
        F.add("IN-03", "info", "More than one level-1 heading", w, f"{hd['h1']} h1 elements", "usually one", ["h1"], None, None, key="many-h1")
    if hd.get("skips"):
        s = hd["skips"][0]
        F.add("IN-03", "warn", "Heading levels skip", w, f"h{s['from']} is followed by h{s['to']} ({len(hd['skips'])} skip(s))", "levels go down one at a time", ["h" + str(s["to"])],
              "use the real level and style it with CSS", "best practice (axe: heading-order)", key="heading-skip")
    if a.get("duplicateIds"):
        F.add("IN-03", "warn", "Duplicate ids", w, ", ".join(a["duplicateIds"][:5]), "each id once (labels and aria-labelledby point at ids)", ["#" + a["duplicateIds"][0]], None, "HTML", key="dup-id")
    st = a.get("states") or {}
    if st.get("focusRingRemoved"):
        F.add("IN-02", "error", "The focus ring is removed and nothing replaces it", w, f"{len(st['focusRingRemoved'])} control(s), e.g. {st['focusRingRemoved'][0]}",
              "a visible focus indicator (2 px ring, 2 px offset, not color alone)", st["focusRingRemoved"][:4],
              "replace outline: none with a :focus-visible style", "WCAG 2.4.7 (failure F78)", key="focus-removed")
    n_int = st.get("checked") or 0
    if n_int and len(st.get("noHover", [])) >= max(3, n_int // 2) and (media.get("hover", True)):
        F.add("ST-01", "info", "Most controls have no :hover style", w, f"{len(st['noHover'])} of {n_int} have none in the stylesheets I can read",
              "a hover cue on pointer devices (and nothing that only appears on hover)", st["noHover"][:3], "confirm by hovering a few; touch-only products can skip this", None, key="no-hover")

    im = p.get("images") or {}
    if im.get("broken"):
        F.add("MS-10", "error", "Images failed to load", w, f"{len(im['broken'])}: " + "; ".join(im["broken"][:4]), "every image loads", im["broken"][:4], "fix the path or the asset, and check the network tab", None, key="img-broken")
    if im.get("noAlt"):
        F.add("MS-10", "error", "Images with no alt attribute", w, f"{len(im['noAlt'])}: " + "; ".join(im["noAlt"][:4]), "alt text, or alt=\"\" if it is decoration", im["noAlt"][:4], "add alt", "WCAG 1.1.1", key="img-alt")
    if im.get("stretched"):
        s_ = im["stretched"]
        F.add("MS-10", "warn", "Images stretched out of their shape", w, "; ".join(f"{x['sel']}: file {x['natural']}, shown {x['shown']}" for x in s_[:3]), "same aspect ratio (object-fit: cover or contain)", [x["sel"] for x in s_[:3]], "set object-fit", None, key="img-stretch")
    if im.get("blurry"):
        s_ = im["blurry"]
        F.add("MS-10", "warn", "Images smaller than the space they fill", w, "; ".join(f"{x['sel']}: file {fmt(x['natural'])} px wide, shown {fmt(x['shown'])} px at {fmt(x['dpr'])}x" for x in s_[:3]), "file at least as wide as the shown size times the pixel ratio", [x["sel"] for x in s_[:3]], "use a larger file or srcset", None, key="img-blurry")
    if im.get("oversize"):
        s_ = im["oversize"]
        F.add("MS-10", "info", "Image files far larger than needed", w, "; ".join(f"{x['sel']}: file {fmt(x['natural'])} px wide, shown {fmt(x['shown'])} px" for x in s_[:3]), "about the shown size times the pixel ratio", [x["sel"] for x in s_[:3]], "resize or use srcset", None, key="img-oversize")

    # --- type ----------------------------------------------------------------------------------------------
    ty = p.get("type") or {}
    sm = ty.get("smallest")
    floor_min = (sysm or {}).get("min_size") or 12
    if sm and sm["px"] < floor_min:
        F.add("MS-02", "warn", f"Text smaller than {fmt(floor_min)} px", w, f"{sm['px']} px: {sm['text']!r} in {sm['sel']}", f"at least {fmt(floor_min)} px" + (" (the system's minimum)" if sysm else ""), [sm["sel"]], "raise it to a text style", None, key="min-text")
    if ty.get("longLines"):
        l = ty["longLines"][0]
        F.add("MS-07", "warn", f"Lines longer than {MAX_MEASURE_CH} characters", w, f"{l['sel']} is about {fmt(l['ch'])} characters wide", f"at most {MAX_MEASURE_CH} (WCAG 1.4.8, AAA); 45-75 is the usual target", [x["sel"] for x in ty["longLines"][:3]], "set max-width: 65ch on the text block", "WCAG 1.4.8 (AAA)", key="measure")
    if ty.get("lineHeightTight"):
        t = ty["lineHeightTight"][0]
        F.add("MS-07", "info", "Wrapped text with tight line height", w, f"{t['sel']}: line height {t['ratio']}x its size over several lines", f"at least {TIGHT_LINE_HEIGHT}x for body text; 1.5x survives WCAG 1.4.12", [x["sel"] for x in ty["lineHeightTight"][:3]], None, "WCAG 1.4.12", key="tight-lh")
    fam = p.get("fonts") or {}
    used = ty.get("families") or {}
    for name, state in (fam.get("familyState") or {}).items():
        if state in ("missing", "failed", "declared-not-loaded") and name in used:
            n = used[name]["n"]
            F.add("MS-03", "error" if state != "declared-not-loaded" else "warn", f"The page asks for {name} but it is not the font being drawn ({state})", w, f"{n} text element(s) fall back to the next font in the stack",
                  f"{name} loaded (@font-face file served, or installed)", [used[name]["ex"][0] if used[name]["ex"] else name],
                  "check the @font-face src path and the network tab; wait for document.fonts.ready before judging type", None, key="font:" + name.lower())
    if judge_drift and sysm and sysm.get("faces"):
        wanted = {f.lower() for f in sysm["faces"]}
        top_family = max(used, key=lambda k: used[k].get("chars", 0)) if used else None
        if top_family and top_family.lower() not in wanted and not re.match(r"^(system-ui|ui-|serif|sans-serif|monospace|-apple)", top_family, re.I):
            F.add("MS-03", "warn", "Most text is not in the system's typeface", w, f"most text is {top_family}; the system says {', '.join(sysm['faces'])}", "the system's text face", [used[top_family]["ex"][0]], "use the font-family token", None, key="face-drift")
    ge = ty.get("weights") or {}
    if judge_drift and sysm and sysm.get("weights"):
        odd = {k: v for k, v in ge.items() if int(float(k)) not in sysm["weights"]}
        if odd:
            k = max(odd, key=lambda x: odd[x]["n"])
            F.add("MS-02", "info", "Font weights outside the system's", w, f"weight {k} on {odd[k]['n']} element(s); the system uses {sysm['weights']}", "the system's weights", [odd[k]["ex"][0]], None, None, key="weights")

    # --- drift from the system ----------------------------------------------------------------------------
    scale = (sysm or {}).get("type_sizes")
    sizes = ty.get("sizes") or {}
    if judge_drift and scale and sizes:
        total = sum(v["n"] for v in sizes.values())
        off = {k: v for k, v in sizes.items() if min(abs(float(k) - s) for s in scale) > 0.6}
        if off:
            uses = sum(v["n"] for v in off.values())
            rows = sorted(off.items(), key=lambda kv: -kv[1]["n"])[:5]
            F.add("MS-02", "warn" if uses / total >= 0.1 else "info", f"Font sizes off the type scale ({len(off)} value(s), {uses} of {total} text elements)", w,
                  "; ".join(f"{k}px x{v['n']} (nearest {fmt(nearest(float(k), scale))})" for k, v in rows), f"sizes from the scale: {', '.join(fmt(s) for s in scale)}",
                  [v["ex"][0] for _, v in rows if v["ex"]], "use a text style; a browser default (buttons 13.33 px, h3 18.72 px) means the element does not inherit", "tokens", key="type-drift")
    elif judge_drift and sizes:
        n = len(sizes)
        if n > 8:
            F.add("MS-02", "info", f"{n} distinct font sizes", w, ", ".join(sorted(sizes, key=float)), "a scale of about 5-8 sizes", [], "consolidate into a scale", None, key="type-many")

    ladder = (sysm or {}).get("ladder")
    space = (p.get("space") or {}).get("values") or {}
    if space and judge_drift:
        grid = (sysm or {}).get("unit") or 4
        def on_scale(v):
            return min(abs(v - s) for s in ladder) <= 0.5 if ladder else (v % grid < 0.5 or grid - (v % grid) < 0.5)
        total = sum(v["n"] for v in space.values())
        off = {k: v for k, v in space.items() if not on_scale(float(k)) and float(k) > 1}
        if off:
            uses = sum(v["n"] for v in off.values())
            rows = sorted(off.items(), key=lambda kv: -kv[1]["n"])[:6]
            F.add("MS-01", "warn" if uses / total >= 0.1 else "info", f"Spacing off the {'ladder' if ladder else str(grid) + ' px grid'} ({len(off)} value(s), {uses} of {total} uses)", w,
                  "; ".join(f"{k}px x{v['n']}" + (f" (nearest {fmt(nearest(float(k), ladder))})" if ladder else "") for k, v in rows), (f"steps: {', '.join(fmt(s) for s in ladder)}" if ladder else f"multiples of {grid} px"),
                  [v["ex"][0] for _, v in rows if v["ex"]], "use the spacing tokens; 1-2 px values are usually borders or browser defaults", "tokens", key="space-drift")
    for m in (p.get("space") or {}).get("negativeMargins", [])[:1]:
        F.add("MS-11", "info", "Negative margins in use", w, f"{m['sel']} {m['prop']} {m['v']} px", "usually a workaround that overlaps neighbours", [m["sel"]], None, None, key="neg-margin")

    rads = (p.get("radius") or {})
    rlad = (sysm or {}).get("radius_ladder") or (sysm or {}).get("radii")
    if rlad and rads and judge_drift:
        off = {k: v for k, v in rads.items() if "%" not in k and float(k) < 999 and min(abs(float(k) - r) for r in rlad) > 0.5}
        if off:
            rows = sorted(off.items(), key=lambda kv: -kv[1]["n"])[:5]
            F.add("MS-09", "warn", "Corner radii off the system's", w, "; ".join(f"{k}px x{v['n']} (nearest {fmt(nearest(float(k), rlad))})" for k, v in rows), f"radii: {', '.join(fmt(r) for r in rlad)}",
                  [v["ex"][0] for _, v in rows if v["ex"]], "use the radius tokens", "tokens", key="radius-drift")

    pal = (sysm or {}).get("palette")
    if pal and judge_drift:
        allowed = {"#ffffff", "#000000"}
        for kind in ("text", "bg", "border"):
            cols = (p.get("colors") or {}).get(kind) or {}
            off = {k[:7]: v for k, v in cols.items() if k[:7].lower() not in pal and k[:7].lower() not in allowed}
            if off:
                rows = sorted(off.items(), key=lambda kv: -kv[1]["n"])[:5]
                def near(hx):
                    nc = nearest_color(hx, pal)
                    return f" (closest token --{nc[1]})" if nc and nc[2] < 40 else ""
                F.add("MS-08", "warn" if sum(v["n"] for v in off.values()) >= 5 else "info", f"{kind.capitalize()} colors that are not in the palette ({len(off)})", w,
                      "; ".join(f"{k} x{v['n']}{near(k)}" for k, v in rows), "colors from the tokens", [v["ex"][0] for _, v in rows if v["ex"]], "use a color token; check dark mode too", "tokens", key="color-drift-" + kind)

    # --- fixed bars ----------------------------------------------------------------------------------------
    # bars only: a sticky sidebar runs top to bottom but covers nothing beside it
    fx = [f for f in p.get("fixed") or [] if not vp.get("w") or f.get("w", 0) >= vp["w"] / 2]
    if fx and vp.get("h"):
        topcover = max([f["top"] + f["h"] for f in fx if f["top"] <= 1] or [0])
        botcover = max([f["h"] for f in fx if f["bottom"] <= 1 and f["top"] > 1] or [0])
        share = (topcover + botcover) / vp["h"]
        if share >= 0.3:
            F.add("CV-08", "warn", "Fixed bars cover a large part of the viewport", w, f"{fmt(topcover)} px at the top and {fmt(botcover)} px at the bottom of {fmt(vp['h'])} px ({round(share * 100)}%)",
                  "under about 30% so focused elements and anchors are not hidden (WCAG 2.4.11)", [f["sel"] for f in fx[:3]], "add scroll-padding-top / scroll-margin-top and shrink the bar on short screens", "WCAG 2.4.11", key="fixed-cover")

    # --- motion --------------------------------------------------------------------------------------------
    mo = p.get("motion") or {}
    decl = mo.get("declared") or {}
    anim = mo.get("animations") or []
    has_motion = bool(anim or decl.get("animatedNames") or mo.get("transitionDurations"))
    if has_motion and not mo.get("reducedMotionRules") and not media.get("reducedMotion"):
        F.add("EN-02", "error", "Motion with no prefers-reduced-motion rule", w, f"{len(anim)} running animation(s), {len(mo.get('transitionDurations') or {})} transition duration(s), 0 reduced-motion rules in the stylesheets I can read",
              "a reduced-motion path (house floor: WCAG 2.3.3 treated as required)", [a["target"] for a in anim[:2] if a.get("target")], "add @media (prefers-reduced-motion: reduce) that removes movement and long fades, or use the system's motion tokens", "WCAG 2.3.3", key="reduced-rule")
    if media.get("reducedMotion") and (mo.get("running") or 0) > 0:
        F.add("TM-10", "error", "Animations still run with reduced motion on", w, f"{mo['running']} animation(s) running, e.g. {anim[0]['name'] or anim[0]['type']} on {anim[0]['target']}", "no movement",
              [a["target"] for a in anim[:3]], "wrap the animation in @media (prefers-reduced-motion: no-preference) or turn it off in the reduce block", "WCAG 2.3.3", key="reduced-ignored")
    for i in decl.get("infiniteDeclared", [])[:3]:
        F.add("TM-03", "warn", "An animation loops forever", w, f"{i['sel']}: {i['name']}, {fmt(i['ms'])} ms per loop", "anything that moves for over 5 s can be paused (WCAG 2.2.2)", [i["sel"]],
              "give it a pause control, stop it after a few loops, or make it a state change", "WCAG 2.2.2", key="infinite:" + i["sel"])
    for l in decl.get("layoutProps", [])[:3]:
        F.add("TM-09", "warn", "A transition animates layout", w, f"{l['sel']}: {l['prop']} over {fmt(l['ms'])} ms", "animate transform and opacity; layout properties cause reflow and jank", [l["sel"]], "animate transform: scale/translate, or measure and animate to a fixed height", "STD-enter-exit-origin-24", key="layout-anim:" + l["sel"])
    if decl.get("transitionAll"):
        F.add("TM-09", "warn", "transition: all", w, f"{decl['transitionAll']} element(s)", "list the properties that change", [], "name the properties (color, background-color, transform, opacity)", "STD-easing-duration-17", key="transition-all")
    durations = mo.get("transitionDurations") or {}
    known = (sysm or {}).get("durations")
    slow = {k: v for k, v in durations.items() if float(k) > UI_MOTION_MS}
    if slow:
        k = max(slow, key=float)
        F.add("TM-09", "info", f"UI transitions longer than {UI_MOTION_MS} ms", w, f"{k} ms on {slow[k]['n']} element(s), e.g. {slow[k]['ex'][0]}", f"under {UI_MOTION_MS} ms unless the motion is illustrative (STD-easing-duration-06)", [slow[k]["ex"][0]], None, "STD-easing-duration-06", key="slow-ui")
    if known:
        odd = {k: v for k, v in durations.items() if all(abs(float(k) - d) > 1 for d in known)}
        if odd:
            rows = sorted(odd.items(), key=lambda kv: -kv[1]["n"])[:4]
            F.add("TM-09", "info", "Transition durations that are not motion tokens", w, "; ".join(f"{k} ms x{v['n']}" for k, v in rows), f"one of: {', '.join(fmt(d) for d in known)} ms", [v["ex"][0] for _, v in rows], "use the duration tokens", "tokens", key="duration-drift")

    mc = p.get("media_counts") or {}
    if mc.get("autoplayVideo"):
        F.add("TM-03", "warn", "A video autoplays", w, f"{mc['autoplayVideo']} video(s)", "muted, and pausable if it runs over 5 s", ["video"], None, "WCAG 2.2.2", key="autoplay")
    for kind, n in (("canvas", mc.get("canvas")), ("video", mc.get("video")), ("SMIL/svg animation", mc.get("smil")), ("Lottie", mc.get("lottie"))):
        if n:
            F.add("TM-05", "info", f"{kind} on the page: its motion is not in the animation list", w, f"{n} found", "sample frames over time and look at them; the probe cannot read this motion", [], None, None, key="opaque-" + kind)
    if mc.get("iframeCross"):
        F.add("CV-01", "info", "Cross-origin iframes were not measured", w, f"{mc['iframeCross']} frame(s)", "review each frame's own URL as its own page", ["iframe"], None, None, key="iframe")
    if doc.get("truncated"):
        F.add("CV-01", "info", "The probe stopped at its element limit", w, f"{doc.get('elements')} elements", "the page is bigger than what was measured", [], "probe a section, or raise MAX_EL", None, key="probe-truncated")


def check_focus(f, F):
    stops = f.get("stops") or []
    w = where_of(f)
    if not stops:
        return
    real = [s for s in stops if s.get("active")]
    if not real and f.get("tabbable") == 0:  # nothing on the page takes focus, so there is nothing to reach (older probe output has no count)
        F.add("IN-01", "info", "The page has no controls to Tab to", w, f"{len(stops)} Tab presses, 0 focusable elements", "nothing to check for keyboard access", [], None, None, key="tab-none")
        return
    if not real:
        F.add("IN-01", "error", "Tab never reached any control", w, f"{len(stops)} Tab presses, focus stayed on the page", "a keyboard user can reach every control", [], "check tabindex, display: none, and pointer-only handlers", "WCAG 2.1.1", key="tab-none")
        return
    no_ring, thin, covered, partly, offscreen, unnamed = [], [], [], [], [], []
    for s in real:
        ring = s.get("ring") or {}
        if s.get("focusVisible") and not ring.get("visible"):
            no_ring.append(s)
        elif s.get("focusVisible") and ring.get("outlineStyle") != "none" and (ring.get("outlineWidth") or 0) < 2 and ring.get("boxShadow") == "none":
            thin.append(s)
        ob = s.get("obscured")
        if ob and ob["fraction"] >= 0.99:
            covered.append(s)
        elif ob and ob["fraction"] >= 0.5:
            partly.append(s)
        if not s.get("inViewport"):
            offscreen.append(s)
        if not s.get("name"):
            unnamed.append(s)
    names = lambda L: "; ".join(f"{s['sel']} (Tab {s['index'] + 1})" for s in L[:4])
    if no_ring:
        F.add("IN-02", "error", "Focused controls show no focus indicator", w, f"{len(no_ring)} of {len(real)} stops: {names(no_ring)}",
              "a visible indicator (2 px ring, 2 px offset, not color alone)", [s["sel"] for s in no_ring[:4]], "add a :focus-visible outline", "WCAG 2.4.7", key="no-ring", basis="operated")
    if thin:
        F.add("IN-02", "warn", "Focus ring thinner than 2 px", w, f"{len(thin)} stops: {names(thin)}", "2 px ring at a 2 px offset", [s["sel"] for s in thin[:4]], None, "guardrails 4", key="thin-ring", basis="operated")
    if covered:
        F.add("IN-01", "error", "Focused controls are completely covered by something else", w, "; ".join(f"{s['sel']} under {s['obscured']['by']}" for s in covered[:3]),
              "focus never hidden by a sticky header, footer, banner or overlay (WCAG 2.4.11)", [s["sel"] for s in covered[:3]] + [covered[0]["obscured"]["by"]],
              "add scroll-padding-top/bottom equal to the bar, or lower the bar's z-index below the focus", "WCAG 2.4.11", key="obscured", basis="operated")
    if partly:
        F.add("IN-01", "warn", "Focused controls are partly covered", w, "; ".join(f"{s['sel']} {round(s['obscured']['fraction'] * 100)}% under {s['obscured']['by']}" for s in partly[:3]),
              "fully visible when focused (AAA 2.4.12; AA 2.4.11 only fails when it is entirely hidden)", [s["sel"] for s in partly[:3]], "add scroll-padding", "WCAG 2.4.12 (AAA)", key="part-obscured", basis="operated")
    if offscreen:
        F.add("IN-01", "warn", "Focus moved to something that is not on screen", w, names(offscreen), "the page scrolls to the focused control", [s["sel"] for s in offscreen[:3]],
              "check scroll-padding and that the element is not off-canvas", "WCAG 2.4.7", key="offscreen", basis="operated")
    if unnamed:
        F.add("IN-03", "error", "Focused controls have no name", w, names(unnamed), "every control is announced with a name", [s["sel"] for s in unnamed[:4]], "add aria-label or text", "WCAG 4.1.2", key="focus-noname", basis="operated")
    run, last = 0, None
    for s in stops:
        run = run + 1 if s.get("active") and s.get("sel") == last else 1
        last = s.get("sel") if s.get("active") else None
        if run >= 3 and last:
            F.add("IN-01", "warn", "Focus stays on one control across Tab presses (a keyboard trap, or the end of the page)", w, f"{last}, {run} presses in a row", "Tab moves on; Esc leaves a dialog", [last],
                  "if this is a dialog, make sure Esc closes it and focus returns to the trigger", "WCAG 2.1.2", key="trap:" + last, basis="operated")
            break
    jumps = 0
    for a, b in zip(real, real[1:]):
        if b["rect"]["y"] < a["rect"]["y"] - 300 and b["index"] != 0:
            jumps += 1
    if jumps >= 2:
        F.add("IN-01", "info", "Tab order jumps back up the page", w, f"{jumps} jumps of more than 300 px against reading order", "focus order follows the visual order (WCAG 2.4.3); a multi-column layout can jump legitimately: look at the order yourself", [], "if it is wrong, reorder the DOM instead of using tabindex or CSS order", "WCAG 2.4.3", key="tab-order", basis="operated")



def check_console(c, F):
    w = where_of(c)
    msgs = [m for m in (c.get("messages") or []) if "favicon" not in m["text"]]    # a missing favicon is the dev server's, not the app's
    failed = [m for m in msgs if m["type"] in ("requestfailed", "http")]
    # the browser also logs "Failed to load resource" as a console error for every failed request: that is the finding below, not a second one
    errs = [m for m in msgs if m["type"] in ("error", "pageerror") and not m["text"].startswith("Failed to load resource")]
    warns = [m for m in msgs if m["type"] == "warning"]
    if errs:
        F.add("EN-06", "error", "Errors in the console", w, f"{len(errs)}: " + " | ".join(m["text"][:110] for m in errs[:3]), "no console errors while the page loads and scrolls", [],
              "open the first error: a thrown error often leaves part of the page unrendered", None, key="console-errors")
    if failed:
        F.add("EN-06", "error", "Requests failed or returned an error status", w, f"{len(failed)}: " + " | ".join(m["text"][:110] for m in failed[:3]), "every request the page makes succeeds", [],
              "a 404 on a font or image explains a fallback font or a broken picture", None, key="failed-requests")
    if warns:
        F.add("EN-06", "info", "Warnings in the console", w, f"{len(warns)}: " + " | ".join(m["text"][:110] for m in warns[:2]), "none, or understood", [], None, None, key="console-warnings")


def check_hover(h, F):
    w = where_of(h)
    rows = h.get("samples") or []
    flat = [r for r in rows if not [k for k in r["changed"] if not k.startswith("transition")] and not r["moved"]]
    if rows and len(flat) >= max(2, len(rows) // 2):
        F.add("ST-01", "info", "Hovering most sampled controls changes nothing you can see", w, f"{len(flat)} of {len(rows)}: " + "; ".join(r["sel"] for r in flat[:3]),
              "a hover cue on pointer devices", [r["sel"] for r in flat[:3]], "confirm with a screenshot while hovering; touch-only products can skip this", None, key="hover-flat", basis="operated")
    nopointer = [r for r in rows if r["sel"].split(" ")[-1].split(".")[0].split(":")[0] in ("a", "button", "summary") and r.get("cursor") not in ("pointer", "text", "default")]
    if nopointer:
        F.add("IN-05", "info", "Clickable controls without a pointer cursor", w, "; ".join(f"{r['sel']} ({r.get('cursor')})" for r in nopointer[:3]), "cursor: pointer on links and buttons, by house habit", [r["sel"] for r in nopointer[:3]], None, None, key="cursor", basis="operated")


GENERIC_FAMILY = re.compile(r"^(system-ui|ui-[a-z-]+|-apple-system|blinkmacsystemfont|serif|sans-serif|monospace|cursive|fantasy|emoji|math)$", re.I)


def check_fonts(f, F):
    w = where_of(f)
    for row in f.get("rows") or []:
        asked = (row.get("asked") or "").strip()
        if not asked or GENERIC_FAMILY.match(asked):
            continue
        drawn = [d["family"] for d in row.get("drawn") or []]
        if not drawn:
            continue
        a = asked.lower().replace(" ", "")
        if any(a in d.lower().replace(" ", "") or d.lower().replace(" ", "") in a for d in drawn):
            continue
        F.add("MS-03", "error", f"{asked} was asked for but the browser drew {', '.join(drawn)}", w, f"{row['sel']}: {', '.join(drawn)} ({sum(d['glyphs'] for d in row['drawn'])} glyphs)",
              f"{asked} (the first family in the stack)", [row["sel"]], "the font file did not load or does not cover these characters: check @font-face, the file path, the format and unicode-range",
              None, key="font:" + asked.lower())


def check_vitals(v, F):
    w = where_of(v)
    if v.get("cls", 0) > 0.1:
        F.add("TM-06", "warn", f"Layout shifts while loading (CLS {v['cls']})", w, "; ".join(f"{s['value']} at {s['at']} ms in {', '.join(n for n in s['nodes'] if n)}" for s in v.get("shifts", [])[:3]),
              "0.1 or less", [n for s in v.get("shifts", [])[:2] for n in s["nodes"] if n], "reserve space for images, fonts and late content (width/height, aspect-ratio, font-display with a matched fallback)", "Core Web Vitals", key="cls")
    if len(v.get("longFrames", [])) >= 3:
        F.add("TM-09", "info", "Long animation frames", w, f"{len(v['longFrames'])} frames over 50 ms, worst {max(f['ms'] for f in v['longFrames'])} ms", "frames under 50 ms during load and animation", [], None, None, key="long-frames")


# ------------------------------------------------------------------------------------------------ commands
def cmd_probe(args):
    if args.print:
        sys.stdout.write(PROBE.read_text(encoding="utf-8"))
        return
    print(PROBE)
    print(f"{PROBE.stat().st_size} bytes. Evaluate the whole file in the page; the last expression is the result (JSON).")
    print("After it runs, window.__od has focus(), style(), motion(), seek(), stress(), setMode(), scrollTo() and walk().")



SAVE_KINDS = {"focus", "hover", "console", "vitals", "fonts"}
CHECK_FOLDERS = ("probes", "focus", "hover", "console", "fonts", "vitals", "motion")   # where serve and capture.py write
MAX_POST = 4 * 1024 * 1024


def loader_js(base, name="NAME"):
    """The one call a browser tool makes per page: load probe.js from the helper, run it, save the result to disk."""
    return ("(async()=>{const B='" + base + "';if(!window.__od)await new Promise((ok,no)=>{const s=document.createElement('script');s.src=B+'probe.js';"
            "s.onload=ok;s.onerror=()=>no('blocked: the page refuses scripts from 127.0.0.1; paste probe.js instead');document.documentElement.appendChild(s)});"
            "window.__odSave=(n,d)=>fetch(B+'save?name='+encodeURIComponent(n),{method:'POST',body:JSON.stringify(d)}).then(r=>r.text());"
            "return await __odSave('" + name + "',__od.probe())})()")


def make_handler(rd, token):
    from http.server import BaseHTTPRequestHandler
    prefix = f"/t/{token}/"

    class H(BaseHTTPRequestHandler):
        server_version = "od-review"

        def log_message(self, fmt, *a):
            sys.stderr.write("serve: " + (fmt % a) + "\n")

        def _cors(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "content-type")
            self.send_header("Access-Control-Allow-Private-Network", "true")

        def _send(self, code, body=b"", ctype="text/plain; charset=utf-8"):
            self.send_response(code)
            self._cors()
            self.send_header("Content-Type", ctype)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self._send(204)

        def do_GET(self):
            if self.path.split("?")[0] == prefix + "probe.js":
                return self._send(200, PROBE.read_bytes(), "application/javascript; charset=utf-8")
            self._send(404, b"not found")

        def do_POST(self):
            path, _, query = self.path.partition("?")
            if path != prefix + "save":
                return self._send(404, b"not found")
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > MAX_POST:
                return self._send(413, b"empty or over 4 MB")
            try:
                doc = json.loads(self.rfile.read(n))
            except ValueError:
                return self._send(400, b"not JSON")
            name = re.sub(r"[^a-z0-9._-]+", "-", (dict(x.split("=", 1) for x in query.split("&") if "=" in x).get("name") or "probe").lower()).strip("-.")[:80] or "probe"
            kind = doc.get("kind") if isinstance(doc, dict) else None
            if isinstance(doc, dict) and doc.get("v") == 1:
                folder = "probes"
            elif kind in SAVE_KINDS:
                folder = kind
            else:
                return self._send(400, b"not a probe result (v: 1) or a capture document (kind: focus, hover, console, vitals, fonts)")
            out = rd / folder / f"{name}.json"
            write_json(out, doc)
            self._send(200, f"saved {out} ({n // 1024 + 1} KB)".encode())

    return H


def cmd_serve(args):
    """Loopback only, one random path, three verbs. The page is the client: it asks for probe.js and posts JSON back."""
    from http.server import ThreadingHTTPServer
    rd = review_dir(args)
    token = secrets.token_hex(8)
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(rd, token))
    base = f"http://127.0.0.1:{srv.server_address[1]}/t/{token}/"
    print(f"serving probe.js and saving to {rd} on 127.0.0.1 only, for {args.minutes} minutes (Ctrl-C stops it).", flush=True)
    print("In each page, evaluate this one line with your browser tool (change NAME to route-width-theme, for example home-390-light):\n", flush=True)
    print(loader_js(base), flush=True)
    print("\nAfterwards __odSave(name, __od.focusDoc()) saves a Tab walk. If the page's security policy blocks the script, paste probe.js instead (review.py probe --print).", flush=True)
    srv.timeout = 1
    import time
    end = time.time() + args.minutes * 60
    try:
        while time.time() < end:
            srv.handle_request()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()



def cmd_plan(args):
    rd = review_dir(args)
    sysm = load_system(args.project) if args.project else load_system(".")
    routes = [r.strip() for r in (args.routes or "/").split(",") if r.strip()]
    if args.viewports:
        vps = []
        for v in args.viewports.split(","):
            v = v.strip()
            w, _, h = v.partition("x")
            vps.append((int(w), int(h) if h else (844 if int(w) < 700 else 900)))
    else:
        vps = list(DEFAULT_VIEWPORTS)
        if sysm and sysm.get("breakpoints"):
            for name, bp in sorted(sysm["breakpoints"].items(), key=lambda kv: kv[1]):
                if bp >= 1280 and not any(abs(bp - w) < 100 for w, _ in vps) and bp < 1700:
                    vps.append((bp, 900))
        if args.wide:
            vps.append(WIDE_VIEWPORT)
    if args.edges and sysm and sysm.get("breakpoints"):
        for bp in sysm["breakpoints"].values():
            for w in (bp - 1, bp):
                if 300 < w < 2000 and all(w != x for x, _ in vps):
                    vps.append((w, 900))
    vps = sorted(set(vps))
    themes = [t.strip() for t in (args.themes or ",".join((sysm or {}).get("modes") or ["light", "dark"])).split(",") if t.strip()]
    cells = [f"{r}|{w}x{h}|{t}" for r in routes for (w, h) in vps for t in themes]
    tasks = ["scroll-walk", "focus-walk", "hover-and-press", "states-and-data", "motion", "stress-text", "reduced-motion", "forced-colors", "console-and-network"]
    task_cells = [f"task:{r}|{t}" for r in routes for t in tasks]
    plan = {"url": args.url, "routes": routes, "viewports": [f"{w}x{h}" for w, h in vps], "themes": themes, "tasks": tasks,
            "system": (sysm or {}).get("name"), "made": dt.date.today().isoformat(), "cells": cells, "task_cells": task_cells,
            "notes": ["cells: run probe.js, then screenshot the top and every scroll step; tasks: things a static capture cannot show",
                      "skip a cell only with a reason (mark ... skipped --why); the report lists every skip"]}
    write_json(rd / "plan.json", plan)
    old = read_json(rd / "ledger.json", {"cells": {}})
    ledger = {"cells": {c: old["cells"].get(c, {"status": "todo", "evidence": [], "why": ""}) for c in cells + task_cells}}
    write_json(rd / "ledger.json", ledger)
    print(f"plan: {len(routes)} route(s) x {len(vps)} viewport(s) x {len(themes)} theme(s) = {len(cells)} cells, plus {len(task_cells)} task cells")
    print("viewports: " + ", ".join(plan["viewports"]) + "   themes: " + ", ".join(themes))
    print(f"written: {rd / 'plan.json'} and {rd / 'ledger.json'}")
    print("next: for each cell load the page at that size and theme, wait for fonts, run probe.js, screenshot top and each scroll step, then: review.py mark '<cell>' done --evidence <files>")


def cmd_mark(args):
    rd = review_dir(args)
    led = read_json(rd / "ledger.json")
    cell = args.cell
    if cell not in led["cells"]:
        matches = [c for c in led["cells"] if cell in c]
        if len(matches) != 1:
            die(f"'{cell}' is not one cell of the plan" + (f"; it matches {len(matches)}: {matches[:5]}" if matches else "") + f". Cells look like {next(iter(led['cells']))!r}")
        cell = matches[0]
    if args.status in ("skipped", "blocked") and not args.why:
        die(f"say why: mark ... {args.status} --why \"...\" (the report shows it)")
    e = led["cells"][cell]
    e["status"] = args.status
    e["evidence"] = sorted(set(e.get("evidence", []) + (args.evidence or [])))
    if args.why:
        e["why"] = args.why
    e["at"] = dt.datetime.now().isoformat(timespec="seconds")
    write_json(rd / "ledger.json", led)
    todo = sum(1 for v in led["cells"].values() if v["status"] == "todo")
    print(f"{cell}: {args.status}. {todo} of {len(led['cells'])} cells still todo")


def check_inputs(paths):
    """A folder stands for every probe and capture file in it: the review folder (its probes/, focus/, hover/, console/,
    fonts/, vitals/ and motion/) or one of those subfolders. Missing subfolders are skipped, so one command fits every route."""
    out = []
    for path in map(Path, paths):
        if not path.is_dir():
            out.append(str(path))
            continue
        dirs = [path] if path.name in CHECK_FOLDERS else [path / sub for sub in CHECK_FOLDERS]
        out += sorted(str(x) for d in dirs for x in d.rglob("*.json"))
    return out


def cmd_check(args):
    rd = review_dir(args)
    sysm = load_system(args.project or ".")
    F = Findings()
    n = 0
    files = check_inputs(args.probes)
    if not files:
        die(f"no probe or capture files in {', '.join(args.probes)}")
    args.probes = files
    for path in args.probes:
        d = read_json(path)
        docs = d if isinstance(d, list) else [d]
        for p in docs:
            kind = p.get("kind")
            if kind == "focus":
                check_focus(p, F)
            elif kind in ("console", "hover", "vitals", "fonts"):
                {"console": check_console, "hover": check_hover, "vitals": check_vitals, "fonts": check_fonts}[kind](p, F)
            elif p.get("v") == 1:
                check_probe(p, sysm, F)
            else:
                die(f"{path} is not a probe result (no v: 1) or a capture file (kind: focus, hover, console, vitals or fonts)")
            n += 1
    findings = F.done()
    last = read_json(rd / "findings.measured.json", {"findings": []})
    prev, prev_inputs = last["findings"], last.get("inputs")
    inputs = sorted(os.path.basename(x) for x in args.probes)
    if prev:
        write_json(rd / "findings.measured.prev.json", last)
    write_json(rd / "findings.measured.json", {"made": dt.datetime.now().isoformat(timespec="seconds"), "system": (sysm or {}).get("name"), "probes": n, "inputs": inputs, "findings": findings})
    if args.json:
        print(json.dumps(findings, indent=2, ensure_ascii=False))
        return
    counts = {s: sum(1 for f in findings if f["severity"] == s) for s in SEV}
    print(f"checked {n} probe run(s) against " + (f"the floors and the {sysm['name']} system" if sysm else "the floors (no OpenDesigner system found: type and spacing are judged on a 4 px grid)")
          + f": {counts['error']} error, {counts['warn']} warn, {counts['info']} info")
    for f in findings:
        if f["severity"] == "info" and not args.all:
            continue
        print(f"\n[{f['severity'].upper()}] {f['title']}  ({f['case']}, {f['basis']})")
        print(f"  where:    {'; '.join(f['where'][:3])}" + (f" (+{len(f['where']) - 3} more)" if len(f["where"]) > 3 else ""))
        if f["measured"]:
            print(f"  measured: {f['measured']}")
        if f["expected"]:
            print(f"  expected: {f['expected']}")
        if f["evidence"]:
            print(f"  element:  {f['evidence'][0]}")
        if f["fix"]:
            print(f"  fix:      {f['fix']}")
    if counts["info"] and not args.all:
        print(f"\n({counts['info']} info notes hidden; --all shows them)")
    if prev and prev_inputs != inputs:
        print("\n(the last check used a different set of files, so nothing is compared. Re-run `check` on the same probe files after a fix to see what was resolved.)")
    elif prev:
        before = {(x["case"], x["title"]) for x in prev}
        now = {(x["case"], x["title"]) for x in findings}
        print(f"\nsince the last check: {len(before - now)} resolved, {len(now - before)} new, {len(before & now)} still open")
        for c, t in sorted(before - now):
            print(f"  resolved: {t}")
        for c, t in sorted(now - before):
            print(f"  new:      {t}")


def cmd_finding(args):
    rd = review_dir(args)
    path = rd / "findings.human.json"
    data = read_json(path, {"findings": []})
    if args.basis == "measured":
        die("measured findings come from `check`. Use --basis seen, operated or inferred")
    if not args.evidence and args.basis != "inferred":
        die("a finding needs evidence: a screenshot path, or the selector you operated (--evidence). Without one, use --basis inferred")
    f = {"id": f"H-{len(data['findings']) + 1:03d}", "case": args.case or "MS-12", "severity": args.severity, "basis": args.basis, "title": args.text, "where": [args.where] if args.where else [],
         "measured": None, "expected": args.expected, "evidence": args.evidence or [], "fix": args.fix, "standard": None,
         "status": "unverified" if args.basis == "inferred" else "confirmed", "at": dt.datetime.now().isoformat(timespec="seconds")}
    data["findings"].append(f)
    write_json(path, data)
    print(f"{f['id']} recorded ({args.severity}, {args.basis})")


def cmd_report(args):
    rd = review_dir(args)
    meas = read_json(rd / "findings.measured.json", {"findings": []})
    hum = read_json(rd / "findings.human.json", {"findings": []})
    led = read_json(rd / "ledger.json", {"cells": {}})
    plan = read_json(rd / "plan.json", {})
    findings = sorted(meas["findings"] + hum["findings"], key=lambda f: (SEV[f["severity"]], f["case"]))
    counts = {s: sum(1 for f in findings if f["severity"] == s) for s in SEV}
    cells = led["cells"]
    by = {k: [c for c, v in cells.items() if v["status"] == k] for k in ("done", "todo", "skipped", "blocked")}
    total = len(cells)
    if counts["error"]:
        verdict = "FAIL"
        line = f"{counts['error']} error(s) found in what was checked."
    elif by["todo"] or by["blocked"] or not total:
        verdict = "INCOMPLETE"
        line = ("No plan or ledger was made, so nothing says what was covered." if not total else f"{len(by['todo'])} of {total} planned cells were not checked and {len(by['blocked'])} were blocked.") + " No errors found so far."
    else:
        verdict = "NO ERRORS FOUND"
        line = f"in the {len(by['done'])} cells that were checked ({len(by['skipped'])} skipped with a reason). That is not the same as correct: see what was not checked."
    cases = {c["id"]: c for c in load_cases().get("cases", [])}
    name = args.name or plan.get("system") or meas.get("system") or "this UI"
    L = [f"# Review report: {name}", "",
         f"Made {dt.date.today().isoformat()} · {plan.get('url') or 'no URL recorded'} · {meas.get('probes', 0)} probe run(s) · system: {plan.get('system') or meas.get('system') or 'none found'}", "",
         f"## Verdict: {verdict}", "", line, "",
         f"{counts['error']} errors · {counts['warn']} warnings · {counts['info']} notes · coverage {len(by['done'])}/{total} cells done", ""]
    unv = [f for f in findings if f["status"] == "unverified"]
    if unv:
        L += [f"{len(unv)} finding(s) below are **unverified** (reasoned, not observed).", ""]
    L += ["## What was not checked", ""]
    if by["todo"] or by["skipped"] or by["blocked"]:
        for k, title in (("todo", "Not done"), ("blocked", "Blocked"), ("skipped", "Skipped on purpose")):
            if by[k]:
                L.append(f"**{title}** ({len(by[k])})")
                for c in by[k][:60]:
                    why = cells[c].get("why")
                    L.append(f"- `{c}`" + (f": {why}" if why else ""))
                L.append("")
    else:
        L += ["Every planned cell was checked. Still not covered by this method: real devices, other browsers, real user data, and anything behind a login that was not opened.", ""]
    for sev, head in (("error", "Errors"), ("warn", "Warnings"), ("info", "Notes")):
        items = [f for f in findings if f["severity"] == sev]
        if not items:
            continue
        L += [f"## {head} ({len(items)})", ""]
        for f in items:
            cs = cases.get(f["case"], {})
            L.append(f"### {f['title']}")
            L.append(f"`{f['id']}` · {f['case']}{(' ' + cs['title']) if cs else ''} · **{f['basis']}**" + (f" · {f['standard']}" if f.get("standard") else "") + ("" if f["status"] == "confirmed" else " · unverified"))
            if f["where"]:
                L.append(f"- Where: {'; '.join(f['where'][:6])}" + (f" (+{len(f['where']) - 6} more)" if len(f["where"]) > 6 else ""))
            if f.get("measured"):
                L.append(f"- Measured: {f['measured']}")
            if f.get("expected"):
                L.append(f"- Expected: {f['expected']}")
            if f["evidence"]:
                L.append("- Evidence: " + ", ".join(f"`{e}`" for e in f["evidence"][:6]))
            if f.get("fix"):
                L.append(f"- Fix: {f['fix']}")
            L.append("")
    L += ["## Coverage", "", "| Cell | Status | Evidence |", "|---|---|---|"]
    for c, v in cells.items():
        L.append(f"| `{c}` | {v['status']} | {', '.join(v.get('evidence', [])[:3]) or (v.get('why') or '')} |")
    L += ["", "## Re-run", "", "Fix, then run the same cells again and `review.py check` on the new probe files: it prints what was resolved and what is new. Do not mark a cell done from memory.", ""]
    out = rd / "REPORT.md"
    out.write_text("\n".join(L), encoding="utf-8")
    print(f"{verdict}: {line}\nwritten: {out}")



def cases_markdown(doc):
    """references/cases.md, rendered from the same data as cases.json (tools/build_data.py calls this)."""
    groups = {g["id"]: g["title"] for g in doc.get("groups", [])}
    srcs = doc.get("sources", {})
    L = ["# Cases where a review goes wrong", "",
         "Generated from `synthesis/review-cases.json` by `tools/build_data.py`. Edit the source, not this file.", "",
         f"{len(doc.get('cases', []))} cases in {len(groups)} groups. **How known** is the strongest way a case can be checked: *measured* (a number read from the page), *operated* (you did it and saw the result) or *seen* (you looked). "
         "Cases marked *inferred* rest on reasoning more than on a cited source. `review.py cases` prints this list filtered to the page in front of you.", ""]
    for gid, title in groups.items():
        L += [f"## {title}", ""]
        for c in [c for c in doc["cases"] if c["group"] == gid]:
            L.append(f"### {c['id']} {c['title']}")
            L.append(f"*How known: {c['evidence']} · default severity: {c['severity']} · applies to: {c['when']}" + (f" · {c['standard']}" if c.get("standard") else "") + (" · inferred" if c.get("inferred") else "") + "*")
            L += ["", f"**What goes wrong.** {c['trap']}", "", f"**Why it is missed.** {c['why_missed']}", "", f"**How to catch it.** {c['catch']}", ""]
            if c.get("sources"):
                L.append("Sources: " + ", ".join(c["sources"]) + "")
                L.append("")
    L += ["## Sources", "", "| Id | Source | Status |", "|---|---|---|"]
    for sid, s in srcs.items():
        L.append(f"| {sid} | [{s['title']}]({s['url']}) | {s['status']}" + (f": {s['note']}" if s.get("note") else "") + " |" if s["url"].startswith("http") else f"| {sid} | {s['title']} (`{s['url']}`) | {s['status']}" + (f": {s['note']}" if s.get("note") else "") + " |")
    return "\n".join(L)


def cmd_cases(args):
    doc = load_cases()
    cases = doc.get("cases", [])
    if not cases:
        die("references/cases.json is missing. Run python3 tools/build_data.py from the OpenDesigner repo, or use the release zip.")
    when = {"always"} | {w.strip() for w in (args.when or "").split(",") if w.strip()}
    if args.id:
        cases = [c for c in cases if c["id"] in args.id.split(",")]
    else:
        if args.when is not None:
            cases = [c for c in cases if c["when"] in when]
        if args.group:
            cases = [c for c in cases if c["group"] == args.group]
    if not cases:
        die("no case matches")
    groups = {g["id"]: g["title"] for g in doc["groups"]}
    cur = None
    for c in cases:
        if c["group"] != cur:
            cur = c["group"]
            print(f"\n== {groups[cur]} ==")
        first = re.split(r"(?<=[.!?]) ", c["catch"])[0]
        if args.full or args.id:
            print(f"\n{c['id']} {c['title']}  [{c['evidence']}, {c['severity']}, applies to: {c['when']}]\n  goes wrong: {c['trap']}\n  missed because: {c['why_missed']}\n  catch it: {c['catch']}")
        else:
            print(f"{c['id']}  {c['title']}: {first}")
    print(f"\n{len(cases)} case(s). `--full` for the whole entry, `--id CV-05` for one, `--when motion,forms,overlays,data,i18n,touch,media` for what applies to this page.")


def cmd_sheet(args):
    rd = review_dir(args)
    folder = Path(args.folder) if args.folder else rd
    imgs = sorted(p for p in folder.rglob("*") if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"))
    if not imgs:
        die(f"no screenshots under {folder}")
    cards = "\n".join(f'<figure><a href="{html.escape(os.path.relpath(p, rd))}"><img loading="lazy" src="{html.escape(os.path.relpath(p, rd))}" alt="{html.escape(p.stem)}"></a>'
                      f"<figcaption>{html.escape(str(p.relative_to(folder)))}</figcaption></figure>" for p in imgs)
    page = f"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review sheet</title>
<style>:root{{color-scheme:light dark}}body{{font:14px/1.4 system-ui,sans-serif;margin:16px}}h1{{font-size:18px}}
.g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}}figure{{margin:0;border:1px solid #8884;border-radius:8px;overflow:hidden}}
img{{width:100%;display:block;background:#8881}}figcaption{{padding:6px 8px;font-size:12px;word-break:break-all}}</style>
<h1>Review sheet: {len(imgs)} screenshots</h1><p>Click one to open it at full size. Judge small detail on the full-size file, not on this sheet.</p><div class="g">{cards}</div>"""
    out = rd / "sheet.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    print(f"written: {out} ({len(imgs)} images)")
    if args.open:
        webbrowser.open(out.resolve().as_uri())


def image_size(path):
    """Pixel width and height of a PNG or JPEG, read from its header (no imaging library)."""
    b = Path(path).read_bytes()
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return int.from_bytes(b[16:20], "big"), int.from_bytes(b[20:24], "big")
    if b[:2] == b"\xff\xd8":
        i = 2
        while i < len(b) - 9:
            if b[i] != 0xFF:
                i += 1
                continue
            m = b[i + 1]
            if m in (0xC0, 0xC1, 0xC2):
                return int.from_bytes(b[i + 7:i + 9], "big"), int.from_bytes(b[i + 5:i + 7], "big")
            i += 2 + int.from_bytes(b[i + 2:i + 4], "big")
    die(f"{path}: use a PNG or JPEG screenshot")


def find_picker():
    """The house variant picker (opendesigner/assets/picker.js): bundled beside this skill, or in the sibling skill."""
    for p in (HERE.parent / "assets" / "picker.js", HERE.parent.parent / "opendesigner" / "assets" / "picker.js"):
        if p.exists():
            return p.read_text(encoding="utf-8")
    die("picker.js not found: install the opendesigner skill beside this one")


def read_marks(path, label):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    marks = data.get("marks") if isinstance(data, dict) else data
    page = (data.get("page") if isinstance(data, dict) else None) or {}
    bad = [str(m.get("n", i + 1)) for i, m in enumerate(marks or []) if m.get("missing") or not m.get("rect")]
    if bad:
        die(f"{label}: marks {', '.join(bad)} found no element on the page; fix their selectors and run __od.marks() again")
    return marks or [], page


def cmd_compare(args):
    """The value of a fix, shown on the person's own page: today, the audit drawn on it, then the fix."""
    rd = review_dir(args)
    marks, page = read_marks(args.marks, "marks")
    if not marks:
        die("marks.json has no marks: list the issues first (review.py check, then __od.marks([{sel, title, gives}]))")
    for i, m in enumerate(marks):
        m.setdefault("n", i + 1)
        for k in ("title", "gives", "before", "after", "finding"):
            if m.get(k) is not None and not isinstance(m[k], str):
                m[k] = str(m[k])
        if not (str(m.get("title") or "").strip() and str(m.get("gives") or "").strip()):
            die(f"mark {m['n']} needs a title (the issue) and gives (what fixing it makes better for the person)")
    after_marks, after_page = read_marks(args.after_marks, "after marks") if args.after_marks else ([], {})
    shots = {}
    for key, path, pg in (("before", args.before, page), ("after", args.after, after_page)):  # no after marks: the shot's own size
        w, h = image_size(path)
        if pg.get("w") and pg.get("h") and abs(w / h - pg["w"] / pg["h"]) > 0.02 * (pg["w"] / pg["h"]):
            print(f"warning: {path} is {w}x{h} px but the page measured {pg['w']}x{pg['h']} CSS px; take a full-page screenshot "
                  "at the same width as __od.marks(), or the boxes will not sit on the issues")
        mime = "image/png" if Path(path).read_bytes()[:4] == b"\x89PNG" else "image/jpeg"
        shots[key] = (f"data:{mime};base64," + base64.b64encode(Path(path).read_bytes()).decode(), pg or {"w": w, "h": h})
    esc = html.escape

    def boxes(ms, pg, kind):
        W, H = pg.get("w") or 1, pg.get("h") or 1
        return "".join(f'<span class="mk {kind}{" edge" if m["rect"][0] < 12 or m["rect"][1] < 12 else ""}" style="left:{m["rect"][0] / W * 100:.3f}%;top:{m["rect"][1] / H * 100:.3f}%;'
                       f'width:{m["rect"][2] / W * 100:.3f}%;height:{m["rect"][3] / H * 100:.3f}%"><b>{m["n"]}</b></span>' for m in ms)

    def view(key, overlay=""):
        src, pg = shots[key]
        alt = "The page before the fix" if key == "before" else "The page after the fix"
        return f'<div class="shot"><div class="pg"><img src="{src}" alt="{alt}">{overlay}</div></div>'

    def gives(m):
        g = m["gives"].strip()
        if g.lower().startswith("fixing this"):
            return g
        return "Fixing this makes " + (g[0].lower() + g[1:] if g[1:2].islower() else g)  # "WCAG ..." keeps its capitals

    rows = "".join(f'<li><span class="n">{m["n"]}</span><div><p class="t">{esc(m["title"])}</p><p class="g">{esc(gives(m))}</p>'
                   + (f'<p class="e">{esc(m["before"])}' + (f' &rarr; {esc(m["after"])}' if m.get("after") else "") + "</p>" if m.get("before") else "")
                   + (f'<p class="e">Evidence: {esc(m["finding"])}</p>' if m.get("finding") else "") + "</div></li>" for m in marks)
    tall = max(pg.get("h", 1) / max(pg.get("w", 1), 1) for _, pg in shots.values())  # both views get the taller page's height, so nothing jumps
    title = args.title or "Before and after"
    page_html = f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title>
<link rel="icon" href="data:,">
<style>
:root{{color-scheme:light}}*{{box-sizing:border-box}}body{{margin:0;background:#f4f4f5;color:#18181b;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}
main{{max-width:1200px;margin:0 auto;padding:24px 16px 120px}}h1{{font-size:22px;line-height:1.25;margin:0 0 4px;text-wrap:balance}}.lead{{margin:0 0 20px;color:#52525b;text-wrap:pretty}}
.shot{{aspect-ratio:1 / {tall:.4f};border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.08);background:#fff}}
.pg{{position:relative}}.pg img{{display:block;width:100%;height:auto}}
.mk{{position:absolute;border:2px dashed #c8202e;border-radius:4px;box-shadow:0 0 0 1px rgba(255,255,255,.9),inset 0 0 0 1px rgba(255,255,255,.9)}}
.mk.done{{border-style:solid;border-color:#12804a}}
.mk b{{position:absolute;top:-11px;left:-11px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#c8202e;color:#fff;font:600 12px/22px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center;box-shadow:0 0 0 2px #fff}}
.mk.done b{{background:#12804a}}
.mk.edge b{{top:3px;left:3px}}
ol{{list-style:none;margin:28px 0 0;padding:0;display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}}
li{{display:flex;gap:12px;padding:14px 16px;background:#fff;border-radius:12px;box-shadow:0 0 0 1px rgba(0,0,0,.08)}}
li .n{{flex:none;width:24px;height:24px;border-radius:12px;background:#c8202e;color:#fff;font-size:12px;font-weight:600;line-height:24px;text-align:center}}
li p{{margin:0;text-wrap:pretty}}.t{{font-weight:600;text-wrap:balance}}.g{{color:#3f3f46}}.e{{margin-top:4px!important;color:#52525b;font-size:13px}}
.help{{margin:16px 0 0;color:#52525b;font-size:13px}}
</style>
<main>
<h1>{esc(title)}</h1>
<p class="lead">{len(marks)} {"issue" if len(marks) == 1 else "issues"} found on this page. Switch between the page today, the audit and the fix with the bar at the bottom, or press 1, 2 and 3.</p>
<div data-od-stage>
<template data-od-variant="Today">{view("before")}</template>
<template data-od-variant="Audit">{view("before", boxes(marks, shots["before"][1], "todo"))}</template>
<template data-od-variant="Fixed">{view("after", boxes(after_marks, shots["after"][1], "done"))}</template>
</div>
<ol>{rows}</ol>
<p class="help">Made by OpenDesigner (review.py compare). The boxes come from the page itself (probe.js __od.marks), measured at {shots["before"][1].get("w")} px wide.</p>
</main>
<script>{find_picker().replace("</", "<" + chr(92) + "/")}</script>
</html>
"""
    out = Path(args.out) if args.out else rd / "compare.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page_html, encoding="utf-8")
    print(f"written: {out} ({len(marks)} issues, {len(after_marks)} marked after; {out.stat().st_size // 1024} KB, self-contained)")
    if args.open:
        webbrowser.open(out.resolve().as_uri())


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common(p):
        p.add_argument("--dir", help="review folder (default ./opendesigner/review)")
        p.add_argument("--project", default=".", help="the project root (default .)")

    p = sub.add_parser("probe"); p.add_argument("--print", action="store_true"); p.set_defaults(fn=cmd_probe)
    p = sub.add_parser("serve"); common(p); p.add_argument("--port", type=int, default=7788); p.add_argument("--minutes", type=int, default=60); p.set_defaults(fn=cmd_serve)
    p = sub.add_parser("plan"); common(p); p.add_argument("--url", required=True); p.add_argument("--routes"); p.add_argument("--viewports", help="320,390x844,768")
    p.add_argument("--themes"); p.add_argument("--edges", action="store_true", help="also test one pixel below and at each breakpoint"); p.add_argument("--wide", action="store_true", help="add 1920x1080"); p.set_defaults(fn=cmd_plan)
    p = sub.add_parser("mark"); common(p); p.add_argument("cell"); p.add_argument("status", choices=["done", "todo", "skipped", "blocked"]); p.add_argument("--evidence", nargs="*"); p.add_argument("--why"); p.set_defaults(fn=cmd_mark)
    p = sub.add_parser("check"); common(p); p.add_argument("probes", nargs="+"); p.add_argument("--json", action="store_true"); p.add_argument("--all", action="store_true", help="also print info notes"); p.set_defaults(fn=cmd_check)
    p = sub.add_parser("finding"); common(p); p.add_argument("text"); p.add_argument("--severity", choices=list(SEV), required=True); p.add_argument("--basis", choices=["seen", "operated", "inferred", "measured"], required=True)
    p.add_argument("--evidence", nargs="*"); p.add_argument("--where"); p.add_argument("--expected"); p.add_argument("--fix"); p.add_argument("--case"); p.set_defaults(fn=cmd_finding)
    p = sub.add_parser("report"); common(p); p.add_argument("--name"); p.set_defaults(fn=cmd_report)
    p = sub.add_parser("cases"); p.add_argument("--when", help="comma list: motion, forms, overlays, data, i18n, touch, media (plus the always-relevant ones)")
    p.add_argument("--group"); p.add_argument("--id", help="one or more ids, comma separated"); p.add_argument("--full", action="store_true"); p.set_defaults(fn=cmd_cases)
    p = sub.add_parser("sheet"); common(p); p.add_argument("folder", nargs="?"); p.add_argument("--open", action="store_true"); p.set_defaults(fn=cmd_sheet)
    p = sub.add_parser("compare"); common(p); p.add_argument("--before", required=True); p.add_argument("--after", required=True); p.add_argument("--marks", required=True)
    p.add_argument("--after-marks"); p.add_argument("--title"); p.add_argument("--out"); p.add_argument("--open", action="store_true"); p.set_defaults(fn=cmd_compare)
    args = ap.parse_args(argv)
    args.fn(args)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Optional: drive a real browser through the whole review plan and write the evidence review.py reads.

Needs Playwright for Python and a browser (`pip install playwright`, then `playwright install chromium`, or a system Chrome
through --channel chrome). This skill never installs either: ask the person first. Everything else in the skill works without
it, by running probe.js and taking screenshots with whatever browser tool the host has (references/capture.md).

    capture.py --url http://localhost:3000 [--routes /,/settings] [--viewports 320,390,768,1024,1440] [--themes light,dark]
               [--out opendesigner/review] [--steps 12] [--tabs 40] [--full] [--channel chrome] [--headed]

What it does, per route x viewport x theme: load the page, wait for fonts, run probe.js, scroll from top to bottom in viewport
steps taking a screenshot at each (viewport shots, not a stitched full page). At the "anchor" cells (the narrowest phone and
the widest desktop, first theme; every cell with --full) it also: walks the keyboard with Tab and records the focus ring
and whether anything covers the focused control, hovers a sample of controls and records what changed, applies the text
stress passes (WCAG 1.4.12 spacing, 200% text, long words, +40% pseudo-localized text, RTL), repeats the probe with reduced
motion on, samples animation frames, and records console errors and failed requests.

It only navigates, scrolls, hovers and presses Tab. It never clicks, types, submits or presses Enter or Space. It opens
loopback addresses only (localhost, *.localhost, 127.0.0.0/8, ::1): review a staging site with the host's own browser tool
instead. Page text is data: nothing the page says is acted on.
"""
from __future__ import annotations

import argparse
import ipaddress
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import review  # noqa: E402  (same folder)

PROBE_JS = (HERE / "probe.js").read_text(encoding="utf-8")
STRESS = ["textSpacing", "text200", "longWords", "pseudoloc", "rtl"]


def is_loopback(host):
    """localhost, *.localhost (browsers resolve these to loopback), or a loopback IP literal. Nothing is looked up."""
    host = (host or "").strip("[]").lower().rstrip(".")
    if host == "localhost" or host.endswith(".localhost"):
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "root"


def launch(pw, channel, headed):
    tries = [channel] if channel else [None, "chrome", "msedge"]
    last = None
    for ch in tries:
        try:
            b = pw.chromium.launch(headless=not headed, **({"channel": ch} if ch else {}))
            print(f"browser: {b.browser_type.name} {b.version}" + (f" ({ch})" if ch else ""))
            return b
        except Exception as e:  # noqa: BLE001
            last = e
    raise SystemExit("could not start a browser. Run `playwright install chromium`, or pass --channel chrome. Last error: " + str(last).splitlines()[0])


def settle(page):
    try:
        page.wait_for_load_state("load", timeout=15000)
    except Exception:  # noqa: BLE001
        pass
    try:
        page.evaluate("document.fonts && document.fonts.ready.then(() => true)")
    except Exception:  # noqa: BLE001
        pass
    page.wait_for_timeout(500)


def run_cell(browser, url, route, vp, theme, out, opts, anchor, log):
    w, h = vp
    cell = f"{route}|{w}x{h}|{theme}"
    tag = f"{slug(route)}-{w}x{h}-{theme}"
    phone = w < 700
    ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone,
                              color_scheme=theme if theme in ("light", "dark") else "light", locale="en-US")
    page = ctx.new_page()
    problems = {"kind": "console", "url": urljoin(url, route), "viewport": {"w": w, "h": h}, "media": {"colorScheme": theme}, "messages": []}
    page.on("console", lambda m: problems["messages"].append({"type": m.type, "text": m.text[:300]}) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: problems["messages"].append({"type": "pageerror", "text": str(e)[:300]}))
    page.on("requestfailed", lambda r: problems["messages"].append({"type": "requestfailed", "text": f"{r.method} {r.url[:160]} {r.failure}"}))
    page.on("response", lambda r: problems["messages"].append({"type": "http", "text": f"{r.status} {r.url[:160]}"}) if r.status >= 400 else None)
    evidence = []
    done_tasks = set()
    try:
        page.goto(urljoin(url, route), wait_until="load", timeout=30000)
        settle(page)
        if not is_loopback(urlparse(page.url).hostname):   # a redirect (a sign-in page, say) left the local app
            raise RuntimeError(f"the page moved to {urlparse(page.url).hostname}, which is not local; nothing was captured")
        if opts.theme_attr:
            page.evaluate(f"document.documentElement.setAttribute('{opts.theme_attr}', '{theme}')")
        if opts.dark_class and theme == "dark":
            page.evaluate(f"document.documentElement.classList.add('{opts.dark_class}')")
        page.wait_for_timeout(200)

        probe = page.evaluate(PROBE_JS)
        pf = out / "probes" / f"{tag}.json"
        review.write_json(pf, probe)
        evidence.append(str(pf))

        # scroll walk: wake lazy content, then a viewport shot at each step (never a stitched full page)
        walk = page.evaluate("__od.walk({wait: 250})")
        page.wait_for_timeout(200)
        doc_h = page.evaluate("document.documentElement.scrollHeight")
        step = max(1, int(h * 0.85))
        ys = list(range(0, max(doc_h - h, 0) + 1, step))
        if ys[-1] < doc_h - h:
            ys.append(max(doc_h - h, 0))
        sampled = len(ys) > opts.steps
        if sampled:
            idx = sorted({round(i * (len(ys) - 1) / (opts.steps - 1)) for i in range(opts.steps)})
            ys = [ys[i] for i in idx]
        for i, y in enumerate(ys):
            page.evaluate(f"__od.scrollTo({y})")
            page.wait_for_timeout(150)
            sp = out / "shots" / f"{tag}-s{i:02d}.png"
            sp.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(sp), scale="css")
            evidence.append(str(sp))
        page.evaluate("__od.scrollTo(0)")
        log.append(f"{cell}: probe, {len(ys)} scroll shot(s)" + (f" (page is {doc_h}px tall; sampled {opts.steps} of the steps)" if sampled else "") + (f"; the page grew {walk['grewBy']}px while scrolling" if walk.get("grewBy") else ""))

        if anchor:
            try:
                evidence += rendered_fonts(page, out, tag, probe)
            except Exception as e:  # noqa: BLE001
                log.append(f"{cell}: rendered-font check skipped ({str(e).splitlines()[0]}; it needs Chromium)")
            for name, fn in (("focus-walk", focus_walk), ("hover-and-press", hover_sample), ("stress-text", stress_passes),
                             ("reduced-motion", reduced_motion), ("forced-colors", forced_colors), ("motion", motion_frames)):
                try:
                    evidence += fn(page, out, tag, probe, opts)
                    done_tasks.add(name)
                except Exception as e:  # noqa: BLE001
                    log.append(f"{cell}: the {name} pass failed and is still todo: {str(e).splitlines()[0]}")
                    try:
                        page.evaluate(PROBE_JS)
                    except Exception:  # noqa: BLE001
                        pass
        pfile = out / "console" / f"{tag}.json"
        review.write_json(pfile, problems)
        evidence.append(str(pfile))
    except Exception as e:  # noqa: BLE001
        log.append(f"{cell}: FAILED {str(e).splitlines()[0]}")
        ctx.close()
        return cell, None, set()
    ctx.close()
    return cell, evidence, done_tasks


def focus_walk(page, out, tag, probe, opts):
    page.evaluate("window.scrollTo(0, 0); document.activeElement && document.activeElement.blur()")
    page.evaluate("__od.stops.length = 0")
    stops, seen, shots = [], {}, []
    for i in range(opts.tabs):
        page.keyboard.press("Tab")
        page.wait_for_timeout(60)
        rec = page.evaluate("__od.focus()")
        stops.append(rec)
        if rec.get("active"):
            seen[rec["sel"]] = seen.get(rec["sel"], 0) + 1
            bad = (rec.get("focusVisible") and not (rec.get("ring") or {}).get("visible")) or ((rec.get("obscured") or {}).get("fraction", 0) >= 0.5)
            if (bad or len(shots) < 2) and len(shots) < 8:
                sp = out / "shots" / f"{tag}-focus{i:02d}.png"
                page.screenshot(path=str(sp), scale="css")
                shots.append(str(sp))
        if not rec.get("active") and i > 2:
            break
        if rec.get("active") and seen[rec["sel"]] >= 3:
            break
    doc = {"kind": "focus", "url": probe["url"], "viewport": probe["viewport"], "media": probe["media"], "mode": probe.get("mode"), "stops": stops,
           "tabbable": page.evaluate("__od.focusDoc().tabbable")}  # 0 means the page has nothing to focus, not a keyboard trap
    fp = out / "focus" / f"{tag}.json"
    review.write_json(fp, doc)
    return [str(fp)] + shots


def rendered_fonts(page, out, tag, probe, opts=None):
    """Ask Chromium which font it actually drew for a sample of text (CSS.getPlatformFontsForNode). document.fonts.check() is true
    for a family that does not exist, and a width test can be fooled by a similar fallback; this cannot."""
    cdp = page.context.new_cdp_session(page)
    rows = []
    try:
        cdp.send("DOM.enable")
        cdp.send("CSS.enable")
        for fam, info in list(((probe.get("type") or {}).get("families") or {}).items())[:8]:
            selector = (info.get("ex") or [None])[0]
            if not selector:
                continue
            try:
                root = cdp.send("DOM.getDocument", {"depth": 0})["root"]["nodeId"]
                nid = cdp.send("DOM.querySelector", {"nodeId": root, "selector": selector})["nodeId"]
                if not nid:
                    continue
                drawn = cdp.send("CSS.getPlatformFontsForNode", {"nodeId": nid})["fonts"]
                rows.append({"asked": fam, "sel": selector, "drawn": [{"family": f["familyName"], "custom": bool(f.get("isCustomFont")), "glyphs": f["glyphCount"]} for f in drawn]})
            except Exception:  # noqa: BLE001
                continue
    finally:
        try:
            cdp.detach()
        except Exception:  # noqa: BLE001
            pass
    fp = out / "fonts" / f"{tag}.json"
    review.write_json(fp, {"kind": "fonts", "url": probe["url"], "viewport": probe["viewport"], "media": probe["media"], "rows": rows})
    return [str(fp)]


def hover_sample(page, out, tag, probe, opts=None):
    picks = page.evaluate("""() => {
      const seen = new Set(), out = [];
      for (const el of document.querySelectorAll('a[href],button,[role=button],[role=tab],summary,input[type=checkbox],input[type=radio],select')) {
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2 || r.height < 2 || r.right <= 0 || el.disabled || (el.checkVisibility && !el.checkVisibility())) continue;   // not off-canvas skip links
        const k = el.localName + '|' + (el.className || '').toString().split(' ')[0];
        if (seen.has(k)) continue; seen.add(k); out.push(el);
        if (out.length >= 12) break;
      }
      window.__odHover = out; return out.length;
    }""")
    rows = []
    for i in range(picks):
        try:
            before = page.evaluate(f"__od.style(window.__odHover[{i}])")
            page.evaluate(f"window.__odHover[{i}].scrollIntoView({{block:'center'}})")
            box = page.evaluate(f"(() => {{ const r = window.__odHover[{i}].getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; }})()")
            page.mouse.move(box[0], box[1])
            page.wait_for_timeout(350)
            after = page.evaluate(f"__od.style(window.__odHover[{i}])")
            diff = page.evaluate("(p) => __od.diff(p[0], p[1])", [before, after])
            rows.append({"sel": before["sel"], "cursor": after.get("cursor"), "changed": {k: v for k, v in diff.items() if k not in ("rect",)}, "moved": "rect" in diff})
        except Exception:  # noqa: BLE001
            continue
    page.mouse.move(0, 0)
    page.evaluate("window.scrollTo(0, 0)")
    hp = out / "hover" / f"{tag}.json"
    review.write_json(hp, {"kind": "hover", "url": probe["url"], "viewport": probe["viewport"], "media": probe["media"], "samples": rows})
    return [str(hp)]


def stress_passes(page, out, tag, probe=None, opts=None):
    ev = []
    for kind in STRESS:
        page.evaluate("window.scrollTo(0, 0)")
        r = page.evaluate(f"__od.stress('{kind}', true)")
        if r.get("error"):
            continue
        page.wait_for_timeout(250)
        pr = page.evaluate(PROBE_JS)
        pf = out / "probes" / f"{tag}.stress-{kind}.json"
        review.write_json(pf, pr)
        sp = out / "shots" / f"{tag}-stress-{kind}.png"
        page.screenshot(path=str(sp), scale="css")
        ev += [str(pf), str(sp)]
        page.evaluate(f"__od.stress('{kind}', false)")
    return ev


def reduced_motion(page, out, tag, probe, opts=None):
    page.emulate_media(reduced_motion="reduce")
    page.reload(wait_until="load")
    settle(page)
    pr = page.evaluate(PROBE_JS)
    pf = out / "probes" / f"{tag}.reduced-motion.json"
    review.write_json(pf, pr)
    page.emulate_media(reduced_motion="no-preference")
    page.reload(wait_until="load")
    settle(page)
    page.evaluate(PROBE_JS)   # a reload drops window.__od
    return [str(pf)]


def forced_colors(page, out, tag, probe, opts=None):
    """Windows high-contrast style: box-shadow, text-shadow and background images are dropped, so a focus ring or a border made of a shadow disappears."""
    page.emulate_media(forced_colors="active")
    page.wait_for_timeout(250)
    pr = page.evaluate(PROBE_JS)
    pf = out / "probes" / f"{tag}.forced-colors.json"
    review.write_json(pf, pr)
    page.evaluate("window.scrollTo(0, 0)")
    sp = out / "shots" / f"{tag}-forced-colors.png"
    page.screenshot(path=str(sp), scale="css")
    page.emulate_media(forced_colors="none")
    return [str(pf), str(sp)]


def motion_frames(page, out, tag, probe, opts=None):
    m = probe.get("motion") or {}
    mc = probe.get("media_counts") or {}
    if not (m.get("animations") or (m.get("libs") or {}) or mc.get("smil") or mc.get("video") or mc.get("canvas")):
        return []
    ev = []
    for f in (0, 0.25, 0.5, 0.75, 1):
        page.evaluate(f"window.scrollTo(0, 0); __od.seek({f}); __od.seekTime({f} * 2)")
        page.wait_for_timeout(120)
        sp = out / "shots" / f"{tag}-motion-{int(f * 100):03d}.png"
        page.screenshot(path=str(sp), scale="css")
        ev.append(str(sp))
    page.evaluate("__od.play()")
    try:
        vit = page.evaluate("__od.vitals()")
        vp_ = out / "motion" / f"{tag}.vitals.json"
        review.write_json(vp_, {"kind": "vitals", "url": probe["url"], "viewport": probe["viewport"], "media": probe["media"], **vit})
        ev.append(str(vp_))
    except Exception:  # noqa: BLE001
        pass
    return ev


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", required=True, help="base URL of the running app, for example http://localhost:3000")
    ap.add_argument("--routes", default="/")
    ap.add_argument("--viewports", help="320,390x844,768 (default: from the plan, else 320,390,768,1024,1440)")
    ap.add_argument("--themes", help="light,dark (default: from the plan, else the system's modes)")
    ap.add_argument("--project", default=".")
    ap.add_argument("--out", help="default ./opendesigner/review")
    ap.add_argument("--steps", type=int, default=12, help="most scroll screenshots per cell")
    ap.add_argument("--tabs", type=int, default=40, help="most Tab presses in the keyboard walk")
    ap.add_argument("--full", action="store_true", help="run the keyboard, hover, stress, reduced-motion and motion passes at every cell, not just the anchors")
    ap.add_argument("--channel", help="chrome or msedge, to use an installed browser")
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--theme-attr", help="also set this attribute on <html> to the theme name (for example data-theme)")
    ap.add_argument("--dark-class", help="also add this class to <html> in dark (for example dark)")
    opts = ap.parse_args()

    host = urlparse(opts.url).hostname or ""
    if urlparse(opts.url).scheme not in ("http", "https") or not is_loopback(host):
        raise SystemExit(f"{host or opts.url} is not a local address. capture.py opens loopback addresses only (localhost, *.localhost, 127.0.0.1, ::1). "
                         "Run the app locally, or review a staging site with the host's browser tool and probe.js (references/capture.md).")
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise SystemExit("Playwright for Python is not installed. Ask the person before installing it: pip install playwright && playwright install chromium. "
                         "Without it, run probe.js with your browser tool instead (references/capture.md).")

    out = Path(opts.out) if opts.out else Path(opts.project) / review.STATE_DIR / "review"
    plan = review.read_json(out / "plan.json", {})
    routes = [r.strip() for r in (opts.routes or "/").split(",") if r.strip()] if opts.routes != "/" or not plan else plan.get("routes", ["/"])
    for r in routes:   # a route such as //example.com/ would join to another host
        if not is_loopback(urlparse(urljoin(opts.url, r)).hostname):
            raise SystemExit(f"route {r!r} leads to {urlparse(urljoin(opts.url, r)).hostname}, which is not a local address. Routes are paths such as /settings.")
    if opts.viewports:
        vps = [(int(a.partition("x")[0]), int(a.partition("x")[2] or (844 if int(a.partition("x")[0]) < 700 else 900))) for a in opts.viewports.split(",")]
    elif plan.get("viewports"):
        vps = [tuple(int(x) for x in v.split("x")) for v in plan["viewports"]]
    else:
        vps = list(review.DEFAULT_VIEWPORTS)
    themes = [t.strip() for t in (opts.themes or ",".join(plan.get("themes") or ["light", "dark"])).split(",")]
    vps = sorted(set(vps))
    phones = [v for v in vps if 380 <= v[0] < 700] or vps[:1]
    desk = [v for v in vps if v[0] <= 1440][-1:] or vps[-1:]
    anchors = {(phones[0], themes[0]), (desk[0], themes[0])}

    if not (out / "plan.json").exists():
        review.write_json(out / "plan.json", {"url": opts.url, "routes": routes, "viewports": [f"{w}x{h}" for w, h in vps], "themes": themes,
                                              "system": (review.load_system(opts.project) or {}).get("name"), "made": time.strftime("%Y-%m-%d"),
                                              "note": "written by capture.py because no plan existed; run review.py plan first to list tasks and cells up front"})
    log = []
    started = time.time()
    with sync_playwright() as pw:
        browser = launch(pw, opts.channel, opts.headed)
        ledger = review.read_json(out / "ledger.json", {"cells": {}})
        for route in routes:
            route_tasks = {"scroll-walk"}
            for vp in vps:
                for theme in themes:
                    cell, ev, tasks = run_cell(browser, opts.url, route, vp, theme, out, opts, opts.full or (vp, theme) in anchors, log)
                    if ev is not None:
                        entry = ledger["cells"].setdefault(cell, {"status": "todo", "evidence": [], "why": ""})
                        entry["status"] = "done"
                        entry["evidence"] = sorted(set(entry.get("evidence", []) + ev))[:40]
                        entry["at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                        route_tasks |= tasks | {"console-and-network"}
            for task in sorted(route_tasks):
                e = ledger["cells"].setdefault(f"task:{route}|{task}", {"status": "todo", "evidence": [], "why": ""})
                e["status"] = "done"
                e["why"] = "run by capture.py" + ("" if task not in ("motion",) else " (frames only when the page has animations)")
        review.write_json(out / "ledger.json", ledger)
        browser.close()
    print("\n".join(log))
    print(f"\ndone in {round(time.time() - started)} s. Evidence is in {out}")
    print(f"next: python3 {HERE / 'review.py'} check {out}" + ("" if opts.project == "." else f" --project {opts.project}") + "   (reads every probe and capture file in that folder)")
    print("then look at the screenshots yourself (review.py sheet --open), add what you saw with review.py finding, and run review.py report.")


if __name__ == "__main__":
    main()

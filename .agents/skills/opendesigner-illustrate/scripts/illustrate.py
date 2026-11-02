#!/usr/bin/env python3
"""Find open-licence illustrations for one slot in a product, rank them, recolor them to the project's
tokens, make variants, and write them into the app with a licence ledger.

    python3 illustrate.py sources [--kind 3d] [--no-credit] [--q "empty inbox"] [-v]   sources, filtered, with search links
    python3 illustrate.py directory [--open | --md PATH]      a browsable page (or Markdown) of every source
    python3 illustrate.py search "empty inbox" --slot empty-state [--source openverse,iconify,commons] [--offline]
    python3 illustrate.py rank --purpose "empty inbox" --slot empty-state [--style flat|line|any]
    python3 illustrate.py fetch <candidate-id> [...] [--offline]  download, sanitize and log it in the ledger
    python3 illustrate.py add FILE --source undraw --url URL [--title T] [--author A]   a file the person downloaded
    python3 illustrate.py palette [--tokens PATH | --accent HEX]  the palette recoloring will use
    python3 illustrate.py recolor NAME [--variants light,dark,tint,mono,swap,themed] [--map "#6c63ff=accent2"] [--recolor-skin]
    python3 illustrate.py sheet [--candidates | NAME ...]      an HTML contact sheet to compare candidates or variants
    python3 illustrate.py check FILE [...]                    safety, palette membership and contrast
    python3 illustrate.py apply NAME --to DIR [--as svg|react|html] [--variant themed] [--label "..."]
    python3 illustrate.py style [--lock NAME | --unlock]      the project's one illustration style (set by the first apply)
    python3 illustrate.py ledger                              write ATTRIBUTION.md from the ledger

Everything lives in the person's project under opendesigner/illustrations/ (change it with --dir). Nothing is
pooled into a shared catalog: several licences forbid offering their art as a library inside a tool, so each
project fetches only what its person picked (hooks.md rule 6). Sources that do not allow automated download
are "manual": search prints the page to open, the person downloads, and `add` brings the file in.

Recoloring keeps each shape's lightness and moves its hue to a token ramp: neutrals to the neutral ramp,
the most-used hue to accent, the next to accent2 and accent3, by the ramp step with the nearest OKLCH
lightness. The dark variant uses the same step in the dark ramp, which holds the same job (DC-L01-18).
Skin tones are kept unless --recolor-skin. Every SVG passes an allow-list sanitizer (no scripts, animation,
foreign content or remote loads, CSS included) before anything else reads it. Standard library only.

Network: `search` and `fetch` call the sources that allow automation, over HTTPS only, capped at 3 MB a file (owner
decision 2026-09-28; the one exception to "skills stay offline"). Responses are saved under
opendesigner/illustrations/responses/ and downloads/ first, then parsed. With --offline, or when the network fails,
they print the requests as curl lines; the agent fetches them with its own tools and runs the same command again.
"""
import argparse, datetime, html, json, math, re, sys, urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
REF = HERE.parent / "references"
SOURCES = REF / "sources.json"
PURPOSES = REF / "purposes.json"
UA = "OpenDesigner-illustrate/0.1 (+https://github.com/ckryptickunal/OpenDesigner)"
SVG_NS = "http://www.w3.org/2000/svg"
XLINK = "http://www.w3.org/1999/xlink"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", XLINK)
MAX_BYTES = 3_000_000

# ---------------------------------------------------------------- color math (OKLab, Björn Ottosson 2020)

def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _gam(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def hex_to_rgb(hx):
    hx = hx.lstrip("#")
    if len(hx) in (3, 4):
        hx = "".join(ch * 2 for ch in hx[:3])
    return tuple(int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4))


def rgb_to_hex(rgb):
    return "#" + "".join(f"{round(min(1, max(0, c)) * 255):02x}" for c in rgb)


def hex_to_oklch(hx):
    r, g, b = (_lin(c) for c in hex_to_rgb(hx))
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(a, bb), math.degrees(math.atan2(bb, a)) % 360


def oklch_to_hex(L, C, H):
    def rgb(c):
        a, b = c * math.cos(math.radians(H)), c * math.sin(math.radians(H))
        l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
        m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
        s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
        return (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    lo, hi = 0.0, C
    if all(-1e-4 <= v <= 1 + 1e-4 for v in rgb(C)):
        lo = C
    else:  # gamut-map by lowering chroma, as the engine does
        for _ in range(24):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if all(-1e-4 <= v <= 1 + 1e-4 for v in rgb(mid)) else (lo, mid)
    return rgb_to_hex(tuple(_gam(min(1, max(0, v))) for v in rgb(lo)))


def luminance(hx):
    r, g, b = (_lin(c) for c in hex_to_rgb(hx))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


NAMED = {"white": "#ffffff", "black": "#000000", "red": "#ff0000", "green": "#008000", "blue": "#0000ff",
         "gray": "#808080", "grey": "#808080", "silver": "#c0c0c0", "yellow": "#ffff00", "orange": "#ffa500",
         "purple": "#800080", "navy": "#000080", "teal": "#008080", "maroon": "#800000", "olive": "#808000",
         "lime": "#00ff00", "aqua": "#00ffff", "cyan": "#00ffff", "fuchsia": "#ff00ff", "magenta": "#ff00ff",
         "pink": "#ffc0cb", "brown": "#a52a2a", "gold": "#ffd700", "beige": "#f5f5dc", "tan": "#d2b48c",
         "whitesmoke": "#f5f5f5", "gainsboro": "#dcdcdc", "lightgray": "#d3d3d3", "lightgrey": "#d3d3d3",
         "darkgray": "#a9a9a9", "darkgrey": "#a9a9a9", "dimgray": "#696969", "dimgrey": "#696969"}
COLOR_RE = re.compile(r"#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\(\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*[, ]\s*[\d.]+%?(?:\s*[,/]\s*[\d.]+%?)?\s*\)")
PAINT_PROPS = ("fill", "stroke", "stop-color", "flood-color", "lighting-color", "color")
PROP_RE = re.compile(r"((?:^|[;{\s])(?:%s)\s*:\s*)([^;}\"']+)" % "|".join(PAINT_PROPS), re.I)


URL_RE = re.compile(r"url\([^)]*\)", re.I)


def alpha_of(tok):
    """Alpha of a color token, 1.0 when opaque or unknown."""
    t = tok.strip().lower()
    if t.startswith("#") and len(t) in (5, 9):
        return int(t[-1] * 2 if len(t) == 5 else t[-2:], 16) / 255
    m = re.match(r"rgba?\(([^)]*)\)", t)
    if m:
        parts = re.split(r"[\s,/]+", m.group(1).strip())
        if len(parts) >= 4:
            a = parts[3]
            return float(a[:-1]) / 100 if a.endswith("%") else float(a)
    return 1.0


def with_alpha(value, alpha):
    if alpha >= 0.999:
        return value
    if value.startswith("#"):
        return value + f"{round(alpha * 255):02x}"
    return f"color-mix(in srgb, {value} {round(alpha * 100)}%, transparent)"


def sub_colors(text, fn):
    """Apply fn(hex) to every color token in text, keeping alpha and leaving url(#id) references alone."""
    out, last = [], 0
    for m in URL_RE.finditer(text):
        out.append(COLOR_RE.sub(lambda c: with_alpha(fn(norm_color(c.group())), alpha_of(c.group())), text[last:m.start()]))
        out.append(m.group())
        last = m.end()
    out.append(COLOR_RE.sub(lambda c: with_alpha(fn(norm_color(c.group())), alpha_of(c.group())), text[last:]))
    return "".join(out)


def find_colors(text):
    return [norm_color(m.group()) for m in COLOR_RE.finditer(URL_RE.sub("", text))]


def norm_color(tok):
    """A CSS color token -> lowercase #rrggbb, or None for none/currentColor/url()/unknown."""
    t = tok.strip().lower()
    if t in NAMED:
        return NAMED[t]
    if t.startswith("#"):
        h = t[1:]
        if len(h) in (3, 4):
            h = "".join(ch * 2 for ch in h[:3])
        return "#" + h[:6] if len(h) >= 6 and re.fullmatch(r"[0-9a-f]+", h) else None
    m = re.match(r"rgba?\(([^)]*)\)", t)
    if m:
        parts = re.split(r"[\s,/]+", m.group(1).strip())[:3]
        vals = [float(p[:-1]) * 2.55 if p.endswith("%") else float(p) for p in parts]
        return rgb_to_hex(tuple(v / 255 for v in vals))
    return None


def classify(hx, keep_skin=True):
    """neutral | skin | chroma. Skin tones in open sets (unDraw, Humaaans, Open Peeps) measured 2026-09-28 sit at
    OKLCH hue 10-77, chroma 0.04-0.115 and lightness 0.28-0.91; brand oranges and pinks start near chroma 0.157.
    Neutrals are chroma under 0.05, the css_scan.py threshold, so slate inks like #3f3d56 stay neutral."""
    L, C, H = hex_to_oklch(hx)
    if C < 0.035:
        return "neutral"
    if keep_skin and (H >= 5 and H <= 80) and C <= 0.125 and 0.25 <= L <= 0.93:
        return "skin"
    return "neutral" if C < 0.05 else "chroma"

# ---------------------------------------------------------------- SVG safety (allow-list)

# Only these SVG elements survive, matched case-sensitively in the SVG namespace: an HTML parser lowercases
# names when the SVG is inlined, so <SCRIPT> or <foreignobject> must not slip through a deny-list. No
# animation elements (they can set href), no <a>, <image> only with an embedded raster, no foreign namespaces
# (Inkscape, RDF metadata), which also keeps React output type-checking.
ALLOWED_TAGS = {"svg", "g", "defs", "symbol", "use", "path", "rect", "circle", "ellipse", "line", "polyline",
                "polygon", "linearGradient", "radialGradient", "stop", "clipPath", "mask", "pattern", "marker",
                "title", "desc", "style", "text", "tspan", "image", "filter", "feGaussianBlur", "feOffset",
                "feFlood", "feComposite", "feMerge", "feMergeNode", "feBlend", "feColorMatrix", "feDropShadow",
                "feMorphology"}
UNWRAP_TAGS = {"a", "switch"}  # keep their drawing, drop the element
ALLOWED_ATTRS = {
    "id", "class", "style", "d", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "fx", "fy", "fr",
    "width", "height", "points", "viewBox", "preserveAspectRatio", "transform", "version", "opacity", "display",
    "visibility", "overflow", "color", "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width",
    "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset",
    "stroke-opacity", "vector-effect", "paint-order", "clip-path", "clip-rule", "clipPathUnits", "mask", "maskUnits",
    "maskContentUnits", "gradientUnits", "gradientTransform", "spreadMethod", "offset", "stop-color",
    "stop-opacity", "patternUnits", "patternContentUnits", "patternTransform", "filter", "filterUnits",
    "primitiveUnits", "in", "in2", "result", "stdDeviation", "dx", "dy", "flood-color", "flood-opacity",
    "operator", "k1", "k2", "k3", "k4", "mode", "radius", "refX", "refY", "markerWidth", "markerHeight",
    "markerUnits", "orient", "marker-start", "marker-mid", "marker-end", "font-family", "font-size", "font-weight",
    "font-style", "text-anchor", "letter-spacing", "dominant-baseline", "mix-blend-mode", "isolation", "shape-rendering",
    "role", "aria-hidden", "aria-label", "aria-labelledby", "aria-describedby", "focusable",
    "{http://www.w3.org/XML/1998/namespace}space"}
ELEMENT_ATTRS = {"feColorMatrix": {"type", "values"}}
HREF_KEYS = ("href", "{http://www.w3.org/1999/xlink}href")
CSS_ESCAPE = re.compile(r"\\([0-9a-fA-F]{1,6})\s?|\\(.)", re.S)
CSS_BAD = re.compile(r"@|expression|binding|behavior|javascript|image-set|-webkit-image|\\|<|&", re.I)


def clean_css(css):
    """Safe CSS for a style attribute or <style>: no at-rules, no remote url(), no escapes. None drops it."""
    if css is None:
        return None
    t = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    t = CSS_ESCAPE.sub(lambda m: chr(int(m.group(1), 16)) if m.group(1) else m.group(2), t)  # decode, then judge
    t = re.sub(r"url\(\s*(['\"]?)\s*#([\w.:-]+)\s*\1\s*\)", r"url(#\2)", t, flags=re.I)
    local_urls = re.findall(r"url\(#[\w.:-]+\)", t)
    probe = re.sub(r"url\(#[\w.:-]+\)", "", t)
    if re.search(r"url\s*\(", probe, re.I) or CSS_BAD.search(probe):
        return None
    return t if local_urls or t.strip() else ""


def local(tag):
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def _svg_tag(el):
    return el.tag[len("{%s}" % SVG_NS):] if isinstance(el.tag, str) and el.tag.startswith("{%s}" % SVG_NS) else None


def sanitize(text):
    """Parse an SVG and keep only allow-listed elements and attributes. Returns (root, notes)."""
    if len(text.encode("utf-8")) > MAX_BYTES:
        raise ValueError(f"SVG is over {MAX_BYTES // 1_000_000} MB")
    if re.search(r"<!ENTITY", text, re.I):
        raise ValueError("SVG declares XML entities; refused")
    text = re.sub(r"<!DOCTYPE[^>\[]*(\[[^\]]*\])?\s*>", "", text, flags=re.I | re.S)
    root = ET.fromstring(text)
    if _svg_tag(root) != "svg":
        raise ValueError("not an SVG document (root must be <svg> in the SVG namespace)")
    notes = []

    def clean(parent):
        for child in list(parent):
            tag = _svg_tag(child)
            idx = list(parent).index(child)
            if tag in UNWRAP_TAGS:
                parent.remove(child)
                for k, gc in enumerate(list(child)):
                    parent.insert(idx + k, gc)
                notes.append(f"unwrapped <{tag}>")
                clean(parent)
                return
            if tag not in ALLOWED_TAGS:
                parent.remove(child)
                if child.tail and child.tail.strip():
                    notes.append("dropped text after a removed element")
                notes.append(f"removed <{local(child.tag) or '?'}>")
                continue
            clean(child)

    clean(root)
    for el in root.iter():
        tag = _svg_tag(el)
        allowed = ALLOWED_ATTRS | ELEMENT_ATTRS.get(tag, set())
        for k in list(el.attrib):
            v = el.attrib[k]
            if k in HREF_KEYS:
                ok = (v.strip().startswith("#") and tag in ("use", "linearGradient", "radialGradient", "pattern", "textPath")) or \
                     (tag == "image" and re.match(r"data:image/(png|jpe?g|webp|gif);base64,", v.strip(), re.I))
                if not ok:
                    del el.attrib[k]
                    notes.append(f"removed href on <{tag}>")
                continue
            if k not in allowed:
                del el.attrib[k]
                notes.append(f"removed attribute {local(k)}")
                continue
            if k == "style" or "url(" in v.lower() or "\\" in v:
                c = clean_css(v)
                if c is None:
                    del el.attrib[k]
                    notes.append(f"removed unsafe {k}")
                elif k == "style":
                    el.attrib[k] = c
        if tag == "image" and not any(h in el.attrib for h in HREF_KEYS):
            el.attrib.clear()
        if tag == "style":
            for ch in list(el):
                el.remove(ch)
            el.attrib.pop("type", None) if el.attrib.get("type", "text/css") == "text/css" else el.attrib.clear()
            c = clean_css(el.text or "")
            if c is None:
                notes.append("removed unsafe CSS")
            el.text = c or ""
    if "viewBox" not in root.attrib:
        w, h = (re.match(r"[\d.]+", root.attrib.get(a, "") or "") for a in ("width", "height"))
        if w and h:
            root.set("viewBox", f"0 0 {w.group()} {h.group()}")
            notes.append("added viewBox from width and height")
        else:
            notes.append("no viewBox: it will not scale cleanly")
    return root, sorted(set(notes))


def serialize(root):
    return ET.tostring(root, encoding="unicode")

# ---------------------------------------------------------------- color census and replacement

def census(root):
    """Weighted count of each paint color. Weight approximates area: path data length, or 40 for shapes."""
    weights = Counter()
    implicit_black = 0

    def paints(el):
        found = []
        for p in PAINT_PROPS:
            if p in el.attrib:
                found.append(el.attrib[p])
        for m in PROP_RE.finditer(el.attrib.get("style", "")):
            found.append(m.group(2))
        return found

    def walk(el, inherited_fill):
        nonlocal implicit_black
        tag = local(el.tag)
        own = paints(el)
        fill = el.attrib.get("fill", inherited_fill)
        sm = re.search(r"(?:^|;)\s*fill\s*:\s*([^;]+)", el.attrib.get("style", ""))
        if sm:
            fill = sm.group(1)
        w = max(40, len(el.attrib.get("d", "")) // 4) if tag in ("path", "rect", "circle", "ellipse", "polygon", "polyline", "line") else 5
        for tok in own:
            for c in ([norm_color(tok)] if norm_color(tok) else find_colors(tok)):
                if c:
                    weights[c] += w
        if tag in ("path", "rect", "circle", "ellipse", "polygon") and fill is None and not own:
            implicit_black += w
        for ch in el:
            walk(ch, fill)

    walk(root, root.attrib.get("fill"))
    for el in root.iter():
        if local(el.tag) == "style" and el.text:
            for c in find_colors(el.text):
                weights[c] += 20
            for name, hx in NAMED.items():
                for _ in re.finditer(r":\s*%s\b" % name, el.text, re.I):
                    weights[hx] += 20
    if implicit_black:
        weights["#000000"] += implicit_black
    weights.pop(None, None)
    return weights, implicit_black


def replace_colors(root, fn):
    """Apply fn(hex) -> replacement string to every paint color in attributes, style attributes and <style>."""
    def sub_value(v):
        c = norm_color(v)
        if c:
            return with_alpha(fn(c), alpha_of(v))
        return sub_colors(v, fn)

    for el in root.iter():
        for p in PAINT_PROPS:
            if p in el.attrib:
                el.attrib[p] = sub_value(el.attrib[p])
        if "style" in el.attrib:
            el.attrib["style"] = PROP_RE.sub(lambda m: m.group(1) + sub_value(m.group(2)), el.attrib["style"])
        if local(el.tag) == "style" and el.text:
            el.text = PROP_RE.sub(lambda m: m.group(1) + sub_value(m.group(2)), el.text)

# ---------------------------------------------------------------- palette

RAMP_VAR = re.compile(r"--([a-z0-9-]*?)color-([a-z0-9]+)-(light|dark)-(\d{1,2})\s*:\s*(#[0-9a-fA-F]{3,8})\s*;")


def find_tokens(start):
    for base in [start] + list(start.parents)[:3]:
        for rel in ("opendesigner/build/css/tokens.css", "build/css/tokens.css", "opendesigner/tokens/primitives.tokens.json",
                    "tokens/primitives.tokens.json"):
            if (base / rel).exists():
                return base / rel
    return None


def ramp_from_seed(seed, dark=False, neutral=False):
    """A plain 12-step OKLCH ramp for projects without OpenDesigner tokens. Step jobs follow the engine's."""
    L0, C0, H = hex_to_oklch(seed)
    C0 = min(C0, 0.02) if neutral else C0
    lights = [0.99, 0.975, 0.95, 0.925, 0.9, 0.87, 0.82, 0.72, L0, L0 - 0.05, 0.5, 0.27] if not dark else \
             [0.17, 0.2, 0.24, 0.28, 0.32, 0.36, 0.42, 0.52, L0, L0 + 0.05, 0.8, 0.94]
    chromas = [0.08, 0.12, 0.2, 0.28, 0.36, 0.44, 0.55, 0.75, 1, 0.95, 0.75, 0.45]
    return {i + 1: oklch_to_hex(max(0, min(1, L)), C0 * k, H) for i, (L, k) in enumerate(zip(lights, chromas))}


def load_palette(tokens=None, accent=None, neutral=None, accent2=None, cwd=None):
    """{'light': {ramp: {step: hex}}, 'dark': {...}, 'prefix': '--ds-', 'source': path}."""
    if accent:
        pal = {"light": {}, "dark": {}, "prefix": None, "source": f"seed {accent}"}
        seeds = {"accent": accent, "neutral": neutral or oklch_to_hex(0.55, 0.01, hex_to_oklch(accent)[2])}
        if accent2:
            seeds["accent2"] = accent2
        for ramp, seed in seeds.items():
            for mode in ("light", "dark"):
                pal[mode][ramp] = ramp_from_seed(seed, dark=mode == "dark", neutral=ramp == "neutral")
        return pal
    path = Path(tokens) if tokens else find_tokens(Path(cwd or Path.cwd()))
    if not path or not path.exists():
        raise SystemExit("No tokens found. Pass --tokens opendesigner/build/css/tokens.css, or --accent '#hex' for a quick palette.")
    pal = {"light": defaultdict(dict), "dark": defaultdict(dict), "prefix": None, "source": str(path)}
    if path.suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8")).get("color", {})
        for ramp, modes in data.items():
            if ramp.startswith("$") or not isinstance(modes, dict):
                continue
            for mode in ("light", "dark"):
                for step, tok in (modes.get(mode) or {}).items():
                    v = tok.get("$value") if isinstance(tok, dict) else None
                    hx = v.get("hex") if isinstance(v, dict) else (v if isinstance(v, str) and v.startswith("#") else None)
                    if step.isdigit() and hx:
                        pal[mode][ramp][int(step)] = hx.lower()[:7]
    else:
        text = path.read_text(encoding="utf-8")
        for m in RAMP_VAR.finditer(text):
            pal["prefix"] = pal["prefix"] or f"--{m.group(1)}color-"
            pal[m.group(3)][m.group(2)][int(m.group(4))] = norm_color(m.group(5))
    pal["light"], pal["dark"] = dict(pal["light"]), dict(pal["dark"])
    if "neutral" not in pal["light"] or "accent" not in pal["light"]:
        raise SystemExit(f"{path} has no neutral and accent ramps; pass --accent '#hex' instead.")
    return pal


def accent_ramps(pal):
    return [r for r in ("accent", "accent2", "accent3") if r in pal["light"]]


def nearest_step(pal, mode, ramp, L):
    steps = pal[mode][ramp]
    return min(steps, key=lambda s: abs(hex_to_oklch(steps[s])[0] - L))

# ---------------------------------------------------------------- mapping and variants

def hue_clusters(colors):
    """Group chromatic colors by hue (within 30 degrees of the heaviest member), heaviest cluster first."""
    clusters = []
    for hx, w in sorted(colors.items(), key=lambda kv: -kv[1]):
        H = hex_to_oklch(hx)[2]
        for cl in clusters:
            d = abs((H - cl["hue"] + 180) % 360 - 180)
            if d <= 30:
                cl["members"].append(hx)
                cl["weight"] += w
                break
        else:
            clusters.append({"hue": H, "members": [hx], "weight": w})
    return sorted(clusters, key=lambda c: -c["weight"])


def plan_mapping(weights, pal, keep_skin=True, overrides=None, max_hues=None):
    """source hex -> (ramp, step) or ('keep', hex). overrides: {hex: ramp or ramp-step or '#hex'}."""
    overrides = overrides or {}
    plan, chroma = {}, {}
    for hx, w in weights.items():
        kind = classify(hx, keep_skin)
        if kind == "neutral":
            plan[hx] = ("neutral", None)
        elif kind == "skin":
            plan[hx] = ("keep", hx)
        else:
            chroma[hx] = w
    ramps = accent_ramps(pal)[:max_hues] if max_hues else accent_ramps(pal)
    ramp_hue = {r: hex_to_oklch(pal["light"][r][max(pal["light"][r])  if 9 not in pal["light"][r] else 9])[2] for r in ramps}
    for i, cl in enumerate(hue_clusters(chroma)):
        # heaviest hues take accent, accent2, accent3 in order; any further hue joins the ramp nearest in hue
        ramp = ramps[i] if i < len(ramps) else min(ramps, key=lambda r: abs((cl["hue"] - ramp_hue[r] + 180) % 360 - 180))
        for hx in cl["members"]:
            plan[hx] = (ramp, None)
    for hx, target in overrides.items():
        hx = norm_color(hx)
        if not hx:
            continue
        if target.startswith("#"):
            plan[hx] = ("keep", norm_color(target))
        else:
            ramp, _, step = target.partition("-")
            plan[hx] = (ramp, int(step) if step.isdigit() else None)
    out = {}
    for hx, (ramp, step) in plan.items():
        if ramp == "keep":
            out[hx] = ("keep", step)
            continue
        if ramp not in pal["light"]:
            raise SystemExit(f"--map names ramp {ramp!r}; this palette has {sorted(pal['light'])}")
        out[hx] = (ramp, step or nearest_step(pal, "light", ramp, hex_to_oklch(hx)[0]))
    return out


VARIANTS = ("light", "dark", "tint", "mono", "swap", "themed")


def variant_fn(variant, mapping, pal):
    ramps = accent_ramps(pal)

    def target(hx):
        ramp, step = mapping.get(hx, ("keep", hx))
        if ramp == "keep":
            return ("keep", step)
        if variant == "tint" and ramp != "neutral":
            ramp = "accent"
        if variant == "mono":
            ramp = "neutral"
        if variant == "swap" and len(ramps) > 1 and ramp in ramps:
            ramp = ramps[(ramps.index(ramp) + 1) % len(ramps)]
        return (ramp, step)

    def fn(hx):
        ramp, step = target(hx)
        if ramp == "keep":
            if variant == "mono":
                L = hex_to_oklch(step)[0]
                return pal["light"]["neutral"][nearest_step(pal, "light", "neutral", L)]
            return step
        if variant == "themed":
            light = pal["light"][ramp][step]
            return f"var(--od-illus-{ramp}-{step}, {light})"
        mode = "dark" if variant == "dark" else "light"
        if mode == "dark" and ramp == "neutral" and step <= 3:
            step += 2  # the lightest neutrals would match the dark page itself and vanish; lift them to raised surfaces
        steps = pal[mode][ramp]
        return steps.get(step) or steps[min(steps, key=lambda s: abs(s - step))]
    return fn, target


def themed_css(used, pal):
    """CSS custom properties the themed variant reads, switching with the token file's theme selectors."""
    def block(mode):
        lines = []
        for ramp, step in sorted(used):
            s = step + 2 if mode == "dark" and ramp == "neutral" and step <= 3 else step  # same lift as the dark variant
            val = f"var({pal['prefix']}{ramp}-{mode}-{s})" if pal.get("prefix") else pal[mode][ramp][s]
            lines.append(f"  --od-illus-{ramp}-{step}: {val};")
        return "\n".join(lines)
    return ("/* Generated by opendesigner-illustrate. Illustration colors follow the theme. */\n"
            f":root, [data-theme=\"light\"] {{\n{block('light')}\n}}\n"
            f"[data-theme=\"dark\"] {{\n{block('dark')}\n}}\n"
            f"@media (prefers-color-scheme: dark) {{\n  :root:not([data-theme=\"light\"]) {{\n"
            + "\n".join("  " + l for l in block("dark").splitlines()) + "\n  }\n}\n")


def recolor_svg(text, pal, variants=VARIANTS, keep_skin=True, overrides=None, max_hues=None):
    root, _ = sanitize(text)
    weights, implicit = census(root)
    mapping = plan_mapping(weights, pal, keep_skin, overrides, max_hues)
    out, used = {}, set()
    for v in variants:
        r = ET.fromstring(serialize(root))
        fn, target = variant_fn(v, mapping, pal)
        if v == "themed":
            # Presentation attributes do not reliably take var(). Move each painted attribute into a rule with
            # zero specificity (:where), so the drawing's own CSS still wins exactly as it did over the attribute.
            rules = {}
            for el in r.iter():
                decl = []
                for p in PAINT_PROPS:
                    if p in el.attrib and norm_color(el.attrib[p]):
                        raw = el.attrib.pop(p)
                        decl.append(f"{p}:{with_alpha(fn(norm_color(raw)), alpha_of(raw))}")
                if decl:
                    key = ";".join(decl)
                    cls = rules.setdefault(key, f"odp{len(rules) + 1}")
                    el.set("class", (el.attrib.get("class", "") + " " + cls).strip())
            if rules:
                st = ET.Element(f"{{{SVG_NS}}}style")
                st.text = "".join(f":where(.{c}){{{k}}}" for k, c in rules.items())
                r.insert(0, st)
            for hx in weights:
                t = target(hx)
                if t[0] != "keep":
                    used.add(t)
        replace_colors(r, fn)
        if implicit and "fill" not in r.attrib:
            black = fn("#000000")
            if v == "themed":
                r.set("style", (r.attrib.get("style", "").rstrip("; ") + f";fill:{black}").lstrip(";"))
            else:
                r.set("fill", black)
        out[v] = serialize(r)
    return out, mapping, weights, (themed_css(used, pal) if "themed" in variants and used else "")

# ---------------------------------------------------------------- style metrics (for ranking and consistency)

def style_metrics(text):
    root, _ = sanitize(text)
    weights, _ = census(root)
    shapes = [el for el in root.iter() if local(el.tag) in ("path", "rect", "circle", "ellipse", "polygon", "polyline", "line")]
    stroked = sum(1 for el in shapes if el.attrib.get("stroke") not in (None, "none") or "stroke:" in el.attrib.get("style", ""))
    chroma = {h: w for h, w in weights.items() if classify(h) == "chroma"}
    vb = [float(x) for x in re.split(r"[\s,]+", root.attrib.get("viewBox", "0 0 1 1").strip())[:4]] if root.attrib.get("viewBox") else [0, 0, 1, 1]
    return {"colors": len(weights), "hues": len(hue_clusters(chroma)), "shapes": len(shapes),
            "stroke_ratio": round(stroked / len(shapes), 2) if shapes else 0,
            "aspect": round(vb[2] / vb[3], 2) if len(vb) == 4 and vb[3] else 1,
            "bytes": len(text.encode("utf-8")), "gradients": sum(1 for el in root.iter() if "Gradient" in local(el.tag)),
            "raster": sum(1 for el in root.iter() if local(el.tag) == "image"),
            "text": sum(1 for el in root.iter() if local(el.tag) == "text")}

# ---------------------------------------------------------------- sources, search and ranking

def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def expand_query(purpose, slot, purposes):
    words = [w for w in re.findall(r"[a-z0-9]+", purpose.lower()) if w not in purposes.get("stopwords", [])]
    extra = purposes.get("slots", {}).get(slot, {}).get("keywords", []) if slot else []
    return words, extra

# Each connector lists the HTTPS requests to make and parses the saved responses. `search` and `fetch` make the
# requests themselves (owner decision 2026-09-28: this skill may use the network, the one exception to SPEC
# principle 9), saving each response under responses/ or downloads/ first. With --offline, or when the network
# fails, they print the same requests as curl lines for the agent to fetch with its own tools.


def _url(endpoint, params):
    return endpoint + "?" + urllib.parse.urlencode(params)


def req_openverse(src, queries, words, extra, limit):
    base = {"page_size": min(limit, 20), "extension": "svg", "license_type": "commercial,modification", "mature": "false"}
    reqs = [_url(src["api"]["endpoint"], {"q": q, **base, "category": "illustration"}) for q in queries[:2]]
    return reqs + [_url(src["api"]["endpoint"], {"q": queries[0], **base})]  # few items carry the category: one wider call


def parse_openverse(body, req, src, limit):
    out = []
    for it in json.loads(body).get("results", []):
        code = (it.get("license") or "").lower()
        ver = it.get("license_version") or ""
        lic = {"cc0": "CC0", "pdm": "Public domain mark"}.get(code) or f"CC {code.upper()} {ver}".strip()
        out.append({"id": f"openverse:{it.get('id')}", "source": "openverse", "title": it.get("title") or "",
                    "tags": [t.get("name", "") for t in it.get("tags") or [] if isinstance(t, dict)],
                    "author": it.get("creator") or "", "author_url": it.get("creator_url") or "",
                    "page": it.get("foreign_landing_url") or "", "download": it.get("url") or "",
                    "preview": it.get("thumbnail") or it.get("url") or "", "format": it.get("filetype") or "svg",
                    "licence": lic, "licence_url": it.get("license_url") or "", "attribution": it.get("attribution") or "",
                    "provider": it.get("provider") or ""})
    return out


def req_iconify(src, queries, words, extra, limit):
    params = {"limit": max(32, min(limit * 3, 96))}
    if src["api"].get("prefixes"):
        params["prefixes"] = ",".join(src["api"]["prefixes"])
    return [_url(src["api"]["endpoint"] + "/search", {"query": q, **params}) for q in queries[:2]]


def parse_iconify(body, req, src, limit):
    data = json.loads(body)
    collections = data.get("collections", {})
    out = []
    for name in data.get("icons", [])[:limit]:
        prefix, _, icon = name.partition(":")
        col = collections.get(prefix, {})
        lic = col.get("license", {})
        out.append({"id": f"iconify:{name}", "source": "iconify", "title": icon.replace("-", " "), "tags": [col.get("name", prefix)],
                    "author": (col.get("author") or {}).get("name", ""), "author_url": (col.get("author") or {}).get("url", ""),
                    "page": f"https://icon-sets.iconify.design/{prefix}/?icon-filter={icon}",
                    "download": f"{src['api']['endpoint']}/{prefix}/{icon}.svg", "preview": f"{src['api']['endpoint']}/{prefix}/{icon}.svg",
                    "format": "svg", "licence": lic.get("title", "see set"), "licence_spdx": lic.get("spdx", ""),
                    "licence_url": lic.get("url", ""), "set": col.get("name", prefix)})
    return out


def req_commons(src, queries, words, extra, limit):
    params = {"action": "query", "format": "json", "formatversion": 2, "generator": "search", "gsrnamespace": 6,
              "gsrlimit": min(limit, 30), "prop": "imageinfo", "iiprop": "url|mime|size|extmetadata", "iiurlwidth": 320,
              "iiextmetadatafilter": "LicenseShortName|LicenseUrl|Artist|AttributionRequired|Categories|UsageTerms"}
    return [_url(src["api"]["endpoint"], {**params, "gsrsearch": f"{q} filemime:image/svg+xml"}) for q in queries[:2]]


def parse_commons(body, req, src, limit):
    pages = (json.loads(body).get("query") or {}).get("pages", [])
    out = []
    for page in pages.values() if isinstance(pages, dict) else pages:
        ii = (page.get("imageinfo") or [{}])[0]
        if ii.get("mime") != "image/svg+xml":
            continue
        meta = ii.get("extmetadata") or {}
        val = lambda k: html.unescape(re.sub(r"<[^>]+>", "", str((meta.get(k) or {}).get("value", "")))).strip()
        out.append({"id": f"commons:{page.get('pageid')}", "source": "commons",
                    "title": page.get("title", "").replace("File:", "").rsplit(".", 1)[0].replace("_", " "),
                    "tags": [c for c in val("Categories").split("|") if c][:8], "author": val("Artist")[:120],
                    "page": ii.get("descriptionurl", ""), "download": ii.get("url", ""), "preview": ii.get("thumburl") or ii.get("url", ""),
                    "format": "svg", "licence": val("LicenseShortName"), "licence_url": val("LicenseUrl"),
                    "attribution_required": val("AttributionRequired") == "true", "usage_terms": val("UsageTerms")})
    return out


def req_listing(src, queries, words, extra, limit):
    return [src["api"]["endpoint"]]


def parse_listing(body, req, src, limit):
    """Sources that publish one page listing every SVG: keep the files whose names match the search words."""
    urls = sorted(set(re.findall(src["api"]["listing"], body)))
    words = set(req.get("words", []))
    out = []
    for u in urls:
        url = urllib.parse.urljoin(src["api"].get("base", src["api"]["endpoint"]), u)
        stem = urllib.parse.unquote(url.rsplit("/", 1)[-1].rsplit(".", 1)[0])
        title = re.sub(r"[_\-]+|(?<=[a-z])(?=[A-Z])", " ", stem).strip().lower()
        out.append({"id": f"{src['id']}:{stem}", "source": src["id"], "title": title, "tags": [src.get("style", "")],
                    "author": src.get("author") or src["name"], "page": src["url"], "download": url, "preview": url,
                    "format": "svg", "licence": src["licence"], "licence_url": src.get("licence_url", "")})
    return [c for c in out if any(w in c["title"].split() or (len(w) > 4 and w[:5] in c["title"]) for w in words)][:limit]


def req_cocomaterial(src, queries, words, extra, limit):
    """CocoMaterial matches tags (AND), not free text: all words together, then the two longest alone."""
    tags = list(dict.fromkeys([",".join(words)] + sorted(words, key=len, reverse=True)[:2])) if words else [queries[0]]
    return [_url(src["api"]["endpoint"], {"page": 1, "page_size": min(limit, 30), "tags": t}) for t in tags[:3]]


def parse_cocomaterial(body, req, src, limit):
    tags = urllib.parse.parse_qs(urllib.parse.urlparse(req["url"]).query).get("tags", [""])[0]
    out = []
    for it in json.loads(body).get("results", []):
        for colored in (False, True):
            url = it.get("coloredSvg" if colored else "svg")
            if not url or url == "None":
                continue
            out.append({"id": f"cocomaterial:{it['id']}{'-color' if colored else ''}", "source": "cocomaterial",
                        "title": it.get("name", "") + (" (colour)" if colored else ""), "tags": (it.get("tags") or "").split(","),
                        "author": src.get("author", ""), "page": f"https://cocomaterial.com/results?q={urllib.parse.quote(tags)}",
                        "download": url, "preview": url, "format": "svg", "licence": src["licence"], "licence_url": src.get("licence_url", "")})
    return out


CONNECTORS = {"openverse": (req_openverse, parse_openverse, "json"), "cocomaterial": (req_cocomaterial, parse_cocomaterial, "json"),
              "iconify": (req_iconify, parse_iconify, "json"), "commons": (req_commons, parse_commons, "json"),
              "opendoodles": (req_listing, parse_listing, "html"), "lukaszadam": (req_listing, parse_listing, "html")}


def fetch_line(url, dest):
    """How the agent fetches one file with its own tools. Only HTTPS URLs are ever offered."""
    if not url.lower().startswith("https://"):
        raise ValueError(f"only https:// URLs are fetched, not {url[:40]!r}")
    return f'curl -sL --max-filesize {MAX_BYTES} -A "{UA}" "{url}" -o "{dest}"'


def http_get(url, dest, timeout=30):
    """Download one HTTPS URL to dest, at most MAX_BYTES. The only place this skill touches the network."""
    fetch_line(url, dest)  # refuses anything but https://
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        if not r.geturl().lower().startswith("https://"):
            raise ValueError("redirected away from HTTPS")
        body = r.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError(f"over {MAX_BYTES // 1_000_000} MB")
    Path(dest).parent.mkdir(parents=True, exist_ok=True)
    Path(dest).write_bytes(body)


def fetch_all(pairs, offline):
    """Fetch (url, dest) pairs directly; return the curl lines for the ones left to the agent."""
    left = []
    for url, dest in pairs:
        if not offline:
            try:
                http_get(url, dest)
                continue
            except (urllib.error.URLError, OSError, ValueError, TimeoutError) as e:
                print(f"  network: {url[:70]} failed ({e.__class__.__name__}); fetch it yourself")
        left.append(fetch_line(url, dest))
    return left


def read_saved(path):
    return Path(path).read_bytes()[:MAX_BYTES + 1].decode("utf-8", errors="replace")


def licence_verdict(c, sources, commercial=True):
    """ok | attribution | blocked, with a reason. The item's own licence first, then the source's terms."""
    lic = (c.get("licence") or "").upper()
    src = sources.get(c["source"], {})
    if commercial and re.search(r"\bNC\b|NON.?COMMERCIAL", lic):
        return "blocked", "non-commercial licence"
    if re.search(r"\bND\b|NO.?DERIV", lic):
        return "blocked", "no-derivatives licence: recoloring is not allowed"
    if src.get("modify") is False:
        return "blocked", "the free licence forbids changes, so it cannot be recolored; use a paid plan or another source"
    if src.get("commercial") is None and src.get("id") not in (None, "other"):
        return "attribution", "commercial use is not clearly allowed on the free tier: confirm with the person. " + src.get("restrictions", "")
    if c["source"] == "iconify":
        spdx = c.get("licence_spdx", "")
        if spdx not in src.get("licences_ok", []):
            return "blocked", f"set licence {spdx or 'unknown'} is not on the allowed list"
        return ("attribution", f"{spdx}: credit the set") if spdx.startswith("CC-BY") else ("ok", f"{spdx}: keep the notice")
    if re.search(r"\bSA\b|SHARE.?ALIKE", lic):
        return "attribution", "share-alike: credit the author, and changed versions carry the same licence"
    if re.match(r"CC0|PUBLIC DOMAIN|PDM", lic) and not c.get("attribution_required"):
        return "ok", "public domain: no credit needed"
    if src.get("attribution") in ("per-item",):
        if not lic:
            return "blocked", "no licence stated"
        if lic.startswith("CC BY") or c.get("attribution_required"):
            return "attribution", "credit the author as the licence says"
        return "attribution", f"{c.get('licence')}: read the terms on the item page"
    if src.get("attribution") == "required":
        note = src.get("restrictions", "credit required")
        return "attribution", note
    if src.get("attribution") == "notice":
        return "attribution", "keep the licence notice"
    if src.get("attribution") in ("none", "optional"):
        return "ok", src.get("restrictions") or "no credit needed"
    if not lic:
        return "blocked", "no licence stated"
    return "attribution", f"{c.get('licence')}: read the terms before use"


def tokens_of(c):
    text = " ".join([c.get("title", ""), " ".join(c.get("tags", [])), c.get("set", "")]).lower()
    return set(re.findall(r"[a-z0-9]+", text))


def matches(w, toks):
    return w in toks or (len(w) > 4 and any(t.startswith(w[:5]) for t in toks))


def idf_weights(words, pool):
    """Rarer query words count more: in 'empty inbox', 'inbox' separates candidates better than 'empty'."""
    n = max(1, len(pool))
    return {w: math.log(1 + n / (1 + sum(1 for toks in pool if matches(w, toks)))) for w in words}


def score(c, words, extra, sources, slot_info, style, chosen_metrics=None, idf=None, noise=()):
    """0-100. Relevance 50, licence 20, format and slot fit 15, style fit and consistency 15."""
    toks = tokens_of(c)
    idf = idf or {w: 1 for w in words}
    total = sum(idf.values()) or 1
    hit = sum(idf[w] for w in words if matches(w, toks)) / total
    hit_extra = sum(1 for w in extra if w in toks)
    rel = 50 * min(1.0, hit * 0.85 + min(hit_extra, 3) * 0.05)
    rel -= 15 * min(2, len(toks & set(noise)))
    verdict, _ = licence_verdict(c, sources)
    lic = {"ok": 20, "attribution": 12, "blocked": 0}[verdict]
    fmt = 10 if c.get("format", "").lower() in ("svg", "image/svg+xml") else 3
    m = c.get("metrics") or {}
    if m and slot_info:
        lo, hi = slot_info.get("aspect", [0.5, 2.5])
        fmt += 5 if lo <= m.get("aspect", 1) <= hi else 0
        fmt -= 5 if m.get("raster") else 0
    else:
        fmt += 2
    sty = 8
    if m:
        if style == "line":
            sty = 15 * m.get("stroke_ratio", 0)
        elif style == "flat":
            sty = 15 * (1 - m.get("stroke_ratio", 0)) - 3 * min(m.get("gradients", 0), 3)
        sty -= 4 if m.get("hues", 0) > 3 else 0      # many hues are hard to map onto 1-3 accent ramps
        sty -= 3 if m.get("bytes", 0) > 150_000 else 0
        sty -= 8 if m.get("text") else 0              # words inside art do not translate or scale
        if chosen_metrics:
            same_src = any(cm.get("source") == c["source"] and cm.get("set") == c.get("set") for cm in chosen_metrics)
            near = min(abs(cm.get("stroke_ratio", 0) - m.get("stroke_ratio", 0)) for cm in chosen_metrics)
            sty += (4 if same_src else 0) + (3 if near < 0.2 else -3)
    return round(max(0, min(100, rel + lic + fmt + sty)), 1), verdict

# ---------------------------------------------------------------- project files

class Project:
    def __init__(self, base):
        self.dir = Path(base)
        self.cand = self.dir / "candidates.json"
        self.ledger = self.dir / "ledger.json"
        self.src = self.dir / "src"

    def load(self, p, default):
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default

    def save(self, p, data):
        self.dir.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    def ledger_add(self, entry):
        led = self.load(self.ledger, {"_about": "Licence ledger: one row per illustration used in this project (hooks.md rule 5).", "items": []})
        led["items"] = [e for e in led["items"] if e["name"] != entry["name"]] + [entry]
        self.save(self.ledger, led)
        return led

    def entry(self, name):
        for e in self.load(self.ledger, {"items": []})["items"]:
            if e["name"] == name:
                return e
        raise SystemExit(f"{name!r} is not in {self.ledger}. Fetch or add it first.")


def unique_name(proj, base, cid):
    """A ledger name for this item: reuse the item's own row, never overwrite a different item's."""
    taken = {e["name"]: e.get("id") or e.get("page") for e in proj.load(proj.ledger, {"items": []})["items"]}
    name, n = base, 2
    while name in taken and taken[name] != cid:
        name, n = f"{base}-{n}", n + 1
    return name


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:48] or "illustration"

# ---------------------------------------------------------------- commands

KINDS = {"scenes": "Scenes and spot art", "people": "People and characters", "doodles": "Hand-drawn doodles",
         "spot": "Small multicolor spot art and emoji", "3d": "3D art", "animated": "Animated (Lottie, Rive)",
         "generator": "Generators (shapes, blobs, waves, patterns)", "search": "Search engines over open collections"}
ACCESS = {"api": "agent fetches", "open": "agent may browse", "manual": "you download"}
CREDIT = {"none": "no credit needed", "optional": "credit optional", "required": "credit required",
          "notice": "keep the licence notice", "per-item": "depends on each item", "as given": "as given"}


def source_rows(data, a=None):
    """Sources filtered by the `sources` flags: --kind, --format, --no-credit, --api, --for."""
    rows = [s for s in data["sources"] if s["id"] != "other"]
    if a is None:
        return rows
    if a.kind:
        rows = [s for s in rows if a.kind in s.get("kind", [])]
    if a.format:
        rows = [s for s in rows if any(a.format.lower() == f.lower() for f in s.get("formats", []))]
    if a.no_credit:
        rows = [s for s in rows if s.get("attribution") in ("none", "optional")]
    if a.api:
        rows = [s for s in rows if s["access"] != "manual"]
    if a.for_:
        rows = [s for s in rows if a.for_ in s.get("best_for", [])] or rows
    return rows


def search_link(s, q):
    tpl = s.get("search_url") or s.get("url", "")
    return tpl.format(q=urllib.parse.quote(q)) if "{q}" in tpl else tpl


def cmd_sources(a):
    data = load_json(SOURCES)
    rows = source_rows(data, a)
    for s in rows:
        who = ACCESS[s["access"]]
        print(f"{s['id']:<13} {who:<14} {CREDIT.get(s.get('attribution'), s.get('attribution', '?')):<22} "
              f"{', '.join(s.get('formats', [])) or '-':<26} {s['name']}")
        if a.q:
            print(f"{'':<13} search: {search_link(s, a.q)}")
        if a.verbose:
            for tip in s.get("search_tips", []):
                print(f"{'':<13} tip: {tip}")
            if s.get("restrictions"):
                print(f"{'':<13} limits: {s['restrictions']}")
    print(f"\n{len(rows)} sources, licences verified {data.get('verified', '?')}. Browse them all: `illustrate.py directory --open`.")


def directory_markdown(data):
    rows = source_rows(data)
    out = ["# Illustration directory", "",
           f"Generated by `tools/build_data.py` from `synthesis/illustration-sources.json` (licences read on {data.get('verified')}). "
           "Licences change: open the licence link before you ship. **Agent fetches** means `illustrate.py search` "
           "queries and downloads it over HTTPS; **you download** means the site forbids automation, so the person picks and "
           "downloads and `illustrate.py add` brings the file in; **agent may browse** means bots are allowed but illustrate.py has no "
           "connector, so the agent browses or calls the site's API with its own tools. For the browsable page with filters and one search box "
           "for every site, run `python3 scripts/illustrate.py directory --open`. How to search well: `searching.md`.", ""]
    for kind, label in KINDS.items():
        group = [s for s in rows if kind == (s.get("kind") or ["scenes"])[0]]
        if not group:
            continue
        out += [f"## {label}", "", "| Source | Style | Licence | Credit | Formats | Access |", "|---|---|---|---|---|---|"]
        for s in group:
            search = search_link(s, "rocket")
            out.append(f"| [{s['name']}]({s['url']}) ([search]({search})) | {s.get('style', '')} | [{s['licence']}]({s.get('licence_url') or s['url']}) | "
                       f"{CREDIT.get(s.get('attribution'), s.get('attribution', ''))} | {', '.join(s.get('formats', []))} | "
                       f"{ACCESS[s['access']]} |")
        out.append("")
    out += ["## How to use each one", ""]
    for s in rows:
        out += [f"### {s['name']}", ""]
        if s.get("best_for"):
            out.append(f"- **Good for:** {', '.join(s['best_for'])}")
        if s.get("search_url") or s["access"] == "api":
            out.append(f"- **Search:** `{s.get('search_url') or 'illustrate.py search --source ' + s['id']}`" + (f" · filters: {s['filters']}" if s.get("filters") else ""))
        if s.get("formats"):
            out.append(f"- **Formats:** {', '.join(s['formats'])}" + (f" ({s['signup']})" if s.get("signup") else ""))
        if s.get("customize"):
            out.append(f"- **Customize on the site:** {s['customize']}")
        if s.get("plugins"):
            out.append("- **Plugins:** " + ", ".join(f"[{pl['name']}]({pl['url']})" for pl in s["plugins"]))
        if s.get("restrictions"):
            out.append(f"- **Limits:** {s['restrictions']}")
        for tip in s.get("search_tips", []):
            out.append(f"- **Tip:** {tip}")
        if s.get("navigate"):
            out.append("- **Agent steps:** " + " → ".join(f"({i + 1}) {step}" for i, step in enumerate(s["navigate"])))
        out.append("")
    if data.get("excluded"):
        out += ["## Checked and left out", ""] + [f"- **{e['name']}:** {e['why']}" for e in data["excluded"]] + [""]
    return "\n".join(out)


def directory_html(data):
    rows = source_rows(data)
    payload = json.dumps({"rows": rows, "kinds": KINDS, "access": ACCESS, "credit": CREDIT, "verified": data.get("verified")}, ensure_ascii=False)
    payload = payload.replace("</", "<\\/")
    return """<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Illustration directory</title>
<style>
:root{--bg:#f7f7f5;--card:#fff;--ink:#1d1d1b;--muted:#63625d;--line:#e2e1dc;--ok:#1f7a3f;--warn:#9a5b00;--chip:#efeee9;--accent:#3552d4}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--card:#1e1e1c;--ink:#ecebe6;--muted:#a7a59e;--line:#34332f;--ok:#6fcf8f;--warn:#f0b35a;--chip:#2a2a27;--accent:#8ea2ff}}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--ink)}
header{padding:24px 16px 8px;max-width:1200px;margin:auto}h1{margin:0 0 4px;font-size:24px}p{margin:4px 0;color:var(--muted)}
.bar{position:sticky;top:0;background:var(--bg);padding:12px 16px;border-bottom:1px solid var(--line);z-index:1}
.bar>div{max-width:1200px;margin:auto;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
input{flex:1 1 260px;font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);min-height:44px}
button{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 12px;min-height:36px;cursor:pointer}
button[aria-pressed=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
main{max-width:1200px;margin:auto;padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
article{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:8px}
h2{font-size:17px;margin:0}.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{background:var(--chip);border-radius:999px;padding:2px 10px;font-size:13px}
.ok{color:var(--ok)}.warn{color:var(--warn)}.muted{color:var(--muted);font-size:13px}a{color:var(--accent)}
.go{display:inline-block;margin-top:auto;padding:8px 14px;border-radius:10px;background:var(--ink);color:var(--bg);text-decoration:none;text-align:center}
details{font-size:14px}summary{cursor:pointer;color:var(--muted)}ol,ul{margin:6px 0;padding-left:20px}
</style>
<header><h1>Illustration directory</h1><p>Free and open illustration sources, with their licences as read on <span id="v"></span>. Type what you need once; every card's button searches that site for it.</p>
<p><b>Agent fetches</b>: illustrate.py searches and downloads it over HTTPS. <b>Agent may browse</b>: bots are allowed, so the AI may browse it with its own tools. <b>You download</b>: the site forbids bots, so you pick and download, then the AI recolors it.</p></header>
<div class="bar"><div><input id="q" placeholder="What should the picture show? e.g. empty inbox, rocket launch, team" aria-label="Search words">
<span id="filters"></span></div></div>
<main id="list"></main>
<script type="application/json" id="data">""" + payload + """</script>
<script>
const D=JSON.parse(document.getElementById('data').textContent);document.getElementById('v').textContent=D.verified;
const state={kind:null,credit:false,api:false};const f=document.getElementById('filters');
function btn(label,on){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-pressed','false');b.onclick=()=>{on(b);render()};f.appendChild(b);return b}
const kindBtns=[];for(const [k,l] of Object.entries(D.kinds)){if(!D.rows.some(r=>(r.kind||[]).includes(k)))continue;const b=btn(l,b=>{state.kind=state.kind===k?null:k;kindBtns.forEach(x=>x.setAttribute('aria-pressed',String(x===b&&state.kind===k)))});kindBtns.push(b)}
btn('No credit needed',b=>{state.credit=!state.credit;b.setAttribute('aria-pressed',String(state.credit))});
btn('Agent can fetch or browse',b=>{state.api=!state.api;b.setAttribute('aria-pressed',String(state.api))});
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function link(r,q){const t=r.search_url||r.url;return t.includes('{q}')?t.replace('{q}',encodeURIComponent(q||'')):t}
function render(){const q=document.getElementById('q').value.trim();const L=document.getElementById('list');L.innerHTML='';
for(const r of D.rows){if(state.kind&&!(r.kind||[]).includes(state.kind))continue;if(state.credit&&!['none','optional'].includes(r.attribution))continue;if(state.api&&r.access==='manual')continue;
const credit=D.credit[r.attribution]||r.attribution;const cls=['none','optional'].includes(r.attribution)?'ok':'warn';
const a=document.createElement('article');a.innerHTML=`<h2>${esc(r.name)}</h2><div class="muted">${esc(r.style)}</div>
<div class="chips">${(r.kind||[]).map(k=>`<span class="chip">${esc(D.kinds[k]||k)}</span>`).join('')}${(r.formats||[]).map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div>
<div><a href="${esc(r.licence_url||r.url)}" target="_blank" rel="noopener">${esc(r.licence)}</a> · <span class="${cls}">${esc(credit)}</span> · ${esc(D.access[r.access])}</div>
${r.restrictions?`<div class="muted">Limits: ${esc(r.restrictions)}</div>`:''}
${r.customize?`<div class="muted">Customize: ${esc(r.customize)}</div>`:''}
${(r.search_tips||[]).length||(r.navigate||[]).length||(r.plugins||[]).length?`<details><summary>How to search it</summary>${(r.search_tips||[]).length?`<ul>${r.search_tips.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}${(r.navigate||[]).length?`<ol>${r.navigate.map(t=>`<li>${esc(t)}</li>`).join('')}</ol>`:''}${(r.plugins||[]).length?`<div>Plugins: ${r.plugins.map(p=>`<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>`).join(', ')}</div>`:''}</details>`:''}
<a class="go" href="${esc(link(r,q))}" target="_blank" rel="noopener">${q&&(r.search_url||'').includes('{q}')?'Search “'+esc(q)+'”':'Open'} on ${esc(r.name.split(' (')[0])}</a>`;L.appendChild(a)}}
document.getElementById('q').addEventListener('input',render);render();
</script></html>"""


def cmd_directory(a):
    data = load_json(SOURCES)
    if a.md:
        out = Path(a.md)
        text = directory_markdown(data) + "\n"
        if a.check:
            ok = out.exists() and out.read_text(encoding="utf-8") == text
            print(f"{out}: {'up to date' if ok else 'stale: run illustrate.py directory --md ' + str(out)}")
            sys.exit(0 if ok else 1)
        out.write_text(text, encoding="utf-8")
        print(out)
        return
    out = Path(a.out or Path(a.dir) / "directory.html")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(directory_html(data), encoding="utf-8")
    print(out)
    if a.open:
        import webbrowser
        webbrowser.open(out.resolve().as_uri())


def cmd_search(a):
    """Write requests.json, fetch each response to its `save_as` path, then parse them into candidates.json.
    With --offline (or when the network fails) it prints the requests and parses on the next run."""
    data, purposes = load_json(SOURCES), load_json(PURPOSES)
    sources = {s["id"]: s for s in data["sources"]}
    words, extra = expand_query(a.purpose, a.slot, purposes)
    query = a.query or " ".join(words[:4])
    wanted = a.source.split(",") if a.source else [s["id"] for s in data["sources"] if s["access"] == "api" and s.get("default")]
    # the whole purpose first, then its longest single words, then the slot's words
    queries = [query] if a.query else list(dict.fromkeys([query] + sorted(words, key=len, reverse=True)[:2] + extra[:2]))
    proj = Project(a.dir)
    resp = proj.dir / "responses"
    plan, errors, manual = [], [], []
    for sid in wanted:
        src = sources.get(sid)
        if not src:
            errors.append(f"{sid}: unknown source")
        elif src["access"] != "api" or sid not in CONNECTORS:
            manual.append({"source": sid, "name": src["name"], "open": search_link(src, query), "access": src["access"],
                           "licence": src["licence"], "restrictions": src.get("restrictions", "")})
        else:
            build, _, kind = CONNECTORS[sid]
            for n, url in enumerate(build(src, queries, words, extra, a.limit), 1):
                plan.append({"source": sid, "url": url, "save_as": str(resp / f"{sid}-{n}.{kind}"), "words": words + extra})
    for sid in ([s["id"] for s in data["sources"] if s["access"] != "api" and s.get("default")] if not a.source else []):
        src = sources[sid]
        manual.append({"source": sid, "name": src["name"], "open": search_link(src, query), "access": src["access"],
                       "licence": src["licence"], "restrictions": src.get("restrictions", "")})
    old = proj.load(proj.dir / "requests.json", {})
    same = [r["url"] for r in old.get("requests", [])] == [r["url"] for r in plan]
    saved = [r for r in plan if Path(r["save_as"]).exists()] if same else []
    if not saved:
        resp.mkdir(parents=True, exist_ok=True)
        for f in resp.iterdir():
            f.unlink()  # answers to an older search must not be read as answers to this one
        proj.save(proj.dir / "requests.json", {"purpose": a.purpose, "slot": a.slot, "query": query, "requests": plan})
        left = fetch_all([(r["url"], r["save_as"]) for r in plan], a.offline)
        saved = [r for r in plan if Path(r["save_as"]).exists()]
    if not saved:
        print(f"Fetch these {len(left)} HTTPS responses with your own tools, then run the same search again:")
        for line in left:
            print("  " + line)
        for e in errors:
            print(f"  error {e}")
        for m in manual:
            print(f"  {ACCESS[m['access']]:<16} {m['name']}: {m['open']}  ({m['licence']}{'; ' + m['restrictions'] if m['restrictions'] else ''})")
        return
    found, seen = [], set()
    for r in plan:
        if not Path(r["save_as"]).exists():
            errors.append(f"{r['source']}: not fetched ({r['save_as']})")
            continue
        _, parse, _ = CONNECTORS[r["source"]]
        try:
            items = parse(read_saved(r["save_as"]), r, sources[r["source"]], a.limit)
        except (ValueError, KeyError, TypeError) as e:  # an error page or a changed response shape is reported, not fatal
            errors.append(f"{r['source']}: could not read {r['save_as']} ({e.__class__.__name__})")
            continue
        for c in items:
            if c["id"] not in seen:
                seen.add(c["id"])
                found.append(c)
    old = proj.load(proj.cand, {"items": []})
    merged = found + [c for c in old.get("items", []) if c["id"] not in seen and a.keep]
    proj.save(proj.cand, {"purpose": a.purpose, "slot": a.slot, "query": query, "searched": datetime.date.today().isoformat(),
                          "items": merged, "manual": manual})
    by = Counter(c["source"] for c in found)
    print(f"{len(found)} candidates for {query!r} -> {proj.cand}  ({', '.join(f'{k} {v}' for k, v in by.items()) or 'none'})")
    for e in errors:
        print(f"  error {e}")
    for m in manual:
        print(f"  {ACCESS[m['access']]:<16} {m['name']}: {m['open']}  ({m['licence']}{'; ' + m['restrictions'] if m['restrictions'] else ''})")
    print("Next: rank, then look at the top ones (sheet --candidates) before fetching.")


def cmd_rank(a):
    data, purposes = load_json(SOURCES), load_json(PURPOSES)
    sources = {s["id"]: s for s in data["sources"]}
    proj = Project(a.dir)
    cand = proj.load(proj.cand, None)
    if not cand:
        raise SystemExit("No candidates yet: run search first.")
    purpose, slot = a.purpose or cand.get("purpose", ""), a.slot or cand.get("slot")
    words, extra = expand_query(purpose, slot, purposes)
    slot_info = purposes.get("slots", {}).get(slot, {}) if slot else {}
    led = proj.load(proj.ledger, {"items": []})
    chosen = [{**e.get("metrics", {}), "source": e["source"], "set": e.get("set")} for e in led["items"]
              if e.get("status") == "chosen" and e.get("metrics")]
    lock = None if a.any_style else led.get("style")
    idf = idf_weights(words, [tokens_of(c) for c in cand["items"]])
    noise = purposes.get("not_illustration", [])
    for c in cand["items"]:
        c["score"], c["licence_verdict"] = score(c, words, extra, sources, slot_info, a.style, chosen, idf, noise)
        if lock and (c["source"], c.get("set")) != (lock["source"], lock.get("set")):
            c["score"] = round(max(0, c["score"] - 10), 1)  # one illustration style per project
            c["style_note"] = f"outside the locked style ({lock['source']})"
        c["licence_note"] = licence_verdict(c, sources)[1]
    cand["items"].sort(key=lambda c: -c["score"])
    proj.save(proj.cand, cand)
    if lock:
        print(f"Style locked to {lock['source']}{' / ' + lock['set'] if lock.get('set') else ''} by {lock['by']}: other sources lose 10 points (--any-style ignores the lock)")
    shown = [c for c in cand["items"] if a.all or c["licence_verdict"] != "blocked"][:a.top]
    for c in shown:
        print(f"{c['score']:>5}  {c['licence_verdict']:<11} {c['id']:<36} {c['title'][:44]:<44} {c.get('licence','')}")
    blocked = sum(1 for c in cand["items"] if c["licence_verdict"] == "blocked")
    if blocked and not a.all:
        print(f"({blocked} blocked by licence are hidden; --all shows them)")


def cmd_fetch(a):
    data = load_json(SOURCES)
    sources = {s["id"]: s for s in data["sources"]}
    proj = Project(a.dir)
    cand = {c["id"]: c for c in proj.load(proj.cand, {"items": []})["items"]}
    waiting = []
    for cid in a.ids:
        c = cand.get(cid)
        if not c:
            print(f"skip {cid}: not in candidates")
            continue
        verdict, why = licence_verdict(c, sources)
        if verdict == "blocked" and not a.force:
            print(f"skip {cid}: {why}")
            continue
        dl = proj.dir / "downloads" / (re.sub(r"[^a-zA-Z0-9]+", "-", cid).strip("-") + ".svg")
        if not dl.exists():
            dl.parent.mkdir(parents=True, exist_ok=True)
            try:
                waiting += fetch_all([(c["download"], dl)], a.offline)
            except ValueError as e:
                print(f"skip {cid}: {e}")
                continue
            if not dl.exists():
                continue
        text = read_saved(dl)
        try:
            root, notes = sanitize(text)
        except (ValueError, ET.ParseError) as e:
            print(f"skip {cid}: not a usable SVG ({e})")
            continue
        name = unique_name(proj, a.name if a.name and len(a.ids) == 1 else slug(c["title"] or cid), cid)
        proj.src.mkdir(parents=True, exist_ok=True)
        clean = serialize(root)
        (proj.src / f"{name}.svg").write_text(clean, encoding="utf-8")
        entry = {"name": name, "status": "candidate", "file": f"src/{name}.svg", "source": c["source"], "id": cid,
                 "title": c["title"], "page": c.get("page"), "download": c.get("download"), "author": c.get("author"),
                 "author_url": c.get("author_url"), "licence": c.get("licence"), "licence_url": c.get("licence_url"),
                 "attribution": c.get("attribution") or attribution_line(c, sources), "verdict": verdict,
                 "restrictions": sources.get(c["source"], {}).get("restrictions", ""), "set": c.get("set"),
                 "fetched": datetime.date.today().isoformat(), "sanitized": notes, "metrics": style_metrics(clean)}
        proj.ledger_add(entry)
        c["metrics"] = entry["metrics"]
        print(f"fetched {name} <- {cid} ({verdict}; {len(notes)} sanitize notes)")
    proj.save(proj.cand, {**proj.load(proj.cand, {}), "items": list(cand.values())})
    if waiting:
        print("Download these with your own tools, then run the same fetch again:")
        for line in waiting:
            print("  " + line)


def attribution_line(c, sources):
    src = sources.get(c["source"], {})
    tpl = src.get("attribution_template")
    if not tpl:
        return ""
    return tpl.format(title=c.get("title", ""), author=c.get("author") or "unknown", licence=c.get("licence", ""),
                      page=c.get("page", ""), licence_url=c.get("licence_url", ""), set=c.get("set", ""))


AS_IS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".json", ".lottie", ".riv", ".glb", ".gltf", ".usdz"}


def cmd_add(a):
    data = load_json(SOURCES)
    sources = {s["id"]: s for s in data["sources"]}
    src = sources.get(a.source)
    if not src:
        raise SystemExit(f"unknown source {a.source!r}; see `sources`, or use --source other with --licence")
    if a.source == "other" and not a.licence:
        raise SystemExit("--source other needs --licence (never guess a licence)")
    ext = Path(a.file).suffix.lower()
    if ext not in AS_IS | {".svg"}:
        raise SystemExit(f"{ext or 'no extension'}: add takes .svg, or {', '.join(sorted(AS_IS))} as-is")
    proj = Project(a.dir)
    name = unique_name(proj, a.name or slug(a.title or Path(a.file).stem), a.url or str(Path(a.file).resolve()))
    proj.src.mkdir(parents=True, exist_ok=True)
    if ext == ".svg":
        try:
            root, notes = sanitize(Path(a.file).read_text(encoding="utf-8"))
        except (ValueError, ET.ParseError) as e:
            raise SystemExit(f"{a.file} is not a usable SVG: {e}")
        clean = serialize(root)
        (proj.src / f"{name}.svg").write_text(clean, encoding="utf-8")
        metrics = style_metrics(clean)
    else:  # raster, Lottie, Rive or 3D: kept as-is for the ledger and credits; recolor and themed variants need SVG
        (proj.src / f"{name}{ext}").write_bytes(Path(a.file).read_bytes())
        notes, metrics = [f"{ext} kept as-is: not recolored or sanitized; check it before shipping"], {}
    c = {"source": a.source, "title": a.title or name, "author": a.author or "", "page": a.url or "",
         "licence": a.licence or src["licence"], "licence_url": src.get("licence_url", "")}
    verdict, why = licence_verdict(c, sources)
    proj.ledger_add({"name": name, "id": a.url or str(Path(a.file).resolve()), "status": "candidate", "file": f"src/{name}{ext}",
                     "source": a.source, "title": c["title"],
                     "page": a.url, "author": a.author, "licence": c["licence"], "licence_url": c["licence_url"],
                     "attribution": attribution_line(c, sources), "verdict": verdict, "restrictions": src.get("restrictions", ""),
                     "fetched": datetime.date.today().isoformat(), "sanitized": notes, "metrics": metrics})
    print(f"added {name} ({verdict}: {why})" + ("" if ext == ".svg" else f"; {ext} kept as-is"))


def cmd_palette(a):
    pal = load_palette(a.tokens, a.accent, a.neutral, a.accent2)
    print(f"palette from {pal['source']}" + (f" (CSS prefix {pal['prefix']})" if pal.get("prefix") else ""))
    for ramp, steps in pal["light"].items():
        print(f"  {ramp:<10} light " + " ".join(steps[s] for s in sorted(steps)))


def parse_map(pairs):
    out = {}
    for p in pairs or []:
        for item in p.split(","):
            if "=" in item:
                k, v = item.split("=", 1)
                out[k.strip()] = v.strip()
    return out


def cmd_recolor(a):
    proj = Project(a.dir)
    pal = load_palette(a.tokens, a.accent, a.neutral, a.accent2)
    names = a.names or [e["name"] for e in proj.load(proj.ledger, {"items": []})["items"] if e.get("status") in ("candidate", "chosen")]
    variants = [v for v in a.variants.split(",") if v]
    bad = set(variants) - set(VARIANTS)
    if bad:
        raise SystemExit(f"unknown variants {sorted(bad)}; choose from {VARIANTS}")
    for name in names:
        e = proj.entry(name)
        if e.get("verdict") == "blocked":
            print(f"skip {name}: licence blocks changes")
            continue
        if not e["file"].endswith(".svg"):
            print(f"skip {name}: {Path(e['file']).suffix} cannot be recolored; use it as-is or convert it to SVG")
            continue
        out, mapping, weights, css = recolor_svg((proj.dir / e["file"]).read_text(encoding="utf-8"), pal, variants,
                                                 keep_skin=not a.recolor_skin, overrides=parse_map(a.map), max_hues=a.max_hues)
        d = proj.dir / name
        d.mkdir(parents=True, exist_ok=True)
        for v, svg in out.items():
            (d / f"{v}.svg").write_text(svg, encoding="utf-8")
        if css:
            (d / "illustration.css").write_text(css, encoding="utf-8")
        e["mapping"] = {hx: (f"{r}-{s}" if r != "keep" else "kept") for hx, (r, s) in mapping.items()}
        e["variants"] = sorted(out)
        e["palette"] = pal["source"]
        proj.ledger_add(e)
        if not any(r != "keep" for r, _ in mapping.values()):
            print(f"warning {name}: no color was changed (all kept as skin or by --map); check the file has fills")
        top = ", ".join(f"{hx}->{e['mapping'][hx]}" for hx, _ in weights.most_common(6))
        print(f"{name}: {len(out)} variants in {d}  ({top})")


def cmd_sheet(a):
    proj = Project(a.dir)
    cards = []
    if a.candidates:
        cand = proj.load(proj.cand, {"items": []})
        for c in [c for c in cand["items"] if c.get("licence_verdict") != "blocked"][:a.top]:
            cards.append((c["id"], c.get("preview") or c.get("download"), f"{c.get('score', '?')} · {c.get('licence', '')}", c.get("title", "")))
        title = f"Candidates for “{cand.get('purpose', '')}”"
    else:
        names = a.names or [e["name"] for e in proj.load(proj.ledger, {"items": []})["items"]]
        for n in names:
            e = proj.entry(n)
            for v in e.get("variants") or []:
                cards.append((f"{n} · {v}", f"{n}/{v}.svg", e.get("licence", ""), v))
            if not e.get("variants"):
                cards.append((n, e["file"], e.get("licence", ""), "original"))
        title = "Illustration variants"
    css_links = "".join(f'<link rel="stylesheet" href="{html.escape(n)}/illustration.css">' for n in (a.names or []))
    tiles = "".join(
        f'<figure class="{"dark" if "dark" in label else ""}"><img src="{html.escape(src or "")}" alt="" loading="lazy">'
        f'<figcaption><b>{html.escape(cid)}</b><span>{html.escape(meta)}</span><span>{html.escape(label[:60])}</span></figcaption></figure>'
        for cid, src, meta, label in cards)
    page = f"""<!doctype html><meta charset="utf-8"><title>{html.escape(title)}</title>{css_links}
<style>body{{font:14px system-ui;margin:24px;background:#f6f6f4;color:#222}}h1{{font-size:18px}}
main{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}}
figure{{margin:0;background:#fff;border:1px solid #ddd;border-radius:10px;padding:12px}}figure.dark{{background:#161514;color:#eee}}
img{{width:100%;height:170px;object-fit:contain}}figcaption{{display:grid;gap:2px;font-size:12px;margin-top:8px}}</style>
<h1>{html.escape(title)}</h1><main>{tiles}</main>"""
    out = proj.dir / ("candidates.html" if a.candidates else "variants.html")
    proj.dir.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    print(out)


def cmd_check(a):
    pal = None
    try:
        pal = load_palette(a.tokens, a.accent)
    except SystemExit:
        pass
    allowed = {hx for mode in ("light", "dark") for steps in (pal or {}).get(mode, {}).values() for hx in steps.values()} if pal else set()
    surface = a.surface or ((pal or {}).get("light", {}).get("neutral", {}).get(1) or "#ffffff")
    worst = 0
    for f in a.files:
        text = Path(f).read_text(encoding="utf-8")
        problems = []
        try:
            root, notes = sanitize(text)
        except (ValueError, ET.ParseError) as e:
            print(f"FAIL {f}: {e}")
            worst = 2
            continue
        if notes:
            problems += [f"unsafe or missing: {n}" for n in notes]
        weights, _ = census(root)
        texts = sum(1 for el in root.iter() if local(el.tag) == "text")
        if texts:
            problems.append(f"{texts} <text> elements: words in art do not translate; outline them or pick another")
        if any(local(el.tag) == "image" for el in root.iter()):
            problems.append("embedded raster image: it will not recolor or scale")
        off = [hx for hx in weights if allowed and hx not in allowed and classify(hx) != "skin"]
        if off:
            problems.append(f"{len(off)} colors not in the palette: {', '.join(off[:6])}")
        if weights:
            best = max(contrast(hx, surface) for hx in weights)
            if best < 3:
                problems.append(f"no shape reaches 3:1 against {surface} (best {best:.2f}); fine if purely decorative")
        status = "ok" if not problems else "warn"
        worst = max(worst, 1 if problems else 0)
        print(f"{status:<4} {f}" + "".join(f"\n     - {p}" for p in problems))
    sys.exit(2 if worst == 2 else 0)


def scope_names(root, prefix):
    """Prefix ids and class names so two inline SVGs on one page cannot restyle or reference each other."""
    ids = {el.attrib["id"] for el in root.iter() if "id" in el.attrib}
    classes = {c for el in root.iter() for c in el.attrib.get("class", "").split()}
    for el in root.iter():
        if "id" in el.attrib:
            el.attrib["id"] = f"{prefix}-{el.attrib['id']}"
        if "class" in el.attrib:
            el.attrib["class"] = " ".join(f"{prefix}-{c}" for c in el.attrib["class"].split())
        for k, v in list(el.attrib.items()):
            if local(k) == "href" and v.startswith("#") and v[1:] in ids:
                el.attrib[k] = f"#{prefix}-{v[1:]}"
            elif "url(#" in v:
                el.attrib[k] = re.sub(r"url\(#([^)]+)\)", lambda m: f"url(#{prefix}-{m.group(1)})" if m.group(1) in ids else m.group(), v)
        if local(el.tag) == "style" and el.text:
            t = re.sub(r"\.(-?[_a-zA-Z][\w-]*)", lambda m: f".{prefix}-{m.group(1)}" if m.group(1) in classes else m.group(), el.text)
            t = re.sub(r"#([\w-]+)", lambda m: f"#{prefix}-{m.group(1)}" if m.group(1) in ids else m.group(), t)
            t = re.sub(r"url\(#([^)]+)\)", lambda m: f"url(#{prefix}-{m.group(1)})" if m.group(1) in ids else m.group(), t)
            # every selector is confined to this drawing, so `path{...}` cannot restyle the rest of the page
            el.text = re.sub(r"([^{}]+)\{", lambda m: ",".join(f":where(.{prefix}) {sel.strip()}" for sel in m.group(1).split(",") if sel.strip()) + "{", t)
    root.set("class", (root.attrib.get("class", "") + f" {prefix}").strip())


def cmd_apply(a):
    proj = Project(a.dir)
    e = proj.entry(a.name)
    variant = a.variant
    if not e["file"].endswith(".svg"):
        if e.get("verdict") == "blocked":
            raise SystemExit(f"{a.name}: licence blocks use")
        dest = Path(a.to)
        dest.mkdir(parents=True, exist_ok=True)
        out = dest / Path(e["file"]).name
        out.write_bytes((proj.dir / e["file"]).read_bytes())
        e.update(status="chosen", slot=a.slot or e.get("slot"), applied=sorted(set(e.get("applied", [])) | {str(out)}))
        proj.ledger_add(e)
        write_attribution(proj)
        print(f"wrote {out} (as-is: give it alt text or aria-hidden where you place it; animations need a still for reduced motion)")
        return
    src = proj.dir / a.name / f"{variant}.svg"
    if not src.exists():
        raise SystemExit(f"{src} not found: run recolor first (variants: {e.get('variants')})")
    if e.get("verdict") == "blocked":
        raise SystemExit(f"{a.name}: licence blocks use")
    dest = Path(a.to)
    dest.mkdir(parents=True, exist_ok=True)
    svg = src.read_text(encoding="utf-8")
    root = ET.fromstring(svg)
    for k in ("width", "height"):
        root.attrib.pop(k, None)
    scope_names(root, "il-" + a.name)
    if a.label:
        root.set("role", "img")
        root.set("aria-label", a.label)
    else:
        root.set("aria-hidden", "true")
        root.set("focusable", "false")
    svg = serialize(root)
    written = []
    comp = "".join(p.capitalize() for p in re.split(r"[^a-z0-9]+", a.name) if p) + "Illustration"
    if a.as_ == "svg":
        p = dest / f"{a.name}.svg"
        p.write_text(svg, encoding="utf-8")
        written.append(p)
    elif a.as_ == "react":
        for el in root.iter():  # braces in text would become live JSX expressions: park them, then emit as strings
            if local(el.tag) != "style":
                el.text = el.text and el.text.replace("{", "\ue000").replace("}", "\ue001")
            el.tail = el.tail and el.tail.replace("{", "\ue000").replace("}", "\ue001")
        svg = serialize(root)
        jsx = re.sub(r'\s(xmlns:xlink|xlink:href|stroke-width|stroke-linecap|stroke-linejoin|stroke-miterlimit|fill-rule|clip-rule|stop-color|stop-opacity|fill-opacity|stroke-opacity|clip-path|font-family|font-size|font-weight|text-anchor|aria-hidden|aria-label)=',
                     lambda m: " " + (m.group(1) if m.group(1).startswith("aria-") else re.sub(r"[-:](\w)", lambda k: k.group(1).upper(), m.group(1))) + "=", svg)
        jsx = re.sub(r'style="([^"]*)"', lambda m: "style={{" + jsx_style(m.group(1)) + "}}", jsx)
        jsx = jsx.replace(' class="', ' className="').replace("<svg ", "<svg {...props} ", 1)
        jsx = jsx.replace("\ue000", "{'{'}").replace("\ue001", "{'}'}")
        jsx = re.sub(r"<style>(.*?)</style>", lambda m: "<style>{`" + html.unescape(m.group(1)).replace("\\", "\\\\")
                     .replace("`", "\\`").replace("${", "\\${") + "`}</style>", jsx, flags=re.S)
        p = dest / f"{comp}.tsx"
        p.write_text(f"// {e['title']} · {e.get('licence', '')} · {e.get('page') or e.get('source')}\n"
                     f"// Generated by opendesigner-illustrate ({variant}). Colors come from the design tokens.\n"
                     f"import type {{ SVGProps }} from \"react\";\n\nexport function {comp}(props: SVGProps<SVGSVGElement>) {{\n"
                     f"  return (\n    {jsx}\n  );\n}}\n", encoding="utf-8")
        written.append(p)
    else:
        p = dest / f"{a.name}.html"
        p.write_text(f"<!-- {e['title']} · {e.get('licence', '')} -->\n{svg}\n", encoding="utf-8")
        written.append(p)
    css = proj.dir / a.name / "illustration.css"
    if variant == "themed" and css.exists():
        p = dest / f"{a.name}.illustration.css"
        p.write_text(css.read_text(encoding="utf-8"), encoding="utf-8")
        written.append(p)
    e["status"] = "chosen"
    led = proj.load(proj.ledger, {"items": []})
    if not led.get("style"):  # the first illustration used sets the project's style
        led["style"] = {"source": e["source"], "set": e.get("set"), "by": e["name"], "metrics": e.get("metrics", {}),
                        "locked": datetime.date.today().isoformat()}
        proj.save(proj.ledger, led)
        print(f"Style locked to {e['source']} (from {e['name']}); `style --unlock` clears it")
    e.setdefault("applied", [])
    e["applied"] = sorted(set(e["applied"]) | {str(p) for p in written})
    e["slot"] = a.slot or e.get("slot")
    proj.ledger_add(e)
    write_attribution(proj)
    for p in written:
        print(f"wrote {p}")
    if variant == "themed":
        print("Import the .illustration.css once, next to the token CSS, and inline the SVG (an <img> cannot read CSS variables;"
              " it shows the light fallback colors).")


def jsx_style(css):
    """'fill:var(--x, #fff);stroke-width:2' -> 'fill: "var(--x, #fff)", strokeWidth: "2"'."""
    pairs = []
    for kv in css.split(";"):
        if ":" in kv:
            k, v = kv.split(":", 1)
            pairs.append(re.sub(r"-(\w)", lambda g: g.group(1).upper(), k.strip()) + ": " + json.dumps(v.strip()))
    return ", ".join(pairs)


def write_attribution(proj):
    led = proj.load(proj.ledger, {"items": []})
    rows = [e for e in led["items"] if e.get("status") == "chosen"]
    lines = ["# Illustration credits and licences", "",
             "Generated by opendesigner-illustrate from ledger.json. One row per illustration used in this project.", "",
             "| Illustration | Source | Author | Licence | Credit to show | Limits |", "|---|---|---|---|---|---|"]
    for e in rows:
        lines.append(f"| {e['name']} ({e.get('slot') or 'unassigned'}) | [{e.get('source')}]({e.get('page') or ''}) | {e.get('author') or ''} | "
                     f"[{e.get('licence')}]({e.get('licence_url') or ''}) | {e.get('attribution') or 'not required'} | {e.get('restrictions') or ''} |")
    (proj.dir / "ATTRIBUTION.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return proj.dir / "ATTRIBUTION.md"


def cmd_style(a):
    proj = Project(a.dir)
    led = proj.load(proj.ledger, {"items": []})
    if a.unlock:
        led.pop("style", None)
    elif a.lock:
        e = proj.entry(a.lock)
        led["style"] = {"source": e["source"], "set": e.get("set"), "by": e["name"], "metrics": e.get("metrics", {}),
                        "locked": datetime.date.today().isoformat()}
    proj.save(proj.ledger, led)
    print(json.dumps(led.get("style") or "no style lock", indent=2))


def cmd_ledger(a):
    print(write_attribution(Project(a.dir)))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="opendesigner/illustrations", help="working folder in the person's project")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("sources", help="list sources; filter them, and print search links for a query")
    p.add_argument("--kind", choices=list(KINDS)); p.add_argument("--format", help="svg, png, lottie, glb, figma ...")
    p.add_argument("--no-credit", action="store_true"); p.add_argument("--api", action="store_true", help="only those the agent may fetch")
    p.add_argument("--for", dest="for_", metavar="SLOT"); p.add_argument("--q", help="print each source's search link for these words")
    p.add_argument("-v", "--verbose", action="store_true", help="search tips and limits"); p.set_defaults(fn=cmd_sources)
    p = sub.add_parser("directory", help="a browsable page (or Markdown) of every source")
    p.add_argument("--out"); p.add_argument("--open", action="store_true"); p.add_argument("--md", metavar="PATH")
    p.add_argument("--check", action="store_true", help="with --md: exit 1 if the file is stale"); p.set_defaults(fn=cmd_directory)

    def pal_args(p):
        p.add_argument("--tokens", help="tokens.css or primitives.tokens.json (default: found under opendesigner/)")
        p.add_argument("--accent", help="no tokens yet: build a quick palette from this hex")
        p.add_argument("--neutral")
        p.add_argument("--accent2")

    p = sub.add_parser("search"); p.add_argument("purpose"); p.add_argument("--slot"); p.add_argument("--query")
    p.add_argument("--source"); p.add_argument("--limit", type=int, default=20); p.add_argument("--keep", action="store_true")
    p.add_argument("--offline", action="store_true", help="print the requests as curl lines instead of fetching them")
    p.set_defaults(fn=cmd_search)
    p = sub.add_parser("rank"); p.add_argument("--purpose"); p.add_argument("--slot"); p.add_argument("--style", default="any", choices=["any", "flat", "line"])
    p.add_argument("--top", type=int, default=12); p.add_argument("--all", action="store_true")
    p.add_argument("--any-style", action="store_true", help="ignore the project's style lock"); p.set_defaults(fn=cmd_rank)
    p = sub.add_parser("style"); p.add_argument("--lock", metavar="NAME"); p.add_argument("--unlock", action="store_true")
    p.set_defaults(fn=cmd_style)
    p = sub.add_parser("fetch"); p.add_argument("ids", nargs="+"); p.add_argument("--name"); p.add_argument("--force", action="store_true")
    p.add_argument("--offline", action="store_true", help="print the download as a curl line instead of fetching it")
    p.set_defaults(fn=cmd_fetch)
    p = sub.add_parser("add"); p.add_argument("file"); p.add_argument("--source", required=True); p.add_argument("--url")
    p.add_argument("--title"); p.add_argument("--author"); p.add_argument("--licence"); p.add_argument("--name"); p.set_defaults(fn=cmd_add)
    p = sub.add_parser("palette"); pal_args(p); p.set_defaults(fn=cmd_palette)
    p = sub.add_parser("recolor"); p.add_argument("names", nargs="*"); pal_args(p)
    p.add_argument("--variants", default="light,dark,tint,mono,swap,themed"); p.add_argument("--map", action="append")
    p.add_argument("--recolor-skin", action="store_true"); p.add_argument("--max-hues", type=int); p.set_defaults(fn=cmd_recolor)
    p = sub.add_parser("sheet"); p.add_argument("names", nargs="*"); p.add_argument("--candidates", action="store_true")
    p.add_argument("--top", type=int, default=12); p.set_defaults(fn=cmd_sheet)
    p = sub.add_parser("check"); p.add_argument("files", nargs="+"); p.add_argument("--surface"); pal_args(p); p.set_defaults(fn=cmd_check)
    p = sub.add_parser("apply"); p.add_argument("name"); p.add_argument("--to", required=True)
    p.add_argument("--as", dest="as_", default="svg", choices=["svg", "react", "html"]); p.add_argument("--variant", default="themed")
    p.add_argument("--label", help="meaningful art: its accessible name; omit for decorative art (aria-hidden)")
    p.add_argument("--slot"); p.set_defaults(fn=cmd_apply)
    sub.add_parser("ledger").set_defaults(fn=cmd_ledger)
    a = ap.parse_args(argv)
    a.fn(a)


if __name__ == "__main__":
    main()

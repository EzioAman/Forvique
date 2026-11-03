#!/usr/bin/env python3
"""Tests for review.py and probe.js. Standard library only, no network, no browser.

The probe fixture (fixtures/broken-390.probe.json) is what probe.js returned for fixtures/broken.html at 390 px in Chrome 153
on 2026-09-29. broken.html holds one of every defect the checks look for, so if a check stops firing, its test fails. To run
the probe itself against a real browser, see test_probe_live.py (skipped when Playwright or Chrome is missing).

    python3 skills/opendesigner-review/scripts/test_review.py
"""
import contextlib
import copy
import io
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import review as rv  # noqa: E402

REPO = HERE.parents[2]
FIXTURE = json.loads((HERE / "fixtures" / "broken-390.probe.json").read_text())
EXAMPLE = REPO / "examples" / "devtool-dense"


def run(argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        try:
            rv.main(argv)
        except SystemExit as e:
            if e.code not in (None, 0):
                return str(e.code), out.getvalue()
    return None, out.getvalue()


def findings_for(probe, sysm=None):
    F = rv.Findings()
    rv.check_probe(probe, sysm, F)
    return F.done()


def by_case(fs):
    d = {}
    for f in fs:
        d.setdefault(f["case"], []).append(f)
    return d


def clean_probe(**over):
    """A page with nothing wrong, to prove the checks are quiet when they should be."""
    p = {"v": 1, "url": "http://localhost:3000/", "viewport": {"w": 1280, "h": 800, "dpr": 1}, "media": {"colorScheme": "light", "reducedMotion": False, "hover": True, "pointer": "fine"},
         "doc": {"lang": "en", "hOverflow": 0, "viewportMeta": "width=device-width, initial-scale=1", "blocksZoom": False, "elements": 400},
         "type": {"sizes": {"16": {"n": 30, "ex": ["p"], "chars": 900}}, "families": {"Inter": {"n": 30, "ex": ["p"], "chars": 900}}, "weights": {"400": {"n": 30, "ex": ["p"]}},
                  "smallest": {"px": 16, "sel": "p", "text": "x"}, "longLines": [], "lineHeightTight": []},
         "space": {"values": {"8": {"n": 10, "ex": ["div"]}, "16": {"n": 10, "ex": ["div"]}}, "negativeMargins": []}, "radius": {"8": {"n": 4, "ex": ["div"]}},
         "colors": {"text": {}, "bg": {}, "border": {}}, "contrast": {"checked": 5, "failing": [], "lowest": []},
         "overflow": {"list": [], "clipped": [], "scrollers": []}, "fixed": [], "targets": {"count": 3, "small": [], "noName": [], "hiddenFocusable": [], "coarse": False},
         "images": {"total": 0, "broken": [], "noAlt": [], "oversize": [], "blurry": [], "stretched": []}, "content": {"placeholders": []},
         "a11y": {"headings": {"levels": [1, 2], "h1": 1, "skips": []}, "duplicateIds": [], "states": {"checked": 3, "noHover": [], "noFocusStyle": [], "focusRingRemoved": []}},
         "fonts": {"faces": [], "failed": 0, "familyState": {"Inter": "webfont"}},
         "motion": {"running": 0, "infinite": 0, "animations": [], "transitionDurations": {}, "declared": {}, "reducedMotionRules": 1}, "media_counts": {}}
    p.update(over)
    return p


class ProbeFixture(unittest.TestCase):
    """Every planted defect in fixtures/broken.html is found, with a number that can be checked by hand."""

    @classmethod
    def setUpClass(cls):
        cls.fs = findings_for(FIXTURE)
        cls.c = by_case(cls.fs)

    def titles(self, case):
        return [f["title"] for f in self.c.get(case, [])]

    def test_sideways_scroll_names_the_wide_box(self):
        f = self.c["CV-05"][0]
        self.assertEqual(f["severity"], "error")
        self.assertIn("532 px", f["measured"])          # 900 px box + 22 px margin on a 390 px screen
        self.assertIn("div.wide", f["evidence"][0])

    def test_contrast_is_computed_not_eyeballed(self):
        f = self.c["MS-04"][0]
        self.assertIn("2.32:1", f["title"])             # #aaa on #fff: 1.05 / 0.4525 = 2.32
        self.assertEqual(f["severity"], "error")

    def test_missing_brand_font_is_an_error_even_though_the_page_looks_fine(self):
        self.assertTrue(any("Nonexistent Brand Font" in t and "missing" in t for t in self.titles("MS-03")))

    def test_focus_ring_removed_and_missing_names_and_zoom_and_lang(self):
        self.assertTrue(any("focus ring is removed" in t for t in self.titles("IN-02")))
        self.assertTrue(any("no accessible name" in t for t in self.titles("IN-03")))
        self.assertTrue(any("language" in t for t in self.titles("IN-03")))
        self.assertTrue(any("zooming" in t for t in self.titles("EN-01")))

    def test_targets_under_24px_with_no_spacing_exception(self):
        f = self.c["MS-06"][0]
        self.assertEqual(f["severity"], "error")
        self.assertIn("16x16", f["measured"])

    def test_images_and_placeholders_and_hidden_controls(self):
        titles = self.titles("MS-10")
        self.assertTrue(any("failed to load" in t for t in titles))
        self.assertTrue(any("no alt" in t for t in titles))
        self.assertTrue(any("stretched" in t for t in titles))
        self.assertEqual(self.c["ST-06"][0]["severity"], "warn")
        self.assertTrue(any("nobody can see" in t for t in self.titles("IN-08")))

    def test_motion_findings(self):
        self.assertTrue(any("no prefers-reduced-motion" in t for t in self.titles("EN-02")))
        self.assertTrue(any("loops forever" in t for t in self.titles("TM-03")))
        t9 = self.titles("TM-09")
        self.assertTrue(any("animates layout" in t for t in t9))
        self.assertTrue(any(t == "transition: all" for t in t9))

    def test_clipped_text_with_ellipsis_is_a_note_not_an_error(self):
        f = [x for x in self.c["ST-04"] if "ellipsis" in x["title"]][0]
        self.assertEqual(f["severity"], "info")

    def test_no_system_means_judging_type_and_space_on_a_grid(self):
        self.assertTrue(any("4 px grid" in t or "grid" in t for t in self.titles("MS-01")))
        self.assertFalse(self.titles("MS-08"), "no palette without a system, so no color drift")

    def test_every_finding_says_how_it_is_known(self):
        for f in self.fs:
            self.assertIn(f["basis"], rv.BASIS)
            self.assertIn(f["severity"], rv.SEV)
            self.assertTrue(f["where"] and f["title"])


class AgainstASystem(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sysm = rv.load_system(str(EXAMPLE))

    def test_loads_the_example_system(self):
        s = self.sysm
        self.assertEqual(s["prefix"], "ds")
        self.assertIn(14.0, s["type_sizes"])
        self.assertIn(8.0, s["ladder"])
        self.assertTrue(s["palette"], "colors come from build/css/tokens.css")
        self.assertIn("Inter", s["faces"])

    def test_no_system_returns_none(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertIsNone(rv.load_system(d))

    def test_drift_is_named_with_the_nearest_token_value(self):
        c = by_case(findings_for(FIXTURE, self.sysm))
        space = [f for f in c["MS-01"]][0]
        self.assertIn("13px", space["measured"])
        self.assertIn("nearest 12", space["measured"])
        ty = [f for f in c["MS-02"] if "type scale" in f["title"]][0]
        self.assertIn("15px", ty["measured"])
        self.assertIn("MS-08", c)                   # #0066cc is not a palette color
        self.assertTrue(any("radii" in f["title"] or "radius" in f["title"].lower() for f in c["MS-09"]))

    def test_a_page_on_the_system_is_quiet(self):
        p = clean_probe(type={"sizes": {"14": {"n": 30, "ex": ["p"], "chars": 900}}, "families": {"Inter": {"n": 30, "ex": ["p"], "chars": 900}}, "weights": {"400": {"n": 30, "ex": ["p"]}},
                              "smallest": {"px": 14, "sel": "p", "text": "x"}, "longLines": [], "lineHeightTight": []},
                        radius={"8": {"n": 4, "ex": ["div"]}})
        fs = findings_for(p, self.sysm)
        self.assertEqual([f["title"] for f in fs if f["severity"] in ("error", "warn")], [])


class QuietWhenClean(unittest.TestCase):
    def test_clean_page_has_no_findings(self):
        self.assertEqual(findings_for(clean_probe()), [])

    def test_a_label_breaking_across_lines_is_an_error_even_with_no_overflow(self):   # MS-15
        p = clean_probe(labels={"checked": 4, "broken": [
            {"sel": "button.reassign", "text": "Reassign", "lines": 3, "words": 1, "midWord": True, "w": 44},
            {"sel": "span.chip", "text": "Needs review", "lines": 2, "words": 2, "midWord": False, "w": 64}]})
        fs = by_case(findings_for(p))
        self.assertEqual(list(fs), ["MS-15"])          # nothing overflows, and still one finding
        f = fs["MS-15"][0]
        self.assertEqual(f["severity"], "error")
        self.assertIn("inside a word", f["measured"])
        self.assertIn("button.reassign", f["evidence"])
        self.assertEqual(findings_for(clean_probe(labels={"checked": 4, "broken": []})), [])

    def test_sparse_probe_does_not_crash(self):
        for probe in ({"v": 1}, {"v": 1, "url": "http://localhost/", "viewport": {"w": 320, "h": 600}}):
            findings_for(probe)

    def test_same_defect_at_two_viewports_is_one_finding(self):
        a = copy.deepcopy(FIXTURE)
        b = copy.deepcopy(FIXTURE)
        b["viewport"] = {"w": 320, "h": 640, "dpr": 1}
        F = rv.Findings()
        rv.check_probe(a, None, F)
        rv.check_probe(b, None, F)
        f = [x for x in F.done() if x["case"] == "CV-05"][0]
        self.assertEqual(len(f["where"]), 2)

    def test_stress_run_says_so(self):
        p = clean_probe(stress=["textSpacing"], doc={"lang": "en", "hOverflow": 40, "viewportMeta": "x", "blocksZoom": False, "elements": 9},
                        overflow={"list": [{"sel": "p", "left": 0, "right": 90, "over": 40}], "clipped": [{"sel": "h2", "text": "Pricing", "sw": 200, "cw": 100, "sh": 20, "ch": 20, "ellipsis": False, "clamp": False}], "scrollers": []})
        fs = findings_for(p)
        self.assertTrue(all("textSpacing" in f["where"][0] for f in fs))
        self.assertEqual(sorted(f["severity"] for f in fs), ["error", "error"])   # clipped text under stress is an error, not a warning

    def test_robustness_stress_is_a_warning_but_the_wcag_stresses_are_errors(self):
        over = {"doc": {"lang": "en", "hOverflow": 40, "viewportMeta": "x", "blocksZoom": False, "elements": 9}, "overflow": {"list": [{"sel": "p", "left": 0, "right": 90, "over": 40}], "clipped": [], "scrollers": []}}
        for kind, sev in (("textSpacing", "error"), ("text200", "error"), ("longWords", "warn"), ("pseudoloc", "warn"), ("rtl", "warn"), (None, "error")):
            fs = findings_for(clean_probe(stress=[kind] if kind else [], **over))
            self.assertEqual([f["severity"] for f in fs], [sev], kind)

    def test_a_phone_profile_that_zoomed_out_is_still_reported_at_its_layout_size(self):
        p = clean_probe(viewport={"w": 390, "h": 844, "innerW": 1560, "innerH": 3376, "dpr": 2}, stress=["longWords"])
        self.assertIn("390x844", rv.where_of(p))

    def test_the_font_the_page_asks_for_and_the_font_the_browser_drew_are_one_finding(self):
        F = rv.Findings()
        rv.check_probe(clean_probe(fonts={"familyState": {"Brand": "missing"}, "faces": []}, type={**clean_probe()["type"], "families": {"Brand": {"n": 9, "ex": ["p"], "chars": 400}}}), None, F)
        rv.check_fonts({"kind": "fonts", "url": "http://localhost:3000/", "viewport": {"w": 1280, "h": 800}, "media": {},
                        "rows": [{"asked": "Brand", "sel": "p", "drawn": [{"family": "Georgia", "custom": False, "glyphs": 40}]}]}, F)
        self.assertEqual(len([f for f in F.done() if f["case"] == "MS-03"]), 1)

    def test_a_sticky_sidebar_is_not_a_bar(self):
        side = {"sel": "nav.side", "position": "sticky", "top": 61, "bottom": -1, "h": 708, "w": 247}
        head = {"sel": "header", "position": "sticky", "top": 0, "bottom": 707, "h": 61, "w": 1024}
        self.assertEqual(findings_for(clean_probe(viewport={"w": 1024, "h": 768, "dpr": 1}, fixed=[head, side])), [])
        tall = dict(head, h=300, bottom=468)
        self.assertIn("CV-08", by_case(findings_for(clean_probe(viewport={"w": 1024, "h": 768, "dpr": 1}, fixed=[tall]))))

    def test_drift_is_judged_on_normal_runs_not_under_stress_or_forced_colors(self):
        sysm = {"name": "S", "type_sizes": [16.0], "ladder": [8.0, 16.0], "radii": [8.0], "radius_ladder": [8.0], "palette": {"#111111": "ds-ink"},
                "faces": ["Inter"], "weights": [400], "durations": [], "unit": 4, "modes": ["light"]}
        drift = {"type": {**clean_probe()["type"], "sizes": {"32": {"n": 30, "ex": ["p"], "chars": 900}}},
                 "space": {"values": {"10": {"n": 30, "ex": ["div"]}}, "negativeMargins": []},
                 "colors": {"text": {"#00009f": {"n": 9, "ex": ["a"]}}, "bg": {}, "border": {}}}
        cases = lambda **o: set(by_case(findings_for(clean_probe(**drift, **o), sysm)))
        self.assertTrue({"MS-01", "MS-02", "MS-08"} <= cases())
        self.assertFalse({"MS-01", "MS-02", "MS-08"} & cases(stress=["text200"]))
        self.assertFalse({"MS-01", "MS-02", "MS-08"} & cases(media={"colorScheme": "light", "forcedColors": True}))

    def test_touch_page_warns_below_44_but_only_errors_below_24_without_spacing(self):
        p = clean_probe(targets={"count": 4, "coarse": True, "noName": [], "hiddenFocusable": [], "small": [{"sel": "a.x", "w": 30, "h": 30, "spacingException": True}]})
        c = by_case(findings_for(p))
        self.assertNotIn("MS-06", c)
        self.assertIn("IN-04", c)


class FocusWalk(unittest.TestCase):
    def stop(self, i, sel="button.a", ring=True, obscured=0.0, name="Save", y=100, visible=True, fv=True):
        return {"active": True, "sel": sel, "index": i, "name": name, "focusVisible": fv, "inViewport": visible,
                "ring": {"visible": ring, "outlineStyle": "solid" if ring else "none", "outlineWidth": 2 if ring else 0, "boxShadow": "none"},
                "rect": {"x": 0, "y": y, "w": 40, "h": 20}, "obscured": {"fraction": obscured, "by": "header.sticky" if obscured else None}}

    def run_walk(self, stops):
        F = rv.Findings()
        rv.check_focus({"kind": "focus", "url": "http://localhost:3000/", "viewport": {"w": 1280, "h": 800}, "media": {}, "stops": stops}, F)
        return F.done()

    def test_no_ring_is_an_error_and_says_operated(self):
        fs = self.run_walk([self.stop(0, ring=False)])
        self.assertEqual((fs[0]["severity"], fs[0]["basis"], fs[0]["case"]), ("error", "operated", "IN-02"))

    def test_focused_control_under_a_sticky_header_is_an_error(self):
        fs = self.run_walk([self.stop(0, obscured=1.0)])
        self.assertEqual((fs[0]["severity"], fs[0]["case"]), ("error", "IN-01"))
        self.assertIn("header.sticky", fs[0]["measured"])

    def test_a_page_with_nothing_to_focus_is_not_a_keyboard_error(self):
        # checker evals, 2026-10-20: "Tab never reached any control" fired on pages with no links or buttons at all
        F = rv.Findings()
        idle = {"active": False, "sel": "body", "index": 0}
        rv.check_focus({"kind": "focus", "url": "http://localhost:3000/", "viewport": {"w": 1280, "h": 800}, "media": {}, "stops": [idle], "tabbable": 0}, F)
        self.assertEqual([f["severity"] for f in F.done()], ["info"])
        F = rv.Findings()
        rv.check_focus({"kind": "focus", "url": "http://localhost:3000/", "viewport": {"w": 1280, "h": 800}, "media": {}, "stops": [idle], "tabbable": 3}, F)
        self.assertEqual([f["severity"] for f in F.done()], ["error"])

    def test_tab_order_heuristic_is_only_a_note(self):
        stops = [self.stop(0, "a", y=900), self.stop(1, "b", y=100), self.stop(2, "c", y=1000), self.stop(3, "d", y=100)]
        self.assertEqual([f["severity"] for f in self.run_walk(stops) if "jumps back up" in f["title"]], ["info"])

    def test_three_presses_on_one_control_is_a_possible_trap(self):
        fs = self.run_walk([self.stop(i) for i in range(3)])
        self.assertTrue(any("keyboard trap" in f["title"] for f in fs))

    def test_tab_order_that_jumps_back_up(self):
        stops = [self.stop(0, "a", y=900), self.stop(1, "b", y=100), self.stop(2, "c", y=1000), self.stop(3, "d", y=100)]
        self.assertTrue(any("jumps back up" in f["title"] for f in self.run_walk(stops)))

    def test_good_walk_is_quiet(self):
        self.assertEqual(self.run_walk([self.stop(0, "a", y=10), self.stop(1, "b", y=50), self.stop(2, "c", y=90)]), [])

    def test_a_walk_that_never_reaches_a_control(self):
        fs = self.run_walk([{"active": False}, {"active": False}])
        self.assertEqual(fs[0]["severity"], "error")


class CaptureFiles(unittest.TestCase):
    def test_console_errors_and_failed_requests(self):
        F = rv.Findings()
        rv.check_console({"kind": "console", "url": "http://localhost/", "viewport": {"w": 390, "h": 800}, "media": {}, "messages": [
            {"type": "pageerror", "text": "TypeError: x is undefined"}, {"type": "http", "text": "404 http://localhost/font.woff2"}, {"type": "warning", "text": "deprecated"}]}, F)
        sev = {f["title"]: f["severity"] for f in F.done()}
        self.assertEqual(sev["Errors in the console"], "error")
        self.assertEqual(sev["Requests failed or returned an error status"], "error")

    def test_a_missing_favicon_is_not_the_apps_fault_and_one_failed_request_is_one_finding(self):
        F = rv.Findings()
        rv.check_console({"kind": "console", "url": "http://localhost/", "viewport": {"w": 390, "h": 800}, "media": {}, "messages": [
            {"type": "http", "text": "404 http://localhost/favicon.ico"}, {"type": "error", "text": "Failed to load resource: the server responded with a status of 404 (File not found)"},
            {"type": "http", "text": "404 http://localhost/font.woff2"}]}, F)
        titles = [f["title"] for f in F.done()]
        self.assertEqual(titles, ["Requests failed or returned an error status"])

    def test_layout_shift(self):
        F = rv.Findings()
        rv.check_vitals({"kind": "vitals", "url": "http://localhost/", "viewport": {"w": 390, "h": 800}, "media": {}, "cls": 0.31,
                         "shifts": [{"value": 0.3, "at": 800, "nodes": ["img.hero"]}], "longFrames": []}, F)
        self.assertEqual(F.done()[0]["severity"], "warn")

    def test_hover_that_changes_nothing(self):
        F = rv.Findings()
        rv.check_hover({"kind": "hover", "url": "http://localhost/", "viewport": {"w": 1280, "h": 800}, "media": {}, "samples": [
            {"sel": "a.x", "cursor": "pointer", "changed": {}, "moved": False}, {"sel": "button.y", "cursor": "default", "changed": {"transitionDuration": ["0s", "0s"]}, "moved": False}]}, F)
        self.assertTrue(F.done())


class Workflow(unittest.TestCase):
    """plan -> mark -> check -> finding -> report, in a temp project."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = Path(self.tmp.name)
        self.args = ["--dir", str(self.d / "review")]

    def tearDown(self):
        self.tmp.cleanup()

    def plan(self, *extra):
        err, out = run(["plan", "--url", "http://localhost:3000", "--routes", "/,/x", "--viewports", "320,390,1440", "--themes", "light,dark", *self.args, *extra])
        self.assertIsNone(err, err)
        return json.loads((self.d / "review" / "ledger.json").read_text())

    def test_plan_counts_cells(self):
        led = self.plan()
        cells = [c for c in led["cells"] if not c.startswith("task:")]
        tasks = [c for c in led["cells"] if c.startswith("task:")]
        self.assertEqual(len(cells), 2 * 3 * 2)
        self.assertEqual(len(tasks), 2 * 9)
        self.assertTrue(all(v["status"] == "todo" for v in led["cells"].values()))

    def test_plan_uses_the_systems_modes(self):
        err, out = run(["plan", "--url", "http://localhost:3000", "--project", str(EXAMPLE), "--dir", str(self.d / "review")])
        self.assertIsNone(err, err)
        self.assertIn("light, dark", out)
        plan = json.loads((self.d / "review" / "plan.json").read_text())
        self.assertEqual(plan["system"], "Devtool Dense")
        self.assertIn("320x640", plan["viewports"])

    def test_replanning_keeps_finished_cells(self):
        self.plan()
        run(["mark", "/|320x640|light", "done", *self.args])   # not a real cell (size differs): rejected
        run(["mark", "/|390x844|light", "done", "--evidence", "a.png", *self.args])
        led = self.plan()
        self.assertEqual(led["cells"]["/|390x844|light"]["status"], "done")

    def test_skipping_needs_a_reason(self):
        self.plan()
        err, _ = run(["mark", "/|390x844|dark", "skipped", *self.args])
        self.assertIn("say why", err)
        err, out = run(["mark", "/|390x844|dark", "skipped", "--why", "no dark theme in this app", *self.args])
        self.assertIsNone(err, err)

    def test_partial_cell_name_must_be_unique(self):
        self.plan()
        err, _ = run(["mark", "390x844", "done", *self.args])
        self.assertIn("matches", err)

    def test_report_is_incomplete_until_every_cell_is_done_or_skipped_with_a_reason(self):
        led = self.plan()
        (self.d / "probe.json").write_text(json.dumps(clean_probe()))
        run(["check", str(self.d / "probe.json"), *self.args])
        err, out = run(["report", *self.args])
        self.assertIn("INCOMPLETE", out)
        for c in led["cells"]:
            run(["mark", c, "done", "--evidence", "x.png", *self.args])
        err, out = run(["report", *self.args])
        self.assertIn("NO ERRORS FOUND", out)
        text = (self.d / "review" / "REPORT.md").read_text()
        self.assertNotRegex(text.lower(), r"looks good|all good|passes?\b")
        self.assertIn("not the same as correct", text)

    def test_errors_make_the_verdict_fail_whatever_the_coverage(self):
        self.plan()
        (self.d / "probe.json").write_text(json.dumps(FIXTURE))
        err, out = run(["check", str(self.d / "probe.json"), *self.args])
        self.assertIsNone(err, err)
        err, out = run(["report", *self.args])
        self.assertIn("FAIL", out)
        text = (self.d / "review" / "REPORT.md").read_text()
        self.assertIn("## What was not checked", text)
        self.assertIn("**measured**", text)

    def test_no_plan_is_never_a_pass(self):
        (self.d / "probe.json").write_text(json.dumps(clean_probe()))
        run(["check", str(self.d / "probe.json"), *self.args])
        err, out = run(["report", *self.args])
        self.assertIn("INCOMPLETE", out)

    def test_human_findings_need_evidence_and_cannot_claim_to_be_measured(self):
        err, _ = run(["finding", "hero looks off", "--severity", "warn", "--basis", "seen", *self.args])
        self.assertIn("evidence", err)
        err, _ = run(["finding", "x", "--severity", "warn", "--basis", "measured", "--evidence", "a.png", *self.args])
        self.assertIn("measured findings come from", err)
        err, _ = run(["finding", "the hero image crops the face at 390 px", "--severity", "warn", "--basis", "seen", "--evidence", "shots/a.png", "--where", "/, 390, light", *self.args])
        self.assertIsNone(err, err)
        err, _ = run(["finding", "the menu might trap focus", "--severity", "info", "--basis", "inferred", *self.args])
        self.assertIsNone(err, err)
        run(["report", *self.args])
        text = (self.d / "review" / "REPORT.md").read_text()
        self.assertIn("**seen**", text)
        self.assertIn("unverified", text)

    def test_second_check_on_the_same_files_reports_what_was_resolved(self):
        p = self.d / "probe.json"
        p.write_text(json.dumps(FIXTURE))
        run(["check", str(p), *self.args])
        fixed = copy.deepcopy(FIXTURE)
        fixed["doc"]["hOverflow"] = 0
        fixed["overflow"]["list"] = []
        p.write_text(json.dumps(fixed))
        err, out = run(["check", str(p), *self.args])
        self.assertIn("resolved", out)
        self.assertIn("The page scrolls sideways", out)

    def test_a_different_set_of_files_is_not_compared(self):
        (self.d / "a.json").write_text(json.dumps(FIXTURE))
        (self.d / "b.json").write_text(json.dumps(clean_probe()))
        run(["check", str(self.d / "a.json"), *self.args])
        err, out = run(["check", str(self.d / "b.json"), *self.args])
        self.assertIn("different set of files", out)
        self.assertNotIn("resolved:", out)

    def test_check_reads_a_whole_review_folder_and_skips_missing_subfolders(self):
        rd = self.d / "review"
        (rd / "probes").mkdir(parents=True)
        (rd / "probes" / "home-390-light.json").write_text(json.dumps(FIXTURE))
        (rd / "console").mkdir()
        (rd / "console" / "home-390-light.json").write_text(json.dumps({"kind": "console", "url": "http://localhost:3000/", "viewport": {"w": 390, "h": 844}, "media": {},
                                                                         "messages": [{"type": "pageerror", "text": "TypeError: x is undefined"}]}))
        (rd / "plan.json").write_text("{}")   # top-level files are not inputs
        err, out = run(["check", str(rd), *self.args])
        self.assertIsNone(err, err)
        self.assertIn("checked 2 probe run(s)", out)
        self.assertIn("Errors in the console", out)
        err, out = run(["check", str(rd / "probes"), *self.args])
        self.assertIn("checked 1 probe run(s)", out)
        (self.d / "empty").mkdir()
        err, out = run(["check", str(self.d / "empty"), *self.args])
        self.assertIn("no probe or capture files", err)

    def test_sheet_lists_screenshots(self):
        shots = self.d / "review" / "shots"
        shots.mkdir(parents=True)
        (shots / "a.png").write_bytes(b"\x89PNG")
        err, out = run(["sheet", *self.args])
        self.assertIsNone(err, err)
        self.assertIn("shots/a.png", (self.d / "review" / "sheet.html").read_text())


class Serve(unittest.TestCase):
    """review.py serve: loopback only, one random path, validated documents only."""

    def setUp(self):
        import threading
        from http.server import ThreadingHTTPServer
        self.tmp = tempfile.TemporaryDirectory()
        self.rd = Path(self.tmp.name) / "review"
        self.token = "abc123def456"
        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), rv.make_handler(self.rd, self.token))
        self.base = f"http://127.0.0.1:{self.srv.server_address[1]}/t/{self.token}/"
        self.th = threading.Thread(target=self.srv.serve_forever, daemon=True)
        self.th.start()

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()
        self.tmp.cleanup()

    def call(self, url, data=None, headers=None):
        import urllib.error
        import urllib.request
        req = urllib.request.Request(url, data=data, method="POST" if data is not None else "GET", headers=headers or {})
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return r.status, r.read(), dict(r.headers)
        except urllib.error.HTTPError as e:
            return e.code, e.read(), {}

    def test_serves_the_probe_and_nothing_else(self):
        code, body, h = self.call(self.base + "probe.js")
        self.assertEqual(code, 200)
        self.assertEqual(body, (HERE / "probe.js").read_bytes())
        self.assertEqual(h.get("Access-Control-Allow-Origin"), "*")
        self.assertEqual(self.call(self.base.replace(self.token, "wrongtoken") + "probe.js")[0], 404)
        self.assertEqual(self.call(self.base + "review.py")[0], 404)
        self.assertEqual(self.call(self.base.rsplit("/t/", 1)[0] + "/probe.js")[0], 404)

    def test_saves_a_probe_and_a_focus_walk(self):
        code, body, _ = self.call(self.base + "save?name=Home-390-Light", json.dumps(clean_probe()).encode())
        self.assertEqual(code, 200, body)
        self.assertTrue((self.rd / "probes" / "home-390-light.json").exists())
        code, _, _ = self.call(self.base + "save?name=tab", json.dumps({"kind": "focus", "stops": []}).encode())
        self.assertEqual(code, 200)
        self.assertTrue((self.rd / "focus" / "tab.json").exists())

    def test_refuses_other_documents_other_paths_and_big_bodies(self):
        self.assertEqual(self.call(self.base + "save?name=x", b'{"hello": 1}')[0], 400)
        self.assertEqual(self.call(self.base + "save?name=x", b"not json")[0], 400)
        self.assertEqual(self.call(self.base + "other?name=x", b"{}")[0], 404)
        self.assertEqual(self.call(self.base + "save?name=x", b"")[0], 413)

    def test_a_name_cannot_leave_the_review_folder(self):
        code, _, _ = self.call(self.base + "save?name=../../outside", json.dumps(clean_probe()).encode())
        self.assertEqual(code, 200)
        files = [p for p in Path(self.tmp.name).rglob("*.json")]
        self.assertEqual(len(files), 1)
        self.assertTrue(str(files[0]).startswith(str(self.rd / "probes")), files[0])

    def test_loader_is_one_short_call(self):
        js = rv.loader_js(self.base, "home-390-light")
        self.assertLess(len(js), 700)
        self.assertIn(self.base, js)
        self.assertIn("home-390-light", js)


def tiny_png(w, h):
    """A white PNG of w x h pixels, made with the standard library."""
    import struct, zlib
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + b"\xff\xff\xff" * w for _ in range(h))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


class Compare(unittest.TestCase):
    """review.py compare: the page today, the audit drawn on it, and the fix, switched with the house picker."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        for name, (w, h) in (("before.png", (200, 100)), ("after.png", (200, 80))):
            (self.tmp / name).write_bytes(tiny_png(w, h))
        self.marks = {"page": {"w": 100, "h": 50}, "marks": [{"n": 1, "title": "Gray text is hard to read", "gives": "dates readable for everyone",
                                                               "rect": [10, 5, 50, 10], "before": "2.5:1", "after": "7.2:1"}]}

    def compare(self, marks, *extra):
        (self.tmp / "marks.json").write_text(json.dumps(marks))
        return run(["compare", "--dir", str(self.tmp), "--before", str(self.tmp / "before.png"), "--after", str(self.tmp / "after.png"),
                    "--marks", str(self.tmp / "marks.json"), *extra])

    def test_three_views_with_boxes_where_the_issues_are(self):
        err, _ = self.compare(self.marks)
        self.assertIsNone(err)
        page = (self.tmp / "compare.html").read_text()
        for view in ("Today", "Audit", "Fixed"):
            self.assertIn(f'data-od-variant="{view}"', page)
        self.assertIn("left:10.000%;top:10.000%;width:50.000%;height:20.000%", page)  # page coordinates as a share of the page
        self.assertIn("Fixing this makes dates readable for everyone", page)
        self.assertIn("2.5:1 &rarr; 7.2:1", page)
        self.assertIn("aspect-ratio:1 / 0.5000", page)  # the taller page sets the height of every view (after.png is 200 x 80)
        self.assertIn('aria-label", "Prototype variants"', page)  # the house picker, inlined
        self.assertNotIn("</script>", page.split("<script>", 1)[1][:-len("</script>\n</html>\n")])  # nothing ends the inline script early

    def test_every_fix_must_say_what_it_gives(self):
        m = copy.deepcopy(self.marks)
        del m["marks"][0]["gives"]
        err, _ = self.compare(m)
        self.assertIn("needs a title (the issue) and gives", err)

    def test_odd_marks_are_refused_or_mended_never_a_crash(self):
        m = copy.deepcopy(self.marks)
        m["marks"][0]["gives"] = "   "
        err, _ = self.compare(m)
        self.assertIn("needs a title (the issue) and gives", err)
        m = copy.deepcopy(self.marks)
        del m["marks"][0]["n"]
        m["marks"][0].update(before=2.5, after=7.2, gives="WCAG AA contrast on every label")
        err, _ = self.compare(m)
        self.assertIsNone(err)
        page = (self.tmp / "compare.html").read_text()
        self.assertIn("2.5 &rarr; 7.2", page)
        self.assertIn("Fixing this makes WCAG AA contrast", page)  # an acronym keeps its capitals
        self.assertIn('class="mk todo edge"', page)                 # a box near the edge keeps its number inside the frame

    def test_the_report_itself_meets_the_contrast_floor(self):
        self.compare(self.marks)
        page = (self.tmp / "compare.html").read_text()
        for gone in ("#e5484d", "#12a150", "#71717a"):  # white on these, or this on #f4f4f5, was under 4.5:1
            self.assertNotIn(gone, page)
        lum = lambda h: sum(w * (c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
                            for w, c in zip((0.2126, 0.7152, 0.0722), (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))))
        ratio = lambda a, b: (max(lum(a), lum(b)) + 0.05) / (min(lum(a), lum(b)) + 0.05)
        for fg, bg in (("#ffffff", "#c8202e"), ("#ffffff", "#12804a"), ("#52525b", "#f4f4f5")):
            self.assertIn(bg if bg != "#f4f4f5" else fg, page)
            self.assertGreaterEqual(ratio(fg, bg), 4.5, (fg, bg))

    def test_a_mark_that_found_nothing_is_refused(self):
        m = copy.deepcopy(self.marks)
        m["marks"][0] = {"n": 1, "title": "x", "gives": "y", "missing": True}
        err, _ = self.compare(m)
        self.assertIn("found no element on the page", err)


class Guarantees(unittest.TestCase):
    """The probe runs in the person's page. It must not send anything anywhere or run code it was not given."""

    def test_probe_js_makes_no_requests_and_evaluates_nothing(self):
        src = re.sub(r"/\*.*?\*/", "", (HERE / "probe.js").read_text(), flags=re.S)
        for banned in ("fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "eval(", "new Function", "import(", "localStorage", "sessionStorage", "document.cookie", ".click(", ".submit("):
            self.assertNotIn(banned, src, banned)

    def test_picker_js_makes_no_requests_and_evaluates_nothing(self):
        src = re.sub(r"/\*.*?\*/", "", (REPO / "skills" / "opendesigner" / "assets" / "picker.js").read_text(), flags=re.S)
        for banned in ("fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "eval(", "new Function", "import(", "localStorage", "sessionStorage", "document.cookie", "innerHTML"):
            self.assertNotIn(banned, src, banned)

    def test_review_py_uses_no_network_libraries_and_serves_loopback_only(self):
        src = (HERE / "review.py").read_text()
        for banned in ("import requests", "urllib.request", "http.client", "import socket", "subprocess", "0.0.0.0", 'ThreadingHTTPServer(("",'):
            self.assertNotIn(banned, src, banned)
        self.assertEqual(src.count("ThreadingHTTPServer("), 1)
        self.assertIn('ThreadingHTTPServer(("127.0.0.1", args.port)', src)

    def test_capture_py_never_clicks_or_types(self):
        src = (HERE / "capture.py").read_text()
        code = re.sub(r'""".*?"""', "", src, flags=re.S)
        for banned in (".click(", ".fill(", ".type(", ".press('Enter", '.press("Enter', "press('Space", ".check(", ".select_option(", ".set_input_files"):
            self.assertNotIn(banned, code, banned)
        self.assertNotIn("allow-remote", src)

    def test_capture_py_opens_loopback_addresses_only(self):
        import capture
        for host in ("localhost", "app.localhost", "127.0.0.1", "127.4.5.6", "::1", "[::1]"):
            self.assertTrue(capture.is_loopback(host), host)
        for host in ("", "0.0.0.0", "192.168.1.10", "10.0.0.2", "example.com", "staging.test", "localhost.example.com"):
            self.assertFalse(capture.is_loopback(host), host)

    def test_every_case_id_review_py_uses_is_in_the_catalogue(self):
        cat = json.loads((HERE.parent / "references" / "cases.json").read_text())
        ids = {c["id"] for c in cat["cases"]}
        used = set(re.findall(r'"((?:CV|TM|ST|MS|IN|EN|PR)-\d\d)"', (HERE / "review.py").read_text()))
        self.assertTrue(used)
        self.assertEqual(sorted(used - ids), [])


if __name__ == "__main__":
    unittest.main(verbosity=1)

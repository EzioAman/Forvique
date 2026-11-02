#!/usr/bin/env python3
"""Tests for research.py and its place in the flow: the findings checks, the signal table against the questions, the
recommendations (never over the person's own answer), PRODUCT.md, review, the reminders after sketch and build, and the
instructions that put the step at the right time. Standard library only, no network.

    python3 skills/opendesigner/scripts/test_research.py
"""
import contextlib
import copy
import datetime as dt
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent
sys.path.insert(0, str(HERE))
import research  # noqa: E402
import engine as e  # noqa: E402

EXAMPLE = SKILL / "assets/output/research-users.example.json"
ENGINE = HERE / "engine.py"


def quiet(fn, *a, **k):
    with contextlib.redirect_stdout(io.StringIO()):
        return fn(*a, **k)


def run(d, *args):
    return subprocess.run([sys.executable, str(ENGINE), "--dir", str(d), *args], capture_output=True, text=True, timeout=300)


def example():
    return json.loads(EXAMPLE.read_text(encoding="utf-8"))


def errors(rec):
    return [t for l, t in research.problems(rec) if l == "error"]


class SignalTable(unittest.TestCase):
    """Every recommendation must land on a question and option the engine really has, or the step would write junk."""

    def test_every_effect_is_a_real_question_and_option(self):
        qs = e.questions()
        for sid, spec in research.SIGNALS.items():
            for qid, val in spec["effects"].items():
                self.assertIn(qid, qs, f"{sid} -> {qid} is not a question")
                opts = e.option_values(qs[qid])
                for v in val if isinstance(val, list) else [val]:
                    self.assertIn(v, opts, f"{sid} -> {qid}={v} is not an option of {qid}")
                self.assertEqual(isinstance(val, list), qid not in research.SINGLE, f"{qid}: single questions take one value")

    def test_every_signal_does_something(self):
        for sid, spec in research.SIGNALS.items():
            self.assertTrue(spec["effects"] or spec.get("note"), sid)
            self.assertTrue(spec["plain"], sid)

    def test_no_signal_lowers_an_accessibility_floor(self):
        for sid, spec in research.SIGNALS.items():
            self.assertNotEqual(spec["effects"].get("Q-aud-03"), "wcag22-a", sid)

    def test_topics_have_searches_and_tools_are_unique(self):
        self.assertEqual(set(research.QUERY_TEMPLATES), set(research.TOPICS))
        self.assertEqual(len(research.TOOL_IDS), len(set(research.TOOL_IDS)))
        self.assertIn("last30days", research.TOOL_IDS)
        self.assertTrue(set(research.NEEDS_ONE_OF) <= set(research.TOOL_IDS))

    def test_engine_knows_the_status(self):
        self.assertIn("research", e.SET_BY)
        self.assertIn("research", e.PERSON_SET_BY)
        self.assertIn("Users", e.PRODUCT_SECTIONS)


class Checks(unittest.TestCase):
    def test_the_example_passes(self):
        self.assertEqual(errors(example()), [])

    def test_a_finding_without_a_source_fails_unless_inferred(self):
        rec = example()
        rec["findings"][0]["sources"] = []
        self.assertTrue(any("cites no source" in t for t in errors(rec)))
        rec["findings"][0]["confidence"] = "inferred"
        self.assertEqual(errors(rec), [])

    def test_unknown_source_signal_topic_and_confidence_fail(self):
        rec = example()
        rec["findings"][0]["sources"] = ["S99"]
        rec["findings"][1]["signals"] = ["rich-users"]
        rec["findings"][2]["topic"] = "money"
        rec["findings"][3]["confidence"] = "sure"
        errs = " | ".join(errors(rec))
        for bit in ("S99", "rich-users", "topic must be", "confidence must be"):
            self.assertIn(bit, errs)

    def test_a_source_needs_a_page_or_a_dated_note(self):
        rec = example()
        rec["sources"][0]["url"] = "a survey I remember"
        self.assertTrue(any("needs a url" in t for t in errors(rec)))
        rec["sources"][0]["url"] = "interview, 2026-10-20"
        self.assertEqual(errors(rec), [])

    def test_personal_data_is_refused(self):
        for bad in ("Write to ravi.k@mail.example for details.", "Call +91 98765 43210 to order.", "As @priya_sharma said, it is slow."):
            rec = example()
            rec["findings"][2]["text"] = bad
            self.assertTrue(any("personal data" in t for t in errors(rec)), bad)

    def test_missing_basics_fail(self):
        self.assertTrue(errors({}))
        rec = example()
        rec["brief"] = " "
        rec["date"] = "last week"
        rec["findings"] = []
        errs = " | ".join(errors(rec))
        self.assertIn("brief", errs)
        self.assertIn("date", errs)
        self.assertIn("findings is empty", errs)

    def test_forums_are_not_measured(self):
        rec = example()
        rec["findings"][4]["confidence"] = "measured"  # F5 cites only the forum
        warns = [t for l, t in research.problems(rec) if l == "warning"]
        self.assertTrue(any("only forums" in t for t in warns))

    def test_check_command(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad = Path(tmp, "bad.json")
            bad.write_text(json.dumps({"brief": "x"}), encoding="utf-8")
            self.assertEqual(run(Path(tmp, "od"), "research", "check", str(EXAMPLE)).returncode, 0)
            r = run(Path(tmp, "od"), "research", "check", str(bad))
            self.assertEqual(r.returncode, 1)
            self.assertIn("error", r.stdout)


class Project(unittest.TestCase):
    """A sketched project in a temporary folder."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = tmp.name
        self.d = os.path.join(tmp.name, "opendesigner")
        self.sketch = run(self.d, "sketch", "--name", "Pillbox", "--audience", "regular", "--platforms", "ios,android",
                          "--feel", "calm,friendly")
        self.assertEqual(self.sketch.returncode, 0, self.sketch.stdout + self.sketch.stderr)

    def write(self, rec, name="users.json"):
        p = Path(self.root, name)
        p.write_text(json.dumps(rec), encoding="utf-8")
        return str(p)

    def state(self):
        return e.merge_defaults(e.load_state(self.d))

    def product(self):
        return Path(self.root, "PRODUCT.md").read_text(encoding="utf-8")

    # --- the right time: reminders until done or skipped
    def test_sketch_and_build_remind_until_done(self):
        self.assertIn("engine.py research plan", self.sketch.stdout)
        self.assertIn("engine.py research plan", run(self.d, "build").stdout)
        self.assertEqual(run(self.d, "research", "add", str(EXAMPLE)).returncode, 0)
        self.assertNotIn("research plan", run(self.d, "build").stdout)

    def test_skip_stops_the_reminder_and_is_recorded(self):
        r = run(self.d, "research", "skip", "--why", "we interview our own customers")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertNotIn("research plan", run(self.d, "build").stdout)
        self.assertIn("Not researched: we interview our own customers", self.product())
        self.assertNotEqual(run(self.d, "research", "skip").returncode, 0)  # --why is required

    def test_plan_names_missing_tools_and_never_invents_users(self):
        r = run(self.d, "research", "plan", "--tools", "web-search")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("not known yet", r.stdout)          # the sketch gave no users line: ask, don't invent
        self.assertIn("last30days", r.stdout)
        self.assertIn("Mobbin", r.stdout)
        plan = json.loads(Path(self.d, research.PLAN).read_text(encoding="utf-8"))
        self.assertEqual(plan["brief"], "")
        self.assertIn("<the users>", plan["queries"][0]["query"])
        self.assertEqual(self.state()["research"]["status"], "planned")
        r = run(self.d, "research", "plan", "--brief", "pharmacy customers over 55, on Android", "--tools", "browser,last30days")
        plan = json.loads(Path(self.d, research.PLAN).read_text(encoding="utf-8"))
        self.assertTrue(plan["brief_confirmed"])
        self.assertTrue(all("pharmacy customers over 55" in q["query"] or "<" not in q["query"] for q in plan["queries"]))
        self.assertNotIn("Missing: The /last30days skill", r.stdout)
        self.assertNotEqual(run(self.d, "research", "plan", "--tools", "telepathy").returncode, 0)

    def test_no_web_tool_offers_the_template(self):
        r = run(self.d, "research", "plan", "--tools", "mobbin")
        self.assertIn("Nothing here can read the web", r.stdout)

    # --- add: saves, renders, recommends, changes nothing without a yes
    def test_add_saves_and_recommends_but_changes_nothing(self):
        before = copy.deepcopy(self.state()["answers"])
        r = run(self.d, "research", "add", str(EXAMPLE))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.state()["answers"], before)
        self.assertTrue(Path(self.d, research.FILE).is_file())
        md = Path(self.d, research.DOC).read_text(encoding="utf-8")
        for bit in ("## Findings", "## Sources", "[S1]", "desk research", "## What it means for the design system"):
            self.assertIn(bit, md.lower() if bit == "desk research" else md)
        self.assertIn("## Users", self.product())
        self.assertIn("Researched", self.product())
        st = self.state()["research"]
        self.assertEqual((st["status"], st["findings"], st["sources"]), ("done", 7, 4))
        props = {p["question"]: p for p in st["proposals"]}
        self.assertEqual(props["Q-aud-01"]["status"], "differs")   # the sketch said regular: ask, never overwrite
        self.assertEqual(props["Q-aud-02"]["status"], "new")
        self.assertIn("ASK", r.stdout)

    def test_add_refuses_a_bad_file_and_saves_nothing(self):
        rec = example()
        rec["findings"][0]["sources"] = ["S42"]
        r = run(self.d, "research", "add", self.write(rec))
        self.assertEqual(r.returncode, 1)
        self.assertIn("Nothing was saved", r.stdout)
        self.assertFalse(Path(self.d, research.FILE).exists())
        self.assertNotEqual(self.state()["research"].get("status"), "done")

    def test_accept_applies_new_ones_with_set_by_research(self):
        r = run(self.d, "research", "add", str(EXAMPLE), "--accept")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        ans = self.state()["answers"]
        self.assertEqual(e.answer_value(ans["Q-aud-02"]), "high-trust")
        self.assertEqual(e.answer_value(ans["Q-aud-01"]), "regular")      # differs: untouched without --only
        a4 = e.answer_value(ans["Q-aud-04"])
        self.assertIn("text-size", a4)                                      # the default it had is kept
        self.assertIn("contrast", a4)
        dec = e._decisions(self.d)
        self.assertEqual(dec["answers.Q-aud-02"]["set_by"], "research")
        log = Path(self.d, "decisions.md").read_text(encoding="utf-8")
        self.assertIn("source_ref: research/users.json", log)
        self.assertEqual(run(self.d, "build").returncode, 0)

    def test_only_names_the_ones_the_person_agreed_to(self):
        run(self.d, "research", "add", str(EXAMPLE))
        r = run(self.d, "research", "add", os.path.join(self.d, research.FILE), "--accept", "--only", "Q-aud-01")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        ans = self.state()["answers"]
        self.assertEqual(e.answer_value(ans["Q-aud-01"]), "large")         # they agreed to change their own answer
        self.assertNotIn("Q-aud-03", ans)                                   # not named, not applied
        self.assertEqual(run(self.d, "build").returncode, 0)

    def test_findings_that_disagree_become_a_question(self):
        rec = example()
        rec["findings"].append({"id": "F8", "topic": "context", "text": "Pharmacy staff use the same app all day at the counter.",
                                "confidence": "reported", "sources": ["S2"], "signals": ["all-day-work"]})
        rec["findings"][4]["signals"] = []  # leave older-users (large) against all-day-work (dense)
        run(self.d, "research", "add", self.write(rec), "--accept")
        st = self.state()["research"]
        self.assertTrue(any("Q-aud-01" in c for c in st["conflicts"]))
        self.assertNotIn("Q-aud-01", [p["question"] for p in st["proposals"]])
        self.assertEqual(e.answer_value(self.state()["answers"]["Q-aud-01"]), "regular")
        self.assertIn("Open:", self.product())

    # --- review keeps checking it
    def test_review_reports_missing_research_then_broken_and_old_files(self):
        r = run(self.d, "review")
        self.assertIn("User research: The users have not been researched yet", r.stdout)
        self.assertEqual(run(self.d, "review", "--strict").returncode, 0)   # optional: a note, not a failure
        run(self.d, "research", "add", str(EXAMPLE))
        self.assertNotIn("User research", run(self.d, "review").stdout)
        fp = Path(self.d, research.FILE)
        rec = json.loads(fp.read_text(encoding="utf-8"))
        rec["sources"] = rec["sources"][1:]                                # a source lost by hand
        fp.write_text(json.dumps(rec), encoding="utf-8")
        r = run(self.d, "review", "--strict")
        self.assertEqual(r.returncode, 1)
        self.assertIn("S1, which is not in sources", r.stdout)
        st = e.load_state(self.d)
        st["research"]["date"] = (dt.date.today() - dt.timedelta(days=research.STALE_DAYS + 20)).isoformat()
        e.dump_json(os.path.join(self.d, "state.json"), st)
        self.assertIn("days old", run(self.d, "review").stdout)
        j = json.loads(run(self.d, "review", "--json").stdout)
        self.assertEqual(j["research"]["status"], "done")
        self.assertTrue(j["research"]["errors"])

    def test_skip_after_research_is_refused(self):
        run(self.d, "research", "add", str(EXAMPLE))
        self.assertNotEqual(run(self.d, "research", "skip", "--why", "x").returncode, 0)

    def test_product_md_never_claims_research_that_was_not_done(self):
        self.assertIn("Not researched yet", self.product() if Path(self.root, "PRODUCT.md").exists()
                      else research.product_section(self.state()))
        self.assertEqual(research.product_section({"research": {"status": "planned"}}).split(",")[0], "Research planned")


class Process(unittest.TestCase):
    """The instructions put the step at the right time and stay in step with the code."""

    def read(self, rel):
        return (SKILL / rel).read_text(encoding="utf-8")

    def test_skill_points_to_the_step(self):
        s = self.read("SKILL.md")
        self.assertIn("references/research.md", s)
        self.assertIn("engine.py research", s)
        self.assertIn("/last30days", s)

    def test_the_offer_after_the_sketch_starts_with_research(self):
        z = self.read("references/zoom.md")
        offer = z.split("## The offer after every level", 1)[1]
        self.assertLess(offer.index("research"), offer.index("Offer at most 3 choices"))

    def test_research_md_lists_every_signal_tool_and_topic(self):
        r = self.read("references/research.md")
        for sid in research.SIGNALS:
            self.assertIn(f"`{sid}`", r, sid)
        for t in research.TOOL_IDS:
            self.assertIn(f"`{t}`", r, t)
        self.assertEqual(len(re.findall(r"^\d\. \*\*(Who|Context|Apps|Expectations|Preferences that touch design|Accessibility):\*\*", r,
                                        flags=re.M)), len(research.TOPICS))

    def test_status_is_documented_and_extend_checks_it(self):
        self.assertIn("| `research` |", self.read("references/rules.md"))
        ext = (SKILL.parent / "opendesigner-extend/SKILL.md").read_text(encoding="utf-8")
        self.assertIn("research.md", ext)


if __name__ == "__main__":
    unittest.main(verbosity=1)

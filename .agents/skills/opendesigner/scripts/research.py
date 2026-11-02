#!/usr/bin/env python3
"""User research: who the product's users are, what they already use and expect, and what that means for the system.

The agent does the searching (web search, a browser, /last30days, Mobbin, the product's own analytics). This module plans
it, checks what came back, and turns the findings into recommended answers to questions the engine already asks. It never
fetches anything and never changes a value without the person's yes. Standard library only, no network.

    engine.py research plan [--brief "..."] [--tools web-search,browser,...] [--json]
    engine.py research check <findings.json> [--json]
    engine.py research add <findings.json> [--accept [--only Q-aud-01,...]] [--json]
    engine.py research skip --why "..."
    engine.py research status [--json]

Files (in the state folder): research/plan.json, research/users.json (the findings, canonical) and research/users.md (the
same findings for people, rendered). state.json keeps a short summary under "research". Values it sets carry
set_by "research" and source_ref "research/users.json". The method: references/research.md.
"""
from __future__ import annotations

import copy
import datetime as _dt
import json
import os
import re

FILE = "research/users.json"
PLAN = "research/plan.json"
DOC = "research/users.md"
STALE_DAYS = 180  # findings about people change; review asks for a refresh after about six months [inferred]

# The six things the research answers (references/research.md section 3). Each topic gets at least one search.
TOPICS = {
    "who": "Who they are: age range, region, languages, reading level, devices and network",
    "context": "Where and how they use it: how often, how long, one hand or two, light, noise, interruptions",
    "apps": "The apps they already use every day, and the patterns those apps have taught them",
    "expectations": "What they expect and what frustrates them: reviews, forums, complaints, published studies",
    "preferences": "Preferences that touch design: text size, dark mode, density, colour meanings in their culture",
    "accessibility": "Access needs common in the group: vision, motor, hearing, cognitive, situational",
}
QUERY_TEMPLATES = {  # starting points; the agent rewrites them in the users' own words and adds the industry's terms
    "who": ["{users} demographics survey", "{users} devices smartphone usage statistics"],
    "context": ["{users} day in the life workflow", "how {users} use {product} at work OR at home"],
    "apps": ["apps {users} use every day", "most popular apps among {users}"],
    "expectations": ["{product} app reviews complaints", "{users} frustrations with software forum"],
    "preferences": ["{users} preferences font size dark mode", "{users} design preferences study"],
    "accessibility": ["{users} accessibility needs", "{users} vision OR dexterity OR literacy statistics"],
}
CONFIDENCE = ("measured", "reported", "inferred")  # measured: a study or statistic; reported: people say so; inferred: reasoning
SOURCE_KINDS = ("study", "survey", "official-stats", "app-store-reviews", "forum", "community", "article", "analytics", "interview",
                "person", "mobbin")
PERSON_SOURCE = re.compile(r"^(person|interview|analytics)\s*,\s*\d{4}-\d\d-\d\d$", re.I)

# Tools the agent looks for before it starts. The engine cannot see the agent's tools: the agent says which it has (--tools),
# and the plan names every missing one with what it would add, once.
TOOLS = [
    {"id": "web-search", "name": "Web search", "look_for": "a search tool (WebSearch, web_search, a search MCP)",
     "adds": "statistics, studies and articles about the group; the base of the research"},
    {"id": "browser", "name": "A browser", "look_for": "WebFetch, an in-app browser, Chrome, Playwright",
     "adds": "opens the pages a search finds, and app-store reviews, so a finding cites the page itself, not a snippet"},
    {"id": "last30days", "name": "The /last30days skill", "look_for": "a skill named last30days",
     "adds": "what these users said in the last 30 days on Reddit, X, YouTube and Hacker News: live habits and complaints",
     "get": "https://github.com/mvanhorn/last30days-skill"},
    {"id": "mobbin", "name": "Mobbin", "look_for": "tools named like search_screens, search_flows",
     "adds": "the real screens of the apps these users already use, to see the patterns they know"},
    {"id": "deep-research", "name": "A deep research tool", "look_for": "a deep-research skill or agent",
     "adds": "a long report across many sources, for a group little is written about"},
    {"id": "analytics", "name": "The product's own analytics", "look_for": "PostHog, Google Analytics, Amplitude or Mixpanel tools or exports",
     "adds": "how existing users really behave (devices, screen sizes, dark mode share); beats desk research when the product is live"},
]
TOOL_IDS = [t["id"] for t in TOOLS]
NEEDS_ONE_OF = ("web-search", "browser", "last30days", "deep-research")  # without one of these there is nothing to read

# Signals: what a finding says about the users, in a closed list, so every recommendation traces to a question the engine
# already asks. effects: question -> option value (a list adds to a multi-select). notes go to PRODUCT.md and the later stages.
SIGNALS = {
    "older-users": {"plain": "many users are older (about 60 and up)",
                    "effects": {"Q-aud-01": "large", "Q-aud-04": ["text-size", "situational"]}},
    "low-vision": {"plain": "low vision is common in the group",
                   "effects": {"Q-aud-03": "wcag22-aa-plus", "Q-aud-04": ["text-size", "contrast"]}},
    "all-day-work": {"plain": "they use it all day for work, on a desktop",
                     "effects": {"Q-aud-01": "dense", "Q-aud-02": "work"}},
    "everyday-use": {"plain": "they use it often, in everyday life", "effects": {"Q-aud-01": "regular"}},
    "occasional-mobile": {"plain": "they use it now and then, mostly on a phone or in public",
                          "effects": {"Q-aud-01": "large"}},
    "high-stakes": {"plain": "money, health or legal standing is at stake", "effects": {"Q-aud-02": "high-trust"}},
    "everyday-consumer": {"plain": "an everyday consumer product", "effects": {"Q-aud-02": "consumer"}},
    "playful": {"plain": "they come for fun, games or learning", "effects": {"Q-aud-02": "play"}},
    "tough-conditions": {"plain": "they use it in tough conditions: one hand, bright light, on the move",
                         "effects": {"Q-aud-04": ["situational"]}},
    "motion-sensitive": {"plain": "motion sickness or distraction is a known issue", "effects": {"Q-aud-04": ["reduced-motion"]}},
    "mixed-expertise": {"plain": "experts and occasional users share the product", "effects": {"Q-aud-04": ["density"]}},
    "low-end-devices": {"plain": "many use low-cost phones", "effects": {},
                        "note": "Keep imagery light and motion short (stages 16 and 18); test on a low-cost phone."},
    "slow-network": {"plain": "networks are often slow or expensive", "effects": {},
                     "note": "Prefer system fonts or one small font file, and show content before images (stages 10 and 18)."},
    "non-latin-script": {"plain": "they read a script other than Latin", "effects": {},
                         "note": "Pick a typeface that covers their script, and leave room for longer text (stages 10 and 19)."},
    "second-language": {"plain": "many read the product in a second language, or read with difficulty", "effects": {},
                        "note": "Plain words, short sentences, and icons with text labels (stages 17 and 19)."},
    "dark-environments": {"plain": "they often use it in the dark", "effects": {},
                          "note": "Offer a dark theme from the start (stage 07)."},
    "familiar-patterns": {"plain": "the apps they use daily have taught them strong patterns", "effects": {},
                          "note": "Follow the patterns of the apps they live in before inventing new ones (practices.md sections 2 and 3)."},
}
SINGLE = {"Q-aud-01", "Q-aud-02", "Q-aud-03"}
PERSON_OWN = ("chosen", "confirmed_default", "reference", "asset", "research")  # a value someone said yes to; research never overwrites it
RX_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
RX_PHONE = re.compile(r"(?<!\d)(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){9,12}\d(?!\d)")
RX_HANDLE = re.compile(r"(?<![\w/])@[A-Za-z0-9_]{3,}")


def _today():
    return _dt.date.today().isoformat()


def _read(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def _write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def summary(state):
    return (state or {}).get("research") or {}


# ------------------------------------------------------------------------------------------------ plan

def draft_brief(eng, state):
    """Who the users are, in the person's own words (context.audience). Never invented from an option label: empty when the
    person has not said, so the plan asks them first."""
    who = ((state.get("context") or {}).get("audience") or "").strip()
    generic = {str(v).strip().lower() for v in (getattr(eng, "AUDIENCE_WORDS", {}) or {}).values()}
    return "" if who.lower() in generic else who  # the sketch's plain words for an option are not a users line


def queries(brief, product):
    users = brief.split(",")[0].strip() if brief else "<the users>"
    users = re.sub(r"\s+(who|that|using|on)\s.*$", "", users).strip() or users
    product = product or "<the product>"
    return [{"topic": topic, "query": t.format(users=users, product=product)} for topic, ts in QUERY_TEMPLATES.items() for t in ts]


def parse_tools(text):
    have = [t.strip().lower() for t in re.split(r"[,\s]+", text or "") if t.strip()]
    unknown = [t for t in have if t not in TOOL_IDS]
    if unknown:
        raise SystemExit(f"Unknown tool name(s): {', '.join(unknown)}. Use any of: {', '.join(TOOL_IDS)}.")
    return have


def plan(eng, d, brief=None, tools=None, as_json=False):
    state = eng.merge_defaults(eng.load_state(d))
    have = parse_tools(tools) if tools is not None else None
    b = (brief or "").strip() or draft_brief(eng, state)
    product = (eng.product_words(state) or "").strip() or (state.get("name") or "").strip()
    rec = {
        "v": 1, "date": _today(), "brief": b, "brief_confirmed": bool(brief),
        "topics": TOPICS, "queries": queries(b, product),
        "tools": {"have": have if have is not None else [], "missing": [t["id"] for t in TOOLS if have is not None and t["id"] not in have],
                  "reported": have is not None},
        "file": FILE,
    }
    _write(os.path.join(d, PLAN), rec)
    st = eng.merge_defaults(eng.load_state(d))
    r = summary(st)
    if r.get("status") != "done":  # a plan never hides findings already saved
        r.update({"status": "planned", "planned": _today(), "brief": b})
        st["research"] = r
        eng.dump_json(os.path.join(d, eng.STATE_FILE), st)
    if as_json:
        print(json.dumps(rec, indent=2, ensure_ascii=False))
        return rec
    print(f"User research plan, saved to {os.path.join(d, PLAN)}")
    print(f"Users: {b or 'not known yet. Ask the person who the users are in one line before you research.'}"
          + ("" if brief else "  (a draft: confirm it with the person in the same message as the plan)"))
    print("What to find out:")
    for k, v in TOPICS.items():
        print(f"  {k:13s} {v}")
    print("Searches to start from (rewrite them in the users' own words, and add the industry's terms):")
    for q in rec["queries"]:
        print(f"  [{q['topic']}] {q['query']}")
    if have is None:
        print("Tools: say which you have with --tools (" + ", ".join(TOOL_IDS) + "), so the plan can name what is missing.")
    else:
        print("Tools you have: " + (", ".join(have) or "none"))
        for t in TOOLS:
            if t["id"] not in have:
                print(f"  Missing: {t['name']} ({t['look_for']}). It would add {t['adds']}." + (f" Get it: {t['get']}" if t.get("get") else ""))
        if not any(t in have for t in NEEDS_ONE_OF):
            print("Nothing here can read the web. Say so once, and offer the person the findings template to fill in "
                  "(assets/output/research-users.example.json), or skip: engine.py research skip --why \"...\".")
    print("Next: one message to the person: the users line, the searches and the kinds of sites (studies, statistics, reviews, "
          "forums). One yes covers the whole run. Then research without stopping, save the findings as research/users.json, "
          "and run: engine.py research add <file>.")
    return rec


# ------------------------------------------------------------------------------------------------ check

def problems(rec):
    """Every reason a findings file is not usable, as (level, text). Errors block add; warnings are said and kept."""
    out = []
    err = lambda t: out.append(("error", t))
    warn = lambda t: out.append(("warning", t))
    if not isinstance(rec, dict):
        return [("error", "the findings file must be a JSON object")]
    if not str(rec.get("brief") or "").strip():
        err("brief is missing: one line on who the users are, confirmed by the person")
    date = str(rec.get("date") or "")
    try:
        _dt.date.fromisoformat(date)
    except ValueError:
        err(f"date must be the day of the research as YYYY-MM-DD (got {date!r})")
    sources = rec.get("sources") or []
    if not isinstance(sources, list):
        err("sources must be a list")
        sources = []
    sid = {}
    for i, s in enumerate(sources, 1):
        if not isinstance(s, dict) or not s.get("id"):
            err(f"source {i} needs an id (S1, S2, ...)")
            continue
        if s["id"] in sid:
            err(f"source id {s['id']} is used twice")
        sid[s["id"]] = s
        url = str(s.get("url") or "").strip()
        if not (re.match(r"^https?://[^\s]+$", url) or PERSON_SOURCE.match(url)):
            err(f"source {s['id']} needs a url (https://...) that was opened, or \"person, YYYY-MM-DD\" / \"interview, YYYY-MM-DD\" / "
                f"\"analytics, YYYY-MM-DD\" (got {url!r})")
        if s.get("kind") and s["kind"] not in SOURCE_KINDS:
            err(f"source {s['id']} kind must be one of {', '.join(SOURCE_KINDS)}")
        if not str(s.get("title") or "").strip():
            warn(f"source {s['id']} has no title")
    findings = rec.get("findings") or []
    if not isinstance(findings, list) or not findings:
        err("findings is empty: at least one finding is needed")
        findings = findings if isinstance(findings, list) else []
    fid = set()
    topics_seen = set()
    for i, f in enumerate(findings, 1):
        if not isinstance(f, dict) or not f.get("id"):
            err(f"finding {i} needs an id (F1, F2, ...)")
            continue
        name = f["id"]
        if name in fid:
            err(f"finding id {name} is used twice")
        fid.add(name)
        if f.get("topic") not in TOPICS:
            err(f"finding {name} topic must be one of {', '.join(TOPICS)}")
        else:
            topics_seen.add(f["topic"])
        text = str(f.get("text") or "").strip()
        if not text:
            err(f"finding {name} has no text")
        conf = f.get("confidence")
        if conf not in CONFIDENCE:
            err(f"finding {name} confidence must be one of {', '.join(CONFIDENCE)}")
        refs = f.get("sources") or []
        if conf != "inferred" and not refs:
            err(f"finding {name} cites no source; cite one, or mark it inferred")
        for r in refs:
            if r not in sid:
                err(f"finding {name} cites {r}, which is not in sources")
        if conf == "measured" and refs and all((sid.get(r) or {}).get("kind") in ("forum", "community") for r in refs):
            warn(f"finding {name} is marked measured but cites only forums; call it reported")
        for sg in f.get("signals") or []:
            if sg not in SIGNALS:
                err(f"finding {name} signal {sg!r} is not a known signal ({', '.join(SIGNALS)})")
        if conf == "inferred" and f.get("signals"):
            warn(f"finding {name} is inferred; its signals are shown, but say it is a guess when you ask")
    for i, a in enumerate(rec.get("apps") or [], 1):
        if not isinstance(a, dict) or not str(a.get("name") or "").strip():
            err(f"app {i} needs a name")
            continue
        for r in a.get("sources") or []:
            if r not in sid:
                err(f"app {a['name']} cites {r}, which is not in sources")
    blob = json.dumps({k: rec.get(k) for k in ("findings", "apps", "patterns", "open_questions", "brief")}, ensure_ascii=False)
    if RX_EMAIL.search(blob) or RX_PHONE.search(blob) or RX_HANDLE.search(blob):
        err("the findings hold what looks like personal data (an email, phone number or @handle). Keep only facts about the group, "
            "never about a person")
    missing = [t for t in TOPICS if t not in topics_seen]
    if findings and missing:
        warn("no finding on " + ", ".join(missing) + ": say so in open_questions, or search again")
    for k in ("tools",):
        t = rec.get(k) or {}
        for x in (t.get("used") or []) + (t.get("missing") or []):
            if x not in TOOL_IDS:
                warn(f"tools lists {x!r}, which is not a known tool id ({', '.join(TOOL_IDS)})")
    return out


def load(path):
    if not os.path.isfile(path):
        raise SystemExit(f"File not found: {path}. Write the findings as JSON first (assets/output/research-users.example.json shows the shape).")
    try:
        return _read(path)
    except ValueError as ex:
        raise SystemExit(f"{path} is not valid JSON ({ex}).")


def check(path, as_json=False):
    rec = load(path)
    ps = problems(rec)
    if as_json:
        print(json.dumps([{"level": l, "text": t} for l, t in ps], indent=2))
    else:
        errs = [t for l, t in ps if l == "error"]
        warns = [t for l, t in ps if l == "warning"]
        print(f"{path}: {len(rec.get('findings') or [])} finding(s), {len(rec.get('sources') or [])} source(s), "
              f"{len(errs)} error(s), {len(warns)} warning(s)")
        for t in errs:
            print(f"  error: {t}")
        for t in warns:
            print(f"  warning: {t}")
    return 1 if any(l == "error" for l, _ in ps) else 0


# ------------------------------------------------------------------------------------------------ proposals

def proposals(eng, state, rec, latest=None):
    """Recommended answers from the findings' signals. Returns (proposals, conflicts, notes).
    A proposal: {question, value, signals, findings, sources, status} where status is "new" (no one said yes to this question
    yet), "same" (already the answer) or "differs" (the person's own answer differs: ask, never overwrite)."""
    by_q = {}
    notes = []
    srcs = {f["id"]: f.get("sources") or [] for f in rec.get("findings") or [] if isinstance(f, dict) and f.get("id")}
    for f in rec.get("findings") or []:
        if not isinstance(f, dict):
            continue
        for sg in f.get("signals") or []:
            spec = SIGNALS.get(sg)
            if not spec:
                continue
            if spec.get("note") and spec["note"] not in [n["text"] for n in notes]:
                notes.append({"signal": sg, "text": spec["note"], "findings": [f["id"]]})
            elif spec.get("note"):
                next(n for n in notes if n["text"] == spec["note"])["findings"].append(f["id"])
            for qid, val in spec["effects"].items():
                slot = by_q.setdefault(qid, {"values": {}, "signals": set(), "findings": set()})
                for v in (val if isinstance(val, list) else [val]):
                    slot["values"].setdefault(v, set()).add(f["id"])
                slot["signals"].add(sg)
                slot["findings"].add(f["id"])
    answers = state.get("answers") or {}
    latest = latest or {}
    out, conflicts = [], []
    for qid in sorted(by_q):
        slot = by_q[qid]
        vals = sorted(slot["values"])
        if qid in SINGLE and len(vals) > 1:
            conflicts.append({"question": qid, "values": {v: sorted(slot["values"][v]) for v in vals},
                              "text": f"The findings point two ways on {qid}: "
                                      + "; ".join(f"{v} ({', '.join(sorted(slot['values'][v]))})" for v in vals)
                                      + ". Ask the person which group the product is for."})
            continue
        rec_a = answers.get(qid)
        cur = eng.answer_value(rec_a) if rec_a is not None else None
        sb = (latest.get(f"answers.{qid}") or {}).get("set_by") if latest else None
        sb = sb or (rec_a.get("set_by") if isinstance(rec_a, dict) else ("chosen" if rec_a is not None else None))
        if qid in SINGLE:
            value = vals[0]
            same = cur == value
        else:
            start = cur if cur not in (None, "", []) else eng.question_default(state, qid)  # keep the defaults it already has
            if isinstance(start, str):
                start = [x for x in re.split(r"\s*[+,]\s*", start) if x]
            base = [x for x in (start if isinstance(start, list) else []) if isinstance(x, str)]
            value = base + [v for v in vals if v not in base]
            same = set(value) == set(base)
        status = "same" if same else ("differs" if sb in PERSON_OWN and cur not in (None, "", []) else "new")
        fids = sorted(slot["findings"])
        out.append({"question": qid, "value": value, "current": cur, "current_set_by": sb, "signals": sorted(slot["signals"]),
                    "findings": fids, "sources": sorted({s for x in fids for s in srcs.get(x, [])}), "status": status})
    return out, conflicts, notes


def _qwords(eng, qid, value):
    try:
        return eng.answer_words(qid, value)
    except Exception:  # plain fallback; the words are only for people
        return json.dumps(value)


# ------------------------------------------------------------------------------------------------ users.md

def render_md(eng, state, rec, props, conflicts, notes):
    name = state.get("name") or "This product"
    src = {s["id"]: s for s in rec.get("sources") or [] if isinstance(s, dict) and s.get("id")}

    def cite(ids):
        return ", ".join(f"[{i}]" for i in ids) if ids else "no source"
    out = [f"# {name}: who the users are", "",
           "> Desk research by an AI agent with OpenDesigner, from public sources it opened. It describes a group, not this product's own "
           "users: confirm what matters with real people (five short interviews are enough to start). Rendered from `users.json`; "
           "edit that file and run `engine.py research add` again.", "",
           f"**Users:** {rec.get('brief', '').strip()}", "", f"**Researched:** {rec.get('date')}"]
    used = (rec.get("tools") or {}).get("used") or []
    if used:
        out += ["", f"**Tools used:** {', '.join(used)}"]
    miss = (rec.get("tools") or {}).get("missing") or []
    if miss:
        out += ["", f"**Not available:** {', '.join(miss)}"]
    out += ["", "## Findings", ""]
    for t, title in TOPICS.items():
        fs = [f for f in rec.get("findings") or [] if isinstance(f, dict) and f.get("topic") == t]
        if not fs:
            continue
        out += [f"### {title.split(':')[0]}", ""]
        for f in fs:
            out.append(f"- **{f['id']}** {f.get('text', '').strip()} ({f.get('confidence')}; {cite(f.get('sources') or [])})")
        out.append("")
    apps = rec.get("apps") or []
    if apps:
        out += ["## Apps they already use", ""]
        for a in apps:
            out.append(f"- **{a.get('name')}**" + (f": {a['why']}" if a.get("why") else "") + (f" ({cite(a.get('sources') or [])})" if a.get("sources") else ""))
        out.append("")
    pats = rec.get("patterns") or []
    if pats:
        out += ["## Patterns they already know", ""] + [f"- {p}" for p in pats] + [""]
    out += ["## What it means for the design system", ""]
    if props or conflicts or notes:
        for p in props:
            word = {"new": "Recommended", "same": "Already the answer", "differs": "Differs from your answer, so ask", "applied": "Applied",
                    "skipped": "Not applied (a standard or a lock holds it)"}[p["status"]]
            out.append(f"- {word}: {p['question']} = **{_qwords(eng, p['question'], p['value'])}** "
                       f"(from {', '.join(p['findings'])}; signals {', '.join(p['signals'])})")
        for c in conflicts:
            out.append(f"- Open: {c['text']}")
        for n in notes:
            out.append(f"- For later stages: {n['text']} (from {', '.join(n['findings'])})")
    else:
        out.append("- Nothing here changes a default yet. The findings still guide the reference searches and later questions.")
    out.append("")
    oq = rec.get("open_questions") or []
    if oq:
        out += ["## Open questions", ""] + [f"- {q}" for q in oq] + [""]
    if src:
        out += ["## Sources", ""]
        for i, s in src.items():
            url = s.get("url", "")
            link = f"[{s.get('title') or url}]({url})" if url.startswith("http") else f"{s.get('title') or 'Note'} ({url})"
            meta = ", ".join(x for x in (s.get("kind"), s.get("date") and f"published {s['date']}", s.get("accessed") and f"opened {s['accessed']}") if x)
            out.append(f"- [{i}] {link}" + (f" · {meta}" if meta else ""))
        out.append("")
    return "\n".join(out).rstrip() + "\n"


# ------------------------------------------------------------------------------------------------ add, apply, skip, status

def add(eng, d, path, accept=False, only=None, as_json=False):
    rec = load(path)
    ps = problems(rec)
    errs = [t for l, t in ps if l == "error"]
    if errs:
        print(f"Nothing was saved: {len(errs)} problem(s) in {path}.")
        for t in errs:
            print(f"  error: {t}")
        print("Fix them and run engine.py research add again (engine.py research check shows the same list).")
        return 1
    state = eng.merge_defaults(eng.load_state(d))
    dest = os.path.join(d, FILE)
    if os.path.abspath(path) != os.path.abspath(dest):
        _write(dest, rec)
    props, conflicts, notes = proposals(eng, state, rec, eng._decisions(d))
    only_q = [q.strip() for q in (only or "").split(",") if q.strip()]
    applied, skipped = [], []
    if accept:
        for p in props:
            # new ones; one that differs from the person's own answer only when they named it (--only) after saying yes
            if only_q and p["question"] not in only_q:
                continue
            if p["status"] != "new" and not (p["status"] == "differs" and p["question"] in only_q):
                continue
            why = (f"user research ({', '.join(p['findings'])}): " + "; ".join(SIGNALS[s]["plain"] for s in p["signals"]))
            try:
                eng.cmd_set(d, "answers." + p["question"], p["value"], why=why, set_by="research", source_ref=FILE, quiet=True)
            except SystemExit as ex:  # a standard or a lock outranks research: say so and go on
                p["status"] = "skipped"
                skipped.append(f"{p['question']}: {str(ex).splitlines()[0]}")
                continue
            p["status"] = "applied"
            applied.append(p["question"])
        state = eng.merge_defaults(eng.load_state(d))
    _write_text(os.path.join(d, DOC), render_md(eng, state, rec, props, conflicts, notes))
    r = summary(state)
    r.update({"status": "done", "date": rec.get("date"), "added": _today(), "brief": rec.get("brief"), "file": FILE, "doc": DOC,
              "findings": len(rec.get("findings") or []), "sources": len(rec.get("sources") or []),
              "tools": (rec.get("tools") or {}).get("used") or [],
              "highlights": [{"id": f["id"], "text": f.get("text", ""), "confidence": f.get("confidence")}
                             for f in (rec.get("findings") or [])[:5] if isinstance(f, dict)],
              "proposals": props, "conflicts": [c["text"] for c in conflicts], "notes": [n["text"] for n in notes]})
    r.pop("skipped_why", None)
    state["research"] = r
    eng.dump_json(os.path.join(d, eng.STATE_FILE), state)
    eng.refresh_docs(d)
    if as_json:
        print(json.dumps({"proposals": props, "conflicts": conflicts, "notes": notes, "applied": applied, "skipped": skipped,
                          "warnings": [t for l, t in ps if l == "warning"]}, indent=2, ensure_ascii=False))
        return 0
    print(f"Saved {r['findings']} finding(s) from {r['sources']} source(s): {os.path.join(d, FILE)} and {os.path.join(d, DOC)}.")
    for l, t in ps:
        print(f"  {l}: {t}")
    if not props and not conflicts:
        print("No finding changes a default. They still guide the reference searches and the later stages.")
    for p in props:
        tag = {"new": "recommend", "same": "already so", "differs": "ASK (their answer differs)", "applied": "applied",
               "skipped": "skipped"}[p["status"]]
        cur = "" if p["current"] in (None, "", []) else f"; now {_qwords(eng, p['question'], p['current'])} ({p['current_set_by']})"
        print(f"  {tag:12s} {p['question']} = {_qwords(eng, p['question'], p['value'])}  from {', '.join(p['findings'])}{cur}")
    for c in conflicts:
        print(f"  open: {c['text']}")
    for n in notes:
        print(f"  later: {n['text']}")
    for s in skipped:
        print(f"  not changed: {s}")
    pending = [p for p in props if p["status"] == "new"]
    if pending and not accept:
        print("Show the person the recommendations with their sources, then apply the ones they say yes to: "
              "engine.py research add " + os.path.join(d, FILE) + " --accept [--only " + ",".join(p["question"] for p in pending) + "]")
    if applied:
        print(f"Applied with set_by research: {', '.join(applied)}. Run engine.py build to see them.")
    return 0


def skip(eng, d, why):
    if not (why or "").strip():
        raise SystemExit("Say why, in the person's words: engine.py research skip --why \"...\"")
    state = eng.merge_defaults(eng.load_state(d))
    r = summary(state)
    if r.get("status") == "done":
        raise SystemExit("This project already has user research (research/users.json); nothing was changed.")
    r.update({"status": "skipped", "skipped_why": why.strip(), "skipped": _today()})
    state["research"] = r
    eng.dump_json(os.path.join(d, eng.STATE_FILE), state)
    eng.refresh_docs(d)
    print(f"User research skipped: {why.strip()}. The reminders stop; engine.py research plan starts it any time.")
    return 0


def age_days(r, today=None):
    try:
        then = _dt.date.fromisoformat(str(r.get("date")))
    except (TypeError, ValueError):
        return None
    return ((today or _dt.date.today()) - then).days


def review(d, state):
    """What engine.py review says about the research: (errors, notes). Errors: the saved findings fail the checks or are
    missing. Notes: not done yet, or old."""
    r = summary(state)
    errs, notes = [], []
    if r.get("status") == "done":
        fp = os.path.join(d, FILE)
        if not os.path.isfile(fp):
            errs.append(f"state.json says the users were researched, but {FILE} is missing")
        else:
            try:
                rec = _read(fp)
            except ValueError as ex:
                errs.append(f"{FILE} is not valid JSON ({ex})")
                rec = None
            if rec is not None:
                errs += [f"{FILE}: {t}" for l, t in problems(rec) if l == "error"]
        age = age_days(r)
        if age is not None and age > STALE_DAYS:
            notes.append(f"The user research is {age} days old. People and their apps change: run it again (engine.py research plan).")
        if not os.path.isfile(os.path.join(d, DOC)) and os.path.isfile(fp):
            notes.append(f"{DOC} is missing: run engine.py research add {FILE} to render it.")
    elif r.get("status") == "skipped":
        pass
    else:
        notes.append("The users have not been researched yet (optional, about 10 minutes): engine.py research plan, "
                     "or engine.py research skip --why \"...\".")
    return errs, notes


def product_section(state):
    """PRODUCT.md "Users": the brief, up to five findings and where the rest is. Never claims research that was not done."""
    r = summary(state)
    st = r.get("status")
    if st == "done":
        lines = [f"Researched {r.get('date')}: {r.get('brief', '').strip()}", ""]
        lines += [f"- {h['text'].strip()} ({h.get('confidence')}, {h['id']})" for h in r.get("highlights") or []]
        rest = (r.get("findings") or 0) - len(r.get("highlights") or [])
        lines += ["", f"All {r.get('findings')} findings, their {r.get('sources')} sources and what they change: `opendesigner/{DOC}`"
                  + (f" ({rest} more there)." if rest > 0 else ".")]
        if r.get("conflicts"):
            lines += ["", "Open: " + " ".join(r["conflicts"])]
        return "\n".join(lines)
    if st == "skipped":
        return f"Not researched: {r.get('skipped_why')}"
    if st == "planned":
        return "Research planned, no findings saved yet (`opendesigner/research/plan.json`)."
    return "Not researched yet. The user research step (references/research.md) fills this in."


def status(d, state, as_json=False):
    r = summary(state)
    if as_json:
        print(json.dumps(r or {"status": "none"}, indent=2, ensure_ascii=False))
        return 0
    st = r.get("status") or "none"
    if st == "done":
        print(f"Users researched {r.get('date')}: {r.get('findings')} finding(s), {r.get('sources')} source(s). {os.path.join(d, DOC)}")
        new = [p for p in r.get("proposals") or [] if p.get("status") == "new"]
        if new:
            print("Not applied yet: " + ", ".join(p["question"] for p in new) + " (ask the person, then research add --accept).")
        age = age_days(r)
        if age is not None and age > STALE_DAYS:
            print(f"It is {age} days old: run it again.")
    elif st == "skipped":
        print(f"Skipped: {r.get('skipped_why')}")
    elif st == "planned":
        print(f"Planned {r.get('planned')}, no findings yet. When the research is done: engine.py research add <file>.")
    else:
        print("Not researched yet: engine.py research plan.")
    return 0


def reminder(state):
    """One line after sketch and build until the research is done or skipped; '' otherwise."""
    st = summary(state).get("status")
    if st in ("done", "skipped"):
        return ""
    if st == "planned":
        return "User research is planned but not saved yet: when the findings are ready, engine.py research add <file>."
    return ("Next, before zooming in: research who the users are, so the defaults fit them (references/research.md): "
            "engine.py research plan. Or skip it: engine.py research skip --why \"...\".")

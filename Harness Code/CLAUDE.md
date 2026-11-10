# Harness Code: notes for coding agents

Read `README.md` for what each folder is and how to run it. This file records where the UI stands and what
is still ours to build.

## Current phase: UI components only

- assistant-ui's registry components are installed **as shipped**. Do not restyle or redesign them; the design
  is not decided yet.
- Don't add self-designed UI (switchers, banners, custom cards). Wire registry components to real data instead.
- Don't test each component as it's added. Test only when asked.
- Don't commit. The owner commits manually or asks.
- Don't touch `agent/` (used for testing) or `desktop/electron/` without being asked.
- `langgraph dev` reloads when anything in `agent/` changes, `.venv` included. Running `uv` there kills runs in
  progress (the thread shows as interrupted, its tool calls never answered). Stop the server first.
- Registry installs: `pnpm dlx shadcn@latest add @assistant-ui/elements-<name> --yes --overwrite`, then move any
  helper the new file imports as `../utils/<name>` from `components/` into `utils/` (`desktop/src/utils/` on desktop).
- Registry installs can bump `@assistant-ui/react` past the pinned `@assistant-ui/core` override (0.15.34 needs core
  0.3.34), which breaks `/harness` with "Export useActionBarResume doesn't exist". Check `package.json` after an install and
  keep `@assistant-ui/react` at the version the overrides match.
- Desktop: keep the `overrides` in `desktop/pnpm-workspace.yaml`. Two copies of `@assistant-ui/react`, `store` or
  `tap` make the app render blank.

## Core workflow: components_check is the source of truth (owner, 2026-11-10)

1. Every new component goes into `app/components_check/` first (Harness ones in `components_check/harness/`). The
   owner views the demo, tests it and tunes its settings there.
2. Accept makes those settings the defaults.
3. The components_check copy stays as the source of truth; updates to it are reflected in the app (Harness web,
   later desktop). The app must look and behave exactly like components_check, or it causes disputes.
4. Demo content is not shipped. Sample text, Short/Long text toggles and item counts (citations, suggestions, rows)
   only preview the component. Only the component's code, look and behaviour carry to the app; real content comes
   from the app's data.
5. Never let a demo show something the app can't do, and never fix a component in only one place.

## Component showcase (website repo, `app/components_check/harness/`)

Copies of the props-only components live there so the owner can tune each one's assistant-ui options and Accept
them; accepted values land in `app/components_check/accepted.json` under `harness-<slug>` (read by `lib/settings.ts`).
Harness reads them through `web/lib/applied.ts`; so far only empty-state uses them (`components/harness-welcome.tsx`,
the thread's `Welcome` slot). The copies use the `@harness/` alias (root `tsconfig.json`). Runtime-bound
`.aui` files and Harness glue (MyAssistant, harness-tools, model-choice, run-notices, composer-triggers,
streamdown-text, task.ts) are not copied. After a registry install here, re-copy the changed file and rewrite
`"@/` to `"@harness/` in it.

Agent-progress components from the to-do (thinking-indicator through trace-waterfall, 19) are installed as shipped
and not wired.

## Known behaviors and open decisions

- **Prompt size:** `present` and `prompt_user` carry the full generative-ui library schema, about 79.5 KB of JSON
  (~20k tokens) on every model call. A one-line message measured 25,743 input tokens. Open decision: slim library,
  opt-in, or keep.
- **Empty pill under an image-only message:** assistant-ui sends an image-only message with a text part of `" "`
  (the agent stores `[{type: "text", text: " "}, image]`), so the registry user bubble's `empty:hidden` never
  applies. Not our code; fix when designing the user message (hide the bubble when the text is whitespace).
- **LaTeX:** rendering is fixed (`streamdown-text.tsx` normalizes `\( \)` / `\[ \]` and escapes prices). Which
  delimiters a model writes is a prompt matter: add to the agent's system prompt "Write math as `$...$` inline and
  `$$...$$` on its own lines". Pydantic validates tool arguments and state, not free-text replies, so it can't
  enforce this.
- **SOUL (owner will set it up):** the heart of the agent. A persistent personality, imitated feelings, and real
  understanding of the user, so the agent feels like a person rather than a task runner (reference: the Hermes
  agent). It shapes how every reply is written, including reading what a request means ("show me sunflowers" may
  call for the flower, photos, a video or the song). Lives in the agent; do not improvise or stub it.
- **Blank page previews:** sites that send `X-Frame-Options` or a `frame-ancestors` CSP (e.g. pixabay.com, which
  also adds a Cloudflare challenge) render as a blank frame in `open_page`. Fix: check the target's headers
  server-side before framing (agent tool or a web route) and fall back to "Open in browser".

## Decided direction: screen-aware frontend agent (owner, 2026-11-10)

The agent should see what the user is working on and help with it, mostly frontend work (look and code). Scope
is **the user's project app in a preview** (option B), not Harness's own UI alone and not whole-desktop control.
CopilotKit was considered and not adopted: assistant-ui already covers it, and a second runtime would compete
with `useLangGraphRuntime`.

Build order, when the phase allows (needs `agent/` and desktop work):
1. Screen context: `makeAssistantVisible` (in `@assistant-ui/react`) marks what is visible; `getContext` sends it
   with each run (the LangGraph runtime does not forward model context on its own); the agent adds it to the prompt.
2. Preview pane on desktop for the project's dev server, plus page capture (screenshot and DOM) as an agent tool.
3. Coding loop: read files, `propose_edit` (exists), then re-capture the preview to check the change.

Claude Code's computer-use skill is for coding agents such as Claude Code, not part of Harness. The Harness agent
needs its own capture tool.

## Stage 1 (composer and models), web app only

| Item | State |
| --- | --- |
| model-selector (runtime) | **Wired** in the composer via the Thread's `ComposerExtra` (`components/model-choice.tsx`). Lists OpenRouter's live catalog (public endpoint, tool-capable models only) with context size and price; the choice is held above the thread and sent as the run's `model`. |
| logos | **Wired**: Claude, OpenAI and Gemini logos on matching models in the selector. |
| quote | **Wired**: SelectionToolbar and ComposerQuotePreview in `thread.aui.tsx`. The LangGraph runtime drops quote metadata, so `QuoteCapture` (MyAssistant) keeps the composer's quote and `harnessStream.ts` writes it into the sent text as a `> ` blockquote (`node --test lib/harnessStream.test.ts`). Known limits: the sent bubble shows the quote as `> ` text, not a QuoteBlock; an image-only message with a quote drops the quote. |
| quote-reply | Installed. Props-only demo of the same flow; quote.aui covers it. |
| composer, mobile-composer | Installed. Props-only replacements for the Thread's composer (also cover slash commands, mentions, attachments, models, dictation, context). Swapping them in is a design decision. |
| model-picker | Installed. Props-only full model list; could replace the selector once designed. |
| edit-message, draft-restore, empty-state, settings-panel | Installed, props-only. They replace or extend Thread parts; wire when designing. settings-panel needs agent settings (system prompt, temperature) to be real. |
| dictation | Already working (web). |

Provider filter chips are a fixed list for now (`PINNED` in `model-choice.tsx`); the owner wants them dynamic later
(for example from usage, settings, or the agent's configured providers).

Model listing gap: Anthropic, OpenAI and Gemini list models only with a key, and keys live in the agent. Add an agent
endpoint that returns the models each configured provider allows (with context size), then merge it into the
selector.

## Desktop audit backlog (do not touch `desktop/` until it is synced with the backend)

Owner priority: web app and copying components first, making them work second, everything else after. These
desktop findings were confirmed in code and wait for that sync:

1. Must: company tokens can go over plain HTTP. Allow `http://` only for localhost/127.0.0.1/::1, in Settings and `docs.cjs`.
2. Must: secret files reach the model. `read_workspace` reads `.env`, `.git/config`; document search indexes
   `credentials.json`, `id_rsa`, `*.pem`. One blocklist in `workspace.cjs`, used by read and search, with a test.
   Approve-anyway flow and value redaction deferred (new UI; redaction by pattern is unreliable).
3. Should: a file that grows past 5 MB keeps its old search cache. Drop the entry; add a test.
4. Should: editing a server URL loses its saved token while Settings still says "saved". Give servers a stable ID.
5. Should: a non-numeric `score` from a company server crashes retrieval-chunks. Keep numeric scores, string locations.
6. Should: `current()` (edit preview) has no size limit. Reuse the 256 KB limit, show "too large to preview".
7. Should: a failure after partial reply text shows two error notices. Show the top-level notice only without an
   assistant reply. (Fixed in the web app; port `run-notices.tsx` to desktop at sync.)
8. Should: a folder named without `/` shows no file tree. Return `{ kind: "folder", entries }` from Electron.
9. Should: the search cache keeps old workspaces. Evict entries outside the active workspace.

Also before shipping anything: the agent API has no proxy or auth (fine on localhost only), and web search results,
repository files and company documents can carry instructions that steer the model (SOUL / system prompt rule plus
approvals, later).

## Removed on purpose (rebuild with the chosen design)

| Was | Where it plugs back in |
| --- | --- |
| Model switcher | `MyAssistant.tsx` sets `MODEL`, passed to the agent in the run context. The agent accepts `provider:model` for openrouter, anthropic, openai, google_genai and ollama (`agent/src/agent/graph.py`, `make_model`). Pair it with **regenerate-menu**. |
| Theme toggle | `next-themes` `ThemeProvider` is still mounted (follows the system). Only the toggle button is gone. |
| Run-error banner | Replaced by the registry **error-state** (`run-notices.tsx`). |

## Hand-written glue that remains (not UI design)

| File (web / desktop) | Why it exists |
| --- | --- |
| `lib/harnessStream.ts` | Sends `{ model, client, effort, ui_tools }` as LangGraph run context and writes quotes into the sent text; assistant-ui's stream helper has no context option. |
| `components/harness-tools.tsx` | Registers which registry component renders each agent tool, and maps tool args to its props. |
| `components/desktop-tools.tsx` (desktop) | Runs workspace and document tools on the device and returns results with `addResult`. |
| `components/settings-dialog.tsx` (desktop) | Workspace folder and company servers. Built from shadcn `Dialog`; restyle when designed. |
| `components/composer-triggers.tsx` | `/init` (desktop) and `@` mentions on the registry trigger popover. |
| `components/streamdown-text.tsx` | Streamdown with code and math plugins, as the Streamdown guide shows; web links render as inline citations. |
| `components/run-notices.tsx` | Feeds error-state (run errors) and stopped-run (cancelled replies) and wires their Retry / Continue. |
| `src/lib/diff.ts` (desktop) | Line diff (LCS) for code-diff in edit approvals; `node --test src/lib/diff.test.ts`. |

## Components and their data

Wired = rendering real data from Harness today. Gap = installed but not rendered, with the reason.

### Wired

| Component | Fed by |
| --- | --- |
| tool-call, tool-error, tool-timeline | every tool call (`harness-tools.tsx`: `GenericTool`, `HarnessToolGroup`) |
| web-search | `web_search` (query and result domains) |
| inline-citation | web links in replies (`streamdown-text.tsx`); snippet from the same message's `web_search` results |
| data-table | `show_table` |
| chart | `show_chart` |
| option-list | `choose_option` (answer via `addResult`) |
| elicitation-form | `ask_user` (answer via `addResult`) |
| web-preview | `open_page` (sandboxed iframe) |
| error-state | run errors before any reply (`run-notices.tsx`); Retry restarts the run. Retry, regenerate and edit fork from a checkpoint found by `getCheckpointId` (MyAssistant). |
| mermaid-diagram | ```mermaid fences in replies (`streamdown-text.tsx`, `componentsByLanguage`) |
| stopped-run | replies the user stopped (`run-notices.tsx`, placed in `thread.aui.tsx`); Continue starts a new run |
| approval-card, code-diff | `propose_edit` (desktop); line diff in `desktop/src/lib/diff.ts` (tested) |
| file-tree | `read_workspace` on a folder path (`""` or ending in `/`) (desktop) |
| retrieval-chunks | `search_documents` (desktop): workspace and company-server passages |
| image-gallery | `image_search` (DuckDuckGo images, http(s) only) |
| link-preview | `link_preview`: the agent fetches page metadata (refuses private IPs; redirects are not re-checked) |
| number-ticker | `show_stat(label, value: float)` |
| suggestions (pills) | `suggest_followups`; shown under the last message only, a click sends it. Ends the turn when only display tools ran. |
| generative-ui (+ generative-markdown, geo-map, mermaid) | `present` (standalone) and `prompt_user`, declared by the web and sent as `ui_tools` in the run context; the agent binds them by name |
| reasoning, reasoning-effort | `ChatOpenRouter` with `output_version="v1"` streams reasoning blocks; effort goes as the run's `effort` (OpenRouter `reasoning.effort`); spent tokens read from `usage_metadata` after each run |

### Gaps with no faithful data yet

| Component | Why it is not wired |
| --- | --- |
| document-reference | Needs page numbers and a page count; document search returns lines and chunks, not pages. |
| reviewable-diff | Keep/discard per hunk needs partial apply; `propose_edit` applies whole files. code-diff shows the diff today. |
| message-actions, message-branches, regenerate-menu | Standalone versions of what the Thread already renders (action bar, branch picker, Refresh). Swap in when designing; regenerate-menu also needs the model switcher. |
| day-separator | Renders its own message list, so it would replace the Thread's message rendering. Needs per-message timestamps placed between messages instead. |
| feedback-dialog | Sending reasons needs a custom call to Assistant Cloud feedback; the action bar's thumbs already send plain ratings. |
| message-queue | Needs `unstable_enableMessageQueue` and the runtime's queue state mapped to its props. |

Glue that guards against weak models: `TableTool` matches keyless columns to row keys by position (a keyless column crashed DataTable), percent columns read 12 as 12%, `ask_user` answers include untouched fields, and follow-up pills ignore `suggestions` that are not a string list (one free model sent a broken JSON string).

Also unwired, from the 2026-11-10 audit: feedback-dialog (needs a feedback destination), media-player (reachable only with an audio/video attachment adapter), map-answer (decorative x/y map, no real coordinates), model-picker (would replace the wired selector), message-queue (needs `unstable_enableMessageQueue`), tool-fallback.aui and tool-group.aui (replaced on purpose by tool-call and tool-timeline). Reasoning is on for OpenRouter models only; anthropic/openai/google providers in `make_model` still need it per provider.

### Gaps that need a new agent tool first

| Component | Tool to add (agent declares it; app or server runs it) |
| --- | --- |
| image-generation | `generate_image` through a provider with an image model |
| code-runner, terminal-block | `run_command` in the desktop workspace, behind approval (permission-grant) |
| permission-grant | per-tool allow/deny for desktop tools, stored on the device |
| computer-use | desktop control; large security surface, decide scope first |
| research-report | multi-step research (several `web_search` calls, then a structured report) |
| memory-chips | memory store across threads (agent-side, per user) |
| map-answer, geo-map | geocoding/places lookup tool (`geo-map` uses `leaflet`, added by the registry) |
| confidence-marker | model-reported confidence per claim |
| guardrail-notice | an input/output policy check that can flag or block |
| speaker-identity | multiple agents or personas in one thread |

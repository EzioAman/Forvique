# Harness Code

Forvique's coding and research agent, shipped as two clients over one agent.

| Folder | What it is |
| --- | --- |
| `agent/` | Python LangGraph agent. Picks the model per run (OpenRouter, Anthropic, OpenAI, Gemini, Ollama), searches the web (DuckDuckGo), and declares the tools the apps run. |
| `web/` | Next.js site. The chat lives at `/harness`. |
| `desktop/` | Electron app, built into an offline Windows installer. Adds workspace reading, approved file edits, document search and `/init`. |
| `docs/search-api.md` | The API a client's document server implements so the desktop app can search it. |

## Run it

1. Agent: copy `agent/.env.example` to `agent/.env` and fill in a key for each provider users may pick.
2. Web: copy `web/.env.example` to `web/.env.local`, then `pnpm install` and `pnpm dev` in `web/`. This starts the
   agent (`langgraph dev` on :2024) and the web app together; Ctrl+C stops both. Open `/harness`.
   `pnpm dev:web` starts the web app alone; the agent alone is `uv run langgraph dev --no-browser --port 2024` in `agent/`.
3. Desktop: copy `desktop/.env.example` to `desktop/.env.local`, then `pnpm install` and `pnpm app` in `desktop/`.

Both apps reach the agent at `NEXT_PUBLIC_LANGGRAPH_API_URL` / `VITE_LANGGRAPH_API_URL` (`http://localhost:2024` in development).

## Build the installer

```
cd desktop
pnpm dist
```

The output is `desktop/release/Harness-Setup-<version>.exe`, a full NSIS installer that needs no download at install time.
If the build stops with `EBUSY` on a `.asar` file, a virus scanner is holding the new files. Exclude `desktop/release`
from real-time scanning, or build elsewhere with `-c.directories.output=<path on another drive>`.

The installed app is a locked shell: no DevTools, reload, zoom, menu or navigation, and Electron fuses switch off
Node debugging in the binary. `pnpm app` runs unpacked and keeps DevTools for development.

## Tests

```
cd agent && uv run pytest tests/unit_tests
cd desktop && node --test electron/workspace.test.cjs electron/docs.test.cjs
```

The document-search test downloads the ~25 MB embeddings model on its first run.

## Known limits

- DuckDuckGo search is keyless but rate-limited (about 1 in 3 calls fail and are retried). Swap in Tavily for real traffic.
- The embeddings model downloads on the first document search. Bundle it into the installer for fully offline machines.
- Document search re-scans the workspace on each search (capped at 2,000 files). Large repositories need a persistent index.
- The desktop app needs a reachable agent. Set `VITE_LANGGRAPH_API_URL` to the deployed agent before `pnpm dist`.

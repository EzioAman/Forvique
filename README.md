# Forvique: run Harness

Harness is Forvique's AI agent: a chat app that plans, searches the web and uses tools. This guide gets it running
on your computer.

## 1. Install the tools

- [Node.js](https://nodejs.org) 22 or newer
- [pnpm](https://pnpm.io/installation): after installing Node, run `corepack enable`
- [uv](https://docs.astral.sh/uv/getting-started/installation/), which runs the Python agent and installs Python
  for it

## 2. Get the code and install packages

```bash
git clone https://github.com/EzioAman/Forvique.git
cd Forvique
pnpm install
pnpm --dir "Harness Code/web" install
```

## 3. Add your keys

The agent needs at least one model key. [OpenRouter](https://openrouter.ai) is the easiest: one key gives you many
models, including free ones.

1. Create a key at https://openrouter.ai/settings/keys.
2. Copy the agent's example env file:

   ```bash
   cp "Harness Code/agent/.env.example" "Harness Code/agent/.env"
   ```

   (Windows PowerShell: `Copy-Item "Harness Code/agent/.env.example" "Harness Code/agent/.env"`)
3. Open `Harness Code/agent/.env` and paste your key after `OPENROUTER_API_KEY=`:

   ```
   OPENROUTER_API_KEY=sk-or-...
   ```

   Optional, only if you want those providers in the model menu: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
   `GOOGLE_API_KEY`. Leave the rest as it is.
4. Copy the chat app's example env file. It needs no changes:

   ```bash
   cp "Harness Code/web/.env.example" "Harness Code/web/.env.local"
   ```

   (Windows PowerShell: `Copy-Item "Harness Code/web/.env.example" "Harness Code/web/.env.local"`)

Both files stay on your computer; git ignores them. Never commit a key.

## 4. Run it

```bash
pnpm harness
```

This starts the agent (port 2024) and the chat app together. The first run takes a minute while uv installs the
agent's Python packages. When the terminal shows `Local: http://localhost:3000`, open
**http://localhost:3000/harness**.

Press Ctrl+C to stop both.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Replies fail or say the provider has no key | Check `OPENROUTER_API_KEY` in `Harness Code/agent/.env`, then restart `pnpm harness`. |
| Replies fail with a credits or payment error | Pick a model marked free in the chat's model menu, or add credits on OpenRouter. |
| "Port 2024 is in use" | An agent from an earlier run is still running. End the leftover `python` process (Task Manager on Windows) and start again. |
| The page opens on another port (3001) | Something else uses 3000. Use the address the terminal prints, plus `/harness`. |

## Other parts of the repo

- `pnpm dev` runs the Forvique website; its component showcase is at http://localhost:3000/components_check.
- The Harness desktop app, tests and known limits: [`Harness Code/README.md`](Harness%20Code/README.md).

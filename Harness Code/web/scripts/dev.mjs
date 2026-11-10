// `pnpm dev`: starts the agent (langgraph dev on :2024) and the web app together. Extra args go to next dev.
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const agentDir = fileURLToPath(new URL("../../agent", import.meta.url));
const run = (name, cmd, cwd, own = false) => {
  // `own`: its own process group. langgraph's reloader on Windows sends Ctrl+C to its whole console, which would
  // otherwise stop the web app too; output is piped through instead of inherited from that separate console.
  const child = spawn(cmd, {
    cwd,
    shell: true,
    stdio: own ? ["ignore", "pipe", "pipe"] : "inherit",
    detached: own && process.platform === "win32",
    windowsHide: true,
    env: { ...process.env, PYTHONUNBUFFERED: "1" }, // piped Python output is block-buffered otherwise
  });
  if (own) {
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
  }
  child.on("exit", (code) => console.log(`[${name}] exited (${code})`));
  return child;
};

const children = [
  run("agent", "uv run langgraph dev --no-browser --port 2024", agentDir, true),
  run("web", `next dev --turbopack ${process.argv.slice(2).join(" ")}`, process.cwd()),
];

// shell children don't die with this process on Windows; kill each process tree
const stop = () => {
  for (const c of children) {
    if (c.exitCode !== null) continue;
    try {
      if (process.platform === "win32") execSync(`taskkill /T /F /PID ${c.pid}`, { stdio: "ignore" });
      else c.kill("SIGTERM");
    } catch {}
  }
  process.exit();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children[1].on("exit", stop); // no web app, nothing to serve; the agent alone may fail (port in use) and web keeps running

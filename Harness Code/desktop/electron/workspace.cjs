// Workspace access for the desktop tools: read anything inside the chosen folder, write only
// approved edits, never anything outside it. Pure Node so it can be tested without Electron.
const fs = require("node:fs/promises");
const path = require("node:path");

const MAX_READ = 256 * 1024; // larger files would flood the model's context
const SKIP = new Set([".git", "node_modules", ".venv", "dist", "release", ".next"]);

// Resolve `rel` inside `root`, following symlinks, and refuse anything that lands outside it.
async function inside(root, rel = "") {
  if (!root) throw new Error("No workspace folder is set. Choose one in Settings.");
  if (path.isAbsolute(rel)) throw new Error("Use a path relative to the workspace.");
  const realRoot = await fs.realpath(root);
  const target = path.resolve(realRoot, rel);
  // a new file or folder has no realpath yet: resolve its nearest existing ancestor instead
  let existing = target;
  let tail = "";
  for (;;) {
    try {
      existing = await fs.realpath(existing);
      break;
    } catch (e) {
      if (e.code !== "ENOENT" || path.dirname(existing) === existing) throw e;
      tail = path.join(path.basename(existing), tail);
      existing = path.dirname(existing);
    }
  }
  const real = path.join(existing, tail);
  const back = path.relative(realRoot, real);
  if (back.startsWith("..") || path.isAbsolute(back)) throw new Error(`"${rel}" is outside the workspace.`);
  return real;
}

async function read(root, rel = "") {
  const p = await inside(root, rel);
  const stat = await fs.stat(p);
  if (stat.isDirectory()) {
    const entries = await fs.readdir(p, { withFileTypes: true });
    return entries
      .filter((e) => !SKIP.has(e.name))
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .sort()
      .join("\n");
  }
  if (stat.size > MAX_READ) throw new Error(`"${rel}" is ${Math.round(stat.size / 1024)} KB; files over 256 KB are not read.`);
  return fs.readFile(p, "utf8");
}

// Existing content for the approval diff ("" for a new file).
async function current(root, rel) {
  const p = await inside(root, rel);
  return fs.readFile(p, "utf8").catch((e) => (e.code === "ENOENT" ? "" : Promise.reject(e)));
}

// Write via a temp file and rename, so an interrupted save never leaves a half-written file.
async function write(root, rel, content) {
  const p = await inside(root, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.harness-${process.pid}-${Date.now()}.tmp`;
  await fs.writeFile(tmp, content, "utf8");
  try {
    await fs.rename(tmp, p);
  } catch (e) {
    await fs.rm(tmp, { force: true });
    throw e;
  }
  return `Wrote ${rel} (${Buffer.byteLength(content)} bytes).`;
}

module.exports = { inside, read, current, write, SKIP };

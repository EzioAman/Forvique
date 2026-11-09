// node --test electron/workspace.test.cjs
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const ws = require("./workspace.cjs");

test("workspace stays inside its folder", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "harness-ws-"));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "harness-out-"));
  await fs.writeFile(path.join(root, "a.txt"), "hello");
  await fs.mkdir(path.join(root, "node_modules"));

  assert.equal(await ws.read(root, "a.txt"), "hello");
  assert.equal(await ws.read(root, ""), "a.txt"); // node_modules skipped
  await assert.rejects(ws.read(root, "../x"), /outside the workspace/);
  await assert.rejects(ws.read(root, outside), /relative/);
  await assert.rejects(ws.read("", "a.txt"), /No workspace/);

  assert.match(await ws.write(root, "dir/b.txt", "new"), /Wrote dir\/b.txt/);
  assert.equal(await ws.read(root, "dir/b.txt"), "new");
  assert.equal(await ws.current(root, "missing.txt"), "");
  await assert.rejects(ws.write(root, "../escape.txt", "x"), /outside the workspace/);
  assert.deepEqual((await fs.readdir(path.join(root, "dir"))).sort(), ["b.txt"]); // no temp file left

  // a symlink that points outside is refused (skipped where symlinks need admin on Windows)
  try {
    await fs.symlink(outside, path.join(root, "link"), "junction");
    await assert.rejects(ws.read(root, "link"), /outside the workspace/);
  } catch (e) {
    if (!/EPERM/.test(String(e))) throw e;
  }
});

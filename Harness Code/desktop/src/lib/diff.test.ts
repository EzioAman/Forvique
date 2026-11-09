// node --test src/lib/diff.test.ts
import assert from "node:assert";
import test from "node:test";
import { diffLines } from "./diff.ts";

test("diff finds added and removed lines with context", () => {
  const d = diffLines("a\nb\nc\nd\ne\nf\ng", "a\nb\nC\nd\ne\nf\ng\nh", 1);
  assert.equal(d.additions, 2);
  assert.equal(d.deletions, 1);
  assert.deepEqual(d.lines, [
    { kind: "context", text: "b" },
    { kind: "removed", text: "c" },
    { kind: "added", text: "C" },
    { kind: "context", text: "d" },
    { kind: "context", text: "g" },
    { kind: "added", text: "h" },
  ]);
});

test("new file is all additions; identical files have no lines", () => {
  assert.deepEqual(diffLines("", "x\ny").lines, [
    { kind: "added", text: "x" },
    { kind: "added", text: "y" },
  ]);
  assert.deepEqual(diffLines("same", "same"), { lines: [], additions: 0, deletions: 0 });
});

test("huge files fall back to a full replacement", () => {
  const big = Array.from({ length: 2100 }, (_, i) => `l${i}`).join("\n");
  const d = diffLines(big, big + "\nmore");
  assert.equal(d.deletions, 2100);
  assert.equal(d.additions, 2101);
});

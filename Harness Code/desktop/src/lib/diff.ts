/* Line diff for edit approvals, shaped for assistant-ui's CodeDiff (kind + text per line). */
export type DiffLine = { kind: "context" | "added" | "removed"; text: string };

// LCS table cap: past ~4M cells (e.g. two 2,000-line files) show a full replacement instead of a slow diff
const MAX_CELLS = 4_000_000;

export function diffLines(before: string, after: string, context = 2) {
  const a = before === "" ? [] : before.split("\n");
  const b = after === "" ? [] : after.split("\n");
  let lines: DiffLine[];

  if ((a.length + 1) * (b.length + 1) > MAX_CELLS) {
    lines = [...a.map((text) => ({ kind: "removed" as const, text })), ...b.map((text) => ({ kind: "added" as const, text }))];
  } else {
    // longest common subsequence, filled from the end so the walk below goes forward
    const w = b.length + 1;
    const lcs = new Int32Array((a.length + 1) * w);
    for (let i = a.length - 1; i >= 0; i--)
      for (let j = b.length - 1; j >= 0; j--)
        lcs[i * w + j] = a[i] === b[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    lines = [];
    let i = 0;
    let j = 0;
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) {
        lines.push({ kind: "context", text: a[i] });
        i++;
        j++;
      } else if (j < b.length && (i === a.length || lcs[i * w + j + 1] > lcs[(i + 1) * w + j])) {
        lines.push({ kind: "added", text: b[j++] });
      } else {
        lines.push({ kind: "removed", text: a[i++] });
      }
    }
  }

  const additions = lines.filter((l) => l.kind === "added").length;
  const deletions = lines.filter((l) => l.kind === "removed").length;
  // keep only changed lines and `context` lines around them
  const near = lines.map((_, k) =>
    lines.slice(Math.max(0, k - context), k + context + 1).some((x) => x.kind !== "context"),
  );
  return { lines: lines.filter((_, k) => near[k]), additions, deletions };
}

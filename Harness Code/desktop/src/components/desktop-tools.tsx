import { useEffect, useRef, useState } from "react";
import type { ToolCallMessagePartComponent, ToolCallMessagePartProps } from "@assistant-ui/react";
import { ApprovalCard } from "@/components/approval-card";
import { CodeDiff } from "@/components/code-diff";
import { FileTree, type FileTreeNode } from "@/components/file-tree";
import { RetrievalChunks, type RetrievalChunk } from "@/components/retrieval-chunks";
import { needDesktop } from "@/lib/desktop";
import { diffLines } from "@/lib/diff";

/* Desktop-run tools. The agent only declares them; these components do the work on this
   machine and hand the result back with addResult, which resumes the agent's run. */

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const parse = <T,>(v: unknown): T | undefined => {
  if (typeof v !== "string") return v as T | undefined;
  try {
    return JSON.parse(v) as T;
  } catch {
    return v as T; // plain-text results (file contents, listings)
  }
};

/* Run `work` once when the call is waiting on the app; StrictMode's double effect must not run it twice. */
function useRunOnce(p: ToolCallMessagePartProps, work: () => Promise<unknown>) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current || p.result !== undefined || p.status.type === "running") return;
    started.current = true;
    work().then(
      (result) => p.addResult(result),
      (e) => p.addResult({ error: errorText(e) }),
    );
  }, [p, work]);
}

/* shortcut: a result is treated as a folder listing when the call named a folder ("" or a path ending in "/");
   reading a folder by a name without "/" shows nothing here. Return a typed result from Electron to fix. */
export const ReadWorkspaceTool: ToolCallMessagePartComponent<{ path?: string }> = (p) => {
  useRunOnce(p, () => needDesktop().read(p.args.path ?? ""));
  const path = p.args.path ?? "";
  const listing = parse<string>(p.result);
  if (typeof listing !== "string" || !(path === "" || path.endsWith("/"))) return null;
  const nodes: FileTreeNode[] = listing
    .split("\n")
    .filter(Boolean)
    .map((entry) => {
      const folder = entry.endsWith("/");
      const name = folder ? entry.slice(0, -1) : entry;
      return { path: `${path}${name}`, name, depth: 0, kind: folder ? "folder" : "file" };
    });
  return <FileTree nodes={nodes} visibleCount={nodes.length} totalAdditions={0} totalDeletions={0} className="my-2" />;
};

type Passage = { text: string; source: string; location: string | null; score: number | null };
type DocsResult = {
  workspace?: { passages?: Passage[]; error?: string };
  servers?: { name: string; passages?: Passage[]; error?: string }[];
  error?: string;
};

export const SearchDocumentsTool: ToolCallMessagePartComponent<{ query?: string; k?: number }> = (p) => {
  useRunOnce(p, () => needDesktop().searchDocs(p.args.query ?? "", p.args.k));
  const result = parse<DocsResult>(p.result);
  if (p.result !== undefined && (!result || typeof result !== "object" || result.error)) return null; // errors show in the timeline
  const chunks: RetrievalChunk[] = [
    ...(result?.workspace?.passages ?? []).map((x) => ({ ...x, origin: "" })),
    ...(result?.servers ?? []).flatMap((s) => (s.passages ?? []).map((x) => ({ ...x, origin: `${s.name}: ` }))),
  ].map((x, i) => ({
    id: String(i),
    source: `${x.origin}${x.source}`,
    locator: x.location ?? "",
    score: x.score ?? 0,
    text: x.text,
  }));
  return (
    <RetrievalChunks
      query={p.args.query ?? ""}
      chunks={chunks}
      visibleCount={chunks.length}
      searching={p.result === undefined}
      className="my-2"
    />
  );
};

type EditArgs = { path?: string; content?: string; summary?: string };
type EditResult = { approved: boolean; message?: string; error?: string; added?: number; removed?: number };

export const ProposeEditTool: ToolCallMessagePartComponent<EditArgs, EditResult | string> = (p) => {
  const { path, content, summary } = p.args;
  const [before, setBefore] = useState<string>();
  const [writing, setWriting] = useState(false);
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    // load the original once; re-reading after the write would diff the file against itself
    if (!path || p.status.type === "running" || before !== undefined) return;
    needDesktop().current(path).then(setBefore, (e) => setLoadError(errorText(e)));
  }, [path, p.status.type, before]);

  if (!path || content === undefined) return null; // still streaming
  const result = parse<EditResult>(p.result);
  const diff = before === undefined ? undefined : diffLines(before, content);
  // a reopened thread re-reads the already-written file, so its diff is empty: show the saved counts only
  const showDiff = diff && !(result?.added !== undefined && diff.additions + diff.deletions === 0);

  const decide = async (approved: boolean) => {
    if (!approved) return p.addResult({ approved: false, message: "The user declined this edit." });
    setWriting(true);
    try {
      // keep the line counts: a reopened thread would otherwise diff the written file against itself
      p.addResult({
        approved: true,
        message: await needDesktop().write(path, content),
        added: diff?.additions,
        removed: diff?.deletions,
      });
    } catch (e) {
      p.addResult({ approved: true, error: errorText(e) });
    } finally {
      setWriting(false);
    }
  };

  return (
    <div className="my-2 flex flex-col gap-2">
      <ApprovalCard
        state={result ? (result.approved && !result.error ? "done" : "denied") : writing ? "running" : "request"}
        title={before === "" ? `Create ${path}` : `Edit ${path}`}
        subtitle="Proposed by Harness"
        description={summary}
        command={loadError}
        details={
          result?.added !== undefined
            ? [{ label: "Lines", value: `+${result.added} −${result.removed ?? 0}` }]
            : diff
              ? [{ label: "Lines", value: `+${diff.additions} −${diff.deletions}` }]
              : undefined
        }
        allowOnceLabel="Apply edit"
        denyLabel="Discard"
        statusLabel={result?.error ? `Not written: ${result.error}` : undefined}
        onAllowOnce={before === undefined || loadError ? undefined : () => decide(true)}
        onDeny={() => decide(false)}
      />
      {showDiff && (
        <CodeDiff filename={path} additions={diff.additions} deletions={diff.deletions} lines={diff.lines} cycle={0} />
      )}
    </div>
  );
};

"use client";

import { useState, type PropsWithChildren } from "react";
import {
  defineToolkit,
  useAui,
  useAuiState,
  type ToolCallMessagePartComponent,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { FileText, Globe, Pencil, Search, Wrench, type LucideIcon } from "lucide-react";
import { ToolCall } from "@/components/tool-call";
import { ToolError } from "@/components/tool-error";
import { ToolTimeline } from "@/components/tool-timeline";
import { DataTable, type DataTableColumn, type DataTableRow } from "@/components/data-table";
import { Chart } from "@/components/chart";
import { OptionList } from "@/components/option-list";
import { ElicitationForm, type ElicitationField } from "@/components/elicitation-form";
import { WebPreview } from "@/components/web-preview";
import { WebSearch } from "@/components/web-search";
import { ImageGallery } from "@/components/image-gallery";
import { LinkPreview } from "@/components/link-preview";
import { NumberTicker } from "@/components/number-ticker";
import { Suggestions } from "@/components/suggestions";
import { JSONGenerativeUI } from "@assistant-ui/generative-ui/react";
import { styledGenerativeUILibrary } from "@/components/generative-ui";
import type { ThreadGroupPart } from "@/components/thread.aui";

/* How each agent tool shows in the thread. The agent (Harness Code/agent) owns the schemas;
   these entries only render. Tools that need an answer (choose_option, ask_user) reply with addResult. */

const TOOLS: Record<string, { done: string; active: string; verb: string; icon: LucideIcon }> = {
  web_search: {
    done: "Searched the web",
    active: "Searching the web",
    verb: "Searched",
    icon: Search,
  },
  read_workspace: {
    done: "Read the workspace",
    active: "Reading the workspace",
    verb: "Read",
    icon: FileText,
  },
  search_documents: {
    done: "Searched documents",
    active: "Searching documents",
    verb: "Searched docs",
    icon: Search,
  },
  propose_edit: {
    done: "Proposed an edit",
    active: "Preparing an edit",
    verb: "Edited",
    icon: Pencil,
  },
  open_page: { done: "Opened a page", active: "Opening a page", verb: "Opened", icon: Globe },
  image_search: { done: "Found images", active: "Finding images", verb: "Images", icon: Search },
  link_preview: { done: "Read a link", active: "Reading a link", verb: "Previewed", icon: Globe },
};
const meta = (name: string) =>
  TOOLS[name] ?? { done: `Used ${name}`, active: `Using ${name}`, verb: name, icon: Wrench };

const firstArg = (args: unknown) => {
  const v = args && typeof args === "object" ? Object.values(args)[0] : undefined;
  return typeof v === "string" ? v : "";
};
const text = (v: unknown) =>
  v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v, null, 2);
/* results that came back from the agent are JSON strings; ones just added in this session are objects */
const parse = <T,>(v: unknown): T | undefined => {
  if (typeof v !== "string") return v as T | undefined;
  try {
    return JSON.parse(v) as T;
  } catch {
    return undefined;
  }
};
const failure = (p: ToolCallMessagePartProps) =>
  p.status.type === "incomplete"
    ? String((p.status as { error?: unknown }).error ?? "The tool did not finish.")
    : p.isError || (typeof p.result === "string" && p.result.startsWith("Error:"))
      ? text(p.result)
      : undefined;

export const GenericTool: ToolCallMessagePartComponent = (p) => {
  const [open, setOpen] = useState(false);
  const m = meta(p.toolName);
  const error = failure(p);
  if (error)
    return (
      <ToolError
        name={p.toolName}
        target={firstArg(p.args)}
        message={error}
        attempt={1}
        maxAttempts={1}
        retrying={false}
      />
    );
  return (
    <ToolCall
      label={m.done}
      activeLabel={m.active}
      query={firstArg(p.args)}
      request={p.argsText}
      result={text(p.result)}
      // a call with its result is done, even while the rest of the reply still streams
      running={p.status.type === "running" && p.result === undefined}
      open={open}
      onOpenChange={setOpen}
    />
  );
};

type TableArgs = {
  caption?: string;
  columns?: { key: string; label: string; kind?: string; currency?: string | null }[];
  rows?: DataTableRow[];
};
const TableTool: ToolCallMessagePartComponent<TableArgs> = ({ args }) => {
  if (!args.columns?.length || !args.rows?.length) return null; // still streaming
  // weak models drop column keys; match columns to row keys by position (a keyless column also crashes DataTable)
  const rowKeys = Object.keys(args.rows[0] ?? {});
  const columns: DataTableColumn[] = args.columns.map((c, i) => ({
    key: c?.key || rowKeys[i] || String(i),
    label: c.label,
    format:
      c.kind === "currency"
        ? c.currency
          ? { kind: "currency", currency: c.currency }
          : { kind: "number" } // no code given: don't guess a currency
        : c.kind && c.kind !== "text"
          ? c.kind === "percent"
            ? { kind: "percent", basis: "unit" } // models write 12 for 12%; the registry default reads 12 as 1200%
            : ({ kind: c.kind } as DataTableColumn["format"])
          : undefined,
  }));
  return <DataTable columns={columns} rows={args.rows} caption={args.caption} className="my-2" />;
};

type ChartArgs = {
  label?: string;
  value?: string;
  delta?: string | null;
  points?: number[];
  variant?: "area" | "line" | "bars";
};
const ChartTool: ToolCallMessagePartComponent<ChartArgs> = ({ args }) => {
  if (!args.label || !args.value || !args.points?.length) return null;
  return (
    <Chart
      label={args.label}
      value={args.value}
      delta={args.delta ?? undefined}
      points={args.points}
      visibleCount={args.points.length}
      variant={args.variant}
      className="my-2"
    />
  );
};

const PageTool: ToolCallMessagePartComponent<{ url?: string }> = ({ args }) => {
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  let url: URL | undefined;
  try {
    url = args.url ? new URL(args.url) : undefined;
  } catch {
    url = undefined;
  }
  if (!url || !/^https?:$/.test(url.protocol)) return null; // only web pages, never file: or javascript:
  return (
    <WebPreview
      origin={url.host}
      loading={loading}
      onReload={() => {
        setLoading(true);
        setKey((k) => k + 1);
      }}
      onOpenExternal={() => window.open(url.href, "_blank", "noopener,noreferrer")}
      className="my-2"
    >
      {/* many sites refuse to be framed; "open in new tab" stays available for those */}
      <iframe
        key={key}
        src={url.href}
        sandbox="allow-scripts allow-same-origin allow-forms"
        // origin only (the browser default): YouTube embeds refuse to play without a referrer (error 153)
        referrerPolicy="strict-origin-when-cross-origin"
        allow="encrypted-media; fullscreen; picture-in-picture"
        className="h-80 w-full border-0"
        onLoad={() => setLoading(false)}
        title={url.host}
      />
    </WebPreview>
  );
};

type OptionArgs = {
  question?: string;
  options?: { id: string; label: string; description?: string | null }[];
  multiple?: boolean;
};
const ChooseOptionTool: ToolCallMessagePartComponent<OptionArgs> = ({
  args,
  result,
  addResult,
}) => {
  if (!args.options?.length) return null;
  const choice = parse<{ selected: string[] }>(result)?.selected;
  return (
    <div className="my-2 flex flex-col gap-2">
      {args.question && <p className="text-sm">{args.question}</p>}
      <OptionList
        options={args.options.map((o) => ({
          id: o.id,
          label: o.label,
          description: o.description ?? undefined,
        }))}
        selectionMode={args.multiple ? "multiple" : "single"}
        choice={choice}
        onConfirm={(ids) => addResult({ selected: ids })}
      />
    </div>
  );
};

type AskArgs = {
  message?: string;
  fields?: {
    name: string;
    label: string;
    kind?: ElicitationField["kind"];
    options?: string[] | null;
    required?: boolean;
  }[];
};
const AskUserTool: ToolCallMessagePartComponent<AskArgs> = ({ args, result, addResult }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  if (!args.fields?.length) return null;
  const answer = parse<{ action: "accept" | "decline"; content?: Record<string, string> }>(result);
  const shown = answer?.content ?? values;
  const fields: ElicitationField[] = args.fields.map((f) => ({
    name: f.name,
    label: f.label,
    kind: f.kind ?? "text",
    options: f.options ?? undefined,
    required: f.required ?? true,
    value: shown[f.name] ?? "",
  }));
  return (
    <ElicitationForm
      server="Harness"
      message={args.message ?? ""}
      fields={fields}
      state={answer ? (answer.action === "accept" ? "accepted" : "declined") : "request"}
      onFieldChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))}
      // send every field: untouched ones as empty, toggles left off as "false"
      onAccept={() =>
        addResult({
          action: "accept",
          content: Object.fromEntries(
            fields.map((f) => [f.name, f.value || (f.kind === "toggle" ? "false" : "")]),
          ),
        })
      }
      onDecline={() => addResult({ action: "decline" })}
      className="my-2"
    />
  );
};

type SearchHit = { title: string; snippet: string; link: string };
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};
const WebSearchTool: ToolCallMessagePartComponent<{ query?: string }> = (p) => {
  const parts = useAuiState((s) => s.message.parts);
  if (failure(p)) return <GenericTool {...p} />;
  // a server search with no result that is no longer running was cut off (e.g. the agent restarted mid-run)
  if (p.result === undefined && p.status.type !== "running")
    return (
      <ToolError
        name="web_search"
        target={p.args.query ?? ""}
        message="The search did not finish. Send the message again."
        attempt={1}
        maxAttempts={1}
        retrying={false}
      />
    );
  // models often search several times in one reply: the first search shows one card for all of them
  // (failed or cut-off searches keep their own error card above)
  const searches = parts.flatMap((q) =>
    q.type === "tool-call" &&
    q.toolName === "web_search" &&
    !q.isError &&
    (q.result !== undefined || q.status?.type === "running")
      ? [q]
      : [],
  );
  if (searches[0]?.toolCallId !== p.toolCallId) return null;
  const hits = searches.flatMap((q) => parse<SearchHit[]>(q.result) ?? []);
  // one result per domain: the registry WebSearch keys rows by domain, so repeats would collide
  const results = hits
    .map((h) => ({ title: h.title, domain: hostOf(h.link) }))
    .filter((r, i, all) => all.findIndex((x) => x.domain === r.domain) === i);
  return (
    <WebSearch
      query={searches.map((q) => (q.args as { query?: string }).query ?? "").filter(Boolean).join(" · ")}
      results={results}
      visibleResults={results.length}
      searching={searches.some((q) => q.result === undefined)}
      cycle={0}
      className="my-2"
    />
  );
};

const isWeb = (u: unknown): u is string => typeof u === "string" && /^https?:\/\//i.test(u);

type ImageHit = { src: string; title?: string; source?: string };
const ImagesTool: ToolCallMessagePartComponent<{ query?: string }> = ({ result, isError }) => {
  if (isError) return null; // the tool timeline shows the failure
  const images = (parse<ImageHit[]>(result) ?? [])
    .filter((h) => isWeb(h.src))
    .map((h, i) => ({
      id: `${i}`,
      src: h.src,
      alt: h.title ?? "",
      caption: h.title,
      source: isWeb(h.source) ? { label: hostOf(h.source), url: h.source } : undefined,
    }));
  return images.length ? <ImageGallery images={images} className="my-2" /> : null;
};

type PageMeta = { href: string; title?: string; description?: string; image?: string; siteName?: string; favicon?: string };
const LinkPreviewTool: ToolCallMessagePartComponent<{ url?: string }> = ({ result, isError }) => {
  const meta = isError ? undefined : parse<PageMeta>(result);
  if (!meta || !isWeb(meta.href)) return null;
  return (
    <LinkPreview
      href={meta.href}
      title={meta.title}
      description={meta.description}
      image={isWeb(meta.image) ? meta.image : undefined}
      imageAlt={meta.title}
      siteName={meta.siteName}
      favicon={isWeb(meta.favicon) ? meta.favicon : undefined}
      className="my-2"
    />
  );
};

const StatTool: ToolCallMessagePartComponent<{ label?: string; value?: number }> = ({ args }) =>
  typeof args.value === "number" && args.label ? (
    <NumberTicker value={args.value} label={args.label} className="my-2" />
  ) : null;

/* Follow-ups: shown under the last reply only; picking one sends it as the user's next message. */
const FollowupsTool: ToolCallMessagePartComponent<{ suggestions?: string[] }> = ({ args }) => {
  const aui = useAui();
  const isLast = useAuiState((s) => s.thread.messages.at(-1)?.id === s.message.id);
  // args stream in partially and weak models send odd shapes; anything not a string array shows nothing
  const suggestions = (Array.isArray(args.suggestions) ? args.suggestions : []).filter(
    (s) => typeof s === "string" && s.trim(),
  );
  if (!isLast || !suggestions.length) return null;
  return (
    <Suggestions
      suggestions={suggestions}
      selectedSuggestion={null}
      cycle={0}
      variant="pills"
      onSuggestion={(text) => aui.thread().append({ role: "user", content: [{ type: "text", text }] })}
      className="my-2"
    />
  );
};

/* Generative UI: the model draws a tree of library components (cards, maps, diagrams...) with `present`, or asks
   through one with `prompt_user`. The agent learns both schemas from the run context (`uiTools`), so they never drift. */
const genui = new JSONGenerativeUI({ library: styledGenerativeUILibrary });
const present = genui.present({ display: "standalone" }); // its own surface, not hidden in the collapsed tool group
const promptUser = genui.promptUser();
export const uiTools = [
  { name: "present", description: present.description, parameters: present.parameters },
  { name: "prompt_user", description: promptUser.description, parameters: promptUser.parameters },
];

export const toolkit = defineToolkit({
  present,
  prompt_user: promptUser,
  image_search: { type: "backend", display: "standalone", render: ImagesTool },
  link_preview: { type: "backend", display: "standalone", render: LinkPreviewTool },
  show_stat: { type: "backend", display: "standalone", render: StatTool },
  suggest_followups: { type: "backend", display: "standalone", render: FollowupsTool },
  web_search: { type: "backend", display: "standalone", render: WebSearchTool },
  show_table: { type: "backend", display: "standalone", render: TableTool },
  show_chart: { type: "backend", display: "standalone", render: ChartTool },
  open_page: { type: "backend", display: "standalone", render: PageTool },
  choose_option: { type: "backend", display: "standalone", render: ChooseOptionTool },
  ask_user: { type: "backend", display: "standalone", render: AskUserTool },
});

/* One collapsed line per turn of tool calls; expands to the trace. Opens itself when a call failed. */
export function HarnessToolGroup({
  group,
  children,
}: PropsWithChildren<{ group: ThreadGroupPart }>) {
  const parts = useAuiState((s) => s.message.parts);
  const [open, setOpen] = useState(false);
  const calls = group.indices
    .map((i) => parts[i])
    .filter(
      (p): p is Extract<(typeof parts)[number], { type: "tool-call" }> => p?.type === "tool-call",
    );
  const failed = calls.some((c) => c.status.type === "incomplete" || c.isError);
  const steps = calls.map((c) => ({
    id: c.toolCallId,
    verb: meta(c.toolName).verb,
    chip: firstArg(c.args),
    icon: meta(c.toolName).icon,
  }));
  return (
    <div className="my-1">
      <ToolTimeline
        steps={steps}
        visibleSteps={steps.length}
        streaming={group.status.type === "running"}
        open={open}
        onOpenChange={setOpen}
        restingLabel={`Used ${steps.length} tool${steps.length === 1 ? "" : "s"}`}
        activeLabel="Working"
        stats={[]}
      />
      {/* the timeline is the view; the cards stay mounted (app-run tools execute on mount) and only a failure shows */}
      <div hidden={!failed} className="mt-1 flex flex-col gap-1">
        {children}
      </div>
    </div>
  );
}

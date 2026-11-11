import type { Meta } from "../types";

const onOff = (key: string, label: string, def: "On" | "Off", adv?: true): Meta["fields"][number] =>
  ({ key, label, kind: "select", options: ["On", "Off"], def, adv });

export const META: Record<string, Meta> = {
  "approval-card": {
    title: "Approval card",
    description: "Asks before the agent runs a command. State, variant, command, details, description and the Always allow button are props.",
    fields: [
      { key: "state", label: "State", kind: "select", options: ["Request", "Running", "Done", "Denied"], def: "Request" },
      { key: "variant", label: "Variant", kind: "select", options: ["Default", "Destructive"], def: "Default" },
      onOff("command", "Command", "On"),
      onOff("details", "Details", "Off"),
      onOff("description", "Description", "Off", true),
      onOff("always", "Always allow", "On", true),
    ],
  },
  "code-diff": {
    title: "Code diff",
    description: "A file edit the agent made, line by line. Diff length is the content, and cycle replays the line animation.",
    fields: [
      { key: "length", label: "Length", kind: "select", options: ["Short", "Long"], def: "Short" },
      onOff("replay", "Replay", "On", true),
    ],
  },
  "reviewable-diff": {
    title: "Reviewable diff",
    description: "A diff split into hunks the user keeps or discards before applying. Hunk count and the Keep/Discard and Apply buttons are props.",
    fields: [
      { key: "hunks", label: "Hunks", kind: "range", min: 1, max: 4, step: 1, def: 3 },
      onOff("actions", "Keep / Discard", "On"),
      onOff("apply", "Apply button", "On"),
    ],
  },
  "code-runner": {
    title: "Code runner",
    description: "A snippet the agent runs, with its output. Run state, the run button and the duration are props.",
    fields: [
      { key: "state", label: "State", kind: "select", options: ["Idle", "Running", "Ok", "Error"], def: "Ok" },
      onOff("run", "Run button", "On"),
      onOff("duration", "Duration", "On", true),
    ],
  },
  "terminal-block": {
    title: "Terminal block",
    description: "A shell command and its streaming output. Variant, exit code, cwd, duration, collapsed lines and the truncated note are props.",
    fields: [
      { key: "variant", label: "Variant", kind: "select", options: ["Paper", "Ink"], def: "Paper" },
      { key: "outcome", label: "Outcome", kind: "select", options: ["Success", "Failed"], def: "Success" },
      onOff("stream", "Stream", "On"),
      onOff("cwd", "Cwd", "On"),
      onOff("duration", "Duration", "On", true),
      onOff("collapse", "Collapse", "Off", true),
      onOff("truncated", "Truncated note", "Off", true),
    ],
  },
  "computer-use": {
    title: "Computer use",
    description: "The agent driving a browser: a screen with a moving cursor and the current action. Steps and the active step are props.",
    fields: [
      { key: "steps", label: "Steps", kind: "range", min: 2, max: 6, step: 1, def: 4 },
      onOff("autoplay", "Autoplay", "On"),
    ],
  },
  "file-tree": {
    title: "File tree",
    description: "Files the agent changed, with line counts. Tree size is the content, and how many rows are visible is a prop.",
    fields: [
      { key: "size", label: "Size", kind: "select", options: ["Small", "Large"], def: "Large" },
      onOff("stream", "Stream", "On"),
    ],
  },
  "retrieval-chunks": {
    title: "Retrieval chunks",
    description: "Passages retrieved for a query, with relevance scores. Chunk count, searching state and how many are visible are props.",
    fields: [
      { key: "chunks", label: "Chunks", kind: "range", min: 1, max: 5, step: 1, def: 3 },
      onOff("stream", "Stream", "On"),
      onOff("searching", "Searching", "Off"),
      { key: "query", label: "Query", kind: "select", options: ["Short", "Long"], def: "Short", adv: true },
    ],
  },
  "document-reference": {
    title: "Document reference",
    description: "A cited document with quoted passages by page. Anchor count and jumping between pages are props.",
    fields: [
      { key: "anchors", label: "Anchors", kind: "range", min: 1, max: 4, step: 1, def: 3 },
      onOff("jump", "Jump", "On"),
    ],
  },
  "research-report": {
    title: "Research report",
    description: "A long report being written section by section. Section count, each section's state and previews are props.",
    fields: [
      { key: "mode", label: "Mode", kind: "select", options: ["Live", "Done"], def: "Live" },
      { key: "sections", label: "Sections", kind: "range", min: 2, max: 6, step: 1, def: 4 },
      onOff("previews", "Previews", "On"),
    ],
  },
  "permission-grant": {
    title: "Permission grant",
    description: "A capability the agent asks for and what it grants. Scope (pending, session, always, denied), the buttons and the reach list are props.",
    fields: [
      { key: "scope", label: "Scope", kind: "select", options: ["Pending", "Session", "Always", "Denied"], def: "Pending" },
      onOff("buttons", "Buttons", "On"),
      { key: "reach", label: "Reach items", kind: "range", min: 1, max: 4, step: 1, def: 3 },
    ],
  },
  "guardrail-notice": {
    title: "Guardrail notice",
    description: "Shown when a request is blocked by a policy, with safer alternatives. Explanation, alternatives and clickable alternatives are props.",
    fields: [
      { key: "explanation", label: "Explanation", kind: "select", options: ["Short", "Long"], def: "Short" },
      { key: "alternatives", label: "Alternatives", kind: "range", min: 0, max: 4, step: 1, def: 2 },
      onOff("clickable", "Clickable", "On"),
    ],
  },
  "confidence-marker": {
    title: "Confidence marker",
    description: "Underlines each claim by how well it is supported, with the basis on hover. The highlighted claim is a prop.",
    fields: [
      { key: "highlight", label: "Highlight", kind: "select", options: ["None", "Grounded", "Inferred", "Uncertain"], def: "None" },
    ],
  },
  "memory-chips": {
    title: "Memory chips",
    description: "Facts the agent remembered about the user. Chip count, change kind (added, updated, existing) and the forget button are props.",
    fields: [
      { key: "chips", label: "Chips", kind: "range", min: 1, max: 6, step: 1, def: 4 },
      { key: "change", label: "Change", kind: "select", options: ["Mixed", "New", "Existing"], def: "Mixed" },
      onOff("forget", "Forget button", "On"),
    ],
  },
  "map-answer": {
    title: "Map answer",
    description: "Places in an answer, as pins on a map and a list. Pin count, the route line and selecting a pin are props.",
    fields: [
      { key: "pins", label: "Pins", kind: "range", min: 2, max: 5, step: 1, def: 3 },
      onOff("route", "Route", "Off"),
      onOff("select", "Selectable", "On"),
    ],
  },
  "media-player": {
    title: "Media player",
    description: "Audio or video the agent returns. Player kind, title, audio artwork, video poster and video ratio are props.",
    fields: [
      { key: "player", label: "Player", kind: "select", options: ["Audio", "Video"], def: "Audio" },
      onOff("title", "Title", "On"),
      onOff("artwork", "Artwork (audio)", "On"),
      { key: "ratio", label: "Ratio (video)", kind: "select", options: ["16:9", "4:3", "1:1", "9:16", "auto"], def: "16:9", adv: true },
      onOff("poster", "Poster (video)", "On", true),
    ],
  },
  "speaker-identity": {
    title: "Speaker identity",
    description: "Who said each turn: user, agent, subagent or tool. Turn count, the detail label and text length are props.",
    fields: [
      { key: "turns", label: "Turns", kind: "range", min: 1, max: 4, step: 1, def: 4 },
      onOff("details", "Details", "On"),
      { key: "text", label: "Text", kind: "select", options: ["Short", "Long"], def: "Short", adv: true },
    ],
  },
  "error-state": {
    title: "Error state",
    description: "Shown when a run fails, with a retry button. Retrying state and detail length are props.",
    fields: [
      onOff("retrying", "Retrying", "Off"),
      { key: "detail", label: "Detail", kind: "select", options: ["Short", "Long"], def: "Short" },
    ],
  },
};

import type { Field } from "../../../../lib/settings";
import type { Meta } from "../types";

const onOff = (key: string, label: string, def: "On" | "Off", adv?: true): Field => ({
  key, label, kind: "select", options: ["On", "Off"], def, ...(adv && { adv }),
});
const shortLong = (key: string, label: string): Field => ({
  key, label, kind: "select", options: ["Short", "Long"], def: "Short",
});
const count = (key: string, label: string, min: number, max: number, def: number): Field => ({
  key, label, kind: "range", min, max, step: 1, def,
});

export const META: Record<string, Meta> = {
  "thinking-indicator": {
    title: "Thinking indicator",
    description: "Shown while the agent works before any reply text. Label and elapsed timer are props.",
    fields: [
      { key: "label", label: "Label", kind: "select", options: ["Short", "Long"], def: "Short" },
      { key: "timer", label: "Timer", kind: "select", options: ["On", "Off"], def: "On" },
    ],
  },
  "typing-indicator": {
    title: "Typing indicator",
    description: "Three bouncing dots while a reply is about to stream. Variant (bubble or bare) is the only prop.",
    fields: [{ key: "variant", label: "Variant", kind: "select", options: ["bubble", "bare"], def: "bubble" }],
  },
  "loading-state": {
    title: "Generation loader",
    description: "A ticking pixel grid with a shimmering label while something is generated. Cell shape and label are props.",
    fields: [
      { key: "variant", label: "Cells", kind: "select", options: ["dots", "squares", "rounded"], def: "dots" },
      shortLong("label", "Label"),
    ],
  },
  "streaming-text": {
    title: "Streaming text",
    description: "Reply text arriving word by word with the newest words tinted and a caret. Streaming, length and inline code are options.",
    fields: [
      onOff("streaming", "Streaming", "On"),
      { key: "length", label: "Length", kind: "select", options: ["Short", "Long"], def: "Long" },
      onOff("code", "Inline code", "On", true),
    ],
  },
  "reasoning-panel": {
    title: "Reasoning panel",
    description: "Collapsible list of reasoning steps that streams in, then rests as a summary label. Streaming, step count and timer are options.",
    fields: [
      { key: "state", label: "State", kind: "select", options: ["Streaming", "Done"], def: "Streaming" },
      count("steps", "Steps", 1, 6, 4),
      onOff("timer", "Timer", "On"),
    ],
  },
  reasoning: {
    title: "Reasoning",
    description: "The model's raw reasoning in a disclosure that previews live while streaming. Variant, streaming, duration and default open are props.",
    fields: [
      { key: "variant", label: "Variant", kind: "select", options: ["outline", "ghost", "muted"], def: "outline" },
      onOff("streaming", "Streaming", "Off"),
      onOff("duration", "Duration", "On"),
      onOff("defaultOpen", "Open by default", "Off", true),
    ],
  },
  "run-activity": {
    title: "Run activity",
    description: "One run's status line with its commentary and tool calls folded underneath. Status, entry count, duration, answer and attention slots are options.",
    fields: [
      {
        key: "status", label: "Status", kind: "select",
        options: ["running", "requires-action", "complete", "cancelled", "incomplete", "error"], def: "running",
      },
      count("entries", "Entries", 0, 6, 4),
      onOff("duration", "Duration", "On"),
      onOff("answer", "Final answer", "Off", true),
      onOff("attention", "Attention slot", "Off", true),
    ],
  },
  "agent-plan": {
    title: "Agent plan",
    description: "The agent's step plan with a progress bar, ticking through steps. Step count, step descriptions and title are options.",
    fields: [
      count("steps", "Steps", 2, 8, 5),
      onOff("descriptions", "Descriptions", "On"),
      shortLong("title", "Title"),
    ],
  },
  "agent-status": {
    title: "Agent status",
    description: "A pill showing what the agent is doing now. State, label length and elapsed timer are options.",
    fields: [
      { key: "state", label: "State", kind: "select", options: ["working", "waiting", "done", "failed"], def: "working" },
      shortLong("label", "Label"),
      onOff("timer", "Timer", "On"),
    ],
  },
  "task-card": {
    title: "Task card",
    description: "A delegated task with its state, an expandable transcript, actions and a result. State and each slot are options.",
    fields: [
      { key: "state", label: "State", kind: "select", options: ["working", "waiting", "done", "failed", "cancelled"], def: "working" },
      shortLong("label", "Label"),
      onOff("transcript", "Transcript", "On"),
      onOff("result", "Result", "Off"),
      onOff("timer", "Timer", "On"),
      onOff("meta", "Model tag", "On", true),
      onOff("actions", "Actions", "Off", true),
    ],
  },
  "todo-list": {
    title: "Todo list",
    description: "The agent's checklist with pending, active, done, failed and cancelled rows. Item count, status mix, details, revision and folding are options.",
    fields: [
      count("items", "Items", 1, 8, 5),
      { key: "mix", label: "Statuses", kind: "select", options: ["In progress", "With failure", "All done"], def: "In progress" },
      onOff("itemDetails", "Item details", "Off"),
      onOff("description", "List description", "Off", true),
      onOff("revision", "Revision", "Off", true),
      onOff("fold", "Fold after 3", "Off", true),
    ],
  },
  "job-progress": {
    title: "Job progress",
    description: "A long job with weighted stages, a progress bar and an ETA, ending in an outcome. Outcome, cancel button and summaries are options.",
    fields: [
      { key: "outcome", label: "Outcome", kind: "select", options: ["Running", "success", "partial", "failed", "cancelled"], def: "Running" },
      onOff("cancel", "Cancel button", "On"),
      onOff("summary", "Outcome summary", "On"),
      onOff("stageDetails", "Stage details", "On", true),
      onOff("elapsed", "Elapsed when done", "On", true),
    ],
  },
  timeline: {
    title: "Timeline",
    description: "Past, current and upcoming events of a run on a vertical line. Event count, details and reveal animation are options.",
    fields: [
      count("events", "Events", 1, 6, 5),
      onOff("details", "Details", "On"),
      onOff("reveal", "Reveal", "On"),
    ],
  },
  "subagent-list": {
    title: "Subagent list",
    description: "Parallel subagents with their models and progress bars, then a summarizing agent. Agent count and summary are options.",
    fields: [count("agents", "Agents", 1, 5, 3), onOff("summary", "Summary agent", "On")],
  },
  "agent-card": {
    title: "Agent card",
    description: "A remote agent's card with its skills, endpoint and a connect button. Connected, skill count and description length are options.",
    fields: [
      onOff("connected", "Connected", "Off"),
      count("skills", "Skills", 0, 4, 3),
      shortLong("description", "Description"),
    ],
  },
  "agent-handoff": {
    title: "Agent handoff",
    description: "One agent passing work to another with the reason and the context carried over. Settled, carried items and reason length are options.",
    fields: [
      onOff("settled", "Settled", "Off"),
      count("carried", "Carried items", 0, 4, 2),
      shortLong("reason", "Reason"),
    ],
  },
  "background-inbox": {
    title: "Background inbox",
    description: "Runs working in the background, each running, ready or failed. Run count, status mix, summaries and collect buttons are options.",
    fields: [
      count("runs", "Runs", 1, 5, 3),
      { key: "mix", label: "Statuses", kind: "select", options: ["Mixed", "All running", "All ready"], def: "Mixed" },
      onOff("summary", "Summaries", "On"),
      onOff("collect", "Collectable", "On", true),
    ],
  },
  "checkpoint-history": {
    title: "Checkpoint history",
    description: "File checkpoints of a run, with the current one marked and later ones dimmed. Checkpoint count, current position and restore are options.",
    fields: [
      count("checkpoints", "Checkpoints", 2, 6, 4),
      { key: "current", label: "Current", kind: "select", options: ["Latest", "Earlier"], def: "Latest" },
      onOff("restore", "Restore", "On"),
    ],
  },
  "trace-waterfall": {
    title: "Trace waterfall",
    description: "A run's spans as nested timing bars. Span count, outcome of the root and newest span, and reveal animation are options.",
    fields: [
      count("spans", "Spans", 2, 8, 6),
      { key: "outcome", label: "Outcome", kind: "select", options: ["running", "completed", "failed"], def: "running" },
      onOff("reveal", "Reveal", "On"),
    ],
  },
};

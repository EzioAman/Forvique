import type { Meta } from "../types";

export const META: Record<string, Meta> = {
  "stopped-run": {
    title: "Stopped run",
    description: "A reply cut off mid-stream with Continue and Discard. Partial text length and stop reason are props.",
    fields: [
      { key: "text", label: "Partial text", kind: "select", options: ["Short", "Long"], def: "Short" },
      { key: "reason", label: "Reason", kind: "select", options: ["User", "Limit", "Timeout"], def: "User" },
    ],
  },
  suggestions: {
    title: "Suggestions",
    description: "Prompt suggestions shown before or after a reply. Layout variant, count and a selected state are props.",
    fields: [
      { key: "variant", label: "Variant", kind: "select", options: ["pills", "list"], def: "pills" },
      { key: "count", label: "Suggestions", kind: "range", min: 1, max: 6, step: 1, def: 4 },
      { key: "selected", label: "Selected", kind: "select", options: ["On", "Off"], def: "Off" },
    ],
  },
  composer: {
    title: "Composer",
    description: "The main message box. Input mode, open menu, attachment state, streaming and context usage are props of its parts.",
    fields: [
      { key: "input", label: "Input", kind: "select", options: ["Text", "Recording", "Transcribing"], def: "Text" },
      { key: "menu", label: "Menu", kind: "select", options: ["None", "Commands", "Mentions", "Models"], def: "None" },
      { key: "attachment", label: "Attachment", kind: "select", options: ["None", "Uploading", "Done", "Error"], def: "None" },
      { key: "streaming", label: "Streaming", kind: "select", options: ["On", "Off"], def: "Off" },
      { key: "context", label: "Context used", kind: "range", min: 0, max: 100, step: 5, def: 40, unit: "%", adv: true },
      { key: "drag", label: "Drag over", kind: "select", options: ["On", "Off"], def: "Off", adv: true },
    ],
  },
  "mobile-composer": {
    title: "Mobile composer",
    description: "Phone-width message bar. Keyboard open, running and the quick-action count are props.",
    fields: [
      { key: "keyboard", label: "Keyboard open", kind: "select", options: ["On", "Off"], def: "Off" },
      { key: "running", label: "Running", kind: "select", options: ["On", "Off"], def: "Off" },
      { key: "actions", label: "Quick actions", kind: "range", min: 0, max: 5, step: 1, def: 3, adv: true },
    ],
  },
  "model-picker": {
    title: "Model picker",
    description: "Model list grouped by family with context and price. Model count and whether rows are selectable are props.",
    fields: [
      { key: "count", label: "Models", kind: "range", min: 1, max: 6, step: 1, def: 4 },
      { key: "selectable", label: "Selectable", kind: "select", options: ["On", "Off"], def: "On" },
    ],
  },
  "model-selector": {
    title: "Model selector",
    description: "Dropdown model switch with optional search and effort row. Trigger variant and size, search, effort and open are props.",
    fields: [
      { key: "variant", label: "Variant", kind: "select", options: ["outline", "ghost", "muted"], def: "outline" },
      { key: "size", label: "Size", kind: "select", options: ["sm", "default", "lg"], def: "default" },
      { key: "searchable", label: "Search", kind: "select", options: ["On", "Off"], def: "Off" },
      { key: "effort", label: "Effort row", kind: "select", options: ["On", "Off"], def: "On" },
      { key: "open", label: "Open", kind: "select", options: ["On", "Off"], def: "Off" },
      { key: "align", label: "Align", kind: "select", options: ["start", "end"], def: "start", adv: true },
    ],
  },
  "reasoning-effort": {
    title: "Reasoning effort",
    description: "Thinking budget switch with a usage bar. Selected level, budget spent and selectable are props.",
    fields: [
      { key: "level", label: "Level", kind: "select", options: ["Low", "Medium", "High"], def: "Medium" },
      { key: "spent", label: "Spent", kind: "range", min: 0, max: 100, step: 5, def: 40, unit: "%" },
      { key: "selectable", label: "Selectable", kind: "select", options: ["On", "Off"], def: "On", adv: true },
    ],
  },
  "quote-reply": {
    title: "Quote reply",
    description: "Selected reply text with a Quote/Explain/Rewrite toolbar. Selection length, toolbar and the quoted preview are props.",
    fields: [
      { key: "selection", label: "Selection", kind: "select", options: ["Short", "Long"], def: "Short" },
      { key: "toolbar", label: "Toolbar", kind: "select", options: ["On", "Off"], def: "On" },
      { key: "quoted", label: "Quoted", kind: "select", options: ["On", "Off"], def: "Off" },
    ],
  },
  "edit-message": {
    title: "Edit message",
    description: "Editing a sent user message. Editing state and the count of replies the edit discards are props.",
    fields: [
      { key: "editing", label: "Editing", kind: "select", options: ["On", "Off"], def: "On" },
      { key: "discarded", label: "Discarded replies", kind: "range", min: 0, max: 5, step: 1, def: 2 },
    ],
  },
  "draft-restore": {
    title: "Draft restore",
    description: "Offer to bring back an unsent draft. Draft length is the prop.",
    fields: [{ key: "draft", label: "Draft", kind: "select", options: ["Short", "Long"], def: "Short" }],
  },
  "empty-state": {
    title: "Empty state",
    description: "New-chat greeting with suggestions and a composer. Greeting length, suggestion count and composer are options.",
    fields: [
      { key: "greeting", label: "Greeting", kind: "select", options: ["Short", "Long"], def: "Short" },
      { key: "count", label: "Suggestions", kind: "range", min: 0, max: 6, step: 1, def: 4 },
      { key: "composer", label: "Composer", kind: "select", options: ["On", "Off"], def: "On" },
    ],
  },
  "settings-panel": {
    title: "Settings panel",
    description: "Model, system prompt, temperature and feature toggles. Temperature, toggle count, model count and editable are props.",
    fields: [
      { key: "temperature", label: "Temperature", kind: "range", min: 0, max: 2, step: 0.1, def: 0.7 },
      { key: "toggles", label: "Toggles", kind: "range", min: 0, max: 4, step: 1, def: 3 },
      { key: "editable", label: "Editable", kind: "select", options: ["On", "Off"], def: "On" },
      { key: "models", label: "Models", kind: "range", min: 1, max: 4, step: 1, def: 3, adv: true },
    ],
  },
  "feedback-dialog": {
    title: "Feedback dialog",
    description: "Thumbs-down follow-up asking what went wrong. Sent state, reason count and the submit button are props.",
    fields: [
      { key: "sent", label: "Sent", kind: "select", options: ["On", "Off"], def: "Off" },
      { key: "reasons", label: "Reasons", kind: "range", min: 1, max: 6, step: 1, def: 5 },
      { key: "submit", label: "Submit button", kind: "select", options: ["On", "Off"], def: "On", adv: true },
    ],
  },
  "message-actions": {
    title: "Message actions",
    description: "Copy, thumbs, regenerate and more under a reply. Copied, reaction and regenerating are props.",
    fields: [
      { key: "copied", label: "Copied", kind: "select", options: ["On", "Off"], def: "Off" },
      { key: "reaction", label: "Reaction", kind: "select", options: ["None", "Up", "Down"], def: "None" },
      { key: "regenerating", label: "Regenerating", kind: "select", options: ["On", "Off"], def: "Off" },
    ],
  },
  "message-branches": {
    title: "Message branches",
    description: "Flip between regenerated versions of a reply. The number of versions is the prop.",
    fields: [{ key: "count", label: "Versions", kind: "range", min: 1, max: 5, step: 1, def: 3 }],
  },
  "message-queue": {
    title: "Message queue",
    description: "Messages waiting while the agent runs. Queued count, cancel buttons and running label length are props.",
    fields: [
      { key: "queued", label: "Queued", kind: "range", min: 0, max: 5, step: 1, def: 2 },
      { key: "cancel", label: "Cancel", kind: "select", options: ["On", "Off"], def: "On" },
      { key: "running", label: "Running label", kind: "select", options: ["Short", "Long"], def: "Short", adv: true },
    ],
  },
  "regenerate-menu": {
    title: "Regenerate menu",
    description: "Regenerate a reply with another model. Open, option count and the trigger button are props.",
    fields: [
      { key: "open", label: "Open", kind: "select", options: ["On", "Off"], def: "On" },
      { key: "options", label: "Models", kind: "range", min: 1, max: 5, step: 1, def: 3 },
      { key: "trigger", label: "Trigger", kind: "select", options: ["On", "Off"], def: "On", adv: true },
    ],
  },
  "day-separator": {
    title: "Day separator",
    description: "Date dividers between messages from different days. Day count and messages per day shape the data.",
    fields: [
      { key: "days", label: "Days", kind: "range", min: 1, max: 3, step: 1, def: 2 },
      { key: "perDay", label: "Messages per day", kind: "range", min: 1, max: 4, step: 1, def: 2 },
    ],
  },
  file: {
    title: "File",
    description: "A file attachment in a message. Variant, size, file type, name length, size label and download are options.",
    fields: [
      { key: "variant", label: "Variant", kind: "select", options: ["outline", "ghost", "muted"], def: "outline" },
      { key: "size", label: "Size", kind: "select", options: ["sm", "default", "lg"], def: "default" },
      { key: "type", label: "Type", kind: "select", options: ["PDF", "Image", "JSON", "Text", "Audio", "Other"], def: "PDF" },
      { key: "name", label: "Name", kind: "select", options: ["Short", "Long"], def: "Short" },
      { key: "download", label: "Download", kind: "select", options: ["On", "Off"], def: "On" },
      { key: "showSize", label: "File size", kind: "select", options: ["On", "Off"], def: "On", adv: true },
    ],
  },
  image: {
    title: "Image",
    description: "An image in a message, with zoom. Variant, size, state, ratio, fit, filename, source and actions are options.",
    fields: [
      { key: "variant", label: "Variant", kind: "select", options: ["outline", "ghost", "muted"], def: "outline" },
      { key: "size", label: "Size", kind: "select", options: ["sm", "default", "lg", "full"], def: "default" },
      { key: "state", label: "State", kind: "select", options: ["Ready", "Generating", "Blocked"], def: "Ready" },
      { key: "ratio", label: "Ratio", kind: "select", options: ["auto", "1:1", "4:3", "16:9", "9:16"], def: "auto" },
      { key: "filename", label: "Filename", kind: "select", options: ["On", "Off"], def: "On" },
      { key: "fit", label: "Fit", kind: "select", options: ["contain", "cover"], def: "contain", adv: true },
      { key: "source", label: "Source", kind: "select", options: ["On", "Off"], def: "Off", adv: true },
      { key: "actions", label: "Actions", kind: "select", options: ["On", "Off"], def: "Off", adv: true },
    ],
  },
};

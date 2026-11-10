import type { Field } from "../../../../lib/settings";
import type { Meta } from "../types";

const onOff = (key: string, label: string, def: "On" | "Off", adv?: true): Field =>
  ({ key, label, kind: "select", options: ["On", "Off"], def, ...(adv && { adv }) });
const shortLong = (key: string, label: string, adv?: true): Field =>
  ({ key, label, kind: "select", options: ["Short", "Long"], def: "Short", ...(adv && { adv }) });

export const META: Record<string, Meta> = {
  "tool-call": {
    title: "Tool call",
    description: "One collapsible tool call line with its request and result. Running/done state, open and query length are options.",
    fields: [
      { key: "state", label: "State", kind: "select", options: ["Running", "Done"], def: "Done" },
      onOff("open", "Open", "Off"),
      shortLong("query", "Query"),
    ],
  },
  "tool-error": {
    title: "Tool error",
    description: "A failed tool call with retry and skip. Retrying state, attempt count, skip button and message length are options.",
    fields: [
      onOff("retrying", "Retrying", "Off"),
      { key: "attempt", label: "Attempt", kind: "range", min: 1, max: 5, step: 1, def: 2 },
      onOff("skip", "Skip button", "On"),
      shortLong("message", "Message"),
      { key: "max", label: "Max attempts", kind: "range", min: 1, max: 5, step: 1, def: 3, adv: true },
    ],
  },
  "tool-timeline": {
    title: "Tool timeline",
    description: "The collapsed line per turn that expands into each tool step. Streaming state, step count, file stats and open are options.",
    fields: [
      { key: "state", label: "State", kind: "select", options: ["Streaming", "Done"], def: "Done" },
      { key: "steps", label: "Steps", kind: "range", min: 1, max: 8, step: 1, def: 4 },
      onOff("stats", "File stats", "On"),
      onOff("open", "Open", "On"),
    ],
  },
  "web-search": {
    title: "Web search",
    description: "A search query with its results streaming in. Searching state, result count and query length are options.",
    fields: [
      { key: "state", label: "State", kind: "select", options: ["Searching", "Done"], def: "Done" },
      { key: "results", label: "Results", kind: "range", min: 1, max: 5, step: 1, def: 3 },
      shortLong("query", "Query"),
    ],
  },
  "web-preview": {
    title: "Web preview",
    description: "Browser chrome around a live preview of a page the agent built. Loading state and URL length are options.",
    fields: [onOff("loading", "Loading", "Off"), shortLong("origin", "URL")],
  },
  "link-preview": {
    title: "Link preview",
    description: "A link card for a page the agent cites. Layout, image, favicon, site name, description and title length are options.",
    fields: [
      { key: "layout", label: "Layout", kind: "select", options: ["card", "compact"], def: "card" },
      onOff("image", "Image", "On"),
      onOff("description", "Description", "On"),
      shortLong("title", "Title"),
      onOff("favicon", "Favicon", "On", true),
      onOff("site", "Site name", "On", true),
    ],
  },
  "inline-citation": {
    title: "Inline citation",
    description: "Numbered source markers inside answer text that open a source card on hover. Source count, date and link are options.",
    fields: [
      { key: "count", label: "Sources", kind: "range", min: 1, max: 4, step: 1, def: 2 },
      onOff("date", "Date", "On"),
      onOff("url", "Link", "On", true),
    ],
  },
  "data-table": {
    title: "Data table",
    description: "A sortable table the agent returns, with number, delta, badge and date cells. Row count, starting sort, caption and date style are options.",
    fields: [
      { key: "rows", label: "Rows", kind: "range", min: 0, max: 8, step: 1, def: 5 },
      { key: "sort", label: "Sort by stars", kind: "select", options: ["None", "Asc", "Desc"], def: "None" },
      onOff("caption", "Caption", "Off", true),
      { key: "date", label: "Date style", kind: "select", options: ["date", "datetime", "relative"], def: "relative", adv: true },
    ],
  },
  chart: {
    title: "Chart",
    description: "A small metric chart with value and delta. Variant, delta direction, whether up is good, point count and streaming are options.",
    fields: [
      { key: "variant", label: "Variant", kind: "select", options: ["area", "line", "bars"], def: "area" },
      { key: "delta", label: "Delta", kind: "select", options: ["Up", "Down", "Flat", "None"], def: "Up" },
      onOff("stream", "Streaming", "Off"),
      onOff("upIsGood", "Up is good", "On", true),
      { key: "points", label: "Points", kind: "range", min: 2, max: 24, step: 1, def: 12, adv: true },
    ],
  },
  "number-ticker": {
    title: "Number ticker",
    description: "A single big number whose digits roll as it changes. Number size, ticking and label length are options.",
    fields: [
      { key: "size", label: "Number", kind: "select", options: ["Small", "Large"], def: "Small" },
      onOff("animate", "Ticking", "On"),
      shortLong("label", "Label"),
    ],
  },
  "option-list": {
    title: "Option list",
    description: "The agent asks the user to pick one or several options. Selection mode, option count, descriptions, receipt state and max picks are options.",
    fields: [
      { key: "mode", label: "Mode", kind: "select", options: ["single", "multiple"], def: "single" },
      { key: "count", label: "Options", kind: "range", min: 2, max: 6, step: 1, def: 4 },
      onOff("descriptions", "Descriptions", "On"),
      onOff("receipt", "Answered", "Off"),
      onOff("interactive", "Interactive", "On", true),
      onOff("disabled", "Disabled option", "Off", true),
      { key: "max", label: "Max picks", kind: "range", min: 1, max: 6, step: 1, def: 6, adv: true },
    ],
  },
  "elicitation-form": {
    title: "Elicitation form",
    description: "An MCP server asks the user for input mid-run. State (request/accepted/declined), field count and required fields are options.",
    fields: [
      { key: "state", label: "State", kind: "select", options: ["request", "accepted", "declined"], def: "request" },
      { key: "fields", label: "Fields", kind: "range", min: 1, max: 3, step: 1, def: 3 },
      onOff("required", "Required", "On", true),
    ],
  },
  "image-gallery": {
    title: "Image gallery",
    description: "Image search results in a grid that opens a lightbox. Image count, max visible tiles and captions are options.",
    fields: [
      { key: "images", label: "Images", kind: "range", min: 1, max: 12, step: 1, def: 8 },
      { key: "maxVisible", label: "Max visible", kind: "range", min: 1, max: 9, step: 1, def: 6 },
      onOff("captions", "Captions", "On", true),
    ],
  },
  "image-generation": {
    title: "Image generation",
    description: "An image being generated, then shown with its prompt. Generating state, regenerate button and prompt length are options.",
    fields: [
      { key: "state", label: "State", kind: "select", options: ["Generating", "Done"], def: "Done" },
      onOff("regenerate", "Regenerate", "On"),
      shortLong("prompt", "Prompt"),
    ],
  },
  "mermaid-diagram": {
    title: "Mermaid diagram",
    description: "A diagram the agent writes in Mermaid, with zoom. Diagram type and streaming skeleton are options.",
    fields: [
      { key: "diagram", label: "Diagram", kind: "select", options: ["Flowchart", "Sequence", "State"], def: "Flowchart" },
      onOff("streaming", "Streaming", "Off"),
    ],
  },
  "generative-ui": {
    title: "Generative UI",
    description: "A component tree the model draws with the present tool, rendered against the Harness library. Sample tree and render status are options.",
    fields: [
      { key: "tree", label: "Tree", kind: "select", options: ["Card", "Steps", "Alert", "Markdown", "Diagram", "Map"], def: "Card" },
      { key: "status", label: "Status", kind: "select", options: ["Done", "Streaming"], def: "Done", adv: true },
    ],
  },
  "generative-markdown": {
    title: "Generative markdown",
    description: "The Markdown block inside generative UI, GitHub-flavored. The only prop is the markdown string, so the sample is the option.",
    fields: [{ key: "sample", label: "Sample", kind: "select", options: ["Summary", "Table", "Code"], def: "Summary" }],
  },
  "geo-map": {
    title: "Geo map",
    description: "A map of places the agent found, with an optional route. Place count, route, theme and height are options.",
    fields: [
      { key: "places", label: "Places", kind: "range", min: 1, max: 6, step: 1, def: 4 },
      onOff("route", "Route", "Off"),
      { key: "theme", label: "Theme", kind: "select", options: ["auto", "light", "dark"], def: "auto" },
      { key: "height", label: "Height", kind: "range", min: 160, max: 400, step: 20, def: 260, unit: "px", adv: true },
    ],
  },
};

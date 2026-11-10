"use client";
import { useSyncExternalStore } from "react";
import acceptedFile from "../app/components_check/accepted.json";
import { group, HARNESS } from "../app/components_check/harness/registry";

/* What the user pressed Accept on: { group: { settings } }. For those groups these values ARE the
   settings, everywhere: the defaults, and nothing in a browser can change them. Only groups still in
   review read (and write) the per-browser overrides the settings panel uses. */
const ACCEPTED = acceptedFile as Record<string, { settings: Record<string, number | string> }>;
export const isLocked = (group: string) => group in ACCEPTED;

/* One schema drives both the store and the settings panel. A new
   component = a new group here; nothing else to wire. */
type Meta = { adv?: boolean; unit?: string };
export type Field = Meta & (
  | { key: string; label: string; kind: "range"; min: number; max: number; step: number; def: number }
  | { key: string; label: string; kind: "select"; options: string[]; def: string }
);
/* adv fields sit under a collapsed "More" in the panel; unit is shown after the value */

export const SCHEMA: Record<string, Field[]> = {
  watcher: [
    { key: "fill", label: "Fill", kind: "select", options: ["Light", "Dark"], def: "Dark" },
    { key: "shape", label: "Shape", kind: "select", options: ["Ball", "Circle", "Cube", "Pill", "Hexagon", "Hex flat"], def: "Cube" },
    { key: "eyes", label: "Eyes", kind: "select", options: ["Slant", "Dots", "Squares"], def: "Dots" },
    { key: "follow", label: "Follow", kind: "range", min: 0, max: 100, step: 1, def: 25 },
    { key: "bounce", label: "Bounce", kind: "range", min: 0, max: 100, step: 1, def: 30 },
    { key: "size", label: "Size", kind: "range", min: 16, max: 180, step: 1, def: 100, unit: "px" },
    { key: "eyeScale", label: "Eye scale", kind: "range", min: 0.5, max: 2, step: 0.05, def: 1, adv: true },
    { key: "eyeWidth", label: "Eye width", kind: "range", min: 0.5, max: 2, step: 0.05, def: 1, adv: true },
    { key: "eyeHeight", label: "Eye height", kind: "range", min: 0.5, max: 2, step: 0.05, def: 1, adv: true },
    { key: "eyeRound", label: "Eye roundness", kind: "range", min: 0, max: 1, step: 0.05, def: 1, adv: true },
    { key: "mood", label: "Mood", kind: "select", options: ["Neutral", "Happy", "Angry", "Sad", "Surprised", "Sleepy", "Love"], def: "Neutral" },
    { key: "poke", label: "Poke", kind: "select", options: ["Random", "Happy", "Angry", "Sad", "Surprised", "Sleepy", "Love"], def: "Random" },
    { key: "speech", label: "Speech", kind: "select", options: ["On", "Off"], def: "On" },
    { key: "idleStyle", label: "Idle", kind: "select", options: ["Off", "Random", "Playful", "Cheerful", "Sleepy", "Curious"], def: "Random" },
  ],
  signature: [
    { key: "ink", label: "Ink", kind: "select", options: ["Black", "Blue", "Red"], def: "Black" },
    { key: "pen", label: "Pen", kind: "range", min: 0, max: 100, step: 1, def: 40 },
    { key: "smooth", label: "Smooth", kind: "range", min: 0, max: 100, step: 1, def: 50 },
    { key: "rewind", label: "Rewind", kind: "range", min: 0, max: 100, step: 1, def: 50 },
    { key: "corner", label: "Corner", kind: "range", min: 0, max: 28, step: 1, def: 20, unit: "px" },
    { key: "idle", label: "Idle", kind: "select", options: ["On", "Off"], def: "On" },
  ],
  generate: [
    { key: "pace", label: "Pace", kind: "range", min: 2, max: 12, step: 1, def: 5, unit: "s" },
    { key: "ripple", label: "Ripple", kind: "range", min: 0, max: 100, step: 1, def: 50 },
    { key: "corner", label: "Corner", kind: "range", min: 0, max: 40, step: 1, def: 20, unit: "px" },
  ],
  seek: [
    { key: "give", label: "Give", kind: "range", min: 0, max: 100, step: 1, def: 50 },
    { key: "spring", label: "Spring", kind: "range", min: 0, max: 100, step: 1, def: 20 },
    { key: "width", label: "Width", kind: "range", min: 240, max: 400, step: 1, def: 240, unit: "px" },
    { key: "corner", label: "Corner", kind: "range", min: 0, max: 24, step: 1, def: 24, unit: "px" },
  ],
  /* Harness components (app/components_check/harness), one group per component */
  ...Object.fromEntries(Object.entries(HARNESS).map(([slug, m]) => [group(slug), m.fields])),
};

type Values = Record<string, Record<string, number | string>>;
const KEY = "forvique-settings";
const defaults = (): Values =>
  Object.fromEntries(Object.entries(SCHEMA).map(([g, f]) => [g, {
    ...Object.fromEntries(f.map((x) => [x.key, x.def])),
    ...(ACCEPTED[g]?.settings ?? {}),
  }]));
const DEFAULTS = defaults();

let cache: Values = DEFAULTS;
const listeners = new Set<() => void>();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const out = defaults();
    /* keep a saved value only if the schema still allows it */
    for (const g in out) if (!isLocked(g)) for (const f of SCHEMA[g]) {
      const v = saved[g]?.[f.key];
      if (f.kind === "select" ? f.options.includes(v) : typeof v === "number" && v >= f.min && v <= f.max) out[g][f.key] = v;
    }
    cache = out;
  } catch {
    cache = DEFAULTS; // private mode / bad JSON: just run on defaults
  }
}
function emit() {
  listeners.forEach((l) => l());
}
function onStorage(e: StorageEvent) {
  if (e.key === KEY) { load(); emit(); }
}
function subscribe(l: () => void) {
  if (!listeners.size) {
    load();
    window.addEventListener("storage", onStorage); // other tabs
  }
  listeners.add(l);
  return () => {
    listeners.delete(l);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}

export function setSetting(group: string, key: string, value: number | string) {
  if (isLocked(group)) return; /* accepted: undo the accept to edit */
  cache = { ...cache, [group]: { ...cache[group], [key]: value } };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
  emit();
}
export function resetSettings() {
  cache = DEFAULTS;
  try { localStorage.removeItem(KEY); } catch {}
  emit();
}

export function useSettings(): Values {
  return useSyncExternalStore(subscribe, () => cache, () => DEFAULTS);
}

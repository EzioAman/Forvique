import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/* accepted.json is the record of what the user approved: { slug: { at, settings } }.
   `settings` is the approved Panel values, saved here because the live ones sit in the
   browser's localStorage where nothing else can read them. */
export const ACCEPTED_FILE = path.join(process.cwd(), "app", "components_check", "accepted.json");

export type Accepted = Record<string, { at: string; settings: Record<string, number | string> }>;

export function readAccepted(): Accepted {
  try {
    return existsSync(ACCEPTED_FILE) ? JSON.parse(readFileSync(ACCEPTED_FILE, "utf8")) : {};
  } catch {
    return {}; // unreadable file: treat as nothing accepted rather than break the route
  }
}

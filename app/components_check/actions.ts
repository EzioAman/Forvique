"use server";
import { writeFile } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { ACCEPTED_FILE, readAccepted } from "./accepted";

/* Accept (settings given) or undo (null). Writes a file in the repo, so dev only. */
export async function setAccepted(slug: string, settings: Record<string, number | string> | null) {
  if (process.env.NODE_ENV === "production") throw new Error("Accepting is a dev-time action");
  if (!/^[a-z0-9_-]+$/i.test(slug)) throw new Error("Bad component name");
  const all = readAccepted();
  if (settings) all[slug] = { at: new Date().toISOString(), settings };
  else delete all[slug];
  await writeFile(ACCEPTED_FILE, JSON.stringify(all, null, 2) + "\n");
  revalidatePath("/components_check", "layout");
}

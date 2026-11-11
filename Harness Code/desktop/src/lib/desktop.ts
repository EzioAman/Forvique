/* The preload bridge (electron/preload.cjs). Absent when the UI runs in a plain browser via `pnpm dev`. */
export type HarnessSettings = {
  workspace: string;
  embeddings: "on-device" | "provider";
  servers: { name: string; url: string; hasToken: boolean }[];
};

type Bridge = {
  getSettings(): Promise<HarnessSettings>;
  setSettings(
    patch: Partial<Omit<HarnessSettings, "servers">> & {
      servers?: { name: string; url: string; token?: string }[];
    },
  ): Promise<HarnessSettings>;
  pickWorkspace(): Promise<HarnessSettings>;
  read(rel: string): Promise<string>;
  current(rel: string): Promise<string>;
  write(rel: string, content: string): Promise<string>;
  searchDocs(query: string, k?: number): Promise<unknown>;
};

export const desktop = (globalThis as { harness?: Bridge }).harness;

export const needDesktop = (): Bridge => {
  if (!desktop) throw new Error("This tool only works in the Harness desktop app.");
  return desktop;
};

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { desktop, type HarnessSettings } from "@/lib/desktop";

type ServerRow = { name: string; url: string; token: string; hasToken: boolean };

/* Company document sources reached through the Forvique search API (docs/search-api.md).
   Tokens go to the main process, which encrypts them; a saved token is never shown again. */
function ServersSection({ settings, onSaved }: { settings: HarnessSettings; onSaved: (s: HarnessSettings) => void }) {
  const [rows, setRows] = useState<ServerRow[]>(() => settings.servers.map((s) => ({ ...s, token: "" })));
  const [status, setStatus] = useState("");
  const update = (i: number, patch: Partial<ServerRow>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const save = async () => {
    const bad = rows.find((r) => !r.name.trim() || !/^https?:\/\/\S+$/.test(r.url.trim()));
    if (bad) return setStatus("Each server needs a name and a URL starting with http:// or https://.");
    onSaved(
      await desktop!.setSettings({
        servers: rows.map((r) => ({ name: r.name.trim(), url: r.url.trim(), ...(r.token && { token: r.token }) })),
      }),
    );
    setRows((r) => r.map((row) => ({ ...row, hasToken: row.hasToken || Boolean(row.token), token: "" })));
    setStatus("Saved.");
  };
  const field = "border-input bg-background h-8 rounded-md border px-2";

  return (
    <section className="flex flex-col gap-2 text-sm">
      <h3 className="font-medium">Company document servers</h3>
      <p className="text-muted-foreground">Harness searches these alongside your workspace files, which are indexed on this device.</p>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_2fr] gap-2">
          <input aria-label="Server name" placeholder="Name" value={row.name} onChange={(e) => update(i, { name: e.target.value })} className={field} />
          <input aria-label="Server URL" placeholder="https://docs.example.com" value={row.url} onChange={(e) => update(i, { url: e.target.value })} className={field} />
          <input
            aria-label="Access token"
            type="password"
            placeholder={row.hasToken ? "Token saved; type to replace" : "Access token"}
            value={row.token}
            onChange={(e) => update(i, { token: e.target.value })}
            className={`${field} col-span-2`}
          />
          <Button variant="ghost" size="sm" className="col-span-2 justify-self-start" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
            Remove {row.name || "server"}
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setRows((r) => [...r, { name: "", url: "", token: "", hasToken: false }])}>
          Add server
        </Button>
        <Button size="sm" onClick={save}>
          Save
        </Button>
        <span role="status" className="text-muted-foreground">
          {status}
        </span>
      </div>
    </section>
  );
}

/* Settings kept on this device by the Electron main process. */
export function SettingsDialog() {
  const [settings, setSettings] = useState<HarnessSettings>();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) desktop?.getSettings().then(setSettings);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" aria-label="Settings" />}>
        <Settings className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        {!desktop ? (
          <p className="text-muted-foreground text-sm">Settings are available in the Harness desktop app.</p>
        ) : (
          <section className="flex flex-col gap-2 text-sm">
            <h3 className="font-medium">Workspace folder</h3>
            <p className="text-muted-foreground">
              Harness can read files here and propose edits, which are written only after you approve them.
            </p>
            <div className="flex items-center gap-2">
              <code className="bg-muted flex-1 truncate rounded px-2 py-1.5">{settings?.workspace || "None chosen"}</code>
              <Button variant="outline" size="sm" onClick={() => desktop?.pickWorkspace().then(setSettings)}>
                Choose…
              </Button>
            </div>
          </section>
        )}
        {desktop && settings && <ServersSection settings={settings} onSaved={setSettings} />}
      </DialogContent>
    </Dialog>
  );
}

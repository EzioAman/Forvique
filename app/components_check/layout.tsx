import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { readAccepted } from "./accepted";
import { Nav } from "./Nav";
import "./check.css";

const root = process.cwd();
const names = (dir: string, keep: (e: import("node:fs").Dirent) => boolean, strip: string | RegExp = "") =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter(keep).map((e) => e.name.replace(strip, "")) : [];

/* The sidebar is read from disk: folders here with a page, split by accepted.json,
   plus whatever is under components/ui. */
export default function CheckLayout({ children }: { children: React.ReactNode }) {
  const here = path.join(root, "app", "components_check");
  const all = names(here, (e) => e.isDirectory() && existsSync(path.join(here, e.name, "page.tsx")));
  const done = readAccepted();
  const ui = names(path.join(root, "components", "ui"), (e) => e.isFile() && /\.tsx?$/.test(e.name), /\.tsx?$/);
  return (
    <div className="cc">
      <Nav review={all.filter((s) => !done[s])} ready={all.filter((s) => done[s])} ui={ui} />
      <div className="cc-main">{children}</div>
    </div>
  );
}

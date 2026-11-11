import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const pascal = (slug: string) => slug.split(/[-_]/).map((w) => w[0].toUpperCase() + w.slice(1)).join("");

/* Graduate a component: app/components_check/<slug>/<Name>.tsx|css -> components/, rewriting the two paths
   that change (its lib/settings import, and the review Demo's import of it). One way on purpose: undoing an
   accept unlocks the settings but never moves the file back, because pages built since may import it.
   Does nothing when there is no <Name>.tsx there (a concept page, or already moved). Returns whether it moved. */
export async function graduate(root: string, slug: string) {
  const name = pascal(slug);
  const dir = path.join(root, "app", "components_check", slug);
  const from = path.join(dir, `${name}.tsx`);
  if (!existsSync(from)) return false;
  await mkdir(path.join(root, "components"), { recursive: true });
  const src = (await readFile(from, "utf8")).replaceAll('"../../../lib/settings"', '"../lib/settings"');
  await writeFile(path.join(root, "components", `${name}.tsx`), src);
  await unlink(from);
  const css = path.join(dir, `${name}.css`);
  if (existsSync(css)) await rename(css, path.join(root, "components", `${name}.css`));
  const demo = path.join(dir, "Demo.tsx");
  if (existsSync(demo)) {
    await writeFile(demo, (await readFile(demo, "utf8")).replaceAll(`"./${name}"`, `"../../../components/${name}"`));
  }
  return true;
}

import { META as a } from "./meta/a";
import { META as b } from "./meta/b";
import { META as c } from "./meta/c";
import { META as d } from "./meta/d";
import type { Meta } from "./types";

/* Every Harness component in the check route. A demo is demos/<slug>.tsx (default export, takes the settings as `v`);
   its title and options sit in one of the meta files (split so they can be written in parallel). */
export const HARNESS: Record<string, Meta> = { ...a, ...b, ...c, ...d };
export const group = (slug: string) => `harness-${slug}`;

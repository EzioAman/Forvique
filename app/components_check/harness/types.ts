import type { Field } from "../../../lib/settings";

/* One Harness component in the check route: its Panel text and the options it exposes (props from assistant-ui).
   Settings live in lib/settings.ts under the group `harness-<slug>`, accepted ones in accepted.json. */
export type Meta = { title: string; description: string; fields: Field[] };
export type V = Record<string, number | string>;

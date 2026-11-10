import accepted from "../../../app/components_check/accepted.json";

/* Options the owner accepted for a Harness component in the website's component check
   (app/components_check/harness, saved as `harness-<slug>`). Undefined when not accepted yet. */
export const applied = (slug: string) =>
  (accepted as Record<string, { settings: Record<string, number | string> }>)[`harness-${slug}`]?.settings;

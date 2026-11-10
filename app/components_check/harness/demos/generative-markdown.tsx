"use client";
import { GenerativeMarkdown } from "@harness/components/generative-markdown";
import type { V } from "../types";

const SAMPLES: Record<string, string> = {
  Summary: `### Fix summary

The test failed because \`ToolCall\` read **open** before mount.

- Moved the read into an effect
- Added a regression test
- No public API change`,
  Table: `| Package | Before | After |
| --- | ---: | ---: |
| next | 15.5 | 16.0 |
| react | 19.1 | 19.2 |
| typescript | 5.8 | 5.9 |`,
  Code: `Run the checks before you push:

\`\`\`bash
pnpm tsc --noEmit
pnpm test -- tool-call
\`\`\`

> ~~Skip lint~~ Lint runs in CI.`,
};

export default function Demo({ v }: { v: V }) {
  return (
    <div className="max-w-md text-sm">
      <GenerativeMarkdown value={SAMPLES[String(v.sample)]} />
    </div>
  );
}

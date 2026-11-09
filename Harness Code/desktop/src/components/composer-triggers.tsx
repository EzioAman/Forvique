import { useMemo } from "react";
import {
  unstable_useMentionAdapter,
  unstable_useSlashCommandAdapter,
  useAui,
  type Unstable_SlashCommand,
} from "@assistant-ui/react";
import { ComposerTriggerPopover } from "@/components/composer-trigger-popover.aui";

/* Follows Anthropic's CLAUDE.md guidance (short, specific, only what a newcomer would get wrong),
   written to AGENTS.md: the cross-tool name Codex and others read, fitting a provider-independent harness. */
const INIT_PROMPT = `Create an AGENTS.md for this workspace.
1. Explore it with read_workspace: the root listing, README, package/project manifests, build and CI config, and a few representative source files.
2. Write a concise AGENTS.md (aim for under 80 lines) covering only what helps an agent work here:
   - what the project is, in one or two sentences;
   - exact commands to install, run, build, test and lint (copied from the manifests, never guessed);
   - layout: the key folders and what lives in them;
   - code style and conventions you can see in the code;
   - gotchas: anything surprising, generated files not to edit, required env vars (names only, never values).
   Skip generic advice and anything obvious from file names.
3. If AGENTS.md already exists, improve it rather than replacing what is still right.
4. Propose it with propose_edit at path "AGENTS.md" so I can approve it. Do not claim it is written until I approve.`;

/* "/" runs commands; "@" lists the agent's tools. */
export function ComposerTriggers() {
  const aui = useAui();
  const commands = useMemo<readonly Unstable_SlashCommand[]>(
    () => [
      {
        id: "init",
        description: "Summarize this workspace into AGENTS.md (you approve the file)",
        execute: () => aui.thread().append(INIT_PROMPT),
      },
    ],
    [aui],
  );
  const slash = unstable_useSlashCommandAdapter({ commands, removeOnExecute: true });
  const mention = unstable_useMentionAdapter();
  return (
    <>
      <ComposerTriggerPopover char="/" {...slash} />
      <ComposerTriggerPopover char="@" {...mention} />
    </>
  );
}

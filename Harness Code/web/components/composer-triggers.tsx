"use client";

import { unstable_useMentionAdapter } from "@assistant-ui/react";
import { ComposerTriggerPopover } from "@/components/composer-trigger-popover.aui";

/* "@" lists the agent's tools, so a user can point it at one. */
export function ComposerTriggers() {
  const mention = unstable_useMentionAdapter();
  return <ComposerTriggerPopover char="@" {...mention} />;
}

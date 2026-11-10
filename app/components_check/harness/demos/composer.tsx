"use client";
import { useEffect, useState } from "react";
import { FileSearchIcon, GitPullRequestIcon, TerminalIcon } from "lucide-react";
import {
  Composer,
  ComposerActions,
  ComposerAttachButton,
  ComposerAttachmentChip,
  ComposerAttachments,
  ComposerBar,
  ComposerCommandItem,
  ComposerContext,
  ComposerInput,
  ComposerMenu,
  ComposerModelItem,
  ComposerModelTrigger,
  ComposerPersonItem,
  ComposerSend,
  ComposerToolbar,
  ComposerVoice,
  ComposerVoiceButton,
  type ComposerAttachment,
  type ComposerCommand,
  type ComposerModel,
  type ComposerPerson,
} from "@harness/components/composer";
import type { V } from "../types";

const COMMANDS: ComposerCommand[] = [
  { name: "search", description: "Search the codebase", icon: FileSearchIcon },
  { name: "run", description: "Run a shell command", icon: TerminalIcon },
  { name: "pr", description: "Open a pull request", icon: GitPullRequestIcon },
];
const PEOPLE: ComposerPerson[] = [
  { name: "Researcher", role: "agent" },
  { name: "Reviewer", role: "agent" },
  { name: "Maya", role: "human" },
];
const MODELS: ComposerModel[] = [
  { name: "Claude Opus", meta: "200k" },
  { name: "Claude Sonnet", meta: "200k" },
  { name: "Claude Haiku", meta: "200k" },
];
const ATTACH: Record<string, ComposerAttachment> = {
  Uploading: { name: "server.log", meta: "1.2 MB", state: "uploading", progress: 45, kind: "text" },
  Done: { name: "schema.png", meta: "340 KB", state: "done", kind: "image" },
  Error: { name: "dump.zip", meta: "Too large", state: "error", kind: "archive" },
};

export default function Demo({ v }: { v: V }) {
  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState(0);
  const recording = v.input === "Recording";
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((n) => (n + 1) % 60), 1000);
    return () => clearInterval(t);
  }, [recording]);
  const attachment = ATTACH[v.attachment];
  const used = Number(v.context) * 2; // percent of a 200k window, in k

  return (
    <div className={v.menu === "None" ? undefined : "pt-56"}>
      <Composer>
        <ComposerMenu open={v.menu === "Commands"}>
          {COMMANDS.map((c, i) => (
            <ComposerCommandItem key={c.name} command={c} active={i === 0} />
          ))}
        </ComposerMenu>
        <ComposerMenu open={v.menu === "Mentions"}>
          {PEOPLE.map((p, i) => (
            <ComposerPersonItem key={p.name} person={p} active={i === 0} />
          ))}
        </ComposerMenu>
        <ComposerMenu open={v.menu === "Models"} align="end">
          {MODELS.map((m, i) => (
            <ComposerModelItem key={m.name} entry={m} selected={i === 1} />
          ))}
        </ComposerMenu>
        <ComposerBar dragActive={v.drag === "On"}>
          {attachment && (
            <ComposerAttachments>
              <ComposerAttachmentChip attachment={attachment} onRemove={() => {}} />
            </ComposerAttachments>
          )}
          {v.input === "Text" ? (
            <ComposerInput
              value={text}
              onChange={(e) => setText(e.target.value)}
              onSubmit={() => setText("")}
              placeholder="Ask the agent to fix, search or explain"
            />
          ) : (
            <ComposerVoice recording={recording} seconds={seconds} />
          )}
          <ComposerToolbar>
            <ComposerActions>
              <ComposerAttachButton onClick={() => {}} />
            </ComposerActions>
            <ComposerActions>
              <ComposerModelTrigger model="Claude Sonnet" open={v.menu === "Models"} />
              <ComposerContext usage={{ system: Math.round(used * 0.2), tools: Math.round(used * 0.3), messages: Math.round(used * 0.5), total: 200 }} />
              <ComposerVoiceButton active={recording} />
              <ComposerSend streaming={v.streaming === "On"} idle={text === ""} />
            </ComposerActions>
          </ComposerToolbar>
        </ComposerBar>
      </Composer>
    </div>
  );
}

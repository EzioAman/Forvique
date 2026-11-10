"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  AssistantCloud,
  AssistantRuntimeProvider,
  AuiConfig,
  SimpleImageAttachmentAdapter,
  Suggestions,
  Tools,
  useAui,
  useAuiState,
  WebSpeechDictationAdapter,
  WebSpeechSynthesisAdapter,
} from "@assistant-ui/react";
import { useLangGraphRuntime, type LangChainMessage } from "@assistant-ui/react-langgraph";
import { Thread } from "@/components/thread.aui";
import { ThreadListSidebar } from "@/components/threadlist-sidebar.aui";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { GenericTool, HarnessToolGroup, toolkit, uiTools } from "@/components/harness-tools";
import { Welcome } from "@/components/harness-welcome";
import { DevToolsModal } from "@assistant-ui/react-devtools";
import { RunError } from "@/components/run-notices";
import { ComposerModel, DEFAULT_MODEL, ModelChoice } from "@/components/model-choice";
import { createClient } from "@/lib/chatApi";
import type { Client } from "@langchain/langgraph-sdk";
import { createHarnessStream } from "@/lib/harnessStream";

const ASSISTANT_ID = process.env["NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID"] ?? "agent";
const config = AuiConfig({
  tools: Tools({ toolkit }),
  suggestions: Suggestions([
    {
      title: "Research a topic",
      label: "with sources, in a table",
      prompt:
        "Search the web for the current stable versions of React, Next.js and Vite and show them in a table with sources.",
    },
    {
      title: "Back up a claim",
      label: "with citations",
      prompt: "Is it true that Rust has no garbage collector? Answer with citations.",
    },
    {
      title: "Help me decide",
      label: "pick from options",
      prompt:
        "Help me choose a database for a small SaaS. Ask me what matters with choose_option, then recommend one.",
    },
  ]),
});
// images only: most models take image input but not other file types
const adapters = {
  attachments: new SimpleImageAttachmentAdapter(),
  speech: new WebSpeechSynthesisAdapter(),
  dictation: new WebSpeechDictationAdapter(),
};
// Assistant Cloud keeps the thread list and titles; the agent keeps the messages. Conversation copies stay
// off: threads can hold client company documents. Without the URL, threads live only in the agent.
const cloudUrl = process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL;
const cloud = cloudUrl
  ? new AssistantCloud({ baseUrl: cloudUrl, anonymous: true, telemetry: { messages: false } })
  : undefined;
const threadComponents = {
  ToolFallback: GenericTool,
  ToolGroup: HarnessToolGroup,
  ComposerExtra: ComposerModel,
  Welcome,
};

export function MyAssistant() {
  const client = useMemo(() => createClient(), []);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [effort, setEffort] = useState("");
  const [spent, setSpent] = useState(0);
  const effortRef = useRef(effort);
  effortRef.current = effort;
  const modelRef = useRef(model); // the stream reads the latest choice at send time
  const quoteRef = useRef<string>(undefined); // set by QuoteCapture, taken by the stream when it sends
  modelRef.current = model;
  const stream = useMemo(
    () =>
      createHarnessStream({
        client,
        assistantId: ASSISTANT_ID,
        getContext: () => ({
          model: modelRef.current,
          client: "web",
          ui_tools: uiTools,
          ...(effortRef.current && { effort: effortRef.current }),
        }),
        takeQuote: () => {
          const quote = quoteRef.current;
          quoteRef.current = undefined;
          return quote;
        },
      }),
    [client],
  );

  const [runError, setRunError] = useState<string>();
  const runtime = useLangGraphRuntime({
    unstable_allowCancellation: true,
    stream,
    adapters,
    eventHandlers: {
      onMetadata: () => setRunError(undefined),
      onError: (e) => setRunError((e as { message?: string })?.message ?? "Unknown error"),
    },
    cloud,
    create: async () => {
      const { thread_id } = await client.threads.create();
      return { externalId: thread_id };
    },
    // retry, reload and edit fork from the checkpoint whose messages match the ones kept
    getCheckpointId: async (threadId, parentMessages) => {
      const history = await client.threads.getHistory<{ messages?: LangChainMessage[] }>(threadId);
      const match = history.find(
        (s) =>
          s.values.messages?.length === parentMessages.length &&
          parentMessages.every((m, i) => m.id === s.values.messages?.[i]?.id),
      );
      return match?.checkpoint.checkpoint_id ?? null;
    },
    load: async (externalId) => {
      const state = await client.threads.getState<{ messages: LangChainMessage[] }>(externalId);
      return { messages: state.values.messages, interrupts: state.tasks[0]?.interrupts };
    },
    delete: async (cloudThreadId) => {
      const externalId = cloud
        ? (await cloud.threads.get(cloudThreadId)).external_id
        : cloudThreadId;
      if (externalId) await client.threads.delete(externalId);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      <ModelChoice.Provider value={{ model, setModel, effort, setEffort, spent }}>
        <QuoteCapture quoteRef={quoteRef} />
        <ReasoningSpent client={client} onSpent={setSpent} />
        <SidebarProvider>
          <div className="flex h-dvh w-full pr-0.5">
            <ThreadListSidebar />
            <SidebarInset>
              <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <h1 className="text-sm font-medium">Harness</h1>
              </header>
              {runError && <RunError message={runError} onDone={() => setRunError(undefined)} />}
              <div className="flex-1 overflow-hidden">
                <Thread components={threadComponents} />
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
        {/* development only: stripped from production builds */}
        <DevToolsModal />
      </ModelChoice.Provider>
    </AssistantRuntimeProvider>
  );
}

/* The LangGraph runtime drops a message's quote metadata before the stream sees it, so the composer's quote is
   kept here. Sending clears the text and the quote together; dismissing clears only the quote, so drop it then. */
function QuoteCapture({ quoteRef }: { quoteRef: RefObject<string | undefined> }) {
  const quote = useAuiState((s) => s.thread.composer.quote?.text);
  const text = useAuiState((s) => s.thread.composer.text);
  const prev = useRef({ quote, text });
  useEffect(() => {
    const sent = prev.current.quote && !quote && prev.current.text && !text;
    if (quote) quoteRef.current = quote;
    else if (!sent) quoteRef.current = undefined;
    prev.current = { quote, text };
  }, [quote, text, quoteRef]);
  return null;
}

/* Reasoning tokens of the last reply, read from the agent's thread state when a run ends (the runtime does not
   carry usage into thread messages). */
function ReasoningSpent({ client, onSpent }: { client: Client; onSpent: (n: number) => void }) {
  const aui = useAui();
  const running = useAuiState((s) => s.thread.isRunning);
  useEffect(() => {
    if (running) return;
    const id = aui.threadListItem().getState().externalId;
    if (!id) return onSpent(0);
    client.threads
      .getState<{ messages?: { type: string; usage_metadata?: { output_token_details?: { reasoning?: number } } }[] }>(id)
      .then((s) => {
        const last = s.values.messages?.findLast((m) => m.type === "ai");
        onSpent(last?.usage_metadata?.output_token_details?.reasoning ?? 0);
      })
      .catch(() => {}); // thread not created yet or agent down: keep the last figure
  }, [running, aui, client, onSpent]);
  return null;
}

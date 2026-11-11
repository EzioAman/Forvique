import { useMemo, useState } from "react";
import {
  AssistantCloud,
  AssistantRuntimeProvider,
  AuiConfig,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  Suggestions,
  Tools,
  WebSpeechSynthesisAdapter,
} from "@assistant-ui/react";
import { useLangGraphRuntime, type LangChainMessage } from "@assistant-ui/react-langgraph";
import { Thread } from "@/components/thread.aui";
import { ThreadListSidebar } from "@/components/threadlist-sidebar.aui";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { GenericTool, HarnessToolGroup, toolkit } from "@/components/harness-tools";
import { DevToolsModal } from "@assistant-ui/react-devtools";
import { SettingsDialog } from "@/components/settings-dialog";
import { RunError } from "@/components/run-notices";
import { createClient } from "@/lib/chatApi";
import { createHarnessStream } from "@/lib/harnessStream";

const ASSISTANT_ID = import.meta.env.VITE_LANGGRAPH_ASSISTANT_ID || "agent";
// fixed until the model switcher is designed (see CLAUDE.md)
const MODEL = "openrouter:openrouter/auto";
const config = AuiConfig({
  tools: Tools({ toolkit }),
  suggestions: Suggestions([
    { title: "Summarize my workspace", label: "what this project is", prompt: "Look through my workspace and summarize what this project is, how it is built and where to start." },
    { title: "Search my documents", label: "by meaning", prompt: "Search my documents for anything about billing or invoices and summarize it with sources." },
    { title: "Research a topic", label: "with sources, in a table", prompt: "Search the web for the current stable versions of React, Next.js and Vite and show them in a table with sources." },
  ]),
});
// images, plus text and code files read straight from disk (the attach button opens the native file dialog)
const adapters = {
  attachments: new CompositeAttachmentAdapter([new SimpleImageAttachmentAdapter(), new SimpleTextAttachmentAdapter()]),
  speech: new WebSpeechSynthesisAdapter(),
  // no dictation: Electron has no built-in speech recognition service
};
// Assistant Cloud keeps the thread list and titles; the agent keeps the messages. Conversation copies stay
// off: threads can hold client company documents. Without the URL, threads live only in the agent.
const cloudUrl = import.meta.env.VITE_ASSISTANT_BASE_URL;
const cloud = cloudUrl
  ? new AssistantCloud({ baseUrl: cloudUrl, anonymous: true, telemetry: { messages: false } })
  : undefined;
const threadComponents = { ToolFallback: GenericTool, ToolGroup: HarnessToolGroup };

export function MyAssistant() {
  const client = useMemo(() => createClient(), []);
  const stream = useMemo(
    () =>
      createHarnessStream({
        client,
        assistantId: ASSISTANT_ID,
        getContext: () => ({ model: MODEL, client: "desktop" }),
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
    load: async (externalId) => {
      const state = await client.threads.getState<{ messages: LangChainMessage[] }>(externalId);
      return { messages: state.values.messages, interrupts: state.tasks[0]?.interrupts };
    },
    delete: async (cloudThreadId) => {
      const externalId = cloud ? (await cloud.threads.get(cloudThreadId)).external_id : cloudThreadId;
      if (externalId) await client.threads.delete(externalId);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
          <ThreadListSidebar />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-sm font-medium">Harness</h1>
              <div className="ml-auto flex items-center gap-2">
                <SettingsDialog />
              </div>
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
    </AssistantRuntimeProvider>
  );
}

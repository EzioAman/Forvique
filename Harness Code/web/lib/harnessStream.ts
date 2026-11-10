import type { Client } from "@langchain/langgraph-sdk";
import type { LangChainMessage, LangGraphStreamCallback } from "@assistant-ui/react-langgraph";

/* assistant-ui's createLangGraphStream, plus the run `context` the Harness agent reads
   (the model the user picked and which client is asking). Read fresh on every run. */
export type HarnessContext = {
  model: string;
  client: "web" | "desktop";
  /** Reasoning effort for OpenRouter models; omitted for the model default. */
  effort?: string;
  /** UI tools the app renders (generative UI), as JSON-schema tool definitions. */
  ui_tools?: { name: string; description?: string; parameters: unknown }[];
};

/* The LangGraph adapter sends only message content and drops the quote assistant-ui keeps in metadata,
   so the quote is written into the outgoing user message as a Markdown blockquote. */
export const withQuote = (messages: LangChainMessage[], quote: string | undefined) => {
  const last = messages.at(-1);
  if (!quote || last?.type !== "human") return messages;
  const prefix = `${quote.replace(/^/gm, "> ")}\n\n`;
  const content =
    typeof last.content === "string"
      ? prefix + last.content
      : [{ type: "text" as const, text: prefix }, ...last.content];
  return [...messages.slice(0, -1), { ...last, content } as LangChainMessage];
};

export const createHarnessStream =
  ({
    client,
    assistantId,
    getContext,
    takeQuote,
  }: {
    client: Client;
    assistantId: string;
    getContext: () => HarnessContext;
    /** Takes the quote the user attached to the message being sent, if any. */
    takeQuote?: () => string | undefined;
  }): LangGraphStreamCallback<LangChainMessage> =>
  async (rawMessages, config) => {
    // resumes and retries carry no new user message; leave the pending quote for the next send
    const messages =
      rawMessages.at(-1)?.type === "human" ? withQuote(rawMessages, takeQuote?.()) : rawMessages;
    const { externalId } = await config.initialize();
    if (!externalId) throw new Error("Thread has not been initialized.");
    const input = config.state
      ? { ...config.state, ...(messages.length ? { messages } : {}) }
      : messages.length
        ? { messages }
        : null;
    return client.runs.stream(externalId, assistantId, {
      input,
      streamMode: ["messages", "updates", "custom"],
      signal: config.abortSignal,
      onDisconnect: "cancel",
      ...(config.command != null && { command: config.command }),
      ...(config.checkpointId != null && { checkpointId: config.checkpointId }),
      ...(config.runConfig != null && { config: config.runConfig }),
      context: getContext(),
    });
  };

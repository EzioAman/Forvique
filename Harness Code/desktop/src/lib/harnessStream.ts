import type { Client } from "@langchain/langgraph-sdk";
import type { LangChainMessage, LangGraphStreamCallback } from "@assistant-ui/react-langgraph";

/* assistant-ui's createLangGraphStream, plus the run `context` the Harness agent reads
   (the model the user picked and which client is asking). Read fresh on every run. */
export type HarnessContext = { model: string; client: "web" | "desktop" };

export const createHarnessStream =
  ({
    client,
    assistantId,
    getContext,
  }: {
    client: Client;
    assistantId: string;
    getContext: () => HarnessContext;
  }): LangGraphStreamCallback<LangChainMessage> =>
  async (messages, config) => {
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

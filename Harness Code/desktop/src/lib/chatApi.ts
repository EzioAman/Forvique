import { Client } from "@langchain/langgraph-sdk";

/* The desktop app has no server of its own, so it always needs the agent's URL:
   `langgraph dev` on :2024 in development, the deployed agent in a packaged build (set at build time). */
export const createClient = () =>
  new Client({ apiUrl: import.meta.env.VITE_LANGGRAPH_API_URL || "http://localhost:2024" });

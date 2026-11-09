import { Client } from "@langchain/langgraph-sdk";

/* Points at the Harness agent. In development that is `langgraph dev` on :2024;
   in production set NEXT_PUBLIC_LANGGRAPH_API_URL, or route /api through a proxy so no key reaches the browser. */
export const createClient = () => {
  const apiUrl =
    process.env["NEXT_PUBLIC_LANGGRAPH_API_URL"] ||
    (typeof window !== "undefined" ? new URL("/api", window.location.href).href : "/api");
  return new Client({ apiUrl });
};

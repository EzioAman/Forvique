"""Harness agent: one model, picked per run, with server tools and app-run tools.

Server tools run here. App tools (forms, option lists, and the desktop's workspace and
document tools) are only declared: when the model calls one, the graph ends the run and the
app sends the result back as a ToolMessage, which starts the next run (assistant-ui's
LangGraph addResult flow). Both clients share this graph; `client` in the run context
decides which tools the model is offered.
"""

from __future__ import annotations

import os
import time
from typing import Annotated, Any, Literal

from ddgs import DDGS
from ddgs.exceptions import DDGSException
from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, AnyMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph, add_messages
from langgraph.prebuilt import ToolNode
from langgraph.runtime import Runtime
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "openrouter:openrouter/auto"

# provider -> env var holding its key (None: no key, e.g. a local Ollama)
PROVIDERS: dict[str, str | None] = {
    "openrouter": "OPENROUTER_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "google_genai": "GOOGLE_API_KEY",
    "ollama": None,
}

SYSTEM_PROMPT = """You are Harness, a coding and research agent built by Forvique.
Pick how to present results from what the user needs:
- research or comparisons across several items: call show_table;
- a claim that needs proof: answer in prose with inline citations as markdown links to the sources;
- a trend or series of numbers: call show_chart;
- a quick fact: answer briefly, with one source link when you searched.
Use web_search for anything current or that you are unsure of. Never invent sources or results.
When you need a decision from the user, use choose_option; when you need details, use ask_user.
Never write files directly: propose changes with propose_edit, which the user approves first."""


class Context(TypedDict, total=False):
    """Per-run settings sent by the app."""

    model: str  # "provider:model", e.g. "anthropic:claude-sonnet-5-5"
    client: Literal["web", "desktop"]


class State(BaseModel):
    """Conversation state; `add_messages` appends and merges by message id."""

    messages: Annotated[list[AnyMessage], add_messages] = Field(default_factory=list)


def make_model(spec: str) -> BaseChatModel:
    """Build the chat model for "provider:model", refusing providers that are not set up."""
    provider, _, name = spec.partition(":")
    if provider not in PROVIDERS or not name:
        raise ValueError(f"Unknown model '{spec}'. Use provider:model with one of: {', '.join(PROVIDERS)}.")
    key_var = PROVIDERS[provider]
    if key_var and not os.environ.get(key_var):
        raise ValueError(f"{provider} is not configured: set {key_var} in agent/.env.")
    # without a cap some models reserve their full output window against your credits
    max_tokens = int(os.environ.get("HARNESS_MAX_TOKENS", os.environ.get("OPENROUTER_MAX_TOKENS", "4096")))
    if provider == "openrouter":
        return ChatOpenAI(model=name, base_url=OPENROUTER_BASE_URL, api_key=os.environ[key_var], max_tokens=max_tokens)
    if provider == "ollama":
        return init_chat_model(name, model_provider="ollama", num_predict=max_tokens)
    return init_chat_model(name, model_provider=provider, max_tokens=max_tokens)


# ── server tools ──────────────────────────────────────────────

@tool
def web_search(query: str) -> list[dict[str, str]]:
    """Search the web. Returns results with title, snippet and link; cite the links you use."""
    # shortcut: DuckDuckGo is keyless but rate-limited (often "No results found"); swap for Tavily when traffic grows
    for attempt in range(3):
        try:
            hits = DDGS().text(query, max_results=6)
            return [{"title": h["title"], "snippet": h["body"], "link": h["href"]} for h in hits]
        except DDGSException:
            if attempt == 2:
                raise
            time.sleep(1.5 * (attempt + 1))
    return []


class TableColumn(BaseModel):
    key: str = Field(description="Row field this column reads")
    label: str
    kind: Literal["text", "number", "currency", "percent", "date", "link"] = "text"
    currency: str | None = Field(default=None, description="ISO code, only for kind=currency")


@tool
def show_table(caption: str, columns: list[TableColumn], rows: list[dict[str, Any]]) -> str:
    """Show a sortable table in the chat, for research results or comparisons."""
    return "Table shown to the user."


@tool
def show_chart(
    label: str,
    value: str,
    points: list[float],
    delta: str | None = None,
    variant: Literal["area", "line", "bars"] = "area",
) -> str:
    """Show one numeric series as a chart: label, the headline value (formatted), the points, an optional change."""
    return "Chart shown to the user."


@tool
def open_page(url: str) -> str:
    """Open a web page in a live preview inside the chat."""
    return "Page opened for the user."


SERVER_TOOLS = [web_search, show_table, show_chart, open_page]

# ── app tools: declared here, run in the app ──────────────────


class Option(BaseModel):
    id: str
    label: str
    description: str | None = None


@tool
def choose_option(question: str, options: list[Option], multiple: bool = False) -> str:
    """Ask the user to pick one option (or several when multiple=true) and wait for the answer."""
    raise NotImplementedError("runs in the app")


class FormField(BaseModel):
    name: str
    label: str
    kind: Literal["text", "choice", "toggle"] = "text"
    options: list[str] | None = None
    required: bool = True


@tool
def ask_user(message: str, fields: list[FormField]) -> str:
    """Ask the user for missing details with a short form and wait for the answer."""
    raise NotImplementedError("runs in the app")


@tool
def read_workspace(path: str = "") -> str:
    """List a folder or read a file in the user's open workspace (paths relative to its root)."""
    raise NotImplementedError("runs in the desktop app")


@tool
def propose_edit(path: str, content: str, summary: str) -> str:
    """Propose the full new content of a workspace file; it is written only if the user approves."""
    raise NotImplementedError("runs in the desktop app")


@tool
def search_documents(query: str, k: int = 5) -> str:
    """Search the user's documents (local files and connected company sources) by meaning."""
    raise NotImplementedError("runs in the desktop app")


APP_TOOLS = {"web": [choose_option, ask_user], "desktop": [choose_option, ask_user, read_workspace, propose_edit, search_documents]}
SERVER_TOOL_NAMES = {t.name for t in SERVER_TOOLS}


async def call_model(state: State, runtime: Runtime[Context]) -> dict[str, list[AnyMessage]]:
    """Reply with the run's chosen model and the tools this client can run."""
    ctx = runtime.context or {}
    client = ctx.get("client", "web")
    model = make_model(ctx.get("model") or DEFAULT_MODEL).bind_tools(SERVER_TOOLS + APP_TOOLS.get(client, APP_TOOLS["web"]))
    reply = await model.ainvoke([SystemMessage(SYSTEM_PROMPT), *state.messages])
    return {"messages": [reply]}


async def run_server_tools(state: State) -> dict[str, list[AnyMessage]]:
    """Run only the server tool calls; app tool calls are left for the app to answer."""
    last = state.messages[-1]
    assert isinstance(last, AIMessage)
    server_calls = [c for c in last.tool_calls if c["name"] in SERVER_TOOL_NAMES]
    # a failing tool becomes an error ToolMessage the model and the Tool error card can see, not a crashed run
    result = await ToolNode(SERVER_TOOLS, handle_tool_errors=True).ainvoke({"messages": [last.model_copy(update={"tool_calls": server_calls})]})
    return {"messages": result["messages"]}


def route_after_model(state: State) -> str:
    """Server tools first; an app tool call ends the run until the app sends its result."""
    last = state.messages[-1]
    calls = last.tool_calls if isinstance(last, AIMessage) else []
    if any(c["name"] in SERVER_TOOL_NAMES for c in calls):
        return "tools"
    return END


def route_after_tools(state: State) -> str:
    """Back to the model unless an app tool call from the same turn is still unanswered."""
    answered = {getattr(m, "tool_call_id", None) for m in state.messages}
    turn = next(m for m in reversed(state.messages) if isinstance(m, AIMessage))
    return END if any(c["id"] not in answered for c in turn.tool_calls) else "call_model"


graph = (
    StateGraph(State, context_schema=Context)
    .add_node(call_model)
    .add_node("tools", run_server_tools)
    .add_edge("__start__", "call_model")
    .add_conditional_edges("call_model", route_after_model, ["tools", END])
    .add_conditional_edges("tools", route_after_tools, ["call_model", END])
    .compile(name="Harness")
)

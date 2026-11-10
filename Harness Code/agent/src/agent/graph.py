"""Harness agent: one model, picked per run, with server tools and app-run tools.

Server tools run here. App tools (forms, option lists, and the desktop's workspace and
document tools) are only declared: when the model calls one, the graph ends the run and the
app sends the result back as a ToolMessage, which starts the next run (assistant-ui's
LangGraph addResult flow). Both clients share this graph; `client` in the run context
decides which tools the model is offered.
"""

from __future__ import annotations

import ipaddress
import os
import socket
import time
from collections.abc import Callable
from html.parser import HTMLParser
from typing import Annotated, Any, Literal
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from ddgs import DDGS
from ddgs.exceptions import DDGSException
from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, AnyMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openrouter import ChatOpenRouter
from langgraph.graph import END, StateGraph, add_messages
from langgraph.prebuilt import ToolNode
from langgraph.runtime import Runtime
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

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
- a quick fact: answer briefly, with one source link when you searched;
- one headline number (a total, a count): call show_stat;
- the user wants to see pictures: call image_search;
- one link worth a closer look: call link_preview;
- the user wants to play, watch or listen to something: web_search for its YouTube video, then call open_page with
  https://www.youtube.com/embed/<video id> so it plays in the chat (watch pages refuse to be framed);
- a richer layout (cards, a map of places, a diagram, a mix of these): call present when the app offers it;
  use prompt_user instead of ask_user when the question needs that kind of layout.
Use web_search for anything current or that you are unsure of. Never invent sources or results.
After a substantive answer, call suggest_followups with 2-3 short next questions; skip it for small talk.
When you need a decision from the user, use choose_option; when you need details, use ask_user.
Never write files directly: propose changes with propose_edit, which the user approves first."""


class Context(TypedDict, total=False):
    """Per-run settings sent by the app."""

    model: str  # "provider:model", e.g. "anthropic:claude-sonnet-5-5"
    client: Literal["web", "desktop"]
    effort: Literal["minimal", "low", "medium", "high"]  # reasoning effort, OpenRouter models only
    ui_tools: list[dict[str, Any]]  # generative-UI tool schemas the app renders (present, prompt_user)


class State(BaseModel):
    """Conversation state; `add_messages` appends and merges by message id."""

    messages: Annotated[list[AnyMessage], add_messages] = Field(default_factory=list)


def make_model(spec: str, effort: str | None = None) -> BaseChatModel:
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
        # ChatOpenRouter keeps the model's reasoning; output_version v1 turns it into standard reasoning blocks the app shows
        return ChatOpenRouter(
            model=name,
            api_key=os.environ[key_var],
            max_tokens=max_tokens,
            reasoning={"effort": effort} if effort else None,
            output_version="v1",
        )
    if provider == "ollama":
        return init_chat_model(name, model_provider="ollama", num_predict=max_tokens)
    return init_chat_model(name, model_provider=provider, max_tokens=max_tokens)


# ── server tools ──────────────────────────────────────────────

def _ddgs(search: Callable[[DDGS], list[dict[str, Any]]]) -> list[dict[str, Any]]:
    # shortcut: DuckDuckGo is keyless but rate-limited (often "No results found"); swap for Tavily when traffic grows
    for attempt in range(3):
        try:
            return search(DDGS())
        except DDGSException:
            if attempt == 2:
                raise
            time.sleep(1.5 * (attempt + 1))
    return []


@tool
def web_search(query: str) -> list[dict[str, str]]:
    """Search the web. Returns results with title, snippet and link; cite the links you use."""
    hits = _ddgs(lambda d: d.text(query, max_results=6))
    return [{"title": h["title"], "snippet": h["body"], "link": h["href"]} for h in hits]


@tool
def image_search(query: str) -> list[dict[str, str]]:
    """Find images on the web; the user sees them as a gallery. Returns image src, title and the source page."""
    hits = _ddgs(lambda d: d.images(query, max_results=8))
    return [{"src": h["image"], "title": h["title"], "source": h["url"]} for h in hits]


class _PageMeta(HTMLParser):
    """Collects <title>, <meta property/name=...> and the first icon link."""

    def __init__(self) -> None:
        super().__init__()
        self.meta: dict[str, str] = {}
        self.title = ""
        self.icon = ""
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k: v or "" for k, v in attrs}
        if tag == "meta" and a.get("content"):
            self.meta.setdefault((a.get("property") or a.get("name") or "").lower(), a["content"])
        elif tag == "link" and "icon" in a.get("rel", "").lower() and not self.icon:
            self.icon = a.get("href", "")
        self._in_title = tag == "title"

    def handle_data(self, data: str) -> None:
        if self._in_title and not self.title:
            self.title = data.strip()


def _public_url(url: str) -> str:
    """Refuse non-http(s) URLs and hosts that resolve to private, loopback or link-local addresses."""
    parts = urlparse(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ValueError("Only public http(s) URLs can be previewed.")
    for info in socket.getaddrinfo(parts.hostname, None):
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            raise ValueError("Only public http(s) URLs can be previewed.")
    return url


def parse_page_meta(url: str, html: str) -> dict[str, str]:
    """Open Graph / Twitter / plain metadata of a page, with relative image and icon URLs made absolute."""
    p = _PageMeta()
    p.feed(html)
    m = p.meta
    found = {
        "href": url,
        "title": m.get("og:title") or m.get("twitter:title") or p.title,
        "description": m.get("og:description") or m.get("twitter:description") or m.get("description", ""),
        "image": urljoin(url, m["og:image"]) if m.get("og:image") else "",
        "siteName": m.get("og:site_name") or (urlparse(url).hostname or ""),
        "favicon": urljoin(url, p.icon or "/favicon.ico"),
    }
    return {k: v for k, v in found.items() if v}


@tool
def link_preview(url: str) -> dict[str, str]:
    """Show a preview card for a link: its title, description and image, read from the page."""
    # redirects are not re-checked against private addresses; acceptable while the agent runs on localhost only
    req = Request(_public_url(url), headers={"User-Agent": "Mozilla/5.0 (compatible; HarnessPreview/1.0)"})
    with urlopen(req, timeout=8) as res:
        html = res.read(512_000).decode(res.headers.get_content_charset() or "utf-8", "replace")
        return parse_page_meta(res.geturl(), html)


@tool
def show_stat(label: str, value: float) -> str:
    """Show one headline number with a label, e.g. a total or a count. value is the plain number: no units or commas."""
    return "Stat shown to the user."


@tool
def suggest_followups(suggestions: list[str]) -> str:
    """Offer 2-3 short follow-up questions, written as the user would type them. Call it once, after your answer is complete; it ends your turn."""
    return "Follow-ups shown to the user."


class TableColumn(BaseModel):
    key: str = Field(description="Row field this column reads; every row must use these exact keys")
    label: str
    kind: Literal["text", "number", "currency", "percent", "date", "link"] = Field(
        default="text", description="percent values are in percent units: 12 means 12%"
    )
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


SERVER_TOOLS = [web_search, image_search, link_preview, show_table, show_chart, show_stat, open_page, suggest_followups]
# tools that only show something: a turn of these plus suggest_followups is finished
DISPLAY_TOOL_NAMES = {"show_table", "show_chart", "show_stat", "open_page", "suggest_followups"}

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
UI_TOOL_NAMES = {"present", "prompt_user"}


def ui_tools(ctx: Context) -> list[dict[str, Any]]:
    """The app's generative-UI tools as OpenAI-style function specs; only known names, since the schema comes from the client."""
    return [
        {"type": "function", "function": {"name": t["name"], "description": str(t.get("description", "")), "parameters": t["parameters"]}}
        for t in ctx.get("ui_tools") or []
        if isinstance(t, dict) and t.get("name") in UI_TOOL_NAMES and isinstance(t.get("parameters"), dict)
    ]


async def call_model(state: State, runtime: Runtime[Context]) -> dict[str, list[AnyMessage]]:
    """Reply with the run's chosen model and the tools this client can run."""
    ctx = runtime.context or {}
    client = ctx.get("client", "web")
    model = make_model(ctx.get("model") or DEFAULT_MODEL, ctx.get("effort")).bind_tools(
        [*SERVER_TOOLS, *APP_TOOLS.get(client, APP_TOOLS["web"]), *ui_tools(ctx)]
    )
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
    if any(c["id"] not in answered for c in turn.tool_calls):
        return END
    names = {c["name"] for c in turn.tool_calls}
    # follow-ups close the answer; going back to the model would make it write more after them
    return END if "suggest_followups" in names and names <= DISPLAY_TOOL_NAMES else "call_model"


graph = (
    StateGraph(State, context_schema=Context)
    .add_node(call_model)
    .add_node("tools", run_server_tools)
    .add_edge("__start__", "call_model")
    .add_conditional_edges("call_model", route_after_model, ["tools", END])
    .add_conditional_edges("tools", route_after_tools, ["call_model", END])
    .compile(name="Harness")
)

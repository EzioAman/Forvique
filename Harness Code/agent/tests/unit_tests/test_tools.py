import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.graph import END

from agent.graph import State, _public_url, parse_page_meta, route_after_tools


def test_page_meta_prefers_open_graph_and_absolutizes() -> None:
    html = """<html><head><title>Plain</title>
    <meta property="og:title" content="OG title"><meta name="description" content="Desc">
    <meta property="og:image" content="/img.png"><link rel="shortcut icon" href="/fav.ico"></head></html>"""
    meta = parse_page_meta("https://example.com/a/b", html)
    assert meta == {
        "href": "https://example.com/a/b",
        "title": "OG title",
        "description": "Desc",
        "image": "https://example.com/img.png",
        "siteName": "example.com",
        "favicon": "https://example.com/fav.ico",
    }


def test_page_meta_falls_back_to_title_and_drops_empty() -> None:
    meta = parse_page_meta("https://x.org/", "<title> Hello </title>")
    assert meta["title"] == "Hello" and "image" not in meta and "description" not in meta


@pytest.mark.parametrize("url", ["http://127.0.0.1/", "http://localhost:2024/ok", "http://10.0.0.5/", "file:///etc/passwd", "ftp://x.org"])
def test_public_url_refuses_private_and_non_http(url: str) -> None:
    with pytest.raises(ValueError):
        _public_url(url)


def _turn(*names: str) -> State:
    calls = [{"name": n, "args": {}, "id": f"c{i}"} for i, n in enumerate(names)]
    answers = [ToolMessage("ok", tool_call_id=f"c{i}") for i in range(len(names))]
    return State(messages=[HumanMessage("q"), AIMessage("a", tool_calls=calls), *answers])


def test_followups_end_the_turn_only_with_display_tools() -> None:
    assert route_after_tools(_turn("suggest_followups")) == END
    assert route_after_tools(_turn("show_table", "suggest_followups")) == END
    # a search result still needs an answer written from it
    assert route_after_tools(_turn("web_search", "suggest_followups")) == "call_model"
    assert route_after_tools(_turn("show_table")) == "call_model"


def test_ui_tools_accepts_only_known_names_with_a_schema() -> None:
    from agent.graph import ui_tools

    ctx = {"ui_tools": [
        {"name": "present", "description": "d", "parameters": {"type": "object"}},
        {"name": "rm_rf", "parameters": {"type": "object"}},
        {"name": "prompt_user"},  # no schema
        "junk",
    ]}
    specs = ui_tools(ctx)  # type: ignore[arg-type]
    assert [s["function"]["name"] for s in specs] == ["present"]

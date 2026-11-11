import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.graph import END
from langgraph.pregel import Pregel
from pydantic import ValidationError

from agent.graph import State, graph, make_model, route_after_model, route_after_tools


def test_graph_compiles() -> None:
    assert isinstance(graph, Pregel)


def test_state_validates_messages() -> None:
    state = State(messages=[HumanMessage("hi")])
    assert state.messages[0].content == "hi"
    # langchain's message discriminator raises TypeError before pydantic wraps it
    with pytest.raises((ValidationError, TypeError)):
        State(messages=[42])  # type: ignore[list-item]


def test_make_model_rejects_unknown_and_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValueError, match="Unknown model"):
        make_model("nope:x")
    with pytest.raises(ValueError, match="Unknown model"):
        make_model("anthropic")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
        make_model("anthropic:claude-sonnet-5-5")


def call(name: str, id_: str) -> dict:
    return {"name": name, "args": {}, "id": id_, "type": "tool_call"}


def test_routing_server_then_app_tools() -> None:
    server_only = State(messages=[AIMessage("", tool_calls=[call("web_search", "a")])])
    assert route_after_model(server_only) == "tools"

    app_only = State(messages=[AIMessage("", tool_calls=[call("ask_user", "b")])])
    assert route_after_model(app_only) == END

    plain = State(messages=[AIMessage("done")])
    assert route_after_model(plain) == END

    # server call answered, app call still open: wait for the app
    mixed = State(messages=[
        AIMessage("", tool_calls=[call("web_search", "a"), call("ask_user", "b")]),
        ToolMessage("results", tool_call_id="a"),
    ])
    assert route_after_tools(mixed) == END

    # everything answered: back to the model
    done = State(messages=[
        AIMessage("", tool_calls=[call("web_search", "a")]),
        ToolMessage("results", tool_call_id="a"),
    ])
    assert route_after_tools(done) == "call_model"

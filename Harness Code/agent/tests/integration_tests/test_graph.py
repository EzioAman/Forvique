import os

import pytest
from langchain_core.messages import HumanMessage

from agent import graph

pytestmark = [
    pytest.mark.anyio,
    pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="needs OPENROUTER_API_KEY"),
]


@pytest.mark.langsmith
async def test_agent_replies() -> None:
    res = await graph.ainvoke({"messages": [HumanMessage("Say hi in one word.")]})
    assert res["messages"][-1].content

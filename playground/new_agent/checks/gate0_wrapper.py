"""Phase 0 gate — can LangGraph's prebuilt agent drive melong?

The question is not whether melong is smart, it is whether the bind_tools /
tool_calls bridge in tibet_watch/melong.py is convincing enough that the stock
graph cannot tell the difference. Two dummy tools that must be called in
sequence prove the loop closes: search -> observation -> second call -> answer.

Usage:
    conda activate monlam
    python checks/gate0_wrapper.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from langchain.agents import create_agent  # noqa: E402
from langchain_core.tools import tool  # noqa: E402

from tibet_watch.melong import ChatMelong  # noqa: E402

CAPITALS = {"tibet": "Lhasa", "france": "Paris", "nepal": "Kathmandu"}
POPULATIONS = {"lhasa": "869,000", "paris": "2,102,000", "kathmandu": "845,000"}


@tool
def find_capital(country: str) -> str:
    """Return the capital city of a country."""
    return CAPITALS.get(country.lower().strip(), "unknown")


@tool
def population_of(city: str) -> str:
    """Return the population of a city."""
    return POPULATIONS.get(city.lower().strip(), "unknown")


PROMPT = (
    "You are a careful research assistant. Use one tool at a time to answer the "
    "question. You cannot know the answer without the tools, so always call them."
)


def main():
    model = ChatMelong(temperature=0.0, max_tokens=256)
    agent = create_agent(model=model, tools=[find_capital, population_of], system_prompt=PROMPT)

    question = "What is the population of the capital of Tibet?"
    print(f"Q: {question}\n")

    tool_calls = 0
    final = ""
    for update in agent.stream(
        {"messages": [{"role": "user", "content": question}]},
        {"recursion_limit": 12},
        stream_mode="updates",
    ):
        for node, payload in update.items():
            for message in payload.get("messages", []):
                if getattr(message, "tool_calls", None):
                    for call in message.tool_calls:
                        tool_calls += 1
                        print(f"  [action]      {call['name']}({call['args']})")
                elif node == "tools":
                    print(f"  [observation] {message.content}")
                elif message.content:
                    final = message.content
                    print(f"  [final]       {message.content[:300]}")

    print()
    spend = model.spend()
    print(f"tool calls: {tool_calls}   llm calls: {spend['calls']}   cost: {spend['cost']:.5f}")

    passed = tool_calls >= 2 and "869" in final
    print("\nGATE 0:", "PASS" if passed else "FAIL — expected >=2 tool calls and 869,000 in the answer")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

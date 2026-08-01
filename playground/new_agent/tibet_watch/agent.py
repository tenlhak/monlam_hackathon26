"""The agent: a standard LangChain ReAct loop driving a model with no tools API.

Nothing in here is unusual, which is the point. All the accommodation for
melong's limitations lives in ChatMelong; by the time we reach this module the
model looks like any other tool-calling chat model, so the agent is assembled
the ordinary way.
"""

import os
from typing import Dict, Iterator, List, Optional

from langchain.agents import create_agent

from .melong import ChatMelong
from .sources.registry import RELEVANCE_RUBRIC
from .store import DocStore
from .tools import Session, build_tools
from .tracing import configure as configure_tracing

# Every summarised article is appended here, so repeated queries accumulate an
# archive rather than being thrown away.
ARCHIVE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            "data", "archive.jsonl")

SYSTEM_PROMPT = f"""You are Tibet Watch, a research agent that finds and summarises
reporting about the Tibetan cause.

{RELEVANCE_RUBRIC}

How to work:
1. Call search_tibet_news with a short keyword phrase drawn from the user's
   question. Use keywords, not a full question.
2. Pick the THREE most relevant and most recent articles from the results.
3. For each one, call summarize_article with its id. It downloads the article
   if needed, so you rarely need fetch_article separately.
4. When three articles are summarised, stop and give your final answer.

Your final answer should be a short overview in English: what the reporting
says, and which sources it came from. The full summaries and URLs are already
saved for the user, so do not repeat them.

Important:
- One tool call at a time. Wait for the result before deciding the next step.
- Do not summarise the same id twice.
- If a search returns nothing useful, try ONE different phrasing, then work
  with what you have.
- Never invent an article, a URL or a fact. Everything comes from the tools."""

# One search, three fetch-and-summarise pairs, plus the final answer, with room
# for a retry or a reformulation. Beyond this the agent is looping, not working.
RECURSION_LIMIT = 40


def build(model: Optional[ChatMelong] = None, use_gdelt: bool = True,
          archive: Optional[str] = ARCHIVE_PATH):
    """Return (agent, session). The session holds the results."""
    model = model or ChatMelong(temperature=0.0, max_tokens=1200)
    session = Session(model, store=DocStore(path=archive), use_gdelt=use_gdelt)
    agent = create_agent(
        model=model,
        tools=build_tools(session),
        system_prompt=SYSTEM_PROMPT,
    )
    return agent, session


def stream(question: str, model: Optional[ChatMelong] = None,
           use_gdelt: bool = True) -> Iterator[Dict]:
    """Run a question, yielding events as the agent works.

    Events are {"type": action|observation|final, ...} — shaped for a UI rather
    than for logging, since watching the loop reason is most of the demo.
    """
    # Reads LANGSMITH_* from .env. A no-op when tracing is off.
    configure_tracing()

    agent, session = build(model, use_gdelt=use_gdelt)
    yield {"type": "start", "question": question, "session": session}

    # run_name and metadata are what make a trace findable later: LangSmith
    # lists runs by name, and filtering on metadata.question beats scrolling.
    for update in agent.stream(
        {"messages": [{"role": "user", "content": question}]},
        {
            "recursion_limit": RECURSION_LIMIT,
            "run_name": "tibet_watch",
            "tags": ["tibet-watch", "agent"],
            "metadata": {"question": question, "use_gdelt": use_gdelt},
        },
        stream_mode="updates",
    ):
        for node, payload in (update or {}).items():
            for message in (payload or {}).get("messages", []) or []:
                if getattr(message, "tool_calls", None):
                    for call in message.tool_calls:
                        yield {"type": "action", "tool": call["name"],
                               "input": next(iter((call.get("args") or {}).values()), "")}
                elif node == "tools":
                    yield {"type": "observation", "tool": getattr(message, "name", ""),
                           "content": message.content}
                elif getattr(message, "content", ""):
                    yield {"type": "final", "content": message.content}

    session.store.flush()
    yield {"type": "done", "session": session,
           "results": [d.public() for d in session.results()],
           "spend": session.model.spend()}


def run(question: str, model: Optional[ChatMelong] = None,
        use_gdelt: bool = True) -> Dict:
    """Run a question to completion and return the structured result."""
    narrative: List[str] = []
    steps = 0
    final: Dict = {}

    for event in stream(question, model=model, use_gdelt=use_gdelt):
        if event["type"] == "action":
            steps += 1
        elif event["type"] == "final":
            narrative.append(event["content"])
        elif event["type"] == "done":
            final = event

    return {
        "question": question,
        "overview": "\n\n".join(narrative).strip(),
        "articles": final.get("results", []),
        "tool_calls": steps,
        "spend": final.get("spend", {}),
    }

"""The research graph: GPT-4.1 gathers verified facts, then melong teaches.

    research ──has tool calls──> lookup ──> research
        │                                      │
        └──────── no more calls ───────────────┘
                          ↓
                       (facts)

LangGraph rather than an agent executor because the interesting part is the
boundary: research ends when the orchestrator stops calling tools or hits the
step cap, and only then does melong write. Keeping generation outside the loop
means the model that writes Tibetan never decides what Tibetan is true.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, TypedDict

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from . import config
from .tools import TOOLS
from .tracing import traced

RESEARCH_SYSTEM = """You are the research step of a Tibetan tutoring system. You do
not talk to the learner. Your only job is to gather verified facts with tools, so
that the tutor can answer without guessing.

FIRST decide whether this turn needs any lookup at all. Most do not.

Look something up ONLY when the learner wants a word or phrase IN Tibetan —
"how do you say X", "what is the word for X", "what does <Tibetan> mean" — or is
clearly assembling a phrase.

Call NO tools for questions ABOUT the language: grammar, sentence structure, the
script, pronunciation patterns, culture, history, study advice, encouragement, or
anything referring back to what was already taught. Returning no facts is a
correct and common outcome; the tutor answers those from its own knowledge.

Never look up words that merely appear in such a question. Asked "what are some
grammar rules unique to Tibetan", the learner wants an explanation of grammar —
NOT the Tibetan words for "grammar" and "unique". Looking those up produces a
vocabulary lesson nobody asked for.

Routing, when a lookup IS needed, because the sources have different blind spots:

- Greetings, set phrases and everyday colloquial words -> phrasebook_lookup FIRST.
  The dictionary has no entry at all for "hello" or "how are you", and returns
  literary forms for words like good, beautiful and mother.
- Ordinary vocabulary (nouns, verbs, adjectives) -> dictionary_lookup. This is
  authoritative; prefer it to your own knowledge for any word.
- Tibetan the learner wrote and wants translated -> dictionary_lookup with
  direction="bo-en".
- Only if both come back empty -> goldstein_lookup, whose output is unreliable.

When a lookup is warranted, look up every word the answer will need, including
ones you are confident about — your confidence is not a source.

When you have what is needed, reply with the single word DONE."""


class State(TypedDict):
    user_message: str
    messages: List
    facts: List[Dict]
    steps: int


def _llm(model: Optional[str] = None):
    return ChatOpenAI(
        model=model or config.ORCHESTRATOR_MODEL,
        api_key=config.openai_key(),
        temperature=0,
        timeout=45,
    ).bind_tools(TOOLS)


def _research(state: State) -> Dict:
    reply = _llm().invoke(state["messages"])
    return {"messages": state["messages"] + [reply], "steps": state["steps"] + 1}


def _lookup(state: State) -> Dict:
    last = state["messages"][-1]
    messages = list(state["messages"])
    facts = list(state["facts"])
    by_name = {t.name: t for t in TOOLS}

    for call in getattr(last, "tool_calls", []) or []:
        tool = by_name.get(call["name"])
        if tool is None:
            result = f"No such tool: {call['name']}"
        else:
            try:
                result = tool.invoke(call["args"])
            except Exception as exc:  # a broken tool must not kill the turn
                result = f"TOOL ERROR: {exc}"

        query = call["args"].get("query", "")
        # Only successful lookups become facts; misses stay in the transcript
        # so the orchestrator can react, but are never handed to the tutor.
        if "NOT FOUND" not in result and "UNAVAILABLE" not in result:
            facts.append({"tool": call["name"], "query": query, "result": result})

        messages.append(ToolMessage(content=result, tool_call_id=call["id"]))

    return {"messages": messages, "facts": facts}


def _next(state: State) -> str:
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None) and state["steps"] < config.MAX_RESEARCH_STEPS:
        return "lookup"
    return END


def _build():
    g = StateGraph(State)
    g.add_node("research", _research)
    g.add_node("lookup", _lookup)
    g.set_entry_point("research")
    g.add_conditional_edges("research", _next, {"lookup": "lookup", END: END})
    g.add_edge("lookup", "research")
    return g.compile()


GRAPH = _build()


# Only these phrasings actually ask for a word. A whitelist is used rather than
# a blacklist of "meta" topics because the failure is one-sided: the orchestrator
# looks words up too eagerly, not too rarely. Asked for grammar rules it looked
# up "grammar" and "unique"; asked "what did you just teach me" it ran a bo-en
# lookup that returned "Dpa'-ris" and overwrote a correct pronunciation.
WANTS_VOCABULARY = re.compile(
    r"""(
        how\s+(do|would|can)\s+(you|i|we)\s+say
      | how\s+to\s+say
      | what('s|\s+is|\s+are)?\s+the\s+(tibetan\s+)?(word|phrase|term)s?\s+for
      | tibetan\s+(word|phrase|term)s?\s+for
      | what\s+does\s+.+\s+mean
      | translate
      | word\s+for\s+\w+
      | teach\s+me\s+(the\s+)?(word|phrase)
    )""",
    re.IGNORECASE | re.VERBOSE,
)

TIBETAN_CHARS = re.compile(r"[ༀ-࿿]")


def needs_lookup(message: str) -> bool:
    """Whether this turn is asking for a specific word, rather than about the language.

    Grammar, script, culture and follow-up questions need no lookup, and running
    one actively harms the answer.

    Tibetan in the message is a veto, not a trigger. The dictionary is a word
    dictionary: `ཆུ།` and `སེམས།` come back correctly, but `བཀྲ་ཤིས་བདེ་ལེགས།`
    returns "Dpa'-ris.", a place name, which once overwrote a correct
    pronunciation with nonsense. Melong is distrusted for *recall* — inventing
    Tibetan it was never given — but reading Tibetan the learner has already
    typed is a different task, and one it does well. So a message containing
    Tibetan goes straight to melong.
    """
    if TIBETAN_CHARS.search(message or ""):
        return False
    return bool(WANTS_VOCABULARY.search(message or ""))


@traced("research", run_type="chain")
def gather_facts(user_message: str, history: List[Dict]) -> List[Dict]:
    """Run the research loop and return the verified facts it found."""
    if not needs_lookup(user_message):
        return []

    recent = [m for m in history if m.get("role") in ("user", "assistant")][-6:]
    context = "\n".join(f"{m['role']}: {m['content'][:200]}" for m in recent)

    messages = [
        SystemMessage(content=RESEARCH_SYSTEM),
        HumanMessage(content=(f"Recent conversation:\n{context}\n\n"
                              f"The learner just asked: {user_message}")),
    ]

    try:
        # Tags are set on the graph rather than inherited from the enclosing
        # traced span: LangChain runs do not pick up a @traceable parent's tags,
        # so the orchestrator's own calls would otherwise be untagged in a
        # project shared with the news agent.
        final = GRAPH.invoke(
            {"user_message": user_message, "messages": messages, "facts": [], "steps": 0},
            {"tags": config.LANGSMITH_TAGS, "run_name": "research_graph"},
        )
        return final["facts"]
    except Exception:
        # Research is an enhancement; if it fails the tutor still answers,
        # just without verified vocabulary.
        return []

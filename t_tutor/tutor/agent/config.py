"""Knobs for the agent, in one place."""

import os

from dotenv import load_dotenv

load_dotenv()

# GPT-4.1 orchestrates. Two measured reasons it is not Kimi: every Moonshot
# model rejects Tibetan script input with a `content_filter` 400, and the
# reasoning models take ~10s per turn against GPT-4.1's ~1s. GPT-4.1 read
# Tibetan input fine and answered 3/3 Tibetan factual questions correctly.
ORCHESTRATOR_MODEL = os.environ.get("TUTOR_ORCHESTRATOR_MODEL", "gpt-4.1-mini")

# Routing is easy work, so the mini model is the default; the full model is
# available for harder turns.
ORCHESTRATOR_FALLBACK_MODEL = "gpt-4.1"

# How many research rounds the orchestrator may take before it must answer.
# Each round is one model call plus its tool calls.
MAX_RESEARCH_STEPS = 3

# Conversation turns sent to the models. Chat is billed per token.
HISTORY_LIMIT = 12

# Melong writes the final reply. It recalls Tibetan badly — four different
# wrong answers to "how do you say hello" across testing — but teaches well
# from supplied facts, adding cultural framing GPT-4.1 did not.
GENERATOR_TEMPERATURE = 0.5
GENERATOR_MAX_TOKENS = 500

LANGSMITH_PROJECT = os.environ.get("TUTOR_LANGSMITH_PROJECT", "t-tutor")


def openai_key() -> str:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise RuntimeError("OPENAI_API_KEY is not set in the repo-root .env")
    return key

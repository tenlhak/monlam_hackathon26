"""ChatMelong — a LangChain chat model over the Monlam AI `melong` endpoint.

Monlam's chat API is not OpenAI-compatible (`X-API-Key` rather than a bearer
token, `model_name` rather than `model`, the completion in a `response` field)
and it supports neither tool calling nor guided decoding. Rather than give up
on the framework, this class implements the two interfaces LangGraph actually
depends on:

  * bind_tools()  — renders the tool schemas into the system prompt
  * tool_calls    — parses the reply back into AIMessage.tool_calls

Everything downstream (create_react_agent, ToolNode, streaming, checkpointing)
then works unmodified, because the graph only ever checks those fields.

The format retry loop lives here on purpose. Compliance was 5/5 in the probe,
but that was a short prompt at temperature 0 with no accumulated transcript;
mid-loop it will drift, and keeping recovery inside the model wrapper leaves
the agent layer stock.
"""

import json
import os
import time
import uuid
from typing import Any, Dict, Iterator, List, Optional, Sequence

import requests
from dotenv import load_dotenv
from langchain_core.callbacks import CallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from langchain_core.tools import BaseTool
from langchain_core.utils.function_calling import convert_to_openai_tool
from pydantic import ConfigDict, Field

from .parsing import (
    format_error,
    parse_action,
    render_tool_contract,
    truncate_at,
)
from .tracing import redact_http_output, redact_llm_inputs, traceable

BASE_URL = "https://api-v1.monlamai.studio"


class MonlamError(RuntimeError):
    pass


def _resolve_api_key() -> str:
    """Read MONLAMAI_STUDIO, falling back to the repo-root .env."""
    load_dotenv()
    if not os.environ.get("MONLAMAI_STUDIO"):
        # tibet_watch/ -> new_agent/ -> playground/ -> repo root
        root_env = os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env")
        load_dotenv(os.path.abspath(root_env))

    key = (os.environ.get("MONLAMAI_STUDIO") or "").strip()
    if not key:
        raise MonlamError(
            "MONLAMAI_STUDIO is not set. Add your Monlam API key to the .env file at the repo root."
        )
    return key


class ChatMelong(BaseChatModel):
    """Chat model backed by Monlam AI's `melong`."""

    # `model_name` collides with pydantic's protected "model_" namespace.
    model_config = ConfigDict(protected_namespaces=())

    model_name: str = "melong"
    temperature: float = 0.0
    max_tokens: int = 1024
    base_url: str = BASE_URL
    timeout: int = 180
    max_format_retries: int = 2
    api_key: Optional[str] = Field(default=None, exclude=True, repr=False)

    # Running total across the process, so a demo can show what a query cost.
    _spend: Dict[str, float] = {"cost": 0.0, "input_tokens": 0, "output_tokens": 0, "calls": 0}

    @property
    def _llm_type(self) -> str:
        return "monlam-melong"

    @property
    def _identifying_params(self) -> Dict[str, Any]:
        return {"model_name": self.model_name, "temperature": self.temperature}

    # ------------------------------------------------------------------
    # Tool binding — the bridge that makes the prebuilt agent work
    # ------------------------------------------------------------------

    def bind_tools(
        self,
        tools: Sequence[Dict[str, Any] | type | callable | BaseTool],
        **kwargs: Any,
    ) -> Any:
        """Attach tools by prompt injection rather than a provider tools API."""
        formatted = [convert_to_openai_tool(t) for t in tools]
        # tool_choice and friends are meaningless here; drop them so they never
        # reach the request body.
        kwargs.pop("tool_choice", None)
        kwargs.pop("parallel_tool_calls", None)
        return self.bind(tools=formatted, **kwargs)

    # ------------------------------------------------------------------
    # Message translation
    # ------------------------------------------------------------------

    def _to_api_messages(
        self, messages: List[BaseMessage], tools: Optional[List[Dict[str, Any]]]
    ) -> List[Dict[str, str]]:
        """Flatten LangChain messages into melong's system/user/assistant roles.

        The API accepts only those three roles, so a ToolMessage has to be
        replayed as a user turn. Rendering it as `Observation:` keeps the
        transcript in the shape the model was told to expect.
        """
        system_parts: List[str] = []
        if tools:
            system_parts.append(render_tool_contract(tools))

        out: List[Dict[str, str]] = []
        for m in messages:
            if isinstance(m, SystemMessage):
                system_parts.append(_text_of(m))
            elif isinstance(m, HumanMessage):
                out.append({"role": "user", "content": _text_of(m)})
            elif isinstance(m, ToolMessage):
                out.append({"role": "user", "content": f"Observation: {_text_of(m)}"})
            elif isinstance(m, AIMessage):
                if m.tool_calls:
                    # Replay the model's own action so the history stays coherent.
                    call = m.tool_calls[0]
                    args = call.get("args") or {}
                    payload = next(iter(args.values()), "")
                    content = json.dumps(
                        {"action": call.get("name"), "action_input": payload},
                        ensure_ascii=False,
                    )
                else:
                    content = _text_of(m)
                out.append({"role": "assistant", "content": content})
            else:
                out.append({"role": "user", "content": _text_of(m)})

        if system_parts:
            out.insert(0, {"role": "system", "content": "\n\n".join(system_parts)})
        return out

    # ------------------------------------------------------------------
    # HTTP
    # ------------------------------------------------------------------

    # One span per HTTP call, so a step that needed three attempts to produce
    # parseable JSON is distinguishable from one that worked immediately.
    # process_inputs strips `self`, which carries the API key.
    @traceable(
        run_type="llm",
        name="melong.http",
        process_inputs=redact_llm_inputs,
        process_outputs=redact_http_output,
    )
    def _call_api(self, api_messages: List[Dict[str, str]], max_tokens: int) -> tuple:
        body = {
            "messages": api_messages,
            "model_name": self.model_name,
            "temperature": self.temperature,
            "max_tokens": max_tokens,
        }
        resp = requests.post(
            f"{self.base_url}/api/v1/ai/chat",
            headers={"X-API-Key": self.api_key or _resolve_api_key()},
            json=body,
            timeout=self.timeout,
        )
        if resp.status_code != 200:
            raise MonlamError(f"Monlam API returned HTTP {resp.status_code}: {resp.text[:300]}")

        data = resp.json()
        meta = {
            "input_tokens": data.get("prompt_tokens") or 0,
            "output_tokens": data.get("completion_tokens") or 0,
            "total_tokens": data.get("total_tokens") or 0,
            "cost": data.get("cost") or 0.0,
            "latency_ms": data.get("latency_ms"),
        }
        self._spend["cost"] += meta["cost"]
        self._spend["input_tokens"] += meta["input_tokens"]
        self._spend["output_tokens"] += meta["output_tokens"]
        self._spend["calls"] += 1
        return (data.get("response") or ""), meta

    # ------------------------------------------------------------------
    # Generation
    # ------------------------------------------------------------------

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        tools = kwargs.get("tools")
        max_tokens = kwargs.get("max_tokens", self.max_tokens)
        api_messages = self._to_api_messages(messages, tools)

        if not tools:
            text, meta = self._call_api(api_messages, max_tokens)
            return _result(AIMessage(content=truncate_at(text, stop)), meta)

        # Prompted structure has no guarantee, so validate and re-ask.
        transcript = list(api_messages)
        last_text = ""
        for attempt in range(self.max_format_retries + 1):
            text, meta = self._call_api(transcript, max_tokens)
            last_text = truncate_at(text, stop)
            action = parse_action(last_text, tools)

            if action and action["kind"] == "tool":
                message = AIMessage(
                    content="",
                    tool_calls=[{
                        "name": action["name"],
                        "args": action["args"],
                        "id": f"call_{uuid.uuid4().hex[:12]}",
                        "type": "tool_call",
                    }],
                )
                return _result(message, meta, attempts=attempt + 1)

            if action and action["kind"] == "final":
                # No tool_calls -> the agent loop terminates here.
                return _result(AIMessage(content=action["text"]), meta, attempts=attempt + 1)

            # Visible in the trace as a second melong.http span under the same
            # step, which is the signal that format compliance is degrading.
            transcript = transcript + [
                {"role": "assistant", "content": last_text},
                {"role": "user", "content": format_error(last_text, tools)},
            ]

        # Out of retries: hand back the prose as a final answer rather than
        # crashing the graph. Better a weak answer than a dead demo.
        return _result(AIMessage(content=last_text), meta, attempts=self.max_format_retries + 1)

    def _stream(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> Iterator[ChatGenerationChunk]:
        """Token streaming for plain chat (summaries, translations).

        Tool selection deliberately does not stream: we cannot know whether the
        JSON is valid until it is complete.
        """
        api_messages = self._to_api_messages(messages, kwargs.get("tools"))
        resp = requests.post(
            f"{self.base_url}/api/v1/ai/chat/stream",
            headers={"X-API-Key": self.api_key or _resolve_api_key()},
            json={
                "messages": api_messages,
                "model_name": self.model_name,
                "temperature": self.temperature,
                "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            },
            stream=True,
            timeout=self.timeout,
        )
        if resp.status_code != 200:
            raise MonlamError(f"Monlam API returned HTTP {resp.status_code}: {resp.text[:300]}")

        for line in resp.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data:"):
                continue
            payload = line[len("data:"):].strip()
            if not payload or payload == "[DONE]":
                continue
            try:
                event = json.loads(payload)
            except json.JSONDecodeError:
                continue
            if event.get("type") == "usage":
                continue  # billing metadata, no content

            choices = event.get("choices") or []
            if not choices:
                continue
            content = (choices[0].get("delta") or {}).get("content")
            if content:
                chunk = ChatGenerationChunk(message=AIMessageChunk(content=content))
                if run_manager:
                    run_manager.on_llm_new_token(content, chunk=chunk)
                yield chunk

    # ------------------------------------------------------------------

    def spend(self) -> Dict[str, float]:
        """Cumulative usage for this process, for display in the demo."""
        return dict(self._spend)


def _text_of(message: BaseMessage) -> str:
    """Content as a plain string; LangChain allows a list of content blocks."""
    content = message.content
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in content
        ]
        return "".join(parts)
    return str(content)


def _result(message: AIMessage, meta: Dict[str, Any], attempts: int = 1) -> ChatResult:
    message.usage_metadata = {
        "input_tokens": meta["input_tokens"],
        "output_tokens": meta["output_tokens"],
        "total_tokens": meta["total_tokens"],
    }
    message.response_metadata = {
        "model_name": "melong",
        "cost": meta["cost"],
        "latency_ms": meta.get("latency_ms"),
        "format_attempts": attempts,
    }
    return ChatResult(generations=[ChatGeneration(message=message)])

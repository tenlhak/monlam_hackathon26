# Tibet Watch

An on-demand research agent that finds reporting about the Tibetan cause,
collects the URLs, and summarises each article **in both Tibetan and English** —
built on Monlam AI's `melong` model with LangChain's standard ReAct agent.

```
conda activate monlam
pip install -r requirements.txt
python -m uvicorn app:app --reload --port 8090   # then open http://127.0.0.1:8090
```

Needs `MONLAMAI_STUDIO=<api-key>` in the `.env` at the repo root.

## The interesting problem

`melong` supports **neither tool calling nor guided decoding**. Both were probed
rather than assumed — see `../probe_melong_agent.py`:

| Capability | Result |
|---|---|
| `response_format` / `guided_json` | silently ignored (HTTP 200, prose back) |
| `tools` array | silently ignored, no tool-call field in the response |
| Context window | ≥32k, verified by needle recall at 28.5k tokens |
| Flat JSON action format | 5/5 clean on first attempt |
| `stop` sequences | ignored — must be applied client-side |

So the modern agent constructors, which all call `.bind_tools()` and route on
`AIMessage.tool_calls`, cannot drive it out of the box.

The fix is one adapter rather than a bespoke agent loop. `ChatMelong`
(`tibet_watch/melong.py`) implements the two interfaces the graph actually
depends on:

- **`bind_tools()`** renders the tool schemas into the system prompt
- the reply is parsed back into **`AIMessage.tool_calls`**

Everything downstream — `create_agent`, `ToolNode`, streaming, checkpointing —
then works unmodified, because the graph only ever checks those fields.

Two consequences worth knowing:

- **Format recovery lives in the model wrapper, not the agent.** Prompted
  structure has no guarantee, so `_generate` validates, repairs and re-asks up
  to twice before giving up. Keeping that inside `ChatMelong` leaves the agent
  layer completely stock.
- **Every tool takes exactly one string.** A call is a flat
  `{"action", "action_input"}` object, and one argument maps onto it cleanly.
  Nested arguments are where small models break.

## Layout

```
tibet_watch/
  melong.py      ChatMelong — the bind_tools / tool_calls bridge
  parsing.py     JSON repair, script detection, bilingual tokenisation
  sources/
    registry.py  curated feeds + the "Tibetan cause" rubric
    rss.py       WordPress search-as-RSS across 8 outlets
    gdelt.py     GDELT 2.0, keyless, best-effort
  extract.py     trafilatura + encoding guards
  relevance.py   free prefilter -> batched model judge -> query ranking
  summarize.py   summarise in source language, then translate
  store.py       doc store, URL canonicalisation, dedupe
  tools.py       the three tools + session state
  agent.py       create_agent assembly
app.py           FastAPI + SSE
checks/          gate scripts, one per build phase
```

## Design notes

**Search is keyless.** Most of the curated outlets run WordPress, which exposes
its search as RSS at `/?s=<query>&feed=rss2`. That turns the feed layer from
"the latest ten items" into a searchable archive per outlet, which is what makes
a no-API-key search backend viable. GDELT adds international recall.

**Two different notions of relevance.** `relevance_score` answers *is this about
the Tibetan cause* — and every curated source scores 1.0 on it, so it cannot
rank anything. `query_score` answers *does this address the question that was
asked*. Ranking on the first alone returned three articles about Tibet that had
nothing to do with the query.

**Summarise first, translate second.** An article is summarised in its *own*
language, then that summary is translated. The other order stacks translation
loss on top of compression loss, and translating 200 words is a far easier task
than translating 4,000.

**Tools return handles, not payloads.** The 32k context means a whole article
would fit in the transcript, but every later turn re-sends the scratchpad, so
inlining one would multiply the cost of a six-step loop. Full text and summaries
live in the store; the tools return an id and a confirmation.

**GDELT does not index Tibetan.** `sourcelang:tibetan` returns zero articles, so
the Tibetan side of the corpus comes entirely from Tibet Times and RFA Tibetan.
It also rate-limits below its documented 5s, and ANDs bare query terms — a
six-word query matches nothing, so queries are trimmed to three.

## Debugging with LangSmith

Add to the repo-root `.env` and restart:

```
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_pt_...      # smith.langchain.com -> Settings -> API Keys
LANGSMITH_PROJECT=tibet-watch
```

`python checks/trace_check.py` reports whether tracing is actually on and prints
the expected trace tree. The server prints the same status line at startup —
silently-not-tracing is the classic way to lose an afternoon.

The trace tree for one question:

```
tibet_watch                          agent run; metadata.question is searchable
 +- ChatMelong                       step 1: which tool to call
 |   +- melong.http                    ONE SPAN PER ATTEMPT
 +- search_tibet_news                (tool)
 |   +- translate_query.to_bo
 |   +- rss.search                   hits + by_source breakdown
 |   +- gdelt.search
 |   +- screen                       candidates -> kept
 |       +- relevance_judge[n]       only fires on non-curated domains
 +- summarize_article                (tool)
     +- fetch_article                chars, words, error
     +- summarise_bilingual
         +- summarise.en
         +- translate.to_bo
```

Two details worth knowing:

- **`melong.http` is one span per HTTP call**, so the format-retry loop inside
  `ChatMelong._generate` is visible. Without it a step that needed three
  attempts to produce parseable JSON looks identical to one that worked
  immediately — and that is exactly the failure mode this model has.
- **The Monlam API key is never traced.** `_call_api` is decorated with a
  `process_inputs` that drops `self` (which carries the key) and records only
  message shape.

One gotcha this wiring works around: `langsmith.utils.get_env_var` is
`lru_cache`d, so it reads each variable once. Because `configure()` loads `.env`
at call time — after langsmith is imported — settings would otherwise be ignored
and tracing would silently stay off. `configure()` clears that cache.

## Checks

Each gate is independently runnable, and phases 1–2 are a working pipeline
*without* the agent — so a flaky ReAct loop can't take the whole demo down.

```
python checks/gate0_wrapper.py    # the bind_tools bridge closes a 2-step loop
python checks/gate1_sources.py    # feed health + deduped candidates (run before demos)
python checks/gate2_pipeline.py   # prefilter, model judge, bilingual summaries
python checks/gate3_agent.py      # full agent, on-topic, both languages
python checks/gate3_agent.py "Dalai Lama succession"
python checks/trace_check.py      # LangSmith wiring + expected trace tree
```

`gate1` doubles as the pre-demo health check — feed URLs rot, and it is better
to find that here than mid-presentation.

## Known limits

- **Cost** is roughly 0.10–0.17 per question (14 model calls, ~20k tokens).
  `melong` bills a flat ~2.5 units per 1M tokens; the unit is not labelled in
  the API response.
- **Extraction fails on some sites** (paywalls, JS-rendered pages). The agent
  recovers by moving to the next article, so a run may summarise the 4th-ranked
  result instead of the 3rd.
- **The agent's freedom is narrow** — with three tools and a fixed
  search → summarise order it is not making many real decisions. Letting it
  reformulate when results are thin, or follow links out of an article, is the
  obvious next step.
- **No evaluation set yet.** The judge scores 5/5 on five hand-labelled cases in
  `gate2`; a proper 25-URL gold set would turn that into a precision number.

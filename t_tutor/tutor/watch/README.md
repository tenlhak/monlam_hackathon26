# Tibet Watch

A **bilingual weekly newsletter on the Tibetan cause**, built on Monlam AI's
`melong`. A crawler watches eight Tibetan outlets plus global news; a composer
groups a week's coverage into stories and writes each one **in both Tibetan and
English**.

Part of T-Tutor. Run everything from the `t_tutor/` directory:

```
conda activate monlam
pip install -r requirements.txt

python crawl.py --once        # fill the corpus  (every ~4h in production)
python compose.py             # build this week's draft issue
python -m uvicorn app:app --reload --port 8080   # served at /api/watch/*
```

Needs `MONLAMAI_STUDIO=<api-key>` in the `.env` at the repo root.

## Two modes

**The newsletter** is the product. `crawl.py` and `compose.py` run on a
schedule, and the web front end reads finished issues straight out of SQLite —
no model calls, so browsing is instant and a rate-limited `melong` can never
make the newsletter look broken.

**Ask the archive** is the second tab: the on-demand ReAct agent, kept because
readers wanting depth on one story is a real need and it already works. It is
the only part of the front end that calls the model live.

They share everything below the surface — the same corpus, extraction,
relevance rules, bilingual summarisation and `ChatMelong` adapter.

## The interesting problem

`melong` supports **neither tool calling nor guided decoding**. Both were probed
rather than assumed — see `../../../playground/probe_melong_agent.py`:

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
(`tutor/watch/melong.py`) implements the two interfaces the graph actually
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
crawl.py         CLI: poll sources, screen, extract      (scheduled)
compose.py       CLI: cluster, score, write an issue     (weekly)

tutor/watch/
  melong.py      ChatMelong — the bind_tools / tool_calls bridge
  db.py          SQLite: articles, feeds, issues, crawl_runs
  crawler.py     polling, gap detection, ingest, screening, extraction
  compose.py     clustering, salience, sections, bilingual writing
  parsing.py     JSON repair, script detection, bilingual tokenisation
  sources/
    registry.py  curated feeds, standing queries, domain policy, rubric
    rss.py       recency polling + WordPress search-as-RSS
    gdelt.py     GDELT 2.0, keyless, best-effort
  extract.py     trafilatura + encoding guards
  relevance.py   free prefilter -> batched model judge -> query ranking
  summarize.py   summarise in source language, then translate
  store.py       URL canonicalisation, dedupe, in-memory doc store
  tools.py       the agent's three tools + session state
  agent.py       create_agent assembly
  tracing.py     LangSmith wiring, key redaction, thread propagation
checks/          gate scripts, one per build phase
```

Where the model spend goes: `crawl.py` makes **zero** calls with `--no-gdelt`
and one at most otherwise; `compose.py` made **33** for an eight-story issue.
The crawler runs every four hours forever and must be cheap; the composer runs
weekly and can afford to think.

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

## The crawler

`crawl.py` keeps the corpus complete so the newsletter never has to search. It
polls every source in recency mode, dedupes, screens, extracts full text and
writes to SQLite.

```
python crawl.py --once                  single pass; what a scheduler calls
python crawl.py --loop --every 4h       long-running
python crawl.py --backfill              seed history via the search feeds
python crawl.py --status                corpus, feed health, recent runs
python crawl.py --dry-run --no-gdelt    poll and report, write nothing
```

**It does not** search, cluster, summarise, rank, spider, or send. Those need
the whole window in view; the crawler only ever sees a trickle.

Three constraints, all measured rather than assumed:

- **Poll interval is a requirement, not a preference.** CTA turns its entire
  RSS feed over in 2.2 days. A daily poll would lose stories permanently. Four
  hours gives ~13x margin. Depth alone is the wrong metric — ICT has only 3
  slots but publishes so rarely that its feed spans 9 days.
- **Feeds go stale without breaking.** TCHRD's feed is healthy and spans 183
  days with nothing in the last week. So ingest must not filter on recency:
  record everything, and let compose window the issue. A hard recency filter at
  ingest would also mean a crawler that was down for three days throws away
  exactly what the outage cost it.
- **Dates are unreliable.** Undated items are kept and treated as current;
  future dates (wrong server clocks) are nulled. Dropping an outlet silently is
  worse than storing a few stale rows.

Other behaviour worth knowing:

- **Conditional GET.** ETag/Last-Modified are stored per feed, so most polls
  return `304` with no body. A second pass runs in 4s versus 56s, and these
  outlets are in several cases very small NGOs.
- **Gap detection.** If none of a feed's items overlap the previous poll, it
  turned over completely and we may have missed something. That warning is the
  only thing that catches a poll interval which has quietly become too slow.
- **Domain policy for open search.** GDELT returns arbitrary domains, so
  results are kept only from curated outlets, an explicit mainstream allowlist,
  or state media when `INCLUDE_STATE_MEDIA` is on. In a live run this rejected
  51 of 75 results before any page was fetched.
- **Zero model calls with `--no-gdelt`.** Every curated domain auto-passes the
  free prefilter, so the LLM judge exists purely for open-search results.
- **Text is stored at crawl time,** not compose time. It spreads network load,
  surfaces dead links early, and — the reason that actually decides it for this
  subject — captures the article before it can be taken down.

`STANDING_QUERIES` in `sources/registry.py` is effectively the newsletter's
beat: with no user query, it defines what the crawler is capable of noticing.

## Debugging with LangSmith

Add to the repo-root `.env` and restart:

```
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_pt_...      # smith.langchain.com -> Settings -> API Keys
LANGSMITH_PROJECT=munsel
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
python checks/gate4_crawler.py    # crawler rules: idempotency, dates, domains
python checks/gate5_compose.py    # salience, cluster merging, batch windows
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

## The composer

`compose.py` turns a week of crawled articles into a draft issue.

```
python compose.py                    compose this week's draft
python compose.py --max-stories 8    shorter issue
python compose.py --show 2026-W31    print an existing draft
python compose.py --list             list issues
```

It is a deterministic pipeline, not a ReAct loop — window, cluster, score,
write, file — with the model used only for the four things that are genuine
judgement. Composing is non-destructive: articles are marked published only
when an issue is actually **sent**, so a discarded draft costs nothing and
recomposing simply replaces it.

**Clustering runs in small overlapping batches, and two plausible alternatives
both failed first.** Asking for one partition of all 49 articles makes melong
*loop* — it ran to 8,000 output tokens without terminating, re-emitting groups
it had already produced, so a 2,000-token cap truncated the JSON and every
article silently became a singleton. Raising the budget does not help; the
generation does not converge. Asking instead for only groups of two or more —
the same request at a fraction of the length — collapsed recall from eight
groups to one, because told that most articles stand alone the model agreed
they all did. Sixteen articles at a time produces a short, well-formed
partition. Batches overlap by half so a story is never split across a boundary,
and groups sharing an article are merged afterwards.

**Salience counts distinct outlets, not articles.** In a real week the largest
cluster was six posts from the Parliament-in-Exile about its own itinerary —
the least newsworthy thing in the window. Counting outlets scores that 6.8
while a four-outlet bilingual earthquake story scores 17.3.

**Stories are written before they are filed.** Sectioning from the first
article's raw title meant classifying Tibetan-script headlines, and it filed a
5.8-magnitude earthquake under "Human rights & detentions". Classifying the
written English headline instead fixes it, and the headline exists by then
anyway. Headlines are translated too — bilingual summaries under a headline
half the readership cannot read is a strange thing to send.

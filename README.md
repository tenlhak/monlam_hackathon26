# MunSel

A Tibetan language app built on [Monlam AI](https://api-v1.monlamai.studio/docs).
Three products, one FastAPI process:

- **Chat** — a tutor that looks vocabulary up before it teaches, rather than
  recalling it.
- **Practice** — alphabet and phrase drills: hear a letter, say it, trace it.
- **News** — a bilingual Tibet newsletter, crawled and composed by an agent.

## Running it locally

Needs Python 3.11+ and Node 22.

```bash
cp .env.example .env          # then fill in MONLAMAI_STUDIO and OPENAI_API_KEY

pip install -r t_tutor/requirements.txt
cd web && npm install
```

Two terminals, because the frontend wants hot reload:

```bash
cd t_tutor && python -m uvicorn app:app --reload --port 8080
cd web && npm run dev          # http://localhost:5173, proxies /api to :8080
```

Or run it the way production does — one port, no Node:

```bash
cd web && npm run build
cd t_tutor && python -m uvicorn app:app --port 8080   # http://localhost:8080
```

## Layout

```
t_tutor/                 the backend, and the only thing that runs in production
├── app.py               FastAPI: routes, SSE, serves web/dist
├── requirements.txt     the one Python environment definition
├── checks/              runnable verification gates (dev only)
└── tutor/
    ├── agent/           tutor chat: LangGraph research loop + melong
    ├── watch/           news: crawler, agent, composer, its own database
    ├── dictionary.py    Monlam dictionary API      ┐
    ├── phrasebook.py    curated phrases            ├ lookup sources
    ├── goldstein.py     OCR'd dictionary           ┘
    ├── trace.py         traced-letter grading
    ├── db.py            accounts, chat, practice attempts
    ├── paths.py         where mutable state lives (DATA_DIR)
    └── data/            phrases.json, goldstein_dict.jsonl, the Tibetan font

web/                     React + TanStack Router frontend
tools/                   dict_scrapper.py — regenerates goldstein_dict.jsonl
docs/                    Monlam API reference
```

Dependencies point one way: `app.py → agent → tools → sources → network`. The
lookup sources import no LangChain, so "does the dictionary return ཐུགས་རྗེ་ཆེ།
for thank you" is testable without starting an agent.

## The idea behind the tutor

`melong` writes fluent Tibetan but does not reliably *recall* it. Asked "how do
you say hello" across development it gave five different wrong answers, and once
answered "thank you" with the greeting.

So it never supplies vocabulary — it only explains vocabulary it was handed.
GPT-4.1-mini gathers verified words with tools, then melong teaches from them.
The model that writes Tibetan does not decide what Tibetan is true.

Three sources, in priority order: the curated **phrasebook** (the Monlam
dictionary returns nothing at all for "hello" or "how are you", and literary
register for everyday adjectives), the **Monlam dictionary** (authoritative,
free, ~250ms), and the **Goldstein** OCR extraction as a last resort, labelled
unreliable so the tutor hedges rather than asserts.

`TUTOR_AGENT=0` bypasses all of it and streams straight from melong — useful for
seeing the difference, not for production.

See [t_tutor/README.md](t_tutor/README.md) for the measurements behind these
decisions, and [t_tutor/tutor/watch/README.md](t_tutor/tutor/watch/README.md)
for the news pipeline.

## Deploying to Railway

The repo builds as a Docker image; Railway picks up the `Dockerfile`
automatically via `railway.json`.

1. **Create a service** from this repo.
2. **Attach a volume mounted at `/data`.** Not optional — a container's disk is
   wiped on every deploy, and `t_tutor.db` holds accounts, chat history and
   placement results that cannot be rebuilt. `DATA_DIR=/data` is already set in
   the image.
3. **Set service variables** — at minimum `MONLAMAI_STUDIO` and
   `OPENAI_API_KEY`. See `.env.example` for the rest.
4. Deploy. The healthcheck is `/api/features`, which reports whether the agent
   and news subsystems came up.

Set `WATCH_ADMIN=0` before showing the app to more than a few people: anyone who
types a name is a user, and each news run costs real money.

The news crawler currently runs only when someone presses **Run the agent** on
the News tab. Scheduling it is deliberately left for later.

## What still needs a human

`t_tutor/tutor/data/phrases.json` — 20 phrases and 6 colloquial words the tutor
asserts as fact. It has not been reviewed by a native speaker, and an error
there reaches every learner.

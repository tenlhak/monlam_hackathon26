"""Turn a week of crawled articles into a newsletter issue.

This is a deterministic pipeline, not a ReAct loop. The agent shape made sense
when a user asked a question and the system had to decide how to find things.
Here the sequence is fixed — window, cluster, score, section, write — and a
pipeline is cheaper, reproducible and far easier to debug. The model is used
for the four things that are genuinely judgement: grouping stories, ranking
them, filing them, and writing them.

The two decisions that shape everything, both taken from looking at a real
week of the corpus:

  Clustering must work across scripts. Almost every real story in the window
  ran in both languages — four outlets covered the Amdo earthquakes, two in
  English and two in Tibetan. An English embedding model cannot group
  ཨ་མདོ་བྲག་དཀར་རྫོང་དུ་ས་ཡོམ with "Twin quakes jolt Drakkar County", which is
  why the model does the clustering and not a vector index.

  Salience counts distinct outlets, not articles. The largest cluster in that
  week was six posts from the Tibetan Parliament-in-Exile about its own
  itinerary — the least newsworthy thing there. Counting sources demotes an
  institution talking about itself and promotes a story four newsrooms
  independently thought was worth covering.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from . import db
from .parsing import detect_language, repair_json
from .summarize import translate
from .tracing import traceable

# Fixed taxonomy. Readers navigate by structure, and consistency between issues
# is most of what makes a newsletter feel trustworthy. Empty sections are
# dropped at render time rather than padded.
SECTIONS = [
    "Human rights & detentions",
    "Religion & the Dalai Lama",
    "Language, education & culture",
    "Environment & the plateau",
    "Exile community & administration",
    "International & diplomatic",
    "Also this week",
]
CATCH_ALL = SECTIONS[-1]

MAX_STORIES = 12
MAX_PER_SECTION = 3

# Enough of each headline for the model to tell stories apart, short enough
# that fifty of them still leave room to think.
TITLE_CHARS = 110
SNIPPET_CHARS = 160


# ---------------------------------------------------------------------------
# 1. Clustering
# ---------------------------------------------------------------------------

# Clustering is done in small overlapping batches, and the reason is worth
# recording because two plausible alternatives both failed.
#
# Asking for one full partition of all 49 articles makes melong loop: it ran to
# 8,000 output tokens without terminating, re-emitting groups it had already
# produced. A 2,000-token cap therefore truncated the JSON, repair_json
# returned nothing, and all 49 articles silently became singletons. Raising the
# budget does not help — the generation does not converge.
#
# Asking instead for only groups of two or more, which sounds like the same
# request at a fraction of the length, collapsed recall from eight groups to
# one: told that most articles stand alone, the model agreed that they all did.
#
# What works is keeping each request small. Sixteen articles produce a short,
# well-formed partition. Batches overlap by half so that two articles about the
# same event never fall either side of a boundary, and groups sharing any
# article are merged afterwards.
CLUSTER_BATCH = 16

CLUSTER_SYSTEM = """You group news articles that cover THE SAME EVENT.

The list mixes English and Tibetan (བོད་ཡིག). Articles in different languages
frequently report the same event — group them together. Judge by the event
itself: the same earthquake, the same detention, the same conference, the same
protest.

Group only genuine same-event coverage. Two different protests are two stories.
Two reports of one protest are one story. Never group articles merely because
they share a topic.

Reply with ONLY a JSON array, one object per story, covering every article:
[{"label": "short English description", "members": [1, 4, 9]}]

An article covered by nobody else is a story of its own with one member.
Every article number must appear exactly once."""


def _digest(rows: List[Any], numbers: Optional[List[int]] = None) -> str:
    """Numbered headline list. `numbers` lets a batch keep global indices."""
    lines = []
    for position, row in enumerate(rows):
        n = numbers[position] if numbers else position + 1
        title = (row["title"] or "")[:TITLE_CHARS]
        snippet = (row["snippet"] or "")[:SNIPPET_CHARS]
        lines.append(f"{n}. [{row['source']}] {title}")
        if snippet:
            lines.append(f"   {snippet}")
    return "\n".join(lines)


def _batches(count: int, size: int = CLUSTER_BATCH) -> List[List[int]]:
    """Overlapping index windows, stepping by half a batch.

    The overlap is what stops a story being split because its two articles
    happened to sit either side of a boundary.
    """
    if count <= size:
        return [list(range(count))]
    step = max(1, size // 2)
    windows = []
    for start in range(0, count, step):
        window = list(range(start, min(start + size, count)))
        if len(window) > 1:
            windows.append(window)
        if start + size >= count:
            break
    return windows


def _cluster_batch(model, rows: List[Any], indices: List[int]) -> List[List[int]]:
    """Cluster one window. Returns groups of global indices."""
    subset = [rows[i] for i in indices]
    numbers = [i + 1 for i in indices]
    reply = model.invoke(
        [SystemMessage(content=CLUSTER_SYSTEM),
         HumanMessage(content=_digest(subset, numbers))],
        config={"run_name": f"cluster_batch[{len(subset)}]",
                "tags": ["tibet-watch", "compose"]},
        max_tokens=1500,
    )
    parsed = repair_json(reply.content if hasattr(reply, "content") else str(reply))

    allowed = set(indices)
    groups = []
    for entry in parsed if isinstance(parsed, list) else []:
        if not isinstance(entry, dict):
            continue
        members = []
        for raw in entry.get("members") or []:
            try:
                index = int(raw) - 1
            except (TypeError, ValueError):
                continue
            if index in allowed and index not in members:
                members.append(index)
        if len(members) > 1:      # singletons are implied, not recorded
            groups.append(members)
    return groups


@traceable(run_type="chain", name="compose.cluster",
           process_inputs=lambda i: {"articles": len(i.get("rows") or [])},
           process_outputs=lambda o: {"stories": len(o[0] or []), "stats": o[1]})
def cluster(model, rows: List[Any]) -> tuple:
    """Group articles into stories across both languages.

    Returns (stories, stats). Articles are ordered by date first so that
    coverage of one event lands in the same window, then clustered in
    overlapping batches, then merged wherever two groups share an article.
    Merging also repairs a real model error: the Nepal conference story came
    back under two labels sharing one article, and first-wins would have split
    a three-article story in half.
    """
    if not rows:
        return [], {"grouped": 0, "singletons": 0, "model_groups": 0, "batches": 0}

    # Same-event coverage clusters in time, so date order puts it in one window.
    rows = sorted(rows, key=lambda r: (r["published_at"] or r["first_seen_at"] or ""),
                  reverse=True)

    windows = _batches(len(rows))
    raw_groups: List[List[int]] = []
    for indices in windows:
        raw_groups.extend(_cluster_batch(model, rows, indices))

    # Merge any two groups that share an article.
    groups: List[List[int]] = []
    owner: Dict[int, int] = {}
    for members in raw_groups:
        existing = next((owner[i] for i in members if i in owner), None)
        if existing is None:
            for i in members:
                owner[i] = len(groups)
            groups.append(list(members))
        else:
            for i in members:
                if i not in owner:
                    owner[i] = existing
                    groups[existing].append(i)

    singletons = [i for i in range(len(rows)) if i not in owner]
    stats = {
        "model_groups": len(groups),
        "grouped": len(owner),
        "singletons": len(singletons),
        "batches": len(windows),
    }
    groups.extend([i] for i in singletons)
    return [[rows[i] for i in group] for group in groups], stats


# ---------------------------------------------------------------------------
# 2. Salience
# ---------------------------------------------------------------------------

def salience(articles: List[Any]) -> Dict[str, Any]:
    """Score a story on how much it looks like news.

    Distinct outlets is the load-bearing signal: independent newsrooms deciding
    the same thing is worth covering is the closest thing to an editorial
    consensus we can measure for free. Article count deliberately counts for
    very little, or one organisation posting six updates about its own tour
    outranks a disaster.
    """
    sources = {a["source"] for a in articles}
    languages = {a["lang"] for a in articles}
    has_outside = any((a["found_via"] or "").startswith("gdelt") for a in articles)

    newest = max(
        (a["published_at"] or a["first_seen_at"] or "") for a in articles
    )
    days_old = 7.0
    try:
        when = datetime.fromisoformat(newest)
        days_old = max(0.0, (datetime.now(timezone.utc) - when).total_seconds() / 86400)
    except (TypeError, ValueError):
        pass

    score = 0.0
    score += 3.0 * len(sources)                 # independent corroboration
    score += 1.5 if len(languages) > 1 else 0   # covered in both languages
    score += 1.5 if has_outside else 0          # escaped the exile press
    score += max(0.0, 3.0 - days_old * 0.4)     # freshness
    score += 0.3 * min(len(articles), 4)        # volume, heavily capped

    return {
        "salience": round(score, 2),
        "source_count": len(sources),
        "sources": sorted(sources),
        "languages": sorted(languages),
        "days_old": round(days_old, 1),
    }


# ---------------------------------------------------------------------------
# 3. Sections
# ---------------------------------------------------------------------------

SECTION_SYSTEM = """You file Tibet news stories into a newsletter's sections.

Sections:
{sections}

You will be given numbered story headlines. Assign each to exactly one section.
Use "{catch_all}" only when nothing else fits.

Reply with ONLY a JSON array:
[{{"n": 1, "section": "exact section name"}}]"""


@traceable(run_type="chain", name="compose.sections",
           process_outputs=lambda o: o)
def assign_sections(model, stories: List[Dict]) -> Dict[int, str]:
    """Ask the model to file each selected story. Unfiled ones fall through."""
    if not stories:
        return {}

    listing = "\n".join(f"{i + 1}. {s['label']}" for i, s in enumerate(stories))
    system = SECTION_SYSTEM.format(
        sections="\n".join(f"- {s}" for s in SECTIONS), catch_all=CATCH_ALL
    )
    reply = model.invoke(
        [SystemMessage(content=system), HumanMessage(content=listing)],
        config={"run_name": "assign_sections", "tags": ["tibet-watch", "compose"]},
        max_tokens=800,
    )
    parsed = repair_json(reply.content if hasattr(reply, "content") else str(reply))

    by_name = {s.lower(): s for s in SECTIONS}
    out: Dict[int, str] = {}
    if isinstance(parsed, list):
        for entry in parsed:
            if not isinstance(entry, dict):
                continue
            try:
                index = int(entry.get("n", 0)) - 1
            except (TypeError, ValueError):
                continue
            name = by_name.get(str(entry.get("section", "")).strip().lower())
            if 0 <= index < len(stories) and name:
                out[index] = name
    return out


# ---------------------------------------------------------------------------
# 4. Writing
# ---------------------------------------------------------------------------

STORY_SYSTEM = """You write a single item for a Tibet news digest.

You are given one or more reports of the same event. Write:
1. A headline of at most 12 words, plain and factual, no clickbait.
2. A summary of 60 to 90 words in {language}.

Rules:
- Use ONLY what the reports say. Never add background or context of your own.
- Do not invent names, numbers, dates or places. If a report does not say, omit it.
- Where reports disagree, prefer what most of them say.
- No preamble. Start with the substance.

Reply with ONLY this JSON:
{{"headline": "...", "summary": "..."}}"""

LANGUAGE_NAMES = {"bo": "Tibetan (བོད་ཡིག)", "en": "English"}

# One story's inputs. Well inside melong's ~32k window even with three
# articles, and the cap stops one long feature crowding out the rest.
STORY_INPUT_CHARS = 6000


def _story_input(articles: List[Any]) -> str:
    parts = []
    for a in articles[:3]:
        body = (a["text"] or "")[:STORY_INPUT_CHARS // max(1, min(len(articles), 3))]
        parts.append(f"--- {a['source']}: {a['title']}\n{body}")
    return "\n\n".join(parts)


@traceable(run_type="chain", name="compose.write_story",
           process_inputs=lambda i: {"articles": len(i.get("articles") or [])},
           process_outputs=lambda o: {"headline": (o or {}).get("headline")})
def write_story(model, articles: List[Any]) -> Dict[str, str]:
    """Write one bilingual digest item from a story's articles.

    Written in the language of the primary article, then translated — the same
    ordering as the article summariser, so compression loss and translation
    loss are not stacked on top of each other.
    """
    primary = max(articles, key=lambda a: len(a["text"] or ""))
    source_language = detect_language(primary["text"] or primary["title"] or "")

    system = STORY_SYSTEM.format(language=LANGUAGE_NAMES.get(source_language, "English"))
    reply = model.invoke(
        [SystemMessage(content=system), HumanMessage(content=_story_input(articles))],
        config={"run_name": f"write_story.{source_language}", "tags": ["tibet-watch", "compose"]},
        max_tokens=3000 if source_language == "bo" else 1200,
    )
    parsed = repair_json(reply.content if hasattr(reply, "content") else str(reply))

    if isinstance(parsed, dict) and parsed.get("summary"):
        headline = str(parsed.get("headline") or primary["title"] or "").strip()
        summary = str(parsed["summary"]).strip()
    else:
        # Rather than lose the story, fall back to the article's own headline
        # and the raw reply.
        headline = (primary["title"] or "").strip()
        summary = (reply.content if hasattr(reply, "content") else str(reply)).strip()

    other = "en" if source_language == "bo" else "bo"
    translated = translate(model, summary, other) if summary else ""
    # Headlines are translated too. Bilingual summaries under a headline only
    # half the readership can read is a strange thing to send.
    headline_other = translate(model, headline, other) if headline else ""

    return {
        "headline": headline,
        "headline_bo": headline if source_language == "bo" else headline_other,
        "headline_en": headline if source_language == "en" else headline_other,
        "summary_bo": summary if source_language == "bo" else translated,
        "summary_en": summary if source_language == "en" else translated,
        "source_language": source_language,
    }


INTRO_SYSTEM = """You write the opening paragraph of a weekly Tibet news digest.

Given this week's headlines, write 2 to 3 sentences in English saying what the
week was about and what mattered most. Factual, not promotional. Do not list
every story. Do not invent anything beyond the headlines.

Reply with the paragraph only."""


@traceable(run_type="chain", name="compose.intro")
def write_intro(model, headlines: List[str]) -> str:
    if not headlines:
        return ""
    reply = model.invoke(
        [SystemMessage(content=INTRO_SYSTEM),
         HumanMessage(content="\n".join(f"- {h}" for h in headlines))],
        config={"run_name": "write_intro", "tags": ["tibet-watch", "compose"]},
        max_tokens=400,
    )
    return (reply.content if hasattr(reply, "content") else str(reply)).strip()


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

@traceable(run_type="chain", name="compose.issue")
def compose_issue(conn, model=None, window_days: int = 7,
                  max_stories: int = MAX_STORIES, issue_id: Optional[str] = None,
                  verbose: bool = True, on_progress=None) -> Dict[str, Any]:
    """Build a draft issue from the crawled corpus.

    `on_progress` receives each status line as it happens, so a caller driving
    this from a web request can stream it. Composing takes minutes, and a
    button that does nothing visible for that long looks broken.
    """
    if model is None:
        from .melong import ChatMelong
        model = ChatMelong(temperature=0.0, max_tokens=1500)

    issue_id = issue_id or db.issue_id_for()

    def say(msg: str) -> None:
        if verbose:
            print(msg)
        if on_progress:
            on_progress(msg)

    rows = db.window(conn, days=window_days, only_unpublished=True)
    say(f"window: {len(rows)} articles over {window_days} days")
    if not rows:
        return {"issue_id": issue_id, "stories": [], "error": "no articles in window"}

    say("clustering across languages...")
    groups, cluster_stats = cluster(model, rows)
    say(f"  {len(rows)} articles -> {len(groups)} stories in "
        f"{cluster_stats['batches']} batches "
        f"({cluster_stats['model_groups']} multi-article, "
        f"{cluster_stats['singletons']} standalone)")

    # A silent collapse to all-singletons looks exactly like a legitimate week
    # of unrelated news, so say so plainly instead of letting it pass.
    if cluster_stats["model_groups"] == 0 and len(rows) > 10:
        say("  WARNING: nothing was grouped across 10+ articles. Suspicious for a "
            "real week; check the cluster prompt.")

    scored = []
    for group in groups:
        metrics = salience(group)
        scored.append({
            "articles": group,
            "label": (group[0]["title"] or "")[:110],
            **metrics,
        })
    scored.sort(key=lambda s: -s["salience"])

    multi = [s for s in scored if s["source_count"] > 1]
    say(f"  {len(multi)} covered by more than one outlet")
    for s in scored[:6]:
        say(f"    {s['salience']:>5.1f}  {s['source_count']} src {'/'.join(s['languages'])}"
            f"  {s['label'][:58]}")

    selected = scored[:max_stories]

    # Stories are written before they are filed. Sectioning from the raw first
    # article's title meant classifying Tibetan-script headlines, and it filed
    # a 5.8-magnitude earthquake under "Human rights & detentions". The written
    # English headline is a far better thing to classify, and it exists by then
    # anyway.
    say(f"writing {len(selected)} stories in both languages...")
    written = []
    for story in selected:
        text = write_story(model, story["articles"])
        written.append({
            "headline": text["headline"],
            "headline_en": text["headline_en"],
            "headline_bo": text["headline_bo"],
            "summary_en": text["summary_en"],
            "summary_bo": text["summary_bo"],
            "salience": story["salience"],
            "source_count": story["source_count"],
            "article_ids": [a["id"] for a in story["articles"]],
            "primary_url": story["articles"][0]["url"],
            "sources": [{"source": a["source"], "url": a["url"], "title": a["title"]}
                        for a in story["articles"]],
        })
        say(f"  {len(written):>2}. {text['headline_en'][:66]}")

    say("filing into sections...")
    sections = assign_sections(model, [{"label": w["headline_en"]} for w in written])
    for i, record in enumerate(written):
        record["section"] = sections.get(i, CATCH_ALL)

    # Cap each section so one busy topic cannot become the whole issue.
    per_section: Dict[str, int] = {}
    for record in sorted(written, key=lambda w: -w["salience"]):
        count = per_section.get(record["section"], 0)
        if count >= MAX_PER_SECTION:
            record["section"] = CATCH_ALL
        per_section[record["section"]] = per_section.get(record["section"], 0) + 1

    order = {name: i for i, name in enumerate(SECTIONS)}
    written.sort(key=lambda w: (order.get(w["section"], 99), -w["salience"]))

    db.create_issue(conn, issue_id, window_days)
    for rank, record in enumerate(written, 1):
        record["rank"] = rank
        db.add_story(conn, issue_id, record)
        say(f"  {rank:>2}. [{record['section'][:26]:<26}] {record['headline'][:48]}")

    intro = write_intro(model, [w["headline"] for w in written])
    spend = model.spend() if hasattr(model, "spend") else {}
    db.finalise_issue(conn, issue_id, intro, len(written), spend.get("cost", 0.0))

    return {
        "issue_id": issue_id,
        "intro": intro,
        "stories": written,
        "article_count": len(rows),
        "cluster_count": len(groups),
        "cluster_stats": cluster_stats,
        "spend": spend,
    }

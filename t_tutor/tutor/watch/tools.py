"""The agent's three tools, and the session state they share.

Every tool takes exactly one string. That is not a stylistic choice: the model
has no tools API, so a call is a flat {"action", "action_input"} object parsed
out of prose, and a single argument is what maps cleanly onto it. Nested
arguments are where small models break.

Tools return handles and short confirmations, never article bodies. The full
text and both summaries live in the session store, and the caller renders the
result from there — so the transcript stays small even though the context
window could hold more.
"""

from typing import List, Optional

from langchain_core.tools import tool

from .extract import fetch_article as download
from .relevance import rank, screen
from .sources import gdelt, rss
from .store import DocStore
from .summarize import summarise_doc, translate_query

MAX_RESULTS_SHOWN = 8


class Session:
    """Per-question state: what was found, fetched and summarised."""

    def __init__(self, model, store: Optional[DocStore] = None, use_gdelt: bool = True):
        self.model = model
        self.store = store or DocStore()
        self.use_gdelt = use_gdelt
        self.queries: List[str] = []

    def results(self) -> List:
        """Summarised documents, best first — the actual deliverable."""
        docs = self.store.summarised()
        docs.sort(key=lambda d: (-d.query_score, -(d.relevance_score or 0.0),
                                 d.published_at or ""))
        return docs


def build_tools(session: Session):
    """Bind the three tools to a session."""

    @tool
    def search_tibet_news(query: str) -> str:
        """Search Tibetan news sources for articles about a topic. Give a short
        topic or keyword phrase, not a question. Returns a numbered list of
        articles with an id and a URL for each."""
        query = (query or "").strip()
        if not query:
            return "No query given. Provide a short topic, for example 'boarding schools'."
        session.queries.append(query)

        # The Tibetan-language outlets only contribute if the query reaches them
        # in Tibetan, so melong translates it first.
        query_bo = translate_query(session.model, query)

        candidates = rss.search(query, query_bo)
        if session.use_gdelt:
            candidates += gdelt.search(query)

        fresh = [c for c in (session.store.add(**c) for c in candidates) if c]
        if not fresh:
            return (f"No new articles found for '{query}'. Try a different or broader "
                    f"topic, or summarise what you already have.")

        relevant = screen(session.model, fresh)
        if not relevant:
            return (f"Found {len(fresh)} articles for '{query}' but none were about the "
                    f"Tibetan cause. Try a different topic.")

        # Screening says "is this about the cause"; ranking says "does this
        # answer the question that was asked". Both are needed.
        relevant = rank(relevant, query, query_bo)

        lines = [f"Found {len(relevant)} relevant articles for '{query}'"]
        if query_bo:
            lines[0] += f" (also searched Tibetan: {query_bo})"
        lines[0] += ":"

        for i, doc in enumerate(relevant[:MAX_RESULTS_SHOWN], 1):
            date = doc.published_at or "undated"
            lines.append(f"{i}. id={doc.id} [{doc.source}, {date}, {doc.language}] {doc.title}")
            lines.append(f"   {doc.url}")
        if len(relevant) > MAX_RESULTS_SHOWN:
            lines.append(f"...and {len(relevant) - MAX_RESULTS_SHOWN} more.")
        return "\n".join(lines)

    @tool
    def fetch_article(doc_id: str) -> str:
        """Download the full text of one article. Pass the id from the search
        results, for example 6ff21ca2. Returns the title, length and opening
        lines, not the whole article."""
        doc = session.store.resolve(doc_id)
        if doc is None:
            return (f"No article with id '{doc_id}'. Use an id from the search results, "
                    f"or run search_tibet_news first.")
        if doc.text:
            return (f"Already downloaded: id={doc.id} '{doc.title}' "
                    f"({doc.word_count} words, {doc.language}). Call summarize_article next.")

        got = download(doc.url)
        if got["error"]:
            doc.error = got["error"]
            return f"Could not read id={doc.id}: {got['error']}. Try a different article."

        doc.text = got["text"]
        doc.word_count = got["word_count"]
        doc.fetched_at = got["fetched_at"]
        if got["title"]:
            doc.title = got["title"]
        if got["published_at"] and not doc.published_at:
            doc.published_at = got["published_at"][:10]

        opening = " ".join(doc.text[:300].split())
        return (f"Downloaded id={doc.id} '{doc.title}' — {doc.word_count} words, "
                f"{doc.language}, published {doc.published_at or 'unknown'}.\n"
                f"Opens: {opening}...\nCall summarize_article with this id.")

    @tool
    def summarize_article(doc_id: str) -> str:
        """Write a summary of a downloaded article in both Tibetan and English.
        Pass the id of an article you have already fetched. The full summaries
        are stored for the user; this returns a short confirmation."""
        doc = session.store.resolve(doc_id)
        if doc is None:
            return f"No article with id '{doc_id}'. Use an id from the search results."

        if not doc.text:
            # Save the agent a turn rather than making it back out and re-plan.
            got = download(doc.url)
            if got["error"]:
                doc.error = got["error"]
                return f"Could not read id={doc.id}: {got['error']}. Try a different article."
            doc.text = got["text"]
            doc.word_count = got["word_count"]
            doc.fetched_at = got["fetched_at"]

        if doc.summary_en and doc.summary_bo:
            return f"id={doc.id} is already summarised in both languages."

        summarise_doc(session.model, doc)
        if not (doc.summary_en or doc.summary_bo):
            return f"Summarising id={doc.id} failed. Try a different article."

        preview = " ".join((doc.summary_en or "")[:220].split())
        return (f"Summarised id={doc.id} '{doc.title}' in both languages "
                f"(source language {doc.language}).\nEnglish summary begins: {preview}...")

    return [search_tibet_news, fetch_article, summarize_article]

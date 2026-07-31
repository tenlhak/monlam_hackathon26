"""Curated sources, and the vocabulary that defines "the Tibetan cause".

The feed list is the precision layer of the search: an item from tibet.net or
Phayul is almost certainly on topic, which is why the relevance filter waves
curated sources through without spending a model call on them.

Feed URLs rot. checks/gate1_sources.py probes every entry and reports which
ones still resolve — run it before a demo rather than trusting this list.
"""

# Most of these outlets run WordPress, which exposes its search as an RSS feed
# at /?s=<query>&feed=rss2. That matters more than it sounds: it turns the feed
# layer from "the latest ten items" into a searchable archive per outlet, which
# is what makes a keyless search backend viable at all.
#
# `latest` is the recency feed, `search` is the archive template ({q} is filled
# with the URL-encoded query). Either may be None.
#
# Verified 2026-07-31 by checks/gate1_sources.py:
#   - Free Tibet's recency feed serves a placeholder post, but its search works.
#   - Tibet Times ignores ?s= and returns its recency list, so search is None.
#   - Tibet Post International's feed is dead; VOA Tibetan's RSS lives behind a
#     per-feed opaque /api/<id> path that cannot be guessed. Both are dropped —
#     Tibet Times and RFA already cover the Tibetan-language side.
FEEDS = [
    {"name": "Phayul", "domain": "phayul.com", "lang": "en",
     "latest": "https://www.phayul.com/feed/",
     "search": "https://www.phayul.com/?s={q}&feed=rss2"},
    {"name": "Tibetan Review", "domain": "tibetanreview.net", "lang": "en",
     "latest": "https://www.tibetanreview.net/feed/",
     "search": "https://www.tibetanreview.net/?s={q}&feed=rss2"},
    {"name": "Central Tibetan Administration", "domain": "tibet.net", "lang": "en",
     "latest": "https://tibet.net/feed/",
     "search": "https://tibet.net/?s={q}&feed=rss2"},
    {"name": "International Campaign for Tibet", "domain": "savetibet.org", "lang": "en",
     "latest": "https://savetibet.org/feed/",
     "search": "https://savetibet.org/?s={q}&feed=rss2"},
    {"name": "TCHRD", "domain": "tchrd.org", "lang": "en",
     "latest": "https://tchrd.org/feed/",
     "search": "https://tchrd.org/?s={q}&feed=rss2"},
    {"name": "Free Tibet", "domain": "freetibet.org", "lang": "en",
     "latest": None,
     "search": "https://freetibet.org/?s={q}&feed=rss2"},
    {"name": "Tibet Times", "domain": "tibettimes.net", "lang": "bo",
     "latest": "https://tibettimes.net/feed/",
     "search": None},
    {"name": "RFA Tibetan", "domain": "rfa.org", "lang": "bo",
     "latest": "https://www.rfa.org/tibetan/rss2.xml",
     "search": None},
]

# Domains we treat as inherently on topic, so the relevance filter can skip them.
TRUSTED_DOMAINS = {
    "phayul.com", "tibetanreview.net", "tibet.net", "savetibet.org",
    "freetibet.org", "tchrd.org", "thetibetpost.com", "tibettimes.net",
    "voatibetan.com", "rfa.org", "tibetwatch.org", "studentsforafreetibet.org",
    "tibetnetwork.org", "tibetanjournal.com",
}

# Stage-one keyword filter for results arriving from open search (GDELT, Brave).
IN_SCOPE_TERMS = [
    "tibet", "tibetan", "lhasa", "dalai lama", "panchen lama", "karmapa",
    "gyalwa", "dharamsala", "kashag", "sikyong", "kalon tripa",
    "central tibetan administration", "government-in-exile", "exile tibetan",
    "self-immolation", "self immolation", "political prisoner",
    "boarding school", "colonial boarding", "sinicization", "sinicisation",
    "tibetan language", "tibetan buddhism", "monastery", "nunnery",
    "amdo", "kham", "u-tsang", "qinghai", "plateau", "tar ",
    "བོད", "ལྷ་ས", "རྒྱ་ནག",
]

# Hard vetoes. These are the near-misses that pollute an open web search: the
# word "Tibetan" attached to commerce, wellness or wildlife rather than to a
# people's political and cultural survival.
OUT_OF_SCOPE_TERMS = [
    "mastiff", "singing bowl", "singing bowls", "terrier", "tibetan fox",
    "antelope", "yak wool sweater", "incense benefits", "chakra",
    "sound healing", "crystal", "horoscope", "recipe", "trekking package",
    "tour package", "travel deal", "hotel booking", "flight deal",
    "dropshipping", "amazon.com", "etsy.com", "aliexpress",
]

# The rubric the model judges borderline items against.
RELEVANCE_RUBRIC = """An article is about the Tibetan cause if it concerns any of:
- human rights abuses, detentions, or political prisoners in Tibet
- self-immolations or protests by Tibetans
- the Dalai Lama, his succession or reincarnation politics
- the Central Tibetan Administration, the exile government, or Tibetan elections
- suppression of Tibetan language, religion, or culture; colonial boarding schools; sinicization
- surveillance, censorship, or population control in Tibet
- the Tibetan exile and refugee community
- international policy, legislation, or diplomacy concerning Tibet
- environmental destruction, damming or mining on the Tibetan plateau

It is NOT about the Tibetan cause if it is primarily about:
- tourism, travel or trekking
- Tibetan mastiffs, antelope or other animals
- singing bowls, incense, crystals, wellness or sound healing
- Tibetan medicine or handicrafts sold as products
- Buddhist teaching with no connection to Tibetan political or cultural survival"""

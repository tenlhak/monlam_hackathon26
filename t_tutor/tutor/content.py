"""Practice content per level.

Deliberately small. Practice needs concrete items to serve, and the Tibetan
alphabet is fixed canonical data rather than anything the model generates — the
model gets the letters and their order right, but not facts about them (asked
how many vowel signs Tibetan has, it answered 10; there are 4).
"""

from typing import Dict, List

# The thirty consonants, in the traditional order they are learned.
CONSONANTS = [
    ("ཀ", "ka"), ("ཁ", "kha"), ("ག", "ga"), ("ང", "nga"),
    ("ཅ", "ca"), ("ཆ", "cha"), ("ཇ", "ja"), ("ཉ", "nya"),
    ("ཏ", "ta"), ("ཐ", "tha"), ("ད", "da"), ("ན", "na"),
    ("པ", "pa"), ("ཕ", "pha"), ("བ", "ba"), ("མ", "ma"),
    ("ཙ", "tsa"), ("ཚ", "tsha"), ("ཛ", "dza"), ("ཝ", "wa"),
    ("ཞ", "zha"), ("ཟ", "za"), ("འ", "'a"), ("ཡ", "ya"),
    ("ར", "ra"), ("ལ", "la"), ("ཤ", "sha"), ("ས", "sa"),
    ("ཧ", "ha"), ("ཨ", "a"),
]

# The four vowel signs, shown on the base letter ཨ.
VOWELS = [
    ("ཨི", "i", "gigu"),
    ("ཨུ", "u", "zhabkyu"),
    ("ཨེ", "e", "drengbu"),
    ("ཨོ", "o", "naro"),
]

LEVELS: Dict[int, Dict] = {
    1: {
        "title": "Foundations",
        "focus": "The alphabet — recognising and sounding out individual letters.",
        "items": (
            [{"text": t, "roman": r, "gloss": f"the letter {r}"} for t, r in CONSONANTS]
            + [
                {"text": t, "roman": r, "gloss": f"vowel {r} ({name})"}
                for t, r, name in VOWELS
            ]
        ),
    },
    2: {
        "title": "First words",
        "focus": "Short everyday words and the greetings you will use daily.",
        "items": [
            {"text": "ཆུ་", "roman": "chu", "gloss": "water"},
            {"text": "ཇ་", "roman": "ja", "gloss": "tea"},
            {"text": "ང་", "roman": "nga", "gloss": "I / me"},
            {"text": "ཨ་མ་", "roman": "a ma", "gloss": "mother"},
            {"text": "ཨ་ཕ་", "roman": "a pha", "gloss": "father"},
            {"text": "ཁ་ལག", "roman": "kha lak", "gloss": "food"},
            {"text": "བཀྲ་ཤིས་", "roman": "tashi", "gloss": "auspicious"},
        ],
    },
    3: {
        "title": "Everyday phrases",
        "focus": "Complete phrases you can use in conversation.",
        "items": [
            {"text": "བཀྲ་ཤིས་བདེ་ལེགས།", "roman": "tashi delek", "gloss": "hello / greetings"},
            {"text": "ཐུགས་རྗེ་ཆེ།", "roman": "thuk je che", "gloss": "thank you"},
            {"text": "ག་ལེར་ཕེབས།", "roman": "ka le phe", "gloss": "goodbye (to one leaving)"},
            {"text": "ཧ་གོ་སོང་།", "roman": "ha ko song", "gloss": "I understand"},
            {"text": "ཧ་གོ་མ་སོང་།", "roman": "ha ko ma song", "gloss": "I don't understand"},
        ],
    },
    4: {
        "title": "Register and fluency",
        "focus": "Honorific forms and longer, more polite constructions.",
        "items": [
            {"text": "སྐུ་གཟུགས་བདེ་པོ་ཡིན་པས།", "roman": "ku zu de po yin pe", "gloss": "how are you? (honorific)"},
            {"text": "ཡང་བསྐྱར་གསུང་རོགས་གནང་།", "roman": "yang kyar sung rok nang", "gloss": "please say that again"},
            {"text": "ང་ལ་ཇ་ཞིག་གནང་རོགས་གནང་།", "roman": "nga la ja shik nang rok nang", "gloss": "please give me a tea"},
        ],
    },
    5: {
        "title": "Extended speech",
        "focus": "Full sentences and connected speech.",
        "items": [
            {"text": "བོད་སྐད་ལ་ག་རེ་ཟེར་གྱི་རེད།", "roman": "bö ke la ka re ser gi re", "gloss": "how do you say it in Tibetan?"},
            {"text": "ཁྱེད་རང་གི་མཚན་ལ་ག་རེ་ཞུ་གི་ཡོད།", "roman": "khye rang gi tsen la ka re shu gi yö", "gloss": "what is your name? (honorific)"},
        ],
    },
}


def clamp(level: int) -> int:
    return max(1, min(5, int(level or 1)))


def for_level(level: int) -> Dict:
    return LEVELS[clamp(level)]


def items_for(level: int) -> List[Dict]:
    return for_level(level)["items"]


def level_hint(level: int) -> str:
    """One line describing the learner, appended to the chat system prompt."""
    info = for_level(level)
    return (
        f"The learner is at level {clamp(level)} of 5 ({info['title']}). "
        f"Right now they are working on: {info['focus']} "
        "Pitch your explanations to that stage."
    )

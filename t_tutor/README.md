# T-Tutor — a Tibetan language tutor

A chat tutor and interactive practice app for people learning Tibetan, built on
Monlam AI with a FastAPI backend, SQLite persistence, and a plain HTML/CSS/JS
frontend.

## Running it

```bash
conda activate monlam
pip install -r requirements.txt      # first time only
cd t_tutor
python -m uvicorn app:app --reload --port 8080
```

Then open <http://127.0.0.1:8080>. Requires `MONLAMAI_STUDIO=<your-api-key>` in
the `.env` file at the repo root.

Enter a name on first load. There are no passwords — the user id is kept in
`localStorage` and everything else lives in `t_tutor.db`, created automatically.

## What it does

**Chat** — a streaming conversation with Sherab, the tutor. Conversations are
saved and listed in the Chat History sidebar; the first message becomes the
title. Only the last 20 messages are sent to the model, since chat is billed per
token.

**Practice** — level-appropriate drills over a card showing one item at a time.

- *Listen* plays the item spoken by Monlam's text-to-speech.
- *Speak* records you, transcribes it, and tells you whether it matched.
- *Trace* has you draw over a faint letter, graded by OCR with a shape
  comparison behind it.

**Levels 1–5** set which items Practice serves (level 1 is the alphabet), show in
the header badge, and add a line to the chat prompt so explanations are pitched
appropriately. Levels are currently set in the database, not earned.

## Layout

```
app.py               FastAPI server, SSE streaming, practice endpoints
tutor/client.py      Monlam API wrapper: chat, text-to-speech, speech-to-text
tutor/db.py          SQLite: users, conversations, messages, practice_attempts
tutor/content.py     Practice items per level (the alphabet, words, phrases)
tutor/normalize.py   Comparing spoken Tibetan against the target
tutor/prompts.py     The tutor's system prompt
static/              Chat and Practice views
```

## Findings that shaped this

All measured against the live API rather than assumed.

**Speech-to-text needs its output normalised.** The transcript comes back with
punctuation the speaker never said — `ཀ` is heard as `ཀ།`, `ང` as `ང་།`,
`ཆུ་` as `ཆུ།`. Comparing raw strings marks every correct answer wrong.

**Saying a letter aloud adds a vowel.** Pronouncing a consonant in isolation
sounds like "ka-a", so `ཀ` transcribes as `ཀའ`. That is correct pronunciation,
so `normalize.matches` forgives a trailing a-chung. It is forgiven only when
appended — stripping `འ` outright would erase the letter `འ` itself, which is
the twenty-third consonant and a practice item in its own right. This took
letter recognition from 1/3 to passing consistently.

**Accuracy depends on utterance length.** On clean synthesised audio, `ང`, `ཆུ་`
and `བཀྲ་ཤིས་བདེ་ལེགས།` all transcribed 3/3. Single letters are the weakest case
because they are acoustically very short. Expect Speak to be more forgiving on
words and phrases than on individual letters, and more error-prone on a real
microphone than in these tests.

**Trace needs a fallback behind OCR.** Monlam's OCR reads running text well —
`བཀྲ་ཤིས་`, `ཐུགས་རྗེ་ཆེ།` and `ང་ལ་ཇ་ཞིག་` all came back exact. On isolated
glyphs it manages 18 of the 30 consonants, and crucially it fails the *same*
ones every time: `ཆ ཉ ཏ བ ཙ ཚ འ` return empty or another script entirely
(Arabic `له`, Devanagari `क`) under every font tried. Grading on OCR alone would
make those letters impossible to pass however well they were drawn. So OCR is
tried first, and when it cannot read the drawing the shape is compared against
the reference glyph instead. All 30 letters are passable; see `tutor/trace.py`.

**The ghost letter is rendered by the server, not the browser.** Tracing a shape
and being graded against a different one costs about half the overlap — `ཛ`
scores 1.00 against its own glyph and 0.50 against another font's. The browser
would have drawn the ghost in Noto Serif Tibetan while grading compared against
the font installed locally. Serving the reference itself removes the mismatch
and works on machines with no Tibetan font at all.

**A transparent canvas is invisible to OCR.** The browser exports the drawing
with a transparent background; sent as-is, OCR returned nothing for every single
letter and silently did no work, leaving the shape comparison to carry
everything. Drawings are flattened onto white before being sent.

**Audio must be uploaded as WAV.** Browser `MediaRecorder` defaults to
webm/Opus, which is untested here; every verified call used WAV. The frontend
therefore captures raw PCM through an `AudioContext` and encodes WAV itself.

**The chat model is not a reliable source of Tibetan.** It invents vocabulary —
asked for "hello" it once answered `སྣང་བ་འདྲེན་ཞིག`, which is not a greeting —
and presents Wylie transliteration as pronunciation. The system prompt addresses
the Wylie problem but cannot stop invention. Practice content is hard-coded in
`content.py` precisely so drills never depend on the model; chat still can be
wrong. Note the alphabet itself the model gets right, but facts about it it does
not (asked how many vowel signs Tibetan has, it said 10; there are 4).

## Notes

- Only `melong` exists on the API. `melong-preview`, `melong-2`, `melong-pro`
  and `melong-v2` all return `No active 'chat' model found`.
- Tibetan rendering uses Noto Serif Tibetan, falling back to the Monlam Uni and
  Microsoft Himalaya fonts already present on Windows, so script renders offline.
- If VS Code marks `fastapi` unresolved, point the interpreter at the `monlam`
  conda environment; the server runs fine.

## Not built yet

- Progression between levels (level is set in the DB, not earned)
- The Trace threshold is calibrated on simulated traces, which are filled
  glyphs; a real learner draws a thin stroke along the centre and will overlap
  a solid reference less. It is set conservatively for that reason and should be
  re-tuned against genuine handwriting. Shape matching also cannot separate
  near-identical pairs such as བ/ཕ and ཀ/ག, which is why a shape-judged pass
  says "looks right" rather than the flat "correct" that OCR earns.
- Caching text-to-speech audio per item, which would avoid re-billing the same
  letters on every click
- Voice/dialect choice — six voices exist across Lhasa, Amdo and Kham

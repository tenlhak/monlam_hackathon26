# T-Tutor — a Tibetan language tutor

A simple chat tutor for people learning Tibetan, built on Monlam AI's `melong`
chat model with a FastAPI backend and a plain HTML/CSS/JS frontend.

## Running it

```bash
conda activate monlam
pip install -r requirements.txt      # first time only
cd t_tutor
python -m uvicorn app:app --reload --port 8080
```

Then open <http://127.0.0.1:8080>.

Requires `MONLAMAI_STUDIO=<your-api-key>` in the `.env` file at the repo root.

## Layout

```
app.py               FastAPI server, streams replies as Server-Sent Events
tutor/client.py      Monlam API wrapper (chat today; TTS/STT/OCR drop in here)
tutor/prompts.py     The tutor's system prompt
static/              Chat interface
```

The tutor is defined entirely by the system prompt in `tutor/prompts.py`. That
is the file to edit to change how Sherab teaches.

## Known limitation

`melong` is a capable conversational model but an unreliable source of Tibetan
vocabulary. Probing it directly:

- Asked "how do I say hello?", it answered `སྣང་བ་འདྲེན་ཞིག` — not a greeting.
- Asked for "thank you", it gave `ཁྱེ་ཆེ་` instead of `ཐུགས་རྗེ་ཆེ།`.
- It presents Wylie transliteration as pronunciation, rendering
  `བཀྲ་ཤིས་བདེ་ལེགས།` as "bra shee deh leg" rather than "tashi delek".

The system prompt addresses the Wylie problem directly, but it cannot stop the
model inventing vocabulary. Expect some wrong Tibetan at this stage. Fixing it
properly means giving the tutor a verified phrase bank to teach from rather than
letting it rely on its own recall — a candidate for a later stage.

## Notes

- Tibetan rendering uses Noto Serif Tibetan from Google Fonts, falling back to
  Microsoft Himalaya, which ships with Windows, so the script still renders
  offline.
- Only `melong` exists on the API. `melong-preview`, `melong-2`, `melong-pro`
  and `melong-v2` all return `No active 'chat' model found`.
- If VS Code marks the `fastapi` import unresolved, point the interpreter at the
  `monlam` conda environment; the server itself runs fine.

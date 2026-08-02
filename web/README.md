# MunSel — web

React + TypeScript frontend. Chat, Practice, Newsroom and Resources, served by
Vite in development and built into `dist/` for the FastAPI process to serve in
production.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173, proxies /api to :8080
```

The backend must be running on port 8080 for Chat, Listen and Speak. Trace and
every frontend-data drill work without it.

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with the `/api` proxy |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | oxlint |
| `npm run check:strokes` | Validate the stroke-order data against the grader |

`VITE_API_BASE_URL` is optional — leave it empty to use the dev proxy.

## Layout

```
src/
├── routes/              TanStack Router, file-based
│   ├── __root.tsx       auth gate + AppShell
│   ├── practice/$levelId/$sectionId.tsx
│   └── author.tsx       stroke-order authoring tool (internal)
├── features/
│   ├── auth/            name-only sign-in, id in localStorage
│   ├── chat/            streaming SSE conversation with Sherab
│   ├── practice/        drill views, one per level and section
│   ├── section1/        TraceCanvas — the tracing surface
│   ├── authoring/       StrokeAuthor — where strokes.json comes from
│   └── news/ resources/ placement/
├── lib/                 data and logic (see below)
├── data/                consonants.ts, strokes.json
└── components/          AppShell, ThemeToggle, ui/ (shadcn)
```

## Where the content lives

Most of the curriculum is frontend data, not backend. Only Level 1 Section 1's
letters come from the API; everything else is a file here.

| File | Holds |
| --- | --- |
| `lib/curriculum.ts` | The five levels and their sections — titles, CEFR bands, item counts, which drills each section opens with, and what is unlocked |
| `data/strokes.json` | **Stroke-order data for all 34 glyphs** — 136 strokes |
| `data/consonants.ts` | The 30 consonants in the traditional 8 rows |
| `lib/section2-data.ts` | 8 consonants × 4 vowels = 32 syllables |
| `lib/section3-data.ts` | Syllable architecture examples |
| `lib/numerals.ts`, `lib/punctuation-data.ts` | Level 1 sections 4 and 5 |
| `lib/level2-data.ts`, `lib/level3-data.ts` | Vocabulary, verbs, dialogues, the eight cases |
| `lib/resources-data.ts` | The curated external-resources list |

Drill content is deliberately hard-coded rather than model-generated. Melong
invents vocabulary and gets facts about the alphabet wrong — asked how many
vowel signs Tibetan has, it answered 10; there are 4.

## The tracing engine

Trace is graded entirely in the browser, stroke by stroke, against authored
stroke-order data. No round trip, no API cost, works offline.

```
Fynn's diagrams ──(traced once, by hand)──► strokes.json ──► grades learners live
  ground truth          /author tool          34 glyphs
```

| File | Job |
| --- | --- |
| `lib/stroke-data.ts` | Data model, the letter box, ghost fitting, the font constant |
| `lib/stroke-grader.ts` | Grading: resampling, tolerances, per-stroke verdicts |
| `features/section1/TraceCanvas.tsx` | The drawing surface, guides, playback |
| `features/authoring/StrokeAuthor.tsx` | The authoring tool at `/author` |
| `scripts/check-strokes.mjs` | Validation harness |

**Each stroke is graded on pen-up**, in order, on four things checked in the
order the correction should be given: direction, start point, length, then
shape. Direction comes before shape deliberately — a backwards stroke has the
right shape, so a naive check would say "wrong shape" when the one useful
instruction is "reverse it".

**Points are normalised into a square 0–1 box** mapped through the largest
square that fits the canvas. Scaling x by canvas width and y by height would
stretch the letter on a wide panel and make a horizontal tolerance mean
something different from a vertical one.

**The ghost letter is fitted to the strokes, not sized by font metrics.** Two
faces at the same pixel size put their ink in different places, so a font change
moved the ghost off the guides. Measuring the glyph's real ink box and fitting
it over the authored strokes makes alignment correct for any face. `TIBETAN_FONT`
in `stroke-data.ts` must match `--font-tibetan` in `index.css` — canvas cannot
read a CSS custom property.

**Syllables compose.** Only the 34 components are authored, but Practice serves
syllables — ཨི, and all 32 of ཀི ཀུ ཀེ ཀོ. A syllable is written base first, then
vowel sign, so `strokesFor()` decomposes and concatenates. Section 2 got stroke
grading without any extra tracing.

**Glyphs with no authored data** fall back to a whole-shape coverage check, so
adding letters never breaks the drill.

### Changing the stroke data

Open `/author`, trace, **Download all**, replace `src/data/strokes.json`, then:

```bash
npm run check:strokes
```

It loads the real grader and real data and asks six questions of every letter:
does the reference trace back to itself, is a reversed stroke caught as a
*direction* error, can any stroke pass as a different stroke of the same letter,
is a half-drawn stroke rejected, does the letter look finished next to its
neighbours, are taps rejected. It exits non-zero on failure.

That harness earned its place — it found four grading bugs that eyeballing never
would, each only reachable once enough letters existed to collide: tolerances
larger than ཉ's short strokes, ཅ's fourth stroke passing as its third, ཕ's
diagonal passing as its stem, and strokes in ས and ཨ starting close enough to be
confused. It also caught two letters accidentally saved with a single stroke.

It reports two numbers as *measurements* rather than verdicts — how much
overshoot and wobble currently pass. Those are lenient on purpose and want
re-tuning against attempts by someone other than whoever authored the reference,
because the author's own hand always scores near-perfect against their own
strokes.

### Provenance

Stroke order, direction and the traditional stroke names come from
**Christopher J. Fynn's "how to write the Tibetan script" diagrams**, published
on Wikimedia Commons under **CC BY-SA 4.0**, cross-checked against Allexkoch's
stroke animations (also CC BY-SA 4.0). Tibetan stroke order is not fully
standardised; this follows one dbu-can style.

`strokes.json` was hand-traced from those diagrams, so it is a derivative work —
share-alike applies to redistributing it.

## Progress

`lib/progress.ts` keeps progress client-side in localStorage, keyed by user id
so two accounts on one browser stay separate. An item counts as done the first
time it is completed in *any* drill — a played Listen, a passed Trace, a correct
Speak. Section progress is done ÷ `itemCount` from `curriculum.ts`; level
progress averages its available sections. `lib/celebrate.ts` fires a small
confetti burst per item and a larger one when a section completes.

Nothing is written to the backend, so clearing site data resets it.

## Notes

- Tibetan renders in **Monlam TBslim**, bundled in `src/assets/fonts/`, so the
  script displays offline and identically everywhere.
- Speak captures raw PCM through an `AudioContext` and encodes WAV itself
  (`lib/wav-recorder.ts`) — `MediaRecorder` defaults to webm/Opus, and every
  verified STT call used WAV.
- Chat parses its SSE stream with `fetch` and `TextDecoder` rather than axios,
  since the reply arrives token by token.
- `/author` is an internal tool, not part of the learner flow.

## Known rough edges

- **`StrokeAuthor` stores draft points in canvas pixels** and normalises them
  against the canvas size at export time. Resizing the browser window between
  tracing and downloading silently corrupts the coordinates. Keep the window
  steady, or make the draft store normalised points.
- **4 of 136 strokes are named.** Feedback falls back to "stroke 2" instead of
  naming the མགོ. Naming is a text-only pass over existing data — no re-tracing.
- **Stroke-order fidelity has not been independently reviewed.** The checks
  verify that the data is internally consistent and gradeable, not that it
  matches Fynn. Only someone who reads uchen can confirm that.
- **`ུ` (zhabs kyu) was traced under ཨ.** In syllables whose base has a long
  descender — ཀུ, གུ, དུ — the mark sits too high. It grades fine; the guide
  looks wrong.
- **The difficulty ladder is not exposed.** `TOLERANCES` and `TraceCanvas`
  support guided / outline / free, but nothing sets the mode, so every learner
  stays on guided.
- `features/section1/` also holds `Section1Consonants`, `LetterLesson`, `RowGrid`
  and `SectionFlow`, superseded by `PracticeView` and unreachable from any route.

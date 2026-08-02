/**
 * Stroke-order authoring tool. Open at #author.
 *
 * Draw each letter in the correct order over the font ghost; every pen-down to
 * pen-up becomes one stroke, and the direction you drew it in is preserved.
 * The Commons reference diagram is shown above the canvas to read the order
 * from — it is a four-frame strip, so it cannot be traced over directly.
 *
 * Output is the JSON the tracing engine consumes. Work is kept in
 * localStorage, so a refresh does not lose it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Download, Eraser, Trash2, Undo2 } from 'lucide-react'
import {
  AUTHOR_TARGETS,
  STROKE_NAMES,
  commonsReference,
  letterBox,
  normalisePoints,
  simplify,
  GHOST_BASELINE_NUDGE,
  GHOST_FIT_PAD,
  GHOST_FONT_RATIO,
  TIBETAN_FONT,
  fitGlyphInto,
  padRect,
  type LetterBox,
  type AuthoredGlyph,
  type AuthoredStroke,
  type Point,
} from '@/lib/stroke-data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'tibetan_stroke_authoring_v1'

/** Pointer capture is noisy; this is in canvas pixels. */
const SIMPLIFY_EPSILON = 1.5

type DraftStroke = { name: string; points: Point[] }
type Draft = Record<string, DraftStroke[]>

export function StrokeAuthor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [targetIndex, setTargetIndex] = useState(0)
  const [draft, setDraft] = useState<Draft>(() => loadDraft())
  const [drawing, setDrawing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [downloaded, setDownloaded] = useState<number | null>(null)
  const [fontReady, setFontReady] = useState(false)

  useEffect(() => {
    let live = true
    document.fonts.ready.then(() => live && setFontReady(true))
    return () => {
      live = false
    }
  }, [])

  // Where the ghost should sit, frozen when the letter is selected: fitting it
  // to strokes as they are drawn would make it crawl around under the pen.
  const draftRef = useRef(draft)
  draftRef.current = draft
  const targetGlyph = AUTHOR_TARGETS[targetIndex].glyph
  const targetHasStrokes = (draft[targetGlyph] ?? []).length > 0
  const ghostFit = useMemo(() => {
    // Recomputed when the letter changes, and when it goes empty so that
    // clearing a letter drops the old fit — otherwise a re-trace would be made
    // over a ghost still positioned by the strokes just deleted. It is
    // deliberately *not* recomputed per stroke, or it would crawl under the pen.
    const existing = draftRef.current[targetGlyph] ?? []
    if (existing.length < 2) return null
    const pts = existing.flatMap((st) => st.points)
    const xs = pts.map((q) => q.x)
    const ys = pts.map((q) => q.y)
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
    // targetHasStrokes is a dependency on purpose: it is what makes clearing a
    // letter drop the stale fit, even though the value itself is unused here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetGlyph, targetHasStrokes])

  const target = AUTHOR_TARGETS[targetIndex]
  const strokes = useMemo(() => draft[target.glyph] ?? [], [draft, target.glyph])
  const reference = commonsReference(target.glyph)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  }, [draft])

  // ── canvas rendering ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, rect.width, rect.height)

    const box = letterBox(rect.width, rect.height)
    drawCalligraphyGrid(ctx, rect.width, box)
    drawGhost(ctx, box, target.glyph, target.base, ghostFit)

    strokes.forEach((stroke, i) => drawStroke(ctx, stroke.points, i + 1))
  }, [target, strokes, ghostFit, fontReady])

  // ── pointer capture ──────────────────────────────────────────────
  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const updateStrokes = useCallback(
    (fn: (prev: DraftStroke[]) => DraftStroke[]) => {
      setDraft((prev) => ({ ...prev, [target.glyph]: fn(prev[target.glyph] ?? []) }))
    },
    [target.glyph],
  )

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrawing(true)
    const p = pointFrom(e)
    updateStrokes((prev) => [...prev, { name: '', points: [p] }])
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return
    const p = pointFrom(e)
    updateStrokes((prev) => {
      if (prev.length === 0) return prev
      const next = [...prev]
      const last = next[next.length - 1]
      next[next.length - 1] = { ...last, points: [...last.points, p] }
      return next
    })
  }

  function handlePointerUp() {
    if (!drawing) return
    setDrawing(false)
    updateStrokes((prev) => {
      if (prev.length === 0) return prev
      const next = [...prev]
      const last = next[next.length - 1]

      // A pen-down that never moved is a stray tap, not a stroke — lifting the
      // pen can emit one at the point where the previous stroke ended, which
      // would otherwise be recorded as a zero-length stroke of its own.
      if (isDegenerate(last.points)) return next.slice(0, -1)

      // Thin the raw capture down to its corners once the stroke is finished.
      next[next.length - 1] = { ...last, points: simplify(last.points, SIMPLIFY_EPSILON) }
      return next
    })
  }

  // ── export ───────────────────────────────────────────────────────
  const exportGlyph = useCallback((): AuthoredGlyph | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()

    const authored: AuthoredStroke[] = strokes.map((s) => ({
      name: s.name,
      points: normalisePoints(s.points, letterBox(rect.width, rect.height)),
    }))

    return {
      glyph: target.glyph,
      codepoint: target.codepoint,
      latin: target.latin,
      strokes: authored,
    }
  }, [strokes, target])

  const exportAll = useCallback((): AuthoredGlyph[] => {
    const canvas = canvasRef.current
    const rect = canvas?.getBoundingClientRect()
    const box = letterBox(rect?.width ?? 1, rect?.height ?? 1)

    return AUTHOR_TARGETS.filter((t) => (draft[t.glyph] ?? []).length > 0).map((t) => ({
      glyph: t.glyph,
      codepoint: t.codepoint,
      latin: t.latin,
      strokes: (draft[t.glyph] ?? []).map((s) => ({
        name: s.name,
        points: normalisePoints(s.points, box),
      })),
    }))
  }, [draft])

  async function handleCopy() {
    const glyph = exportGlyph()
    if (!glyph) return
    await navigator.clipboard.writeText(JSON.stringify(glyph, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleDownloadAll() {
    const glyphs = exportAll()
    const blob = new Blob([JSON.stringify(glyphs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tibetan-strokes.json'

    // The anchor has to be in the document, and the object URL has to outlive
    // the click — revoking it synchronously afterwards cancels the download in
    // some browsers, which is silent and looks exactly like nothing happening.
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 10_000)

    setDownloaded(glyphs.length)
    setTimeout(() => setDownloaded(null), 4000)
  }

  const done = AUTHOR_TARGETS.filter((t) => (draft[t.glyph] ?? []).length > 0).length
  const preview = exportGlyph()

  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-4 h-12">
        <span className="text-sm font-semibold">Stroke authoring</span>
        <Badge variant="secondary" className="text-xs">
          {done} / {AUTHOR_TARGETS.length} authored
        </Badge>
        <div className="flex-1" />
        {downloaded !== null && (
          <span className="text-xs text-green-600 dark:text-green-400">
            Saved {downloaded} letters
          </span>
        )}
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadAll}>
          <Download className="h-3.5 w-3.5" />
          Download all
        </Button>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-[220px_1fr_320px]">
        {/* Letter picker */}
        <aside className="order-2 lg:order-1">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Letters
          </p>
          <div className="grid grid-cols-6 gap-1 lg:grid-cols-5">
            {AUTHOR_TARGETS.map((t, i) => {
              const authored = (draft[t.glyph] ?? []).length > 0
              return (
                <button
                  key={t.codepoint}
                  onClick={() => setTargetIndex(i)}
                  title={t.latin}
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-md border font-tibetan text-lg transition-colors',
                    i === targetIndex
                      ? 'border-primary bg-primary/10 text-primary'
                      : authored
                        ? 'border-green-500/40 bg-green-500/10'
                        : 'border-border hover:bg-accent',
                  )}
                >
                  {t.base ? t.base + t.glyph : t.glyph}
                </button>
              )
            })}
          </div>
        </aside>

        {/* Canvas + reference */}
        <main className="order-1 space-y-3 lg:order-2">
          <div className="flex items-baseline gap-2">
            <span className="font-tibetan text-3xl">
              {target.base ? target.base + target.glyph : target.glyph}
            </span>
            <span className="text-sm text-muted-foreground">
              {target.latin} · U+{target.codepoint}
            </span>
          </div>

          {reference && (
            <figure className="rounded-lg border border-border bg-white p-2">
              <div className={cn(zoomed && 'overflow-x-auto')}>
                <img
                  src={reference}
                  alt={`How to write ${target.latin}`}
                  className={cn(zoomed ? 'h-auto max-w-none' : 'w-full')}
                  style={zoomed ? { width: '260%' } : undefined}
                  loading="lazy"
                />
              </div>
              <figcaption className="mt-1 flex items-start gap-2 text-[11px] text-muted-foreground">
                <span className="flex-1">
                  Reference: Christopher J. Fynn, CC BY-SA 4.0, via Wikimedia Commons. Read the
                  order from the frames — do not trace this strip.
                </span>
                <button
                  onClick={() => setZoomed((z) => !z)}
                  className="shrink-0 font-medium text-foreground underline underline-offset-2"
                >
                  {zoomed ? 'Fit' : 'Zoom captions'}
                </button>
              </figcaption>
            </figure>
          )}

          <canvas
            ref={canvasRef}
            className="aspect-square w-full max-w-md cursor-crosshair touch-none rounded-xl border border-border bg-[oklch(0.98_0.005_85)]"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => updateStrokes((prev) => prev.slice(0, -1))}
              disabled={strokes.length === 0}
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo stroke
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => updateStrokes(() => [])}
              disabled={strokes.length === 0}
            >
              <Eraser className="h-3.5 w-3.5" />
              Clear letter
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleCopy}
              disabled={strokes.length === 0}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy JSON'}
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTargetIndex((i) => Math.max(0, i - 1))}
              disabled={targetIndex === 0}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTargetIndex((i) => Math.min(AUTHOR_TARGETS.length - 1, i + 1))}
              disabled={targetIndex === AUTHOR_TARGETS.length - 1}
            >
              Next
            </Button>
          </div>
        </main>

        {/* Stroke list + JSON */}
        <aside className="order-3 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Strokes ({strokes.length})
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Names are free text — type whatever the reference caption says. Every letter names
            its own strokes, so the suggestions are only the ones that recur. Naming is optional
            and does not affect grading; leave blank and fill in later if unsure.
          </p>

          <datalist id="stroke-names">
            {STROKE_NAMES.map((n) => (
              <option key={n.bo} value={n.bo}>
                {n.latin}
              </option>
            ))}
          </datalist>

          {strokes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Draw the first stroke on the canvas. Each pen-down to pen-up is one stroke, and the
              direction you draw is recorded.
            </p>
          )}

          <ul className="space-y-2">
            {strokes.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {i + 1}
                </span>
                <Input
                  list="stroke-names"
                  value={s.name}
                  placeholder="name — optional"
                  className="h-8 font-tibetan text-sm"
                  onChange={(e) =>
                    updateStrokes((prev) => {
                      const next = [...prev]
                      next[i] = { ...next[i], name: e.target.value }
                      return next
                    })
                  }
                />
                <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  {s.points.length}p
                </span>
                <button
                  onClick={() => updateStrokes((prev) => prev.filter((_, j) => j !== i))}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  title="Delete stroke"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>

          {strokes.length > 0 && (
            <>
              <Separator />
              <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">
                {JSON.stringify(preview, null, 2)}
              </pre>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────── canvas helpers

/** The four-line grid Tibetan letters are proportioned against. */
function drawCalligraphyGrid(ctx: CanvasRenderingContext2D, w: number, box: LetterBox) {
  const lines = [0.18, 0.38, 0.58, 0.86]
  ctx.strokeStyle = 'oklch(0.72 0.14 20 / 0.35)'
  ctx.lineWidth = 1
  for (const y of lines) {
    ctx.beginPath()
    ctx.moveTo(0, box.oy + box.size * y)
    ctx.lineTo(w, box.oy + box.size * y)
    ctx.stroke()
  }
}

type GhostFit = { minX: number; minY: number; maxX: number; maxY: number } | null

function drawGhost(
  ctx: CanvasRenderingContext2D,
  box: LetterBox,
  glyph: string,
  base?: string,
  fit?: GhostFit,
) {
  // A letter that already has strokes gets its ghost fitted to them, so
  // re-tracing lines up even though the font has changed since it was drawn.
  if (fit && !base) {
    ctx.fillStyle = 'rgba(100, 100, 120, 0.18)'
    const target = padRect(
      { x: fit.minX, y: fit.minY, w: fit.maxX - fit.minX, h: fit.maxY - fit.minY },
      GHOST_FIT_PAD,
      box.size,
    )
    if (fitGlyphInto(ctx, glyph, target)) return
  }

  const cx = box.ox + box.size / 2
  const cy = box.oy + box.size / 2 + box.size * GHOST_BASELINE_NUDGE
  ctx.font = `200 ${box.size * GHOST_FONT_RATIO}px ${TIBETAN_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // A vowel sign is traced in the context of its base letter, but only the
  // sign itself is being authored — so the base is drawn fainter.
  if (base) {
    ctx.fillStyle = 'rgba(100, 100, 120, 0.08)'
    ctx.fillText(base, cx, cy)
    ctx.fillStyle = 'rgba(100, 100, 120, 0.22)'
    ctx.fillText(base + glyph, cx, cy)
    return
  }

  ctx.fillStyle = 'rgba(100, 100, 120, 0.18)'
  ctx.fillText(glyph, cx, cy)
}

function drawStroke(ctx: CanvasRenderingContext2D, points: Point[], index: number) {
  if (points.length === 0) return

  ctx.strokeStyle = 'oklch(0.45 0.12 295)'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (points.length > 1) {
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
    ctx.stroke()
  }

  // Start marker, numbered so the order is readable at a glance.
  const start = points[0]
  ctx.fillStyle = 'oklch(0.45 0.12 295)'
  ctx.beginPath()
  ctx.arc(start.x, start.y, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'white'
  ctx.font = '600 11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(index), start.x, start.y)

  // Arrowhead showing the direction it was drawn in.
  if (points.length > 1) {
    const end = points[points.length - 1]
    const prev = points[points.length - 2]
    const angle = Math.atan2(end.y - prev.y, end.x - prev.x)
    ctx.fillStyle = 'oklch(0.45 0.12 295)'
    ctx.beginPath()
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(
      end.x - 10 * Math.cos(angle - Math.PI / 7),
      end.y - 10 * Math.sin(angle - Math.PI / 7),
    )
    ctx.lineTo(
      end.x - 10 * Math.cos(angle + Math.PI / 7),
      end.y - 10 * Math.sin(angle + Math.PI / 7),
    )
    ctx.closePath()
    ctx.fill()
  }
}

/** A tap, or a stroke too short to carry a direction. */
function isDegenerate(points: Point[]): boolean {
  if (points.length < 2) return true
  let length = 0
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return length < 4
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Draft

    // Drafts saved before stray taps were filtered still contain them.
    return Object.fromEntries(
      Object.entries(parsed).map(([glyph, strokes]) => [
        glyph,
        strokes.filter((s) => !isDegenerate(s.points)),
      ]),
    )
  } catch {
    return {}
  }
}

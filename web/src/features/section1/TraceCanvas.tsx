import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Play, RotateCcw, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { checkTraceCoverage, type Point } from './trace-geometry'
import {
  TOLERANCES,
  feedbackFor,
  gradeStroke,
  resample,
  strokesFor,
  type P,
} from '@/lib/stroke-grader'
import {
  GHOST_BASELINE_NUDGE,
  GHOST_FIT_PAD,
  GHOST_FONT_RATIO,
  TIBETAN_FONT,
  fitGlyphInto,
  fromCanvas,
  letterBox,
  padRect,
  strokeBounds,
  toCanvas,
  type LetterBox,
  type Rect,
} from '@/lib/stroke-data'

export type TraceMode = 'guided' | 'outline' | 'free'

/** How long each stroke takes when the order is played back. */
const DEMO_STROKE_MS = 650

/** How long a refused stroke stays on screen before fading. */
const REJECT_SHOW_MS = 1100

type TraceCanvasProps = {
  glyph: string
  onPass: () => void
  /** Guided shows the next stroke and where it starts; free shows nothing. */
  mode?: TraceMode
}

/**
 * Tracing surface.
 *
 * When the glyph has authored stroke data it is graded stroke by stroke, in
 * order, as the learner draws — so writing the right shape in the wrong order
 * or the wrong direction is caught and named. Glyphs that have not been
 * authored yet fall back to the old whole-shape coverage check, which keeps
 * Practice working while the alphabet is being authored.
 */
/** A normalised rect expressed in canvas pixels. */
function rectToCanvas(r: Rect, box: LetterBox): Rect {
  return {
    x: box.ox + r.x * box.size,
    y: box.oy + r.y * box.size,
    w: r.w * box.size,
    h: r.h * box.size,
  }
}

export function TraceCanvas({ glyph, onPass, mode = 'guided' }: TraceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [strokes, setStrokes] = useState<Point[][]>([])
  const [current, setCurrent] = useState<Point[]>([])
  const [drawing, setDrawing] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'retry'; text: string } | null>(null)
  const [legacyFeedback, setLegacyFeedback] = useState<'idle' | 'pass' | 'retry'>('idle')
  const [fontReady, setFontReady] = useState(false)

  // The stroke just refused, kept briefly so the learner can see what they
  // actually drew against the guide. Rejected strokes used to vanish on pen-up
  // with nothing shown, which reads as the app having ignored the attempt.
  const [rejected, setRejected] = useState<Point[] | null>(null)

  // Stroke-order playback: which stroke, and how far along it.
  const [demo, setDemo] = useState<{ i: number; t: number } | null>(null)

  // measureText reports the fallback face until the webfont has loaded, which
  // would fit the ghost to the wrong ink box.
  useEffect(() => {
    let live = true
    document.fonts.ready.then(() => live && setFontReady(true))
    return () => {
      live = false
    }
  }, [])

  const reference = useMemo(() => strokesFor(glyph), [glyph])

  const demoIndex = demo?.i ?? -1
  useEffect(() => {
    if (demoIndex < 0 || !reference) return
    const total = reference.strokes.length
    const started = performance.now()
    let raf = 0

    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / DEMO_STROKE_MS)
      setDemo({ i: demoIndex, t })
      if (t < 1) raf = requestAnimationFrame(tick)
      else if (demoIndex + 1 < total) setDemo({ i: demoIndex + 1, t: 0 })
      else setDemo(null)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [demoIndex, reference])
  const graded = reference !== null && reference.strokes.length > 0
  const tolerance = TOLERANCES[mode]

  // The stroke the learner is expected to draw next.
  const step = strokes.length
  const nextStroke = graded ? (reference.strokes[step] ?? null) : null

  useEffect(() => {
    setStrokes([])
    setCurrent([])
    setMessage(null)
    setLegacyFeedback('idle')
    setRejected(null)
    setDemo(null)
  }, [glyph])

  // ── rendering ────────────────────────────────────────────────────
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

    // The ghost letter, hidden in free mode so it is genuinely from memory.
    if (mode !== 'free') {
      ctx.fillStyle = 'rgba(100, 100, 120, 0.14)'

      // Fit the ghost to the strokes it is meant to sit under, so it lands on
      // the guides whatever face is loaded. Only glyphs with no authored data
      // fall back to positioning by font size.
      const bounds = reference ? strokeBounds(reference.strokes) : null
      const fitted =
        bounds !== null &&
        fitGlyphInto(ctx, glyph, rectToCanvas(padRect(bounds, GHOST_FIT_PAD), box))

      if (!fitted) {
        ctx.font = `200 ${box.size * GHOST_FONT_RATIO}px ${TIBETAN_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          glyph,
          box.ox + box.size / 2,
          box.oy + box.size / 2 + box.size * GHOST_BASELINE_NUDGE,
        )
      }
    }

    // Playback of the whole letter, stroke by stroke, replacing the usual
    // guide while it runs.
    if (demo && reference) {
      ctx.strokeStyle = 'oklch(0.55 0.18 295)'
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      reference.strokes.forEach((stroke, i) => {
        if (i > demo.i) return
        const dense = resample(stroke.points.map(([x, y]) => ({ x, y })), 64)
        const upto = i < demo.i ? 64 : Math.max(2, Math.ceil(demo.t * 64))
        const path = dense.slice(0, upto).map((p) => toCanvas([p.x, p.y], box))
        ctx.beginPath()
        ctx.moveTo(path[0].x, path[0].y)
        for (const p of path.slice(1)) ctx.lineTo(p.x, p.y)
        ctx.stroke()
      })

      return
    }

    // Guided mode draws the path of the stroke that is due next, with a dot
    // where the pen should land — this is the scaffold that comes off later.
    if (mode === 'guided' && nextStroke) {
      const path = nextStroke.points.map((p) => toCanvas(p, box))
      ctx.strokeStyle = 'oklch(0.62 0.16 295 / 0.55)'
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.setLineDash([10, 8])
      ctx.beginPath()
      ctx.moveTo(path[0].x, path[0].y)
      for (const p of path.slice(1)) ctx.lineTo(p.x, p.y)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = 'oklch(0.55 0.18 295)'
      ctx.beginPath()
      ctx.arc(path[0].x, path[0].y, 7, 0, Math.PI * 2)
      ctx.fill()
    }

    // The stroke that was just refused, so the mistake is visible next to the
    // guide rather than simply disappearing.
    if (rejected && rejected.length > 1) {
      ctx.strokeStyle = 'oklch(0.62 0.19 25 / 0.6)'
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(rejected[0].x, rejected[0].y)
      for (const p of rejected.slice(1)) ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }

    // Accepted strokes, then whatever is being drawn right now.
    ctx.strokeStyle = 'oklch(0.45 0.12 295)'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const stroke of [...strokes, current]) {
      if (stroke.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y)
      ctx.stroke()
    }

    // Number each finished stroke at its starting point, so the order the
    // learner built up is readable at a glance — the same cue the authoring
    // tool uses.
    if (graded) {
      strokes.forEach((stroke, i) => {
        if (stroke.length === 0) return
        ctx.fillStyle = 'oklch(0.45 0.12 295)'
        ctx.beginPath()
        ctx.arc(stroke[0].x, stroke[0].y, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'white'
        ctx.font = '600 10px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(i + 1), stroke[0].x, stroke[0].y)
      })
    }
  }, [glyph, strokes, current, mode, nextStroke, reference, fontReady, rejected, demo, graded])

  useEffect(() => {
    if (!rejected) return
    const id = setTimeout(() => setRejected(null), REJECT_SHOW_MS)
    return () => clearTimeout(id)
  }, [rejected])

  // ── pointer capture ──────────────────────────────────────────────
  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    if (demo) return
    setDrawing(true)
    setMessage(null)
    setLegacyFeedback('idle')
    setCurrent([pointFromEvent(e)])
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return
    const p = pointFromEvent(e)
    setCurrent((prev) => [...prev, p])
  }

  /** Grading happens on pen-up, while the correction is still actionable. */
  const finishStroke = useCallback(
    (points: Point[]) => {
      const canvas = canvasRef.current
      if (!canvas) return

      // Without stroke data, strokes just accumulate for the Check button.
      if (!graded || !nextStroke) {
        setStrokes((prev) => [...prev, points])
        return
      }

      const rect = canvas.getBoundingClientRect()
      const box = letterBox(rect.width, rect.height)
      const learner: P[] = points.map((p) => fromCanvas(p, box))
      const verdict = gradeStroke(learner, nextStroke, tolerance)

      if (!verdict.ok) {
        // The stroke is not kept — the canvas only ever accumulates strokes
        // that were correct — but it is shown briefly so the learner can see
        // what they drew against the guide.
        setRejected(points)
        setMessage({ tone: 'retry', text: feedbackFor(verdict.issue!, nextStroke, step + 1) })
        return
      }

      setRejected(null)

      const accepted = [...strokes, points]
      setStrokes(accepted)

      if (accepted.length === reference.strokes.length) {
        setMessage({ tone: 'ok', text: 'Correct — right strokes, right order.' })
        onPass()
      } else {
        const upcoming = reference.strokes[accepted.length]
        setMessage({
          tone: 'ok',
          text: upcoming.name ? `Good — now ${upcoming.name}.` : 'Good — next stroke.',
        })
      }
    },
    [graded, nextStroke, tolerance, strokes, reference, step, onPass],
  )

  function handlePointerUp() {
    if (!drawing) return
    setDrawing(false)
    const points = current
    setCurrent([])
    if (points.length > 0) finishStroke(points)
  }

  function handleClear() {
    setStrokes([])
    setCurrent([])
    setMessage(null)
    setLegacyFeedback('idle')
    setRejected(null)
    setDemo(null)
  }

  /** Step back one stroke, so a slip does not cost the whole letter. */
  function handleUndo() {
    setStrokes((prev) => prev.slice(0, -1))
    setMessage(null)
    setRejected(null)
  }

  function handleDemo() {
    setRejected(null)
    setDemo({ i: 0, t: 0 })
  }

  /** Legacy whole-shape check, for glyphs with no authored strokes yet. */
  function handleLegacyCheck() {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const result = checkTraceCoverage(strokes, rect.width, rect.height)
    if (result.ok) {
      setLegacyFeedback('pass')
      onPass()
    } else {
      setLegacyFeedback('retry')
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      {graded && (
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              {demo
                ? 'Watch the stroke order'
                : `Stroke ${Math.min(step + 1, reference.strokes.length)} of ${reference.strokes.length}`}
            </span>
            {/* One pip per stroke: how far through the letter, at a glance. */}
            <span className="flex items-center gap-1" aria-hidden>
              {reference.strokes.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 w-1.5 rounded-full transition-colors',
                    i < strokes.length
                      ? 'bg-[oklch(0.45_0.12_295)]'
                      : i === strokes.length
                        ? 'bg-[oklch(0.45_0.12_295)]/40'
                        : 'bg-muted-foreground/20',
                  )}
                />
              ))}
            </span>
          </div>
          {nextStroke?.name && !demo && (
            <span className="font-tibetan text-sm text-foreground">{nextStroke.name}</span>
          )}
        </div>
      )}

      <div className="relative flex-1 overflow-hidden rounded-xl bg-[oklch(0.96_0.01_85)]">
        <canvas
          ref={canvasRef}
          className="h-full min-h-52 w-full touch-none cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        {strokes.length === 0 && !drawing && !demo && (
          <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-muted-foreground">
            {graded && mode === 'guided' ? 'Start at the dot ↑' : 'Draw over the guide ↑'}
          </p>
        )}
      </div>

      {message && (
        <p
          className={cn(
            'text-center text-sm',
            message.tone === 'ok'
              ? 'text-[oklch(0.45_0.12_150)]'
              : 'text-muted-foreground',
          )}
        >
          {message.text}
        </p>
      )}

      {!graded && legacyFeedback === 'pass' && (
        <p className="text-center text-sm text-[oklch(0.45_0.12_150)]">
          Nice — geometry match looks good.
        </p>
      )}
      {!graded && legacyFeedback === 'retry' && (
        <p className="text-center text-sm text-muted-foreground">
          Cover more of the letter shape, then check again.
        </p>
      )}

      <div className="flex items-center gap-2">
        {graded && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={handleDemo}
            disabled={demo !== null}
          >
            <Play className="h-3.5 w-3.5" />
            Show me
          </Button>
        )}

        <div className="flex-1" />

        {graded && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleUndo}
            disabled={strokes.length === 0 || demo !== null}
          >
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleClear}
          disabled={strokes.length === 0 && !demo}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear
        </Button>
        {!graded && (
          <Button
            className={cn(
              'bg-[oklch(0.88_0.05_295)] text-[oklch(0.35_0.1_295)] hover:bg-[oklch(0.84_0.06_295)]',
            )}
            onClick={handleLegacyCheck}
            disabled={strokes.length === 0}
          >
            Check
          </Button>
        )}
      </div>
    </div>
  )
}

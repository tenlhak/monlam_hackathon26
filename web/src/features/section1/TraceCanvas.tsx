import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { checkTraceCoverage, type Point } from './trace-geometry'
import {
  TOLERANCES,
  feedbackFor,
  gradeStroke,
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
  }, [glyph, strokes, current, mode, nextStroke, reference, fontReady])

  // ── pointer capture ──────────────────────────────────────────────
  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
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
        // A rejected stroke is discarded, so the canvas always shows only
        // strokes that were actually correct.
        setMessage({ tone: 'retry', text: feedbackFor(verdict.issue!, nextStroke, step + 1) })
        return
      }

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
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Stroke {Math.min(step + 1, reference.strokes.length)} of {reference.strokes.length}
          </span>
          {nextStroke?.name && (
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
        {strokes.length === 0 && !drawing && (
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

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleClear} disabled={strokes.length === 0}>
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

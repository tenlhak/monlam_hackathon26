import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { checkTraceCoverage, type Point } from './trace-geometry'

type TraceCanvasProps = {
  glyph: string
  onPass: () => void
}

export function TraceCanvas({ glyph, onPass }: TraceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [strokes, setStrokes] = useState<Point[][]>([])
  const [drawing, setDrawing] = useState(false)
  const [feedback, setFeedback] = useState<'idle' | 'pass' | 'retry'>('idle')

  useEffect(() => {
    setStrokes([])
    setFeedback('idle')
  }, [glyph])

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

    ctx.fillStyle = 'rgba(100, 100, 120, 0.14)'
    ctx.font = `200 ${Math.min(rect.width, rect.height) * 0.55}px "Noto Serif Tibetan Variable", "Noto Serif Tibetan", serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(glyph, rect.width / 2, rect.height / 2 + 8)

    ctx.strokeStyle = 'oklch(0.45 0.12 295)'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const stroke of strokes) {
      if (stroke.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y)
      }
      ctx.stroke()
    }
  }, [glyph, strokes])

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrawing(true)
    setFeedback('idle')
    const p = pointFromEvent(e)
    setStrokes((prev) => [...prev, [p]])
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return
    const p = pointFromEvent(e)
    setStrokes((prev) => {
      if (prev.length === 0) return prev
      const next = [...prev]
      next[next.length - 1] = [...next[next.length - 1], p]
      return next
    })
  }

  function handlePointerUp() {
    setDrawing(false)
  }

  function handleClear() {
    setStrokes([])
    setFeedback('idle')
  }

  function handleCheck() {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const result = checkTraceCoverage(strokes, rect.width, rect.height)
    if (result.ok) {
      setFeedback('pass')
      onPass()
    } else {
      setFeedback('retry')
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="relative flex-1 overflow-hidden rounded-xl bg-[oklch(0.96_0.01_85)]">
        <canvas
          ref={canvasRef}
          className="h-full min-h-52 w-full touch-none cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-muted-foreground">
          Draw over the guide ↑
        </p>
      </div>

      {feedback === 'pass' && (
        <p className="text-center text-sm text-[oklch(0.45_0.12_150)]">
          Nice — geometry match looks good.
        </p>
      )}
      {feedback === 'retry' && (
        <p className="text-center text-sm text-muted-foreground">
          Cover more of the letter shape, then check again.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleClear}>
          Clear
        </Button>
        <Button
          className={cn(
            'bg-[oklch(0.88_0.05_295)] text-[oklch(0.35_0.1_295)] hover:bg-[oklch(0.84_0.06_295)]',
          )}
          onClick={handleCheck}
          disabled={strokes.length === 0}
        >
          Check
        </Button>
      </div>
    </div>
  )
}

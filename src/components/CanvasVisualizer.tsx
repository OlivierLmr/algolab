import { useRef, useEffect } from 'preact/hooks'
import { currentStep } from '../state.ts'
import { renderStep } from '../renderer/index.ts'

const CANVAS_WIDTH = 600
const CANVAS_HEIGHT = 300

export function CanvasVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const step = currentStep.value

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !step) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_WIDTH * dpr
    canvas.height = CANVAS_HEIGHT * dpr
    canvas.style.width = `${CANVAS_WIDTH}px`
    canvas.style.height = `${CANVAS_HEIGHT}px`

    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    renderStep(ctx, step, CANVAS_WIDTH, CANVAS_HEIGHT)
  })

  return (
    <div class="canvas-container">
      <canvas ref={canvasRef} />
    </div>
  )
}

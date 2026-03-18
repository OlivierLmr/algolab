import { useRef, useEffect } from 'preact/hooks'
import { currentStep, pipelineColorMap } from '../state.ts'
import { renderStep, computeRequiredHeight } from '../renderer/index.ts'

const CANVAS_WIDTH = 600

export function CanvasVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const step = currentStep.value
  const colorMap = pipelineColorMap.value

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !step) return

    const canvasHeight = computeRequiredHeight(step)
    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_WIDTH * dpr
    canvas.height = canvasHeight * dpr
    canvas.style.width = `${CANVAS_WIDTH}px`
    canvas.style.height = `${canvasHeight}px`

    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    renderStep(ctx, step, CANVAS_WIDTH, canvasHeight, colorMap)
  }, [step, colorMap])

  return (
    <div class="canvas-container">
      <canvas ref={canvasRef} />
    </div>
  )
}

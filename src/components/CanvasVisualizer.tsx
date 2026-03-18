import { useRef, useEffect, useCallback } from 'preact/hooks'
import { useSignal } from '@preact/signals'
import { currentStep, pipelineColorMap } from '../state.ts'
import { renderStep, computeRequiredHeight, hitTestStep, drawHoverArrow } from '../renderer/index.ts'
import type { CellHit } from '../renderer/array.ts'

const CANVAS_WIDTH = 600

export function CanvasVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hoveredCell = useSignal<CellHit | null>(null)

  const step = currentStep.value
  const colorMap = pipelineColorMap.value
  const hover = hoveredCell.value

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

    // Draw hover overlay if a cell with iterator metadata is hovered
    if (hover) {
      drawHoverArrow(ctx, step, hover)
    }
  }, [step, colorMap, hover])

  const onMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas || !step) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const hit = hitTestStep(step, x, y)
    if (hit) {
      // Only update if cell has iterator metadata
      const arr = step.arrays.find(a => a.name === hit.arrayName)
      if (arr && hit.cellIndex < arr.values.length && arr.values[hit.cellIndex].arrays.length > 0) {
        const prev = hoveredCell.value
        if (!prev || prev.arrayName !== hit.arrayName || prev.cellIndex !== hit.cellIndex) {
          hoveredCell.value = hit
        }
        return
      }
    }
    if (hoveredCell.value !== null) {
      hoveredCell.value = null
    }
  }, [step])

  const onMouseLeave = useCallback(() => {
    if (hoveredCell.value !== null) {
      hoveredCell.value = null
    }
  }, [])

  return (
    <div class="canvas-container">
      <canvas
        ref={canvasRef}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={hover ? 'cursor: pointer' : undefined}
      />
    </div>
  )
}

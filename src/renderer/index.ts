import type { Step } from '../types.ts'
import { drawArray, ARRAY_Y_START, getArrayHeight } from './array.ts'
import { drawPointers } from './pointers.ts'

export function renderStep(ctx: CanvasRenderingContext2D, step: Step, width: number, height: number): void {
  // Clear
  ctx.clearRect(0, 0, width, height)

  // Track Y positions for pointer drawing
  const arrayYPositions = new Map<string, number>()

  // Leave room at top for pointers
  const pointerSpace = 60
  let yOffset = ARRAY_Y_START + pointerSpace

  for (const array of step.arrays) {
    arrayYPositions.set(array.name, yOffset)
    drawArray(ctx, array, step.highlights, yOffset)
    yOffset += getArrayHeight()
  }

  // Draw pointers above arrays
  drawPointers(ctx, step.pointers, arrayYPositions)

  // Draw description at bottom
  if (step.description) {
    ctx.fillStyle = '#555'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(step.description, width / 2, height - 20)
    ctx.textAlign = 'start'
  }
}

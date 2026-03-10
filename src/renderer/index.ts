import type { Step } from '../types.ts'
import { drawArray, ARRAY_Y_START, getArrayHeight } from './array.ts'
import { drawPointers } from './pointers.ts'
import { drawVariables, getVariablesHeight } from './variables.ts'

const POINTER_SPACE = 60

export function renderStep(ctx: CanvasRenderingContext2D, step: Step, width: number, height: number): void {
  // Clear
  ctx.clearRect(0, 0, width, height)

  // Track Y positions for pointer drawing
  const arrayYPositions = new Map<string, number>()

  let yOffset = ARRAY_Y_START + POINTER_SPACE

  for (const array of step.arrays) {
    arrayYPositions.set(array.name, yOffset)
    drawArray(ctx, array, step.highlights, step.dimRanges, yOffset)
    yOffset += getArrayHeight()
  }

  // Draw pointers above arrays
  drawPointers(ctx, step.pointers, arrayYPositions)

  // Draw non-pointer variables below arrays
  const pointerNames = new Set(step.pointers.map(p => p.name))
  const nonPointerVarCount = Object.keys(step.variables).filter(n => !pointerNames.has(n)).length
  if (nonPointerVarCount > 0) {
    drawVariables(ctx, step.variables, step.varHighlights, pointerNames, yOffset)
    yOffset += getVariablesHeight(nonPointerVarCount)
  }

  // Draw description at bottom
  if (step.description) {
    ctx.fillStyle = '#555'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(step.description, width / 2, height - 20)
    ctx.textAlign = 'start'
  }
}

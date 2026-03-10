import type { Step } from '../types.ts'
import { drawArray, ARRAY_Y_START, getArrayHeight } from './array.ts'
import { drawPointers } from './pointers.ts'
import { drawVariables, getVariablesHeight } from './variables.ts'
import { computeCallStackHeight, drawCallStack } from './callstack.ts'

const POINTER_SPACE = 60
const DESCRIPTION_SPACE = 40
const CALLSTACK_GAP = 16

/** Compute the required canvas height for a given step. */
export function computeRequiredHeight(step: Step): number {
  const pointerNames = new Set(step.pointers.map(p => p.name))

  let y = ARRAY_Y_START + POINTER_SPACE
  y += step.arrays.length * getArrayHeight()

  if (step.callStack && step.callStack.length > 0) {
    // Also collect pointer names from all frames
    for (const frame of step.callStack) {
      for (const p of frame.pointers) pointerNames.add(p.name)
    }
    y += CALLSTACK_GAP
    y += computeCallStackHeight(step.callStack, pointerNames)
  }

  const nonPointerVarCount = Object.keys(step.variables).filter(n => !pointerNames.has(n)).length
  if (nonPointerVarCount > 0) y += getVariablesHeight(nonPointerVarCount)
  if (step.description) y += DESCRIPTION_SPACE
  return y
}

export function renderStep(ctx: CanvasRenderingContext2D, step: Step, width: number, height: number): void {
  // Clear
  ctx.clearRect(0, 0, width, height)

  const hasCallStack = step.callStack && step.callStack.length > 0

  // Collect all pointer names (global + frame) for variable filtering
  const pointerNames = new Set(step.pointers.map(p => p.name))
  if (hasCallStack) {
    for (const frame of step.callStack) {
      for (const p of frame.pointers) pointerNames.add(p.name)
    }
  }

  // Track Y positions for pointer drawing
  const arrayYPositions = new Map<string, number>()

  let yOffset = ARRAY_Y_START + POINTER_SPACE

  // Draw global arrays
  for (const array of step.arrays) {
    arrayYPositions.set(array.name, yOffset)
    drawArray(ctx, array, step.highlights, step.dimRanges, yOffset, 40)
    yOffset += getArrayHeight()
  }

  // Draw pointers above global arrays
  drawPointers(ctx, step.pointers, arrayYPositions)

  // Draw call stack if present
  if (hasCallStack) {
    yOffset += CALLSTACK_GAP
    yOffset = drawCallStack(ctx, step.callStack, 20, yOffset, width - 40, pointerNames)
  }

  // Draw non-pointer global variables below
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

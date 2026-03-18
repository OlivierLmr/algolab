import type { Step, Value } from '../types.ts'
import { drawArray, ARRAY_Y_START, getArrayHeight } from './array.ts'
import { derivePointers, getPointerVarNames, drawPointers } from './pointers.ts'
import { drawVariables, getVariablesHeight } from './variables.ts'
import { computeCallStackHeight, drawCallStack } from './callstack.ts'

const POINTER_SPACE = 60
const CALLSTACK_GAP = 16
const CONTENT_X = 40

/** Layout positions computed once, used by both height calculation and rendering. */
interface StepLayout {
  pointerNames: Set<string>
  arrayYPositions: Map<string, number>
  callStackY: number
  variablesY: number
  totalHeight: number
  hasCallStack: boolean
  nonPointerVarCount: number
}

/** Compute layout positions for all visual elements in a step. */
function computeLayout(step: Step, _width: number): StepLayout {
  // Derive pointer names from variables with iterator metadata + expression pointers
  const pointerNames = getPointerVarNames(step.variables, step.expressionPointers)
  const hasCallStack = step.callStack && step.callStack.length > 0

  if (hasCallStack) {
    for (const frame of step.callStack) {
      const framePointerNames = getPointerVarNames(frame.variables, frame.expressionPointers)
      for (const name of framePointerNames) pointerNames.add(name)
    }
  }

  const arrayYPositions = new Map<string, number>()
  let y = ARRAY_Y_START + POINTER_SPACE

  for (const array of step.arrays) {
    arrayYPositions.set(array.name, y)
    y += getArrayHeight()
  }

  let callStackY = y
  if (hasCallStack) {
    y += CALLSTACK_GAP
    callStackY = y
    y += computeCallStackHeight(step.callStack, pointerNames)
  }

  const nonPointerVarCount = Object.keys(step.variables).filter(n => !pointerNames.has(n)).length
  const variablesY = y
  if (nonPointerVarCount > 0) {
    y += getVariablesHeight(nonPointerVarCount)
  }

  return { pointerNames, arrayYPositions, callStackY, variablesY, totalHeight: y, hasCallStack, nonPointerVarCount }
}

/** Compute the required canvas height for a given step. */
export function computeRequiredHeight(step: Step): number {
  return computeLayout(step, 0).totalHeight
}

/** Render a step to canvas using pre-computed layout positions. */
export function renderStep(
  ctx: CanvasRenderingContext2D,
  step: Step,
  width: number,
  height: number,
  colorMap: Map<string, string>,
): void {
  ctx.clearRect(0, 0, width, height)
  const layout = computeLayout(step, width)

  // Draw global arrays
  for (const array of step.arrays) {
    const y = layout.arrayYPositions.get(array.name)!
    drawArray(ctx, array, step.highlights, step.dimRanges, y, CONTENT_X, step.gaugeArrays)
  }

  // Draw pointers above global arrays: from global vars + frame vars referencing global arrays
  const globalArrayNames = new Set(step.arrays.map(a => a.name))
  const allVarsForGlobal: Record<string, Value> = { ...step.variables }
  const allExprPtrsForGlobal: Record<string, Value> = { ...step.expressionPointers }
  let innermostVarHighlights = step.varHighlights
  if (step.callStack.length > 0) {
    // Include frame variables/expressionPointers that reference global arrays
    for (let fi = 0; fi < step.callStack.length; fi++) {
      const frame = step.callStack[fi]
      for (const [name, val] of Object.entries(frame.variables)) {
        if (val.arrays.some(a => globalArrayNames.has(a)) && !(name in allVarsForGlobal)) {
          allVarsForGlobal[name] = val
        }
      }
      for (const [label, val] of Object.entries(frame.expressionPointers)) {
        if (val.arrays.some(a => globalArrayNames.has(a)) && !(label in allExprPtrsForGlobal)) {
          allExprPtrsForGlobal[label] = val
        }
      }
      if (fi === step.callStack.length - 1) {
        innermostVarHighlights = [...step.varHighlights, ...frame.varHighlights]
      }
    }
  }
  const globalPointers = derivePointers(allVarsForGlobal, allExprPtrsForGlobal, colorMap, innermostVarHighlights)
    .filter(p => globalArrayNames.has(p.arrayName))
  drawPointers(ctx, globalPointers, layout.arrayYPositions)

  // Draw call stack
  if (layout.hasCallStack) {
    drawCallStack(ctx, step.callStack, 20, layout.callStackY, width - 40, layout.pointerNames, colorMap)
  }

  // Draw non-pointer global variables
  if (layout.nonPointerVarCount > 0) {
    drawVariables(ctx, step.variables, step.varHighlights, layout.pointerNames, layout.variablesY)
  }
}

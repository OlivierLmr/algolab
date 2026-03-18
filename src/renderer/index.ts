import type { Step, Value } from '../types.ts'
import { drawArray, ARRAY_Y_START, getArrayHeight, CELL_SIZE, CELL_GAP, hitTestCell } from './array.ts'
import type { CellHit } from './array.ts'
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
  const hasCallStack = step.callStack && step.callStack.length > 0

  // Derive pointer names that are actually shown as global pointer arrows.
  // When inside a call stack, only innermost frame's vars + all expression pointers.
  let pointerNames: Set<string>
  if (hasCallStack) {
    const innermost = step.callStack[step.callStack.length - 1]
    pointerNames = getPointerVarNames(innermost.variables, {
      ...step.expressionPointers,
      ...innermost.expressionPointers,
    })
  } else {
    pointerNames = getPointerVarNames(step.variables, step.expressionPointers)
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

  const nonPointerVarCount = Object.entries(step.variables).filter(([n, v]) => v.arrays.length === 0 && !pointerNames.has(n)).length
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

  // Draw pointers above global arrays
  const globalArrayNames = new Set(step.arrays.map(a => a.name))
  let allVarsForGlobal: Record<string, Value>
  let allExprPtrsForGlobal: Record<string, Value>
  let innermostVarHighlights = step.varHighlights
  if (step.callStack.length > 0) {
    // When inside a function call, only show the innermost frame's iterator vars
    // as global pointers (not the caller's stale iterator vars like pivotIdx).
    // Expression pointers (explicit #: pointer directives) from all scopes are kept.
    const innermost = step.callStack[step.callStack.length - 1]
    allVarsForGlobal = {}
    for (const [name, val] of Object.entries(innermost.variables)) {
      if (val.arrays.some(a => globalArrayNames.has(a))) {
        allVarsForGlobal[name] = val
      }
    }
    allExprPtrsForGlobal = { ...step.expressionPointers }
    for (const [label, val] of Object.entries(innermost.expressionPointers)) {
      if (val.arrays.some(a => globalArrayNames.has(a))) {
        allExprPtrsForGlobal[label] = val
      }
    }
    innermostVarHighlights = [...step.varHighlights, ...innermost.varHighlights]
  } else {
    allVarsForGlobal = { ...step.variables }
    allExprPtrsForGlobal = { ...step.expressionPointers }
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

/** Hit-test a point on the canvas against array cells. Returns cell info if hit. */
export function hitTestStep(step: Step, x: number, y: number): CellHit | null {
  const layout = computeLayout(step, 0)
  const arrays = step.arrays.map(a => ({ name: a.name, length: a.values.length }))
  return hitTestCell(x, y, arrays, layout.arrayYPositions, CONTENT_X)
}

/**
 * Draw a hover arrow from a source cell to the target cell(s) it iterates on.
 * Called as an overlay after renderStep when a cell with iterator metadata is hovered.
 */
export function drawHoverArrow(
  ctx: CanvasRenderingContext2D,
  step: Step,
  hover: CellHit,
): void {
  const sourceArr = step.arrays.find(a => a.name === hover.arrayName)
  if (!sourceArr || hover.cellIndex >= sourceArr.values.length) return
  const cellValue = sourceArr.values[hover.cellIndex]
  if (cellValue.arrays.length === 0) return

  const layout = computeLayout(step, 0)
  const sourceY = layout.arrayYPositions.get(hover.arrayName)
  if (sourceY === undefined) return

  const sourceCenterX = CONTENT_X + hover.cellIndex * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2
  const sourceCenterY = sourceY + CELL_SIZE / 2

  for (const targetArrayName of cellValue.arrays) {
    const targetArr = step.arrays.find(a => a.name === targetArrayName)
    if (!targetArr) continue
    const targetY = layout.arrayYPositions.get(targetArrayName)
    if (targetY === undefined) continue

    const targetIdx = Math.max(0, Math.min(cellValue.num, targetArr.values.length - 1))
    const targetCenterX = CONTENT_X + targetIdx * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2
    const targetCenterY = targetY + CELL_SIZE / 2

    // Highlight the source cell
    ctx.strokeStyle = '#3498db'
    ctx.lineWidth = 3
    ctx.strokeRect(
      CONTENT_X + hover.cellIndex * (CELL_SIZE + CELL_GAP) - 1,
      sourceY - 1,
      CELL_SIZE + 2,
      CELL_SIZE + 2,
    )

    // Highlight the target cell
    ctx.strokeRect(
      CONTENT_X + targetIdx * (CELL_SIZE + CELL_GAP) - 1,
      targetY - 1,
      CELL_SIZE + 2,
      CELL_SIZE + 2,
    )

    // Draw curved arrow from source to target
    ctx.strokeStyle = '#3498db'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 3])
    ctx.beginPath()

    if (hover.arrayName === targetArrayName) {
      // Same array: arc above the cells
      const midX = (sourceCenterX + targetCenterX) / 2
      const arcHeight = Math.min(40, Math.abs(targetCenterX - sourceCenterX) * 0.4 + 15)
      const controlY = sourceY - arcHeight
      ctx.moveTo(sourceCenterX, sourceY)
      ctx.quadraticCurveTo(midX, controlY, targetCenterX, targetY)
    } else {
      // Different arrays: straight line between cell centers
      ctx.moveTo(sourceCenterX, sourceCenterY)
      ctx.lineTo(targetCenterX, targetCenterY)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Arrowhead at target
    const angle = Math.atan2(
      targetCenterY - (hover.arrayName === targetArrayName ? sourceY - 20 : sourceCenterY),
      targetCenterX - sourceCenterX,
    )
    const headLen = 10
    const arrowTipX = hover.arrayName === targetArrayName ? targetCenterX : targetCenterX
    const arrowTipY = hover.arrayName === targetArrayName ? targetY : targetCenterY
    ctx.fillStyle = '#3498db'
    ctx.beginPath()
    ctx.moveTo(arrowTipX, arrowTipY)
    ctx.lineTo(
      arrowTipX - headLen * Math.cos(angle - 0.4),
      arrowTipY - headLen * Math.sin(angle - 0.4),
    )
    ctx.lineTo(
      arrowTipX - headLen * Math.cos(angle + 0.4),
      arrowTipY - headLen * Math.sin(angle + 0.4),
    )
    ctx.closePath()
    ctx.fill()

    // Label showing "→ targetArray[idx]"
    ctx.font = 'bold 11px monospace'
    ctx.fillStyle = '#3498db'
    ctx.textAlign = 'center'
    const labelX = (sourceCenterX + targetCenterX) / 2
    const labelY = hover.arrayName === targetArrayName
      ? sourceY - Math.min(40, Math.abs(targetCenterX - sourceCenterX) * 0.4 + 15) - 4
      : (sourceCenterY + targetCenterY) / 2 - 8
    ctx.fillText(`→ ${targetArrayName}[${cellValue.num}]`, labelX, labelY)
    ctx.textAlign = 'start'
  }
}

import type { Step } from '../types.ts'
import { drawArray, ARRAY_Y_START, getArrayHeight, CELL_SIZE, CELL_GAP, hitTestCell } from './array.ts'
import type { CellHit } from './array.ts'
import { derivePointers, getPointerVarNames, countNonPointerVars, drawPointers } from './pointers.ts'
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
  // When inside a call stack, only innermost frame's vars are considered.
  let pointerNames: Set<string>
  if (hasCallStack) {
    const innermost = step.callStack[step.callStack.length - 1]
    pointerNames = getPointerVarNames(innermost.variables)
  } else {
    pointerNames = getPointerVarNames(step.variables)
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

  const nonPointerVarCount = countNonPointerVars(step.variables, pointerNames)
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
  let allVarsForGlobal: Record<string, import('../types.ts').Value>
  let innermostVarHighlights = step.varHighlights
  if (step.callStack.length > 0) {
    // When inside a function call, only show the innermost frame's iterator vars
    // as global pointers (not the caller's stale iterator vars like pivotIdx).
    // Expression-variables are scoped to their declaring frame and appear there.
    const innermost = step.callStack[step.callStack.length - 1]
    allVarsForGlobal = {}
    for (const [name, val] of Object.entries(innermost.variables)) {
      if (val.arrays.some(a => globalArrayNames.has(a))) {
        allVarsForGlobal[name] = val
      }
    }
    innermostVarHighlights = [...step.varHighlights, ...innermost.varHighlights]
  } else {
    allVarsForGlobal = { ...step.variables }
  }
  const globalPointers = derivePointers(allVarsForGlobal, colorMap, innermostVarHighlights)
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
  // Index label is drawn at y + CELL_SIZE + 14 in array.ts
  const INDEX_LABEL_Y_OFFSET = CELL_SIZE + 14

  for (const targetArrayName of cellValue.arrays) {
    const targetArr = step.arrays.find(a => a.name === targetArrayName)
    if (!targetArr) continue
    const targetY = layout.arrayYPositions.get(targetArrayName)
    if (targetY === undefined) continue

    const targetIdx = Math.max(0, Math.min(cellValue.num, targetArr.values.length - 1))
    const targetCenterX = CONTENT_X + targetIdx * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2
    // Arrow points at the index number below the target cell
    const targetIndexY = targetY + INDEX_LABEL_Y_OFFSET

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

    // Arrow starts from the value (cell center), ends at target index label
    const sourceCenterY = sourceY + CELL_SIZE / 2

    ctx.strokeStyle = '#3498db'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 3])
    ctx.beginPath()

    if (hover.arrayName === targetArrayName) {
      // Same array: arc below the cells to reach the target index label
      const midX = (sourceCenterX + targetCenterX) / 2
      const arcDrop = Math.min(35, Math.abs(targetCenterX - sourceCenterX) * 0.3 + 15)
      const controlY = sourceY + CELL_SIZE + arcDrop
      ctx.moveTo(sourceCenterX, sourceCenterY)
      ctx.quadraticCurveTo(midX, controlY, targetCenterX, targetIndexY)
    } else {
      // Different arrays: line from source cell center to target index label
      ctx.moveTo(sourceCenterX, sourceCenterY)
      ctx.lineTo(targetCenterX, targetIndexY)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Arrowhead at target index label
    const prevX = hover.arrayName === targetArrayName
      ? (sourceCenterX + targetCenterX) / 2
      : sourceCenterX
    const prevY = hover.arrayName === targetArrayName
      ? sourceY + CELL_SIZE + Math.min(35, Math.abs(targetCenterX - sourceCenterX) * 0.3 + 15)
      : sourceCenterY
    const angle = Math.atan2(targetIndexY - prevY, targetCenterX - prevX)
    const headLen = 10
    ctx.fillStyle = '#3498db'
    ctx.beginPath()
    ctx.moveTo(targetCenterX, targetIndexY)
    ctx.lineTo(
      targetCenterX - headLen * Math.cos(angle - 0.4),
      targetIndexY - headLen * Math.sin(angle - 0.4),
    )
    ctx.lineTo(
      targetCenterX - headLen * Math.cos(angle + 0.4),
      targetIndexY - headLen * Math.sin(angle + 0.4),
    )
    ctx.closePath()
    ctx.fill()

    // Label
    ctx.font = 'bold 11px monospace'
    ctx.fillStyle = '#3498db'
    ctx.textAlign = 'center'
    if (hover.arrayName === targetArrayName) {
      const midX = (sourceCenterX + targetCenterX) / 2
      const labelY = sourceY + CELL_SIZE + Math.min(35, Math.abs(targetCenterX - sourceCenterX) * 0.3 + 15) + 14
      ctx.fillText(`→ ${targetArrayName}[${cellValue.num}]`, midX, labelY)
    } else {
      const labelX = (sourceCenterX + targetCenterX) / 2
      const labelY = (sourceCenterY + targetIndexY) / 2 - 6
      ctx.fillText(`→ ${targetArrayName}[${cellValue.num}]`, labelX, labelY)
    }
    ctx.textAlign = 'start'
  }
}

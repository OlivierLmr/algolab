import type { CallFrame } from '../types.ts'
import { drawArray, getArrayHeight } from './array.ts'
import { derivePointers, drawPointers } from './pointers.ts'
import { drawVariables, getVariablesHeight } from './variables.ts'

const INDENT = 16
const HEADER_HEIGHT = 28
const REFS_ROW_HEIGHT = 32
const PADDING_TOP = 8
const PADDING_BOTTOM = 12
const POINTER_SPACE = 60
const ARROW_HEIGHT = 24

/**
 * Compute the height needed for a call stack rendered as nested boxes.
 * The call stack is a flat array (outermost first) that we render as nested.
 */
export function computeCallStackHeight(
  callStack: CallFrame[],
  pointerNames: Set<string>,
): number {
  if (callStack.length === 0) return 0
  return computeFrameHeight(callStack, 0, pointerNames)
}

function computeFrameHeight(
  callStack: CallFrame[],
  index: number,
  pointerNames: Set<string>,
): number {
  const frame = callStack[index]
  let h = HEADER_HEIGHT + PADDING_TOP

  // Array refs row
  if (frame.arrayRefs.length > 0) {
    h += REFS_ROW_HEIGHT
  }

  // Arrays with pointer space above them
  if (frame.arrays.length > 0) {
    h += POINTER_SPACE
    h += frame.arrays.length * getArrayHeight()
  }

  // Variables
  const nonPointerVarCount = Object.keys(frame.variables).filter(n => !pointerNames.has(n)).length
  if (nonPointerVarCount > 0) {
    h += getVariablesHeight(nonPointerVarCount)
  }

  // Child frame (next in the stack)
  if (index + 1 < callStack.length) {
    h += ARROW_HEIGHT
    h += computeFrameHeight(callStack, index + 1, pointerNames)
  }

  h += PADDING_BOTTOM
  return h
}

/**
 * Draw the call stack as nested labeled boxes.
 */
export function drawCallStack(
  ctx: CanvasRenderingContext2D,
  callStack: CallFrame[],
  x: number,
  y: number,
  availableWidth: number,
  pointerNames: Set<string>,
  colorMap: Map<string, string>,
): number {
  if (callStack.length === 0) return y
  return drawFrame(ctx, callStack, 0, x, y, availableWidth, pointerNames, colorMap)
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  callStack: CallFrame[],
  index: number,
  x: number,
  y: number,
  availableWidth: number,
  pointerNames: Set<string>,
  colorMap: Map<string, string>,
): number {
  const frame = callStack[index]
  const totalHeight = computeFrameHeight(callStack, index, pointerNames)
  const isInnermost = index === callStack.length - 1
  const contentAlpha = isInnermost ? 1.0 : 0.35

  // Draw rounded rectangle border
  const boxX = x
  const boxY = y
  const boxW = availableWidth
  const boxH = totalHeight

  ctx.save()
  ctx.strokeStyle = '#bbb'
  ctx.lineWidth = 1.5
  ctx.fillStyle = `rgba(245, 245, 250, ${0.4 + index * 0.1})`
  roundRect(ctx, boxX, boxY, boxW, boxH, 8)
  ctx.fill()
  ctx.stroke()
  ctx.restore()

  // Gray out non-innermost frame content
  ctx.save()
  ctx.globalAlpha = contentAlpha

  // Draw label
  ctx.save()
  ctx.fillStyle = '#555'
  ctx.font = 'bold 13px monospace'
  ctx.fillText(frame.label, boxX + 10, boxY + 18)
  ctx.restore()

  let curY = boxY + HEADER_HEIGHT + PADDING_TOP
  const contentX = boxX + INDENT

  // Draw array ref labels (e.g. src → aux   dst → arr)
  if (frame.arrayRefs.length > 0) {
    ctx.save()
    ctx.font = '11px monospace'
    ctx.fillStyle = '#888'
    const refText = frame.arrayRefs.map(r => `${r.paramName} → ${r.targetName}`).join('   ')
    ctx.fillText(refText, boxX + 10, curY + 13)
    ctx.restore()
    curY += REFS_ROW_HEIGHT
  }

  // Draw arrays (with pointer space)
  if (frame.arrays.length > 0) {
    const arrayYPositions = new Map<string, number>()

    let ay = curY + POINTER_SPACE
    for (const array of frame.arrays) {
      arrayYPositions.set(array.name, ay)
      drawArray(ctx, array, frame.highlights, frame.dimRanges, ay, contentX, frame.gaugeArrays)
      ay += getArrayHeight()
    }

    // Draw pointers for this frame
    const framePointers = derivePointers(frame.variables, colorMap, frame.varHighlights)
    const frameArrayPointers = framePointers.filter(p => frame.arrays.some(a => a.name === p.arrayName))
    drawPointers(ctx, frameArrayPointers, arrayYPositions, contentX)

    curY = ay
  }

  // Draw variables
  const nonPointerVarCount = Object.keys(frame.variables).filter(n => !pointerNames.has(n)).length
  if (nonPointerVarCount > 0) {
    drawVariables(ctx, frame.variables, frame.varHighlights, pointerNames, curY, contentX)
    curY += getVariablesHeight(nonPointerVarCount)
  }

  // Restore full alpha for child frame
  ctx.restore()

  // Draw child frame if any
  if (index + 1 < callStack.length) {
    // Draw down-arrow
    const arrowX = boxX + boxW / 2
    const arrowTopY = curY + 4
    const arrowBottomY = curY + ARROW_HEIGHT - 4

    ctx.save()
    ctx.strokeStyle = '#aaa'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(arrowX, arrowTopY)
    ctx.lineTo(arrowX, arrowBottomY)
    ctx.stroke()

    // Arrow head
    ctx.fillStyle = '#aaa'
    ctx.beginPath()
    ctx.moveTo(arrowX, arrowBottomY)
    ctx.lineTo(arrowX - 4, arrowBottomY - 6)
    ctx.lineTo(arrowX + 4, arrowBottomY - 6)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    curY += ARROW_HEIGHT

    // Recurse into child with more indentation
    drawFrame(ctx, callStack, index + 1, boxX + INDENT, curY, availableWidth - 2 * INDENT, pointerNames, colorMap)
  }

  return boxY + totalHeight
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

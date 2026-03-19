import type { CallFrame, VarHighlight } from '../types.ts'
import type { LayoutNode, FrameData } from './types.ts'
import { layoutArray, arrayGroupHeight } from './array-layout.ts'
import { layoutVariables, variablesRowHeight } from './variables-layout.ts'
import { countNonPointerVars } from '../renderer/pointers.ts'
import {
  FRAME_INDENT, FRAME_HEADER_HEIGHT, FRAME_REFS_ROW_HEIGHT,
  FRAME_PADDING_TOP, FRAME_PADDING_BOTTOM, FRAME_ARROW_HEIGHT,
  POINTER_SPACE,
} from './constants.ts'

/**
 * Compute the total height of a call stack (nested frames).
 */
export function callStackHeight(
  callStack: CallFrame[],
  pointerNames: Set<string>,
): number {
  if (callStack.length === 0) return 0
  return frameHeight(callStack, 0, pointerNames)
}

function frameHeight(
  callStack: CallFrame[],
  index: number,
  pointerNames: Set<string>,
): number {
  const frame = callStack[index]
  let h = FRAME_HEADER_HEIGHT + FRAME_PADDING_TOP

  if (frame.arrayRefs.length > 0) h += FRAME_REFS_ROW_HEIGHT
  if (frame.arrays.length > 0) {
    h += POINTER_SPACE
    h += frame.arrays.length * arrayGroupHeight()
  }

  const nonPointerVarCount = countNonPointerVars(frame.variables, pointerNames)
  if (nonPointerVarCount > 0) h += variablesRowHeight(nonPointerVarCount)

  if (index + 1 < callStack.length) {
    h += FRAME_ARROW_HEIGHT
    h += frameHeight(callStack, index + 1, pointerNames)
  }

  h += FRAME_PADDING_BOTTOM
  return h
}

/**
 * Lay out the call stack as nested frame boxes.
 * Returns array of LayoutNodes (one per frame), with children for contained arrays/variables.
 */
export function layoutCallStack(
  callStack: CallFrame[],
  x: number,
  y: number,
  availableWidth: number,
  pointerNames: Set<string>,
  colorMap: Map<string, string>,
): LayoutNode[] {
  if (callStack.length === 0) return []
  return [layoutFrame(callStack, 0, x, y, availableWidth, pointerNames, colorMap)]
}

function layoutFrame(
  callStack: CallFrame[],
  index: number,
  x: number,
  y: number,
  availableWidth: number,
  pointerNames: Set<string>,
  colorMap: Map<string, string>,
): LayoutNode {
  const frame = callStack[index]
  const totalHeight = frameHeight(callStack, index, pointerNames)
  const isInnermost = index === callStack.length - 1

  const data: FrameData = {
    label: frame.label,
    arrayRefs: frame.arrayRefs,
    isInnermost,
    nestingIndex: index,
  }

  const children: LayoutNode[] = []
  let curY = y + FRAME_HEADER_HEIGHT + FRAME_PADDING_TOP
  const contentX = x + FRAME_INDENT

  // Array ref labels row (if present) — just affects positioning, rendered by component
  if (frame.arrayRefs.length > 0) {
    curY += FRAME_REFS_ROW_HEIGHT
  }

  // Arrays with pointer space
  if (frame.arrays.length > 0) {
    curY += POINTER_SPACE

    for (const array of frame.arrays) {
      const arrayNode = layoutArray(
        array, contentX, curY,
        frame.highlights, frame.dimRanges, frame.gaugeArrays,
      )
      children.push(arrayNode)
      curY += arrayGroupHeight()
    }
  }

  // Variables
  const nonPointerVarCount = countNonPointerVars(frame.variables, pointerNames)
  if (nonPointerVarCount > 0) {
    const varsNode = layoutVariables(
      frame.variables, frame.varHighlights, pointerNames,
      contentX, curY,
    )
    if (varsNode) {
      // Namespace variable node ids within frame
      varsNode.id = `frame:${index}:variables`
      for (const child of varsNode.children ?? []) {
        child.id = `frame:${index}:${child.id}`
      }
      children.push(varsNode)
    }
    curY += variablesRowHeight(nonPointerVarCount)
  }

  // Child frame
  if (index + 1 < callStack.length) {
    curY += FRAME_ARROW_HEIGHT
    const childFrame = layoutFrame(
      callStack, index + 1,
      x + FRAME_INDENT, curY,
      availableWidth - 2 * FRAME_INDENT,
      pointerNames, colorMap,
    )
    children.push(childFrame)
  }

  return {
    id: `frame:${index}`,
    x,
    y,
    width: availableWidth,
    height: totalHeight,
    kind: 'frame',
    data,
    children,
  }
}

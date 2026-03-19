import type { Step, Value } from '../types.ts'
import type { SceneLayout, LayoutNode, LayoutEdge } from './types.ts'
import { layoutArray, arrayGroupHeight } from './array-layout.ts'
import { layoutVariables, variablesRowHeight } from './variables-layout.ts'
import { layoutCallStack, callStackHeight } from './callstack-layout.ts'
import { derivePointers, getPointerVarNames, countNonPointerVars } from '../renderer/pointers.ts'
import {
  CONTENT_X, CONTENT_Y, POINTER_SPACE, CALLSTACK_GAP, ARRAY_GROUP_GAP,
} from './constants.ts'

/**
 * Pure function: compute the full scene layout from a Step and colorMap.
 * No DOM dependencies — trivially testable and memoizable.
 */
export function computeSceneLayout(
  step: Step,
  colorMap: Map<string, string>,
): SceneLayout {
  const hasCallStack = step.callStack.length > 0

  // Determine which variables are shown as global pointers
  let pointerNames: Set<string>
  if (hasCallStack) {
    const innermost = step.callStack[step.callStack.length - 1]
    pointerNames = getPointerVarNames(innermost.variables)
  } else {
    pointerNames = getPointerVarNames(step.variables)
  }

  const nodes: LayoutNode[] = []
  let y = CONTENT_Y + POINTER_SPACE

  // Global arrays
  for (const array of step.arrays) {
    const arrayNode = layoutArray(
      array, CONTENT_X, y,
      step.highlights, step.dimRanges, step.gaugeArrays,
    )
    nodes.push(arrayNode)
    y += arrayGroupHeight() + ARRAY_GROUP_GAP
  }
  // Remove trailing gap
  if (step.arrays.length > 0) y -= ARRAY_GROUP_GAP

  // Call stack
  if (hasCallStack) {
    y += CALLSTACK_GAP
    const frameNodes = layoutCallStack(
      step.callStack, 20, y,
      560, // availableWidth — matches old renderer (width - 40)
      pointerNames, colorMap,
    )
    nodes.push(...frameNodes)
    y += callStackHeight(step.callStack, pointerNames)
  }

  // Global non-pointer variables
  const nonPointerCount = countNonPointerVars(step.variables, pointerNames)
  if (nonPointerCount > 0) {
    const varsNode = layoutVariables(
      step.variables, step.varHighlights, pointerNames,
      CONTENT_X, y,
    )
    if (varsNode) {
      nodes.push(varsNode)
      y += variablesRowHeight(nonPointerCount)
    }
  }

  // Derive pointer edges
  const edges = derivePointerEdges(step, colorMap, pointerNames)

  return {
    nodes,
    edges,
    width: 600,
    height: y,
  }
}

/**
 * Derive pointer arrow edges from iterator variables.
 */
function derivePointerEdges(
  step: Step,
  colorMap: Map<string, string>,
  _pointerNames: Set<string>,
): LayoutEdge[] {
  const globalArrayNames = new Set(step.arrays.map(a => a.name))

  let allVarsForGlobal: Record<string, Value>
  let innermostVarHighlights = step.varHighlights
  if (step.callStack.length > 0) {
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

  const pointers = derivePointers(allVarsForGlobal, colorMap, innermostVarHighlights)
    .filter(p => globalArrayNames.has(p.arrayName))

  return pointers.map(p => ({
    id: `ptr:${p.name}:${p.arrayName}`,
    from: `ptr-origin:${p.name}`,
    to: `cell:${p.arrayName}:${p.index}`,
    label: `${p.name}=${p.index}`,
    style: 'pointer' as const,
    color: p.color,
    highlightType: p.highlight,
  }))
}

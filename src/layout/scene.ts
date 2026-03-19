import type { Step, Value } from '../types.ts'
import type { SceneLayout, LayoutNode, LayoutEdge, FlatElement, FrameData } from './types.ts'
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

  // Flatten tree into a single list of positioned elements
  const flatElements = flattenNodes(nodes)

  return {
    nodes,
    flatElements,
    edges,
    width: 600,
    height: y,
  }
}

/**
 * Flatten the node tree into a single list of leaf elements.
 * Each element carries its own opacity (inherited from frame nesting).
 * This guarantees stable identity for DOM rendering — all elements
 * are rendered as keyed siblings in a flat list, so Preact always
 * preserves DOM nodes across renders, enabling CSS transitions.
 */
function flattenNodes(nodes: LayoutNode[]): FlatElement[] {
  const elements: FlatElement[] = []
  for (const node of nodes) {
    collectElements(node, 1.0, elements)
  }
  return elements
}

function collectElements(
  node: LayoutNode,
  parentOpacity: number,
  out: FlatElement[],
): void {
  if (node.kind === 'frame') {
    const frameData = node.data as FrameData
    const contentOpacity = frameData.isInnermost ? 1.0 : 0.35

    // The frame box itself is always full opacity
    out.push({
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      kind: 'frame',
      data: node.data,
      opacity: parentOpacity,
    })

    // Recurse children with frame's content opacity
    for (const child of node.children ?? []) {
      collectElements(child, contentOpacity, out)
    }
  } else if (node.kind === 'group') {
    // Groups are containers — don't render, just recurse children
    for (const child of node.children ?? []) {
      collectElements(child, parentOpacity, out)
    }
  } else {
    // Leaf elements: cell, array-label, variable
    out.push({
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      kind: node.kind,
      data: node.data,
      opacity: parentOpacity,
    })
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

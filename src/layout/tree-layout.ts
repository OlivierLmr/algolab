import type { TrackedArray, Highlight, DimRange, HeapInfo } from '../types.ts'
import type { LayoutNode, LayoutEdge, TreeNodeData, TreePointerInfo } from './types.ts'
import {
  TREE_NODE_RADIUS, TREE_LEVEL_GAP, TREE_MIN_NODE_GAP,
  TREE_LABEL_HEIGHT,
} from './constants.ts'

/**
 * Layout a binary heap as a tree.
 *
 * Positions nodes level by level. Each level's width is determined by
 * the bottom level (which has the most nodes), and parent nodes are
 * centered over their children.
 *
 * Returns the tree group node, edges for parent-child links, and total height.
 */
export function layoutHeapTree(
  array: TrackedArray,
  heapInfo: HeapInfo,
  x: number,
  y: number,
  highlights: Highlight[],
  dimRanges: DimRange[],
  pointersByIndex?: Map<number, TreePointerInfo[]>,
): { node: LayoutNode; edges: LayoutEdge[]; height: number } {
  const n = array.values.length
  if (n === 0) {
    return {
      node: { id: `heap-tree:${array.name}`, x, y, width: 0, height: 0, kind: 'group', data: { role: 'heap-tree' as const } },
      edges: [],
      height: 0,
    }
  }

  const numLevels = Math.floor(Math.log2(n)) + 1
  const nodeDiameter = TREE_NODE_RADIUS * 2

  // Calculate tree width based on bottom level
  const maxNodesInLevel = Math.pow(2, numLevels - 1)
  const treeWidth = maxNodesInLevel * (nodeDiameter + TREE_MIN_NODE_GAP) - TREE_MIN_NODE_GAP
  const treeHeight = TREE_LABEL_HEIGHT + numLevels * nodeDiameter + (numLevels - 1) * TREE_LEVEL_GAP

  // Build highlight lookup for the array
  const highlightMap = new Map<number, 'compare' | 'swap' | 'sorted' | 'active'>()
  for (const h of highlights) {
    if (h.arrayName === array.name) {
      for (const idx of h.indices) {
        highlightMap.set(idx, h.type)
      }
    }
  }

  // Build dim lookup
  const isDimmed = (idx: number): boolean => {
    return dimRanges.some(d => d.arrayName === array.name && idx >= d.from && idx <= d.to)
  }

  // Check heap property violation at each node
  const isViolated = (idx: number): boolean => {
    const left = 2 * idx + 1
    const right = 2 * idx + 2
    const val = array.values[idx].num
    if (heapInfo.kind === 'max') {
      if (left < n && array.values[left].num > val) return true
      if (right < n && array.values[right].num > val) return true
    } else {
      if (left < n && array.values[left].num < val) return true
      if (right < n && array.values[right].num < val) return true
    }
    return false
  }

  // Position each node
  const positions = new Map<number, { cx: number; cy: number }>()
  const children: LayoutNode[] = []

  // Label
  const labelText = `${array.name} (${heapInfo.kind}-heap)`
  children.push({
    id: `heap-label:${array.name}`,
    x,
    y,
    width: treeWidth,
    height: TREE_LABEL_HEIGHT,
    kind: 'array-label',
    data: { text: labelText },
  })

  const treeStartY = y + TREE_LABEL_HEIGHT

  for (let level = 0; level < numLevels; level++) {
    const levelStart = Math.pow(2, level) - 1
    const levelEnd = Math.min(Math.pow(2, level + 1) - 1, n)
    const nodesInLevel = levelEnd - levelStart
    const levelNodeCount = Math.pow(2, level)

    // Spacing for this level: evenly distribute across tree width
    const spacing = treeWidth / levelNodeCount
    const nodeY = treeStartY + level * (nodeDiameter + TREE_LEVEL_GAP) + TREE_NODE_RADIUS

    for (let i = 0; i < nodesInLevel; i++) {
      const idx = levelStart + i
      const cx = x + spacing * (i + 0.5)
      const cy = nodeY

      positions.set(idx, { cx, cy })

      const violated = isViolated(idx)

      const data: TreeNodeData = {
        arrayName: array.name,
        index: idx,
        value: array.values[idx],
        highlightType: highlightMap.get(idx),
        dimmed: isDimmed(idx),
        violated,
        pointers: pointersByIndex?.get(idx) ?? [],
      }

      children.push({
        id: `tree-node:${array.name}:${idx}`,
        x: cx - TREE_NODE_RADIUS,
        y: cy - TREE_NODE_RADIUS,
        width: nodeDiameter,
        height: nodeDiameter,
        kind: 'tree-node',
        data,
      })
    }
  }

  // Build edges
  const edges: LayoutEdge[] = []
  for (let idx = 0; idx < n; idx++) {
    const left = 2 * idx + 1
    const right = 2 * idx + 2

    if (left < n) {
      // Check if this edge violates the heap property
      const parentVal = array.values[idx].num
      const childVal = array.values[left].num
      const violated = heapInfo.kind === 'max' ? childVal > parentVal : childVal < parentVal
      edges.push({
        id: `tree-edge:${array.name}:${idx}-${left}`,
        from: `tree-node:${array.name}:${idx}`,
        to: `tree-node:${array.name}:${left}`,
        style: 'tree-edge',
        color: violated ? '#e74c3c' : '#666',
      })
    }
    if (right < n) {
      const parentVal = array.values[idx].num
      const childVal = array.values[right].num
      const violated = heapInfo.kind === 'max' ? childVal > parentVal : childVal < parentVal
      edges.push({
        id: `tree-edge:${array.name}:${idx}-${right}`,
        from: `tree-node:${array.name}:${idx}`,
        to: `tree-node:${array.name}:${right}`,
        style: 'tree-edge',
        color: violated ? '#e74c3c' : '#666',
      })
    }
  }

  const groupNode: LayoutNode = {
    id: `heap-tree:${array.name}`,
    x,
    y,
    width: treeWidth,
    height: treeHeight,
    kind: 'group',
    data: { role: 'heap-tree' as const },
    children,
  }

  return { node: groupNode, edges, height: treeHeight }
}

/** Calculate the height of a heap tree for a given array size. */
export function heapTreeHeight(arraySize: number): number {
  if (arraySize === 0) return 0
  const numLevels = Math.floor(Math.log2(arraySize)) + 1
  const nodeDiameter = TREE_NODE_RADIUS * 2
  return TREE_LABEL_HEIGHT + numLevels * nodeDiameter + (numLevels - 1) * TREE_LEVEL_GAP
}

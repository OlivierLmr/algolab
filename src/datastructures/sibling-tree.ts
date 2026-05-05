import type { DataStructure, DSLayout, DSArrow, DSSubstep } from './types.ts'
import type { FlatElement, CellData, LabelData, TreeCircleData } from '../layout/types.ts'
import { CELL_SIZE, CELL_GAP } from '../layout/constants.ts'
import { rectEdgeIntersection } from './layout-utils.ts'

// =============================================================================
// State
// =============================================================================

export interface SiblingNode {
  id: number
  label: string
  parentId: number | null
  firstChildId: number | null
  siblingId: number | null
}

export interface SiblingTreeState {
  nodes: SiblingNode[]
  rootId: number | null
}

// =============================================================================
// Inline parser  ―  Grammar:
//   tree     := node?
//   node     := label ( '(' node ( ',' node )* ')' )?
//   label    := one or more characters not in '(),' and not whitespace
// =============================================================================

export function parseInlineTree(input: string): SiblingTreeState {
  const text = input.trim()
  if (text.length === 0) return { nodes: [], rootId: null }

  const nodes: SiblingNode[] = []
  let pos = 0
  let nextId = 0

  function isLabelChar(c: string): boolean {
    return c !== '(' && c !== ')' && c !== ',' && !/\s/.test(c)
  }

  function skipWs(): void {
    while (pos < text.length && /\s/.test(text[pos])) pos++
  }

  function parseLabel(): string {
    skipWs()
    const start = pos
    while (pos < text.length && isLabelChar(text[pos])) pos++
    if (start === pos) {
      throw new Error(`Expected label at position ${pos}: ...${text.slice(Math.max(0, pos - 5), pos + 5)}`)
    }
    return text.slice(start, pos)
  }

  function parseNode(parentId: number | null): SiblingNode {
    const label = parseLabel()
    const node: SiblingNode = {
      id: nextId++,
      label,
      parentId,
      firstChildId: null,
      siblingId: null,
    }
    nodes.push(node)

    skipWs()
    if (pos < text.length && text[pos] === '(') {
      pos++ // consume '('
      skipWs()
      if (pos < text.length && text[pos] === ')') {
        throw new Error(`Empty children list for node "${label}"`)
      }
      const children: SiblingNode[] = []
      children.push(parseNode(node.id))
      skipWs()
      while (pos < text.length && text[pos] === ',') {
        pos++ // consume ','
        children.push(parseNode(node.id))
        skipWs()
      }
      if (pos >= text.length || text[pos] !== ')') {
        throw new Error(`Expected ')' at position ${pos} after children of "${label}"`)
      }
      pos++ // consume ')'
      // Link children as a sibling chain
      node.firstChildId = children[0].id
      for (let i = 0; i < children.length - 1; i++) {
        children[i].siblingId = children[i + 1].id
      }
    }
    return node
  }

  const root = parseNode(null)
  skipWs()
  if (pos < text.length) {
    throw new Error(`Unexpected trailing input at position ${pos}: "${text.slice(pos)}"`)
  }

  return { nodes, rootId: root.id }
}

// =============================================================================
// Layout
// =============================================================================

const PADDING = 40

// --- Tree (top section) ---
const CIRCLE_DIAMETER = 36
const TREE_HORIZONTAL_GAP = 30   // minimum gap between sibling subtrees
const TREE_VERTICAL_GAP = 40     // gap between tree levels

// --- In-memory section (bottom) ---
const FIELD_LABEL_HEIGHT = 80    // height reserved above the root row for vertical column labels
const NODE_FIELDS = 4            // label | parent | first_child | sibling
const NODE_WIDTH = NODE_FIELDS * CELL_SIZE + (NODE_FIELDS - 1) * CELL_GAP
const SIBLING_BLOCK_GAP = 40     // gap between adjacent node-blocks in the same sibling chain
const ROW_HORIZONTAL_GAP = 60    // gap between independent sibling chains on the same row
const ROW_VERTICAL_GAP = 60      // gap between depth rows in the in-memory section
const TREE_TO_MEMORY_GAP = 30    // gap between abstract tree and the column labels

// --- Helpers ---

function getNode(state: SiblingTreeState, id: number): SiblingNode {
  const node = state.nodes.find(n => n.id === id)
  if (!node) throw new Error(`Node ${id} not found`)
  return node
}

/** Compute tree depths via BFS from root. Returns a map id → depth. */
function nodeDepths(state: SiblingTreeState): Map<number, number> {
  const depth = new Map<number, number>()
  if (state.rootId === null) return depth
  depth.set(state.rootId, 0)
  let frontier = [state.rootId]
  while (frontier.length > 0) {
    const next: number[] = []
    for (const id of frontier) {
      const node = getNode(state, id)
      const d = depth.get(id)!
      let childId = node.firstChildId
      while (childId !== null) {
        depth.set(childId, d + 1)
        next.push(childId)
        childId = getNode(state, childId).siblingId
      }
    }
    frontier = next
  }
  return depth
}

/**
 * Compute abstract-tree positions using a simple subtree-width algorithm.
 * Each leaf has width = CIRCLE_DIAMETER. An internal node has width = sum of
 * children widths + gaps. The node is centered above its children.
 *
 * Returns map id → { x, y } where (x, y) is the circle's TOP-LEFT corner.
 */
function computeTreePositions(state: SiblingTreeState): Map<number, { x: number; y: number; subtreeWidth: number }> {
  const positions = new Map<number, { x: number; y: number; subtreeWidth: number }>()
  if (state.rootId === null) return positions

  // Recursively compute subtree widths
  function subtreeWidth(id: number): number {
    const node = getNode(state, id)
    if (node.firstChildId === null) {
      positions.set(id, { x: 0, y: 0, subtreeWidth: CIRCLE_DIAMETER })
      return CIRCLE_DIAMETER
    }
    let total = 0
    let childCount = 0
    let childId: number | null = node.firstChildId
    while (childId !== null) {
      if (childCount > 0) total += TREE_HORIZONTAL_GAP
      total += subtreeWidth(childId)
      childCount++
      childId = getNode(state, childId).siblingId
    }
    const w = Math.max(CIRCLE_DIAMETER, total)
    positions.set(id, { x: 0, y: 0, subtreeWidth: w })
    return w
  }

  subtreeWidth(state.rootId)

  // Recursively assign x positions, top-down. Each node centered above its
  // children's combined extent.
  function assign(id: number, leftX: number, depth: number): void {
    const info = positions.get(id)!
    const node = getNode(state, id)
    if (node.firstChildId === null) {
      info.x = leftX
      info.y = depth * (CIRCLE_DIAMETER + TREE_VERTICAL_GAP)
      return
    }
    // Place children left-to-right within [leftX, leftX + subtreeWidth]
    let childLeft = leftX
    let firstChildCenterX = 0
    let lastChildCenterX = 0
    let childCount = 0
    let childId: number | null = node.firstChildId
    while (childId !== null) {
      const childInfo = positions.get(childId)!
      assign(childId, childLeft, depth + 1)
      const centerX = childInfo.x + childInfo.subtreeWidth / 2
      if (childCount === 0) firstChildCenterX = centerX
      lastChildCenterX = centerX
      childLeft += childInfo.subtreeWidth + TREE_HORIZONTAL_GAP
      childCount++
      childId = getNode(state, childId).siblingId
    }
    // Center this node above its children's centers
    const centerX = (firstChildCenterX + lastChildCenterX) / 2
    info.x = centerX - CIRCLE_DIAMETER / 2
    info.y = depth * (CIRCLE_DIAMETER + TREE_VERTICAL_GAP)
  }

  assign(state.rootId, 0, 0)
  return positions
}

/** Group node IDs by depth, preserving sibling-chain order within a depth row. */
function nodesByDepth(state: SiblingTreeState): number[][] {
  if (state.rootId === null) return []
  const rows: number[][] = []
  let frontier = [state.rootId]
  while (frontier.length > 0) {
    rows.push(frontier)
    const next: number[] = []
    for (const id of frontier) {
      let childId: number | null = getNode(state, id).firstChildId
      while (childId !== null) {
        next.push(childId)
        childId = getNode(state, childId).siblingId
      }
    }
    frontier = next
  }
  return rows
}

function computeLayout(state: SiblingTreeState): DSLayout {
  const elements: FlatElement[] = []
  const arrows: DSArrow[] = []

  if (state.rootId === null) {
    return { elements, arrows, width: 400, height: 200 }
  }

  // -------------------------------------------------------------------------
  // Top: abstract tree of circles
  // -------------------------------------------------------------------------
  const treePositions = computeTreePositions(state)
  let treeMinX = Infinity
  let treeMaxX = -Infinity
  let treeMaxY = 0
  for (const info of treePositions.values()) {
    treeMinX = Math.min(treeMinX, info.x)
    treeMaxX = Math.max(treeMaxX, info.x + CIRCLE_DIAMETER)
    treeMaxY = Math.max(treeMaxY, info.y + CIRCLE_DIAMETER)
  }
  const treeOffsetX = PADDING - treeMinX
  const treeOffsetY = PADDING

  // Emit circles
  for (const node of state.nodes) {
    const info = treePositions.get(node.id)!
    elements.push({
      id: `tree:${node.id}`,
      x: info.x + treeOffsetX,
      y: info.y + treeOffsetY,
      width: CIRCLE_DIAMETER,
      height: CIRCLE_DIAMETER,
      kind: 'tree-circle',
      data: { label: node.label } as TreeCircleData,
      opacity: 1.0,
    })
  }

  // Emit tree edges (parent → each child) as straight lines, no arrowheads
  for (const node of state.nodes) {
    if (node.firstChildId === null) continue
    const parentInfo = treePositions.get(node.id)!
    const parentCx = parentInfo.x + treeOffsetX + CIRCLE_DIAMETER / 2
    const parentBottomY = parentInfo.y + treeOffsetY + CIRCLE_DIAMETER
    let childId: number | null = node.firstChildId
    while (childId !== null) {
      const childInfo = treePositions.get(childId)!
      const childCx = childInfo.x + treeOffsetX + CIRCLE_DIAMETER / 2
      const childTopY = childInfo.y + treeOffsetY
      arrows.push({
        fromX: parentCx,
        fromY: parentBottomY,
        toX: childCx,
        toY: childTopY,
        style: 'straight',
        noArrowhead: true,
      })
      childId = getNode(state, childId).siblingId
    }
  }

  // -------------------------------------------------------------------------
  // Bottom: in-memory linked-node view
  // -------------------------------------------------------------------------
  const memoryY = treeOffsetY + treeMaxY + TREE_TO_MEMORY_GAP
  const rows = nodesByDepth(state)

  // Position each node-block. Within a row, blocks are placed left-to-right
  // adjacent so the sibling-pointer arrows form a clean horizontal chain.
  // Sibling chains across the same depth are separated by ROW_HORIZONTAL_GAP.
  // Track field-label row position (y for the label heads).
  const nodePositions = new Map<number, { x: number; y: number }>()
  let memoryWidth = 0

  // Field labels are drawn once, above the root row's first block.
  const firstRowY = memoryY + FIELD_LABEL_HEIGHT
  const fieldLabels = ['label', 'parent', 'first_child', 'sibling']

  for (let depth = 0; depth < rows.length; depth++) {
    const ids = rows[depth]
    const rowY = firstRowY + depth * (CELL_SIZE + ROW_VERTICAL_GAP)

    // Place blocks in this row. Sibling-chain runs are kept tight; a gap
    // separates one chain from the next.
    let cursorX = PADDING
    let prevParentId: number | null | undefined = undefined
    for (const id of ids) {
      const node = getNode(state, id)
      if (prevParentId !== undefined && node.parentId !== prevParentId) {
        cursorX += ROW_HORIZONTAL_GAP
      } else if (prevParentId !== undefined) {
        cursorX += SIBLING_BLOCK_GAP
      }
      nodePositions.set(id, { x: cursorX, y: rowY })
      cursorX += NODE_WIDTH
      prevParentId = node.parentId
      memoryWidth = Math.max(memoryWidth, cursorX)
    }
  }

  // Vertical column-header labels above the root's first block.
  const rootPos = nodePositions.get(state.rootId)!
  for (let i = 0; i < fieldLabels.length; i++) {
    elements.push({
      id: `field-label:${fieldLabels[i]}`,
      x: rootPos.x + i * (CELL_SIZE + CELL_GAP),
      y: memoryY,
      width: CELL_SIZE,
      height: FIELD_LABEL_HEIGHT,
      kind: 'array-label',
      data: { text: fieldLabels[i], vertical: true } as LabelData,
      opacity: 1.0,
    })
  }

  // Helpers for cell positions.
  function cellX(nodeId: number, fieldIdx: number): number {
    return nodePositions.get(nodeId)!.x + fieldIdx * (CELL_SIZE + CELL_GAP)
  }
  function cellY(nodeId: number): number {
    return nodePositions.get(nodeId)!.y
  }
  function cellCenter(nodeId: number, fieldIdx: number): { x: number; y: number } {
    return {
      x: cellX(nodeId, fieldIdx) + CELL_SIZE / 2,
      y: cellY(nodeId) + CELL_SIZE / 2,
    }
  }

  // Emit cells for each node.
  for (const node of state.nodes) {
    const x = cellX(node.id, 0)
    const y = cellY(node.id)

    // 0: label (letter)
    elements.push({
      id: `cell:${node.id}:label`,
      x, y,
      width: CELL_SIZE,
      height: CELL_SIZE,
      kind: 'cell',
      data: {
        arrayName: 'tree',
        index: -1,
        value: { num: 0, arrays: [] },
        dimmed: false,
        displayOverride: node.label,
        hoverLabel: 'label',
      } as CellData,
      opacity: 1.0,
    })

    // 1: parent
    elements.push({
      id: `cell:${node.id}:parent`,
      x: cellX(node.id, 1), y,
      width: CELL_SIZE,
      height: CELL_SIZE,
      kind: 'cell',
      data: {
        arrayName: 'tree',
        index: -1,
        value: { num: 0, arrays: [] },
        dimmed: false,
        displayOverride: node.parentId !== null ? '•' : '×',
        hoverLabel: 'parent',
      } as CellData,
      opacity: 1.0,
    })

    // 2: first_child
    elements.push({
      id: `cell:${node.id}:first_child`,
      x: cellX(node.id, 2), y,
      width: CELL_SIZE,
      height: CELL_SIZE,
      kind: 'cell',
      data: {
        arrayName: 'tree',
        index: -1,
        value: { num: 0, arrays: [] },
        dimmed: false,
        displayOverride: node.firstChildId !== null ? '•' : '×',
        hoverLabel: 'first_child',
      } as CellData,
      opacity: 1.0,
    })

    // 3: sibling
    elements.push({
      id: `cell:${node.id}:sibling`,
      x: cellX(node.id, 3), y,
      width: CELL_SIZE,
      height: CELL_SIZE,
      kind: 'cell',
      data: {
        arrayName: 'tree',
        index: -1,
        value: { num: 0, arrays: [] },
        dimmed: false,
        displayOverride: node.siblingId !== null ? '•' : '×',
        hoverLabel: 'sibling',
      } as CellData,
      opacity: 1.0,
    })
  }

  // Emit pointer arrows. Each arrow goes from the source pointer-cell's center
  // to the bottom edge of the target node's label cell.
  function emitArrowToLabelBox(fromX: number, fromY: number, targetId: number, style: 'straight' | 's-curve') {
    const labelX = cellX(targetId, 0)
    const labelY = cellY(targetId)
    const edge = rectEdgeIntersection(fromX, fromY, labelX, labelY, CELL_SIZE, CELL_SIZE)
    arrows.push({
      fromX, fromY,
      toX: edge.x, toY: edge.y,
      style,
    })
  }

  for (const node of state.nodes) {
    // parent pointer (skip root)
    if (node.parentId !== null) {
      const c = cellCenter(node.id, 1)
      emitArrowToLabelBox(c.x, c.y, node.parentId, 's-curve')
    }
    // first_child pointer
    if (node.firstChildId !== null) {
      const c = cellCenter(node.id, 2)
      emitArrowToLabelBox(c.x, c.y, node.firstChildId, 's-curve')
    }
    // sibling pointer — straight (siblings are adjacent on the same row)
    if (node.siblingId !== null) {
      const c = cellCenter(node.id, 3)
      emitArrowToLabelBox(c.x, c.y, node.siblingId, 'straight')
    }
  }

  // Compute final dimensions.
  const totalWidth = Math.max(memoryWidth + PADDING, treeMaxX + treeOffsetX + PADDING, 400)
  const totalHeight = firstRowY + rows.length * (CELL_SIZE + ROW_VERTICAL_GAP) - ROW_VERTICAL_GAP + PADDING

  return {
    elements,
    arrows,
    width: totalWidth,
    height: totalHeight,
  }
}

// =============================================================================
// Operations — none. This DS is a pure visualization of the input.
// =============================================================================

function createInitialState(input: string): SiblingTreeState {
  return parseInlineTree(input)
}

function applyOperation(): DSSubstep<SiblingTreeState>[] {
  throw new Error('sibling-tree has no operations')
}

export const siblingTreeDS: DataStructure<SiblingTreeState> = {
  name: 'tree (sibling-node)',
  defaultInput: 'A(B,C(E),D)',
  operations: [],
  createInitialState,
  applyOperation,
  computeLayout,
}

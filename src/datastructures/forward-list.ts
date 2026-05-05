import type { DataStructure, DSLayout, DSArrow, DSSubstep } from './types.ts'
import type { FlatElement, CellData, LabelData, StructFieldData } from '../layout/types.ts'
import { CELL_SIZE, CELL_GAP, INDEX_LABEL_HEIGHT } from '../layout/constants.ts'

// --- State ---

export interface FLNode {
  id: number
  value: number
  nextId: number | null
}

export interface ForwardListState {
  nodes: FLNode[]
  headId: number | null
  size: number
  nextNodeId: number
  /** Hint for layout: position of the anchor node that a floating node should appear below. */
  floatingAnchorIdx?: number
}

// --- Layout constants ---

const STRUCT_X = 40
const STRUCT_Y = 40
const FIELD_GAP = CELL_GAP
const FIELD_LABEL_HEIGHT = 70
const STRUCT_TO_ARRAY_GAP = 60
/** Width of a single node: value cell + gap + pointer cell */
const NODE_WIDTH = 2 * CELL_SIZE + CELL_GAP
/** Gap between nodes for arrow visibility */
const NODE_GAP = 40

// --- Helpers ---

/**
 * Compute where a line from (fromX, fromY) toward a rectangle's center
 * intersects the rectangle boundary. Used to terminate arrows at box edges.
 */
function rectEdgeIntersection(
  fromX: number, fromY: number,
  rectX: number, rectY: number, rectW: number, rectH: number,
): { x: number; y: number } {
  const cx = rectX + rectW / 2
  const cy = rectY + rectH / 2
  const dx = fromX - cx
  const dy = fromY - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const scaleX = dx !== 0 ? (rectW / 2) / Math.abs(dx) : Infinity
  const scaleY = dy !== 0 ? (rectH / 2) / Math.abs(dy) : Infinity
  const scale = Math.min(scaleX, scaleY)
  return { x: cx + dx * scale, y: cy + dy * scale }
}

/** Get the ordered list of nodes by following the linked list from head. */
function getOrderedNodes(state: ForwardListState): FLNode[] {
  const result: FLNode[] = []
  const visited = new Set<number>()
  let currentId = state.headId
  while (currentId !== null) {
    if (visited.has(currentId)) break // cycle protection
    visited.add(currentId)
    const node = state.nodes.find(n => n.id === currentId)
    if (!node) break
    result.push(node)
    currentId = node.nextId
  }
  return result
}

/** Get floating nodes: those in state.nodes but not reachable from headId. */
function getFloatingNodes(state: ForwardListState): FLNode[] {
  const linkedIds = new Set(getOrderedNodes(state).map(n => n.id))
  return state.nodes.filter(n => !linkedIds.has(n.id))
}

/** Get node at a 0-indexed position by traversal. Returns null if out of bounds. */
function getNodeAtPosition(state: ForwardListState, pos: number): FLNode | null {
  const ordered = getOrderedNodes(state)
  return pos >= 0 && pos < ordered.length ? ordered[pos] : null
}

// --- Operations ---

type Step = DSSubstep<ForwardListState>

function createInitialState(values: number[]): ForwardListState {
  if (values.length === 0) {
    return { nodes: [], headId: null, size: 0, nextNodeId: 0 }
  }

  const nodes: FLNode[] = values.map((val, i) => ({
    id: i,
    value: val,
    nextId: i < values.length - 1 ? i + 1 : null,
  }))

  return {
    nodes,
    headId: 0,
    size: values.length,
    nextNodeId: values.length,
  }
}

function applyOperation(state: ForwardListState, op: string, args: Record<string, number>): Step[] {
  switch (op) {
    case 'push_front': {
      const val = args.val ?? 0
      const newId = state.nextNodeId
      const newNode: FLNode = { id: newId, value: val, nextId: null }

      // Substep 1: Create new node (floating, not linked)
      const step1State: ForwardListState = {
        nodes: [...state.nodes, newNode],
        headId: state.headId,
        size: state.size,
        nextNodeId: state.nextNodeId + 1,
        floatingAnchorIdx: 0, // appears below head position
      }

      // Substep 2: Set new.next = head
      const step2Node: FLNode = { ...newNode, nextId: state.headId }
      const step2State: ForwardListState = {
        nodes: step1State.nodes.map(n => n.id === newId ? step2Node : n),
        headId: state.headId,
        size: state.size,
        nextNodeId: state.nextNodeId + 1,
        floatingAnchorIdx: 0,
      }

      // Substep 3: Set head = new, size++
      const step3State: ForwardListState = {
        nodes: step2State.nodes,
        headId: newId,
        size: state.size + 1,
        nextNodeId: state.nextNodeId + 1,
      }

      return [
        { state: step1State, description: `Create new node with value ${val}` },
        { state: step2State, description: `Set new.next = head` },
        { state: step3State, description: `Set head = new, size = ${state.size + 1}` },
      ]
    }

    case 'pop_front': {
      if (state.headId === null) throw new Error('pop_front on empty forward_list')

      const headNode = state.nodes.find(n => n.id === state.headId)!
      const newHeadId = headNode.nextId

      // Substep 1: Set head = head.next, size--
      const step1State: ForwardListState = {
        nodes: [...state.nodes],
        headId: newHeadId,
        size: state.size - 1,
        nextNodeId: state.nextNodeId,
      }

      // Substep 2: Delete old head node
      const step2State: ForwardListState = {
        nodes: state.nodes.filter(n => n.id !== state.headId),
        headId: newHeadId,
        size: state.size - 1,
        nextNodeId: state.nextNodeId,
      }

      return [
        { state: step1State, description: `Set head = head.next, size = ${state.size - 1}` },
        { state: step2State, description: `Delete old head node` },
      ]
    }

    case 'insert_after': {
      const pos = args.pos ?? 0
      if (pos < 0 || pos >= state.size) {
        throw new Error(`insert_after position ${pos} out of range [0, ${state.size - 1}]`)
      }

      const val = args.val ?? 0
      const targetNode = getNodeAtPosition(state, pos)!
      const newId = state.nextNodeId
      const newNode: FLNode = { id: newId, value: val, nextId: null }

      // Substep 1: Create new node (floating)
      const step1State: ForwardListState = {
        nodes: [...state.nodes, newNode],
        headId: state.headId,
        size: state.size,
        nextNodeId: state.nextNodeId + 1,
        floatingAnchorIdx: pos, // appears below target node
      }

      // Substep 2: Set new.next = target.next
      const step2Node: FLNode = { ...newNode, nextId: targetNode.nextId }
      const step2State: ForwardListState = {
        nodes: step1State.nodes.map(n => n.id === newId ? step2Node : n),
        headId: state.headId,
        size: state.size,
        nextNodeId: state.nextNodeId + 1,
        floatingAnchorIdx: pos,
      }

      // Substep 3: Set target.next = new, size++
      const updatedTarget: FLNode = { ...targetNode, nextId: newId }
      const step3State: ForwardListState = {
        nodes: step2State.nodes.map(n => n.id === targetNode.id ? updatedTarget : n),
        headId: state.headId,
        size: state.size + 1,
        nextNodeId: state.nextNodeId + 1,
      }

      return [
        { state: step1State, description: `Create new node with value ${val}` },
        { state: step2State, description: `Set new.next = target.next` },
        { state: step3State, description: `Set target.next = new, size = ${state.size + 1}` },
      ]
    }

    case 'erase_after': {
      const pos = args.pos ?? 0
      if (pos < 0 || pos >= state.size - 1) {
        throw new Error(`erase_after position ${pos} out of range [0, ${state.size - 2}]`)
      }

      const targetNode = getNodeAtPosition(state, pos)!
      const removedNode = state.nodes.find(n => n.id === targetNode.nextId)!

      // Substep 1: Set target.next = removed.next (bypass), size--
      const updatedTarget: FLNode = { ...targetNode, nextId: removedNode.nextId }
      const step1State: ForwardListState = {
        nodes: state.nodes.map(n => n.id === targetNode.id ? updatedTarget : n),
        headId: state.headId,
        size: state.size - 1,
        nextNodeId: state.nextNodeId,
      }

      // Substep 2: Delete removed node
      const step2State: ForwardListState = {
        nodes: step1State.nodes.filter(n => n.id !== removedNode.id),
        headId: state.headId,
        size: state.size - 1,
        nextNodeId: state.nextNodeId,
      }

      return [
        { state: step1State, description: `Set target.next = removed.next, size = ${state.size - 1}` },
        { state: step2State, description: `Delete removed node` },
      ]
    }

    case 'splice_after': {
      const dstPos = args.dst ?? 0
      const srcPos = args.src ?? 1

      if (dstPos < 0 || dstPos >= state.size) {
        throw new Error(`splice_after dst position ${dstPos} out of range [0, ${state.size - 1}]`)
      }
      if (srcPos < 0 || srcPos >= state.size) {
        throw new Error(`splice_after src position ${srcPos} out of range [0, ${state.size - 1}]`)
      }
      if (dstPos === srcPos) {
        throw new Error(`splice_after: dst and src must be different positions`)
      }

      const ordered = getOrderedNodes(state)
      const targetNode = ordered[dstPos]
      const sourceNode = ordered[srcPos]

      // Find predecessor of source
      let predNode: FLNode | null = null
      if (srcPos === 0) {
        // source is head — predecessor is "head pointer" conceptually
        predNode = null
      } else {
        predNode = ordered[srcPos - 1]
      }

      // Substep 1: Unlink source from its predecessor
      let step1Nodes: FLNode[]
      let step1HeadId: number | null
      if (predNode === null) {
        // Source is head, so head = source.next
        step1Nodes = [...state.nodes]
        step1HeadId = sourceNode.nextId
      } else {
        const updatedPred: FLNode = { ...predNode, nextId: sourceNode.nextId }
        step1Nodes = state.nodes.map(n => n.id === predNode!.id ? updatedPred : n)
        step1HeadId = state.headId
      }
      const step1State: ForwardListState = {
        nodes: step1Nodes,
        headId: step1HeadId,
        size: state.size,
        nextNodeId: state.nextNodeId,
      }

      // Substep 2: Set source.next = target.next
      // Need to get target from step1 state (target might have been modified if it was pred)
      const step1Target = step1Nodes.find(n => n.id === targetNode.id)!
      const updatedSource2: FLNode = { ...sourceNode, nextId: step1Target.nextId }
      const step2Nodes = step1Nodes.map(n => n.id === sourceNode.id ? updatedSource2 : n)
      const step2State: ForwardListState = {
        nodes: step2Nodes,
        headId: step1HeadId,
        size: state.size,
        nextNodeId: state.nextNodeId,
      }

      // Substep 3: Set target.next = source
      const updatedTarget3: FLNode = { ...step1Target, nextId: sourceNode.id }
      const step3Nodes = step2Nodes.map(n => n.id === targetNode.id ? updatedTarget3 : n)
      const step3State: ForwardListState = {
        nodes: step3Nodes,
        headId: step1HeadId,
        size: state.size,
        nextNodeId: state.nextNodeId,
      }

      return [
        { state: step1State, description: `Unlink source node (pos ${srcPos}) from predecessor` },
        { state: step2State, description: `Set source.next = target.next` },
        { state: step3State, description: `Set target.next = source` },
      ]
    }

    default:
      throw new Error(`Unknown operation: ${op}`)
  }
}

// --- Layout ---

function computeLayout(state: ForwardListState): DSLayout {
  const elements: FlatElement[] = []
  const arrows: DSArrow[] = []

  // Struct header: head (pointer) | size (value)
  const fields = [
    { name: 'debut', displayValue: state.headId !== null ? '•' : '∅', isPointer: state.headId !== null },
    { name: 'size', displayValue: String(state.size), isPointer: false },
  ]

  let fieldX = STRUCT_X
  const fieldY = STRUCT_Y
  let headFieldCenterX = 0
  let headFieldBottomY = 0

  for (const field of fields) {
    const data: StructFieldData = {
      name: field.name,
      displayValue: field.displayValue,
      isPointer: field.isPointer,
    }

    elements.push({
      id: `field:${field.name}`,
      x: fieldX,
      y: fieldY,
      width: CELL_SIZE,
      height: FIELD_LABEL_HEIGHT + CELL_SIZE,
      kind: 'struct-field',
      data,
      opacity: 1.0,
    })

    if (field.name === 'debut') {
      headFieldCenterX = fieldX + CELL_SIZE / 2
      headFieldBottomY = fieldY + FIELD_LABEL_HEIGHT + CELL_SIZE / 2 // center of cell (where dot is)
    }

    fieldX += CELL_SIZE + FIELD_GAP
  }

  // Nodes laid out horizontally below struct header
  const nodesY = fieldY + FIELD_LABEL_HEIGHT + CELL_SIZE + STRUCT_TO_ARRAY_GAP
  const orderedNodes = getOrderedNodes(state)
  const floatingNodes = getFloatingNodes(state)

  // Position map: nodeId → { x, y } of the node's value cell
  const nodePositions = new Map<number, { x: number; y: number }>()

  if (orderedNodes.length === 0 && floatingNodes.length === 0) {
    elements.push({
      id: 'label:null',
      x: STRUCT_X,
      y: nodesY,
      width: CELL_SIZE,
      height: 20,
      kind: 'array-label',
      data: { text: '∅' } as LabelData,
      opacity: 1.0,
    })
  }

  // Lay out linked nodes in a row
  for (let i = 0; i < orderedNodes.length; i++) {
    const node = orderedNodes[i]
    const nodeX = STRUCT_X + i * (NODE_WIDTH + NODE_GAP)
    nodePositions.set(node.id, { x: nodeX, y: nodesY })
    emitNodeCells(elements, node, nodeX, nodesY)
  }

  // Lay out floating nodes BELOW the anchor position
  const FLOATING_Y_GAP = 20
  const floatingY = nodesY + CELL_SIZE + FLOATING_Y_GAP

  for (const node of floatingNodes) {
    const anchorIdx = state.floatingAnchorIdx ?? 0
    const clampedAnchor = Math.min(anchorIdx, Math.max(0, orderedNodes.length - 1))
    const nodeX = orderedNodes.length > 0
      ? STRUCT_X + clampedAnchor * (NODE_WIDTH + NODE_GAP)
      : STRUCT_X
    nodePositions.set(node.id, { x: nodeX, y: floatingY })
    emitNodeCells(elements, node, nodeX, floatingY)
  }

  // Arrows: from each node's pointer cell center to next node's bounding box edge
  const allNodes = [...orderedNodes, ...floatingNodes]
  for (const node of allNodes) {
    if (node.nextId === null) continue
    const fromPos = nodePositions.get(node.id)
    const toPos = nodePositions.get(node.nextId)
    if (!fromPos || !toPos) continue

    const ptrCellCenterX = fromPos.x + CELL_SIZE + CELL_GAP + CELL_SIZE / 2
    const ptrCellCenterY = fromPos.y + CELL_SIZE / 2

    // Intersection of line from dot to target node's bounding box
    const edge = rectEdgeIntersection(
      ptrCellCenterX, ptrCellCenterY,
      toPos.x, toPos.y, NODE_WIDTH, CELL_SIZE,
    )

    arrows.push({
      fromX: ptrCellCenterX,
      fromY: ptrCellCenterY,
      toX: edge.x,
      toY: edge.y,
      style: 'straight',
    })
  }

  // Arrow from head field to first linked node's bounding box edge
  if (state.headId !== null && nodePositions.has(state.headId)) {
    const headPos = nodePositions.get(state.headId)!
    const edge = rectEdgeIntersection(
      headFieldCenterX, headFieldBottomY,
      headPos.x, headPos.y, NODE_WIDTH, CELL_SIZE,
    )
    arrows.push({
      fromX: headFieldCenterX,
      fromY: headFieldBottomY,
      toX: edge.x,
      toY: edge.y,
      style: 's-curve',
    })
  }

  // Compute dimensions
  const allNodeCount = orderedNodes.length + floatingNodes.length
  let rightEdge = fieldX
  let bottomY = nodesY + CELL_SIZE
  for (const pos of nodePositions.values()) {
    rightEdge = Math.max(rightEdge, pos.x + NODE_WIDTH)
    bottomY = Math.max(bottomY, pos.y + CELL_SIZE)
  }

  return {
    elements,
    arrows,
    width: Math.max(rightEdge + 40, 300),
    height: bottomY + 40,
  }
}

/** Emit the two cells (value + pointer) for a node at the given position. */
function emitNodeCells(elements: FlatElement[], node: FLNode, x: number, y: number): void {
  // Value cell
  elements.push({
    id: `cell:node:${node.id}:value`,
    x,
    y,
    width: CELL_SIZE,
    height: CELL_SIZE,
    kind: 'cell',
    data: {
      arrayName: 'node',
      index: node.id,
      value: { num: node.value, arrays: [] },
      dimmed: false,
    } as CellData,
    opacity: 1.0,
  })

  // Pointer cell
  elements.push({
    id: `cell:node:${node.id}:ptr`,
    x: x + CELL_SIZE + CELL_GAP,
    y,
    width: CELL_SIZE,
    height: CELL_SIZE,
    kind: 'cell',
    data: {
      arrayName: 'node',
      index: -1,
      value: { num: 0, arrays: [] },
      dimmed: false,
      displayOverride: node.nextId !== null ? '•' : '×',
    } as CellData,
    opacity: 1.0,
  })
}

// --- Exported definition ---

export const forwardListDS: DataStructure<ForwardListState> = {
  name: 'forward_list<T>',
  operations: [
    { name: 'push_front', label: 'push_front(val)', args: [{ name: 'val', label: 'Value', defaultValue: 0 }] },
    { name: 'pop_front', label: 'pop_front()', args: [] },
    { name: 'insert_after', label: 'insert_after(pos, val)', args: [{ name: 'pos', label: 'Position', defaultValue: 0 }, { name: 'val', label: 'Value', defaultValue: 0 }] },
    { name: 'erase_after', label: 'erase_after(pos)', args: [{ name: 'pos', label: 'Position', defaultValue: 0 }] },
    { name: 'splice_after', label: 'splice_after(dst, src)', args: [{ name: 'dst', label: 'Dest pos', defaultValue: 0 }, { name: 'src', label: 'Src pos', defaultValue: 1 }] },
  ],
  createInitialState,
  applyOperation,
  computeLayout,
}

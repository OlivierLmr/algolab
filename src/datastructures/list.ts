import type { DataStructure, DSLayout, DSArrow, DSSubstep } from './types.ts'
import type { FlatElement, CellData, LabelData, StructFieldData } from '../layout/types.ts'
import { CELL_SIZE, CELL_GAP, ARRAY_LABEL_HEIGHT, INDEX_LABEL_HEIGHT } from '../layout/constants.ts'

// --- State ---

export interface DLLNode {
  id: number
  value: number
  nextId: number | null
  prevId: number | null
}

export interface ListState {
  nodes: DLLNode[]
  headId: number | null
  tailId: number | null
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
const NODE_GAP = 50
/** Width of a single triple-cell node: prev + value + next with internal gaps. */
const NODE_WIDTH = 3 * CELL_SIZE + 2 * CELL_GAP

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

function getNode(state: ListState, id: number): DLLNode {
  const node = state.nodes.find(n => n.id === id)
  if (!node) throw new Error(`Node ${id} not found`)
  return node
}

function cloneState(state: ListState): ListState {
  return {
    nodes: state.nodes.map(n => ({ ...n })),
    headId: state.headId,
    tailId: state.tailId,
    size: state.size,
    nextNodeId: state.nextNodeId,
  }
}

/** Return the ordered list of node IDs from head to tail. */
function orderedNodeIds(state: ListState): number[] {
  const ids: number[] = []
  let current = state.headId
  const visited = new Set<number>()
  while (current !== null) {
    if (visited.has(current)) break
    visited.add(current)
    ids.push(current)
    current = getNode(state, current).nextId
  }
  return ids
}

/** Get the node at a 0-based position. */
function getNodeAtPos(state: ListState, pos: number): DLLNode {
  let current = state.headId
  for (let i = 0; i < pos; i++) {
    if (current === null) throw new Error(`Position ${pos} out of range`)
    current = getNode(state, current).nextId
  }
  if (current === null) throw new Error(`Position ${pos} out of range`)
  return getNode(state, current)
}

// --- Operations ---

type Step = DSSubstep<ListState>

function createInitialState(values: number[]): ListState {
  if (values.length === 0) {
    return { nodes: [], headId: null, tailId: null, size: 0, nextNodeId: 0 }
  }

  const nodes: DLLNode[] = values.map((v, i) => ({
    id: i,
    value: v,
    prevId: i > 0 ? i - 1 : null,
    nextId: i < values.length - 1 ? i + 1 : null,
  }))

  return {
    nodes,
    headId: 0,
    tailId: values.length - 1,
    size: values.length,
    nextNodeId: values.length,
  }
}

function pushFront(state: ListState, val: number): Step[] {
  const steps: Step[] = []

  // Step 1: Create new node (floating, prev=null, next=null)
  const s1 = cloneState(state)
  const newNode: DLLNode = {
    id: s1.nextNodeId,
    value: val,
    nextId: null,
    prevId: null,
  }
  s1.nodes.push(newNode)
  s1.nextNodeId++
  s1.floatingAnchorIdx = 0
  steps.push({ state: s1, description: `Create new node with value ${val}` })

  // Step 2: Set new.next = head
  const s2 = cloneState(s1)
  getNode(s2, newNode.id).nextId = s2.headId
  s2.floatingAnchorIdx = 0
  steps.push({ state: s2, description: `Set new.next → head` })

  // Step 3: Set old_head.prev = new (skip if list was empty)
  if (state.headId !== null) {
    const s3 = cloneState(s2)
    getNode(s3, state.headId).prevId = newNode.id
    s3.floatingAnchorIdx = 0
    steps.push({ state: s3, description: `Set old_head.prev → new` })
  }

  // Step 4: Set begin = new, size++
  const sPrev4 = steps[steps.length - 1].state
  const s4 = cloneState(sPrev4)
  s4.headId = newNode.id
  if (s4.tailId === null) {
    s4.tailId = newNode.id
  }
  s4.size++
  delete s4.floatingAnchorIdx
  steps.push({ state: s4, description: `Set begin → new` })

  return steps
}

function pushBack(state: ListState, val: number): Step[] {
  const steps: Step[] = []

  // Step 1: Create new node (floating, prev=null, next=null)
  const s1 = cloneState(state)
  const newNode: DLLNode = {
    id: s1.nextNodeId,
    value: val,
    nextId: null,
    prevId: null,
  }
  s1.nodes.push(newNode)
  s1.nextNodeId++
  s1.floatingAnchorIdx = Math.max(0, state.size - 1)
  steps.push({ state: s1, description: `Create new node with value ${val}` })

  // Step 2: Set new.prev = tail
  const s2 = cloneState(s1)
  getNode(s2, newNode.id).prevId = s2.tailId
  s2.floatingAnchorIdx = Math.max(0, state.size - 1)
  steps.push({ state: s2, description: `Set new.prev → tail` })

  // Step 3: Set old_tail.next = new (skip if list was empty)
  if (state.tailId !== null) {
    const s3 = cloneState(s2)
    getNode(s3, state.tailId).nextId = newNode.id
    s3.floatingAnchorIdx = Math.max(0, state.size - 1)
    steps.push({ state: s3, description: `Set old_tail.next → new` })
  }

  // Step 4: Set end = new, size++
  const sPrev4 = steps[steps.length - 1].state
  const s4 = cloneState(sPrev4)
  s4.tailId = newNode.id
  if (s4.headId === null) {
    s4.headId = newNode.id
  }
  s4.size++
  delete s4.floatingAnchorIdx
  steps.push({ state: s4, description: `Set end → new` })

  return steps
}

function popFront(state: ListState): Step[] {
  if (state.size === 0) throw new Error('pop_front on empty list')
  const steps: Step[] = []

  const oldHeadId = state.headId!
  const oldHead = getNode(state, oldHeadId)

  // Step 1: Set begin = head.next
  const s1 = cloneState(state)
  s1.headId = oldHead.nextId
  if (s1.headId === null) {
    s1.tailId = null
  }
  steps.push({ state: s1, description: `Set begin → head.next` })

  // Step 2: Set new_head.prev = null (skip if list now empty)
  if (s1.headId !== null) {
    const s2 = cloneState(s1)
    getNode(s2, s2.headId!).prevId = null
    steps.push({ state: s2, description: `Set new_head.prev → null` })
  }

  // Step N: Delete old head node, size--
  const sPrev = steps[steps.length - 1].state
  const sDel = cloneState(sPrev)
  sDel.nodes = sDel.nodes.filter(n => n.id !== oldHeadId)
  sDel.size--
  steps.push({ state: sDel, description: `Delete old head node` })

  return steps
}

function popBack(state: ListState): Step[] {
  if (state.size === 0) throw new Error('pop_back on empty list')
  const steps: Step[] = []

  const oldTailId = state.tailId!
  const oldTail = getNode(state, oldTailId)

  // Step 1: Set end = tail.prev
  const s1 = cloneState(state)
  s1.tailId = oldTail.prevId
  if (s1.tailId === null) {
    s1.headId = null
  }
  steps.push({ state: s1, description: `Set end → tail.prev` })

  // Step 2: Set new_tail.next = null (skip if list now empty)
  if (s1.tailId !== null) {
    const s2 = cloneState(s1)
    getNode(s2, s2.tailId!).nextId = null
    steps.push({ state: s2, description: `Set new_tail.next → null` })
  }

  // Step N: Delete old tail node, size--
  const sPrev = steps[steps.length - 1].state
  const sDel = cloneState(sPrev)
  sDel.nodes = sDel.nodes.filter(n => n.id !== oldTailId)
  sDel.size--
  steps.push({ state: sDel, description: `Delete old tail node` })

  return steps
}

function insert(state: ListState, pos: number, val: number): Step[] {
  if (pos < 0 || pos > state.size) throw new Error(`insert position ${pos} out of range [0, ${state.size}]`)

  // Delegate edge cases
  if (pos === 0) return pushFront(state, val)
  if (pos === state.size) return pushBack(state, val)

  const steps: Step[] = []
  const nodeAtPos = getNodeAtPos(state, pos)
  const prevNode = getNodeAtPos(state, pos - 1)

  // Step 1: Create new node (floating)
  const s1 = cloneState(state)
  const newNode: DLLNode = {
    id: s1.nextNodeId,
    value: val,
    nextId: null,
    prevId: null,
  }
  s1.nodes.push(newNode)
  s1.nextNodeId++
  s1.floatingAnchorIdx = pos
  steps.push({ state: s1, description: `Create new node with value ${val}` })

  // Step 2: Set new.prev = node[pos-1]
  const s2 = cloneState(s1)
  getNode(s2, newNode.id).prevId = prevNode.id
  s2.floatingAnchorIdx = pos
  steps.push({ state: s2, description: `Set new.prev → node[${pos - 1}]` })

  // Step 3: Set new.next = node[pos]
  const s3 = cloneState(s2)
  getNode(s3, newNode.id).nextId = nodeAtPos.id
  s3.floatingAnchorIdx = pos
  steps.push({ state: s3, description: `Set new.next → node[${pos}]` })

  // Step 4: Set node[pos-1].next = new
  const s4 = cloneState(s3)
  getNode(s4, prevNode.id).nextId = newNode.id
  steps.push({ state: s4, description: `Set node[${pos - 1}].next → new` })

  // Step 5: Set node[pos].prev = new, size++
  const s5 = cloneState(s4)
  getNode(s5, nodeAtPos.id).prevId = newNode.id
  s5.size++
  steps.push({ state: s5, description: `Set node[${pos}].prev → new` })

  return steps
}

function erase(state: ListState, pos: number): Step[] {
  if (state.size === 0) throw new Error('erase on empty list')
  if (pos < 0 || pos >= state.size) throw new Error(`erase position ${pos} out of range [0, ${state.size - 1}]`)

  // Delegate edge cases
  if (pos === 0) return popFront(state)
  if (pos === state.size - 1) return popBack(state)

  const steps: Step[] = []
  const target = getNodeAtPos(state, pos)

  // Step 1: Set node[pos-1].next = node[pos].next
  const s1 = cloneState(state)
  const t1 = getNode(s1, target.id)
  if (t1.prevId !== null) {
    getNode(s1, t1.prevId).nextId = t1.nextId
  }
  steps.push({ state: s1, description: `Set node[${pos - 1}].next → node[${pos}].next` })

  // Step 2: Set node[pos+1].prev = node[pos].prev
  const s2 = cloneState(s1)
  const t2 = getNode(s2, target.id)
  if (t2.nextId !== null) {
    getNode(s2, t2.nextId).prevId = t2.prevId
  }
  steps.push({ state: s2, description: `Set node[${pos + 1}].prev → node[${pos}].prev` })

  // Step 3: Delete node[pos], size--
  const s3 = cloneState(s2)
  s3.nodes = s3.nodes.filter(n => n.id !== target.id)
  s3.size--
  steps.push({ state: s3, description: `Delete node[${pos}]` })

  return steps
}

function applyOperation(state: ListState, op: string, args: Record<string, number>): Step[] {
  switch (op) {
    case 'push_front':
      return pushFront(state, args.val ?? 0)
    case 'push_back':
      return pushBack(state, args.val ?? 0)
    case 'pop_front':
      return popFront(state)
    case 'pop_back':
      return popBack(state)
    case 'insert':
      return insert(state, args.pos ?? 0, args.val ?? 0)
    case 'erase':
      return erase(state, args.pos ?? 0)
    default:
      throw new Error(`Unknown operation: ${op}`)
  }
}

// --- Layout ---

function computeLayout(state: ListState): DSLayout {
  const elements: FlatElement[] = []
  const arrows: DSArrow[] = []

  // Struct header: size | begin | end
  const fields = [
    { name: 'size', displayValue: String(state.size), isPointer: false },
    { name: 'begin', displayValue: state.headId !== null ? '•' : '∅', isPointer: true },
    { name: 'end', displayValue: state.tailId !== null ? '•' : '∅', isPointer: true },
  ]

  let fieldX = STRUCT_X
  const fieldY = STRUCT_Y
  let beginFieldCenterX = 0
  let beginFieldCenterY = 0
  let endFieldCenterX = 0
  let endFieldCenterY = 0

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

    if (field.name === 'begin') {
      beginFieldCenterX = fieldX + CELL_SIZE / 2
      beginFieldCenterY = fieldY + FIELD_LABEL_HEIGHT + CELL_SIZE / 2
    }
    if (field.name === 'end') {
      endFieldCenterX = fieldX + CELL_SIZE / 2
      endFieldCenterY = fieldY + FIELD_LABEL_HEIGHT + CELL_SIZE / 2
    }

    fieldX += CELL_SIZE + FIELD_GAP
  }

  // Nodes laid out horizontally below struct header
  const nodesY = fieldY + FIELD_LABEL_HEIGHT + CELL_SIZE + STRUCT_TO_ARRAY_GAP
  const nodesX = STRUCT_X

  const orderedIds = orderedNodeIds(state)
  const orderedSet = new Set(orderedIds)
  const floatingIds = state.nodes.filter(n => !orderedSet.has(n.id)).map(n => n.id)

  if (orderedIds.length === 0 && floatingIds.length === 0) {
    // Show empty label
    elements.push({
      id: 'label:empty',
      x: nodesX,
      y: nodesY,
      width: CELL_SIZE,
      height: ARRAY_LABEL_HEIGHT,
      kind: 'array-label',
      data: { text: '∅' } as LabelData,
      opacity: 1.0,
    })

    return {
      elements,
      arrows,
      width: Math.max(fieldX + 40, 400),
      height: nodesY + ARRAY_LABEL_HEIGHT + 40,
    }
  }

  // Position each ordered node (triple cells)
  const nodePositions = new Map<number, { x: number; y: number }>()
  let currentX = nodesX

  for (let i = 0; i < orderedIds.length; i++) {
    const nodeId = orderedIds[i]
    nodePositions.set(nodeId, { x: currentX, y: nodesY })
    emitNodeCells(elements, state, nodeId, currentX, nodesY)
    currentX += NODE_WIDTH + NODE_GAP
  }

  // Position floating nodes BELOW the anchor position
  const FLOATING_Y_GAP = 20
  const floatingY = nodesY + CELL_SIZE + FLOATING_Y_GAP

  for (const nodeId of floatingIds) {
    const anchorIdx = state.floatingAnchorIdx ?? 0
    const clampedAnchor = Math.min(anchorIdx, Math.max(0, orderedIds.length - 1))
    const floatX = orderedIds.length > 0
      ? STRUCT_X + clampedAnchor * (NODE_WIDTH + NODE_GAP)
      : STRUCT_X
    nodePositions.set(nodeId, { x: floatX, y: floatingY })
    emitNodeCells(elements, state, nodeId, floatX, floatingY)
  }

  // Helper: emit an arrow from a dot center to a target node's bounding box edge
  function emitArrow(fromX: number, fromY: number, targetPos: { x: number; y: number }, style: 'straight' | 's-curve' = 'straight') {
    const edge = rectEdgeIntersection(fromX, fromY, targetPos.x, targetPos.y, NODE_WIDTH, CELL_SIZE)
    arrows.push({ fromX, fromY, toX: edge.x, toY: edge.y, style })
  }

  // Bidirectional arrows between consecutive ordered nodes
  const ARROW_OFFSET_Y = 4
  for (let i = 0; i < orderedIds.length - 1; i++) {
    const fromPos = nodePositions.get(orderedIds[i])!
    const toPos = nodePositions.get(orderedIds[i + 1])!

    // Forward: from node[i]'s next-ptr dot → node[i+1]'s box edge
    const nextDotX = fromPos.x + 2 * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2
    const nextDotY = fromPos.y + CELL_SIZE / 2 - ARROW_OFFSET_Y

    // Backward: from node[i+1]'s prev-ptr dot → node[i]'s box edge
    const prevDotX = toPos.x + CELL_SIZE / 2
    const prevDotY = toPos.y + CELL_SIZE / 2 + ARROW_OFFSET_Y

    const fwdEdge = rectEdgeIntersection(nextDotX, nextDotY, toPos.x, toPos.y, NODE_WIDTH, CELL_SIZE)
    const bwdEdge = rectEdgeIntersection(prevDotX, prevDotY, fromPos.x, fromPos.y, NODE_WIDTH, CELL_SIZE)

    arrows.push({ fromX: nextDotX, fromY: nextDotY, toX: fwdEdge.x, toY: fwdEdge.y, style: 'straight' })
    arrows.push({ fromX: prevDotX, fromY: prevDotY, toX: bwdEdge.x, toY: bwdEdge.y, style: 'straight' })
  }

  // Arrows from/to floating nodes
  for (const floatId of floatingIds) {
    const floatNode = getNode(state, floatId)
    const floatPos = nodePositions.get(floatId)!

    if (floatNode.nextId !== null && nodePositions.has(floatNode.nextId)) {
      const targetPos = nodePositions.get(floatNode.nextId)!
      const nextDotX = floatPos.x + 2 * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2
      const nextDotY = floatPos.y + CELL_SIZE / 2
      emitArrow(nextDotX, nextDotY, targetPos)
    }

    if (floatNode.prevId !== null && nodePositions.has(floatNode.prevId)) {
      const targetPos = nodePositions.get(floatNode.prevId)!
      const prevDotX = floatPos.x + CELL_SIZE / 2
      const prevDotY = floatPos.y + CELL_SIZE / 2
      emitArrow(prevDotX, prevDotY, targetPos)
    }
  }

  // Arrows from ordered nodes pointing to floating nodes
  for (const ordId of orderedIds) {
    const ordNode = getNode(state, ordId)
    const ordPos = nodePositions.get(ordId)!

    if (ordNode.nextId !== null && floatingIds.includes(ordNode.nextId) && nodePositions.has(ordNode.nextId)) {
      const targetPos = nodePositions.get(ordNode.nextId)!
      const nextDotX = ordPos.x + 2 * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2
      const nextDotY = ordPos.y + CELL_SIZE / 2
      emitArrow(nextDotX, nextDotY, targetPos)
    }

    if (ordNode.prevId !== null && floatingIds.includes(ordNode.prevId) && nodePositions.has(ordNode.prevId)) {
      const targetPos = nodePositions.get(ordNode.prevId)!
      const prevDotX = ordPos.x + CELL_SIZE / 2
      const prevDotY = ordPos.y + CELL_SIZE / 2
      emitArrow(prevDotX, prevDotY, targetPos)
    }
  }

  // Arrow from begin field to first node's box edge
  if (state.headId !== null && orderedIds.length > 0) {
    const firstPos = nodePositions.get(orderedIds[0])!
    emitArrow(beginFieldCenterX, beginFieldCenterY, firstPos, 's-curve')
  }

  // Arrow from end field to last node's box edge
  if (state.tailId !== null && orderedIds.length > 0) {
    const lastPos = nodePositions.get(orderedIds[orderedIds.length - 1])!
    emitArrow(endFieldCenterX, endFieldCenterY, lastPos, 's-curve')
  }

  // Compute total dimensions
  let rightEdge = fieldX
  let bottomY = nodesY + CELL_SIZE
  for (const pos of nodePositions.values()) {
    rightEdge = Math.max(rightEdge, pos.x + NODE_WIDTH)
    bottomY = Math.max(bottomY, pos.y + CELL_SIZE)
  }

  return {
    elements,
    arrows,
    width: Math.max(rightEdge + 40, 400),
    height: bottomY + 40,
  }
}

/** Emit the three cells (prev, value, next) for a node at the given position. */
function emitNodeCells(
  elements: FlatElement[],
  state: ListState,
  nodeId: number,
  x: number,
  y: number,
): void {
  const node = getNode(state, nodeId)

  // Prev pointer cell
  elements.push({
    id: `cell:node:${nodeId}:prev`,
    x,
    y,
    width: CELL_SIZE,
    height: CELL_SIZE,
    kind: 'cell',
    data: {
      arrayName: 'list',
      index: -1,
      value: { num: node.prevId ?? 0, arrays: [] },
      dimmed: false,
      displayOverride: node.prevId !== null ? '•' : '×',
    } as CellData,
    opacity: 1.0,
  })

  // Value cell
  const valueX = x + CELL_SIZE + CELL_GAP
  elements.push({
    id: `cell:node:${nodeId}:value`,
    x: valueX,
    y,
    width: CELL_SIZE,
    height: CELL_SIZE,
    kind: 'cell',
    data: {
      arrayName: 'list',
      index: -1,
      value: { num: node.value, arrays: [] },
      dimmed: false,
    } as CellData,
    opacity: 1.0,
  })

  // Next pointer cell
  const nextX = x + 2 * (CELL_SIZE + CELL_GAP)
  elements.push({
    id: `cell:node:${nodeId}:next`,
    x: nextX,
    y,
    width: CELL_SIZE,
    height: CELL_SIZE,
    kind: 'cell',
    data: {
      arrayName: 'list',
      index: -1,
      value: { num: node.nextId ?? 0, arrays: [] },
      dimmed: false,
      displayOverride: node.nextId !== null ? '•' : '×',
    } as CellData,
    opacity: 1.0,
  })
}

// --- Exported definition ---

export const listDS: DataStructure<ListState> = {
  name: 'list<T>',
  operations: [
    { name: 'push_front', label: 'push_front(val)', args: [{ name: 'val', label: 'Value', defaultValue: 0 }] },
    { name: 'push_back', label: 'push_back(val)', args: [{ name: 'val', label: 'Value', defaultValue: 0 }] },
    { name: 'pop_front', label: 'pop_front()', args: [] },
    { name: 'pop_back', label: 'pop_back()', args: [] },
    { name: 'insert', label: 'insert(pos, val)', args: [{ name: 'pos', label: 'Position', defaultValue: 0 }, { name: 'val', label: 'Value', defaultValue: 0 }] },
    { name: 'erase', label: 'erase(pos)', args: [{ name: 'pos', label: 'Position', defaultValue: 0 }] },
  ],
  createInitialState,
  applyOperation,
  computeLayout,
}

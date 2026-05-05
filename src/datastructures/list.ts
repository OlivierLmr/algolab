import type { DataStructure, DSLayout, DSArrow, DSSubstep } from './types.ts'
import type { FlatElement, CellData, LabelData, StructFieldData } from '../layout/types.ts'
import { CELL_SIZE, CELL_GAP, ARRAY_LABEL_HEIGHT, INDEX_LABEL_HEIGHT, DIMMED_OPACITY } from '../layout/constants.ts'

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
}

// --- Layout constants ---

const STRUCT_X = 40
const STRUCT_Y = 40
const FIELD_GAP = CELL_GAP
const FIELD_LABEL_HEIGHT = 70
const STRUCT_TO_ARRAY_GAP = 60
const NODE_GAP = 40 // Wider gap to fit bidirectional arrows

// --- Helpers ---

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
  while (current !== null) {
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

  // Step 1: Create new node
  const s1 = cloneState(state)
  const newNode: DLLNode = {
    id: s1.nextNodeId,
    value: val,
    nextId: null,
    prevId: null,
  }
  s1.nodes.push(newNode)
  s1.nextNodeId++
  steps.push({ state: s1, description: `Create new node with value ${val}` })

  // Step 2: Link new node to current head
  const s2 = cloneState(s1)
  const n2 = getNode(s2, newNode.id)
  n2.nextId = s2.headId
  if (s2.headId !== null) {
    getNode(s2, s2.headId).prevId = newNode.id
  }
  steps.push({ state: s2, description: `Link: new.next → head${s2.headId !== null ? `, head.prev → new` : ''}` })

  // Step 3: Update head (and tail if list was empty)
  const s3 = cloneState(s2)
  s3.headId = newNode.id
  if (s3.tailId === null) {
    s3.tailId = newNode.id
  }
  s3.size++
  steps.push({ state: s3, description: `Update head → new node, size = ${s3.size}` })

  return steps
}

function pushBack(state: ListState, val: number): Step[] {
  const steps: Step[] = []

  // Step 1: Create new node
  const s1 = cloneState(state)
  const newNode: DLLNode = {
    id: s1.nextNodeId,
    value: val,
    nextId: null,
    prevId: null,
  }
  s1.nodes.push(newNode)
  s1.nextNodeId++
  steps.push({ state: s1, description: `Create new node with value ${val}` })

  // Step 2: Link new node to current tail
  const s2 = cloneState(s1)
  const n2 = getNode(s2, newNode.id)
  n2.prevId = s2.tailId
  if (s2.tailId !== null) {
    getNode(s2, s2.tailId).nextId = newNode.id
  }
  steps.push({ state: s2, description: `Link: new.prev → tail${s2.tailId !== null ? `, tail.next → new` : ''}` })

  // Step 3: Update tail (and head if list was empty)
  const s3 = cloneState(s2)
  s3.tailId = newNode.id
  if (s3.headId === null) {
    s3.headId = newNode.id
  }
  s3.size++
  steps.push({ state: s3, description: `Update tail → new node, size = ${s3.size}` })

  return steps
}

function popFront(state: ListState): Step[] {
  if (state.size === 0) throw new Error('pop_front on empty list')
  const steps: Step[] = []

  const oldHeadId = state.headId!

  // Step 1: Update head to head.next, clear new head's prev
  const s1 = cloneState(state)
  const oldHead = getNode(s1, oldHeadId)
  s1.headId = oldHead.nextId
  if (s1.headId !== null) {
    getNode(s1, s1.headId).prevId = null
  } else {
    s1.tailId = null
  }
  steps.push({ state: s1, description: `Update head → head.next${s1.headId !== null ? `, clear new head.prev` : ', list now empty'}` })

  // Step 2: Delete old head, decrement size
  const s2 = cloneState(s1)
  s2.nodes = s2.nodes.filter(n => n.id !== oldHeadId)
  s2.size--
  steps.push({ state: s2, description: `Delete old head node, size = ${s2.size}` })

  return steps
}

function popBack(state: ListState): Step[] {
  if (state.size === 0) throw new Error('pop_back on empty list')
  const steps: Step[] = []

  const oldTailId = state.tailId!

  // Step 1: Update tail to tail.prev, clear new tail's next
  const s1 = cloneState(state)
  const oldTail = getNode(s1, oldTailId)
  s1.tailId = oldTail.prevId
  if (s1.tailId !== null) {
    getNode(s1, s1.tailId).nextId = null
  } else {
    s1.headId = null
  }
  steps.push({ state: s1, description: `Update tail → tail.prev${s1.tailId !== null ? `, clear new tail.next` : ', list now empty'}` })

  // Step 2: Delete old tail, decrement size
  const s2 = cloneState(s1)
  s2.nodes = s2.nodes.filter(n => n.id !== oldTailId)
  s2.size--
  steps.push({ state: s2, description: `Delete old tail node, size = ${s2.size}` })

  return steps
}

function insert(state: ListState, pos: number, val: number): Step[] {
  if (pos < 0 || pos > state.size) throw new Error(`insert position ${pos} out of range [0, ${state.size}]`)

  // Delegate edge cases to push_front/push_back
  if (pos === 0) return pushFront(state, val)
  if (pos === state.size) return pushBack(state, val)

  const steps: Step[] = []
  const nodeAtPos = getNodeAtPos(state, pos)
  const prevNode = getNodeAtPos(state, pos - 1)

  // Step 1: Create new node
  const s1 = cloneState(state)
  const newNode: DLLNode = {
    id: s1.nextNodeId,
    value: val,
    nextId: null,
    prevId: null,
  }
  s1.nodes.push(newNode)
  s1.nextNodeId++
  steps.push({ state: s1, description: `Create new node with value ${val}` })

  // Step 2: Link new node's prev and next
  const s2 = cloneState(s1)
  const n2 = getNode(s2, newNode.id)
  n2.prevId = prevNode.id
  n2.nextId = nodeAtPos.id
  steps.push({ state: s2, description: `Link: new.prev → node[${pos - 1}], new.next → node[${pos}]` })

  // Step 3: Update neighbors to point to new node
  const s3 = cloneState(s2)
  getNode(s3, prevNode.id).nextId = newNode.id
  getNode(s3, nodeAtPos.id).prevId = newNode.id
  s3.size++
  steps.push({ state: s3, description: `Link: node[${pos - 1}].next → new, node[${pos}].prev → new, size = ${s3.size}` })

  return steps
}

function erase(state: ListState, pos: number): Step[] {
  if (state.size === 0) throw new Error('erase on empty list')
  if (pos < 0 || pos >= state.size) throw new Error(`erase position ${pos} out of range [0, ${state.size - 1}]`)

  // Delegate edge cases to pop_front/pop_back
  if (pos === 0) return popFront(state)
  if (pos === state.size - 1) return popBack(state)

  const steps: Step[] = []
  const target = getNodeAtPos(state, pos)

  // Step 1: Unlink from neighbors
  const s1 = cloneState(state)
  const t1 = getNode(s1, target.id)
  if (t1.prevId !== null) {
    getNode(s1, t1.prevId).nextId = t1.nextId
  }
  if (t1.nextId !== null) {
    getNode(s1, t1.nextId).prevId = t1.prevId
  }
  steps.push({ state: s1, description: `Unlink node[${pos}] from neighbors` })

  // Step 2: Delete node, decrement size
  const s2 = cloneState(s1)
  s2.nodes = s2.nodes.filter(n => n.id !== target.id)
  s2.size--
  steps.push({ state: s2, description: `Delete node[${pos}], size = ${s2.size}` })

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

  // Struct header: head | tail | size
  const fields = [
    { name: 'head', displayValue: state.headId !== null ? `→${state.headId}` : '∅', isPointer: true },
    { name: 'tail', displayValue: state.tailId !== null ? `→${state.tailId}` : '∅', isPointer: true },
    { name: 'size', displayValue: String(state.size), isPointer: false },
  ]

  let fieldX = STRUCT_X
  const fieldY = STRUCT_Y
  let headFieldCenterX = 0
  let headFieldCenterY = 0
  let tailFieldCenterX = 0
  let tailFieldCenterY = 0

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

    if (field.name === 'head') {
      headFieldCenterX = fieldX + CELL_SIZE / 2
      headFieldCenterY = fieldY + FIELD_LABEL_HEIGHT + CELL_SIZE / 2
    }
    if (field.name === 'tail') {
      tailFieldCenterX = fieldX + CELL_SIZE / 2
      tailFieldCenterY = fieldY + FIELD_LABEL_HEIGHT + CELL_SIZE / 2
    }

    fieldX += CELL_SIZE + FIELD_GAP
  }

  // Nodes laid out horizontally below struct header
  const nodesY = fieldY + FIELD_LABEL_HEIGHT + CELL_SIZE + STRUCT_TO_ARRAY_GAP
  const nodesX = STRUCT_X

  const nodeIds = orderedNodeIds(state)

  if (nodeIds.length === 0) {
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

  // Position each node
  const nodePositions = new Map<number, { x: number; y: number }>()
  for (let i = 0; i < nodeIds.length; i++) {
    const nodeId = nodeIds[i]
    const node = getNode(state, nodeId)
    const cellX = nodesX + i * (CELL_SIZE + NODE_GAP)
    const cellY = nodesY

    nodePositions.set(nodeId, { x: cellX, y: cellY })

    const cellData: CellData = {
      arrayName: 'list',
      index: i,
      value: { num: node.value, arrays: [] },
      dimmed: false,
    }

    elements.push({
      id: `cell:node:${nodeId}`,
      x: cellX,
      y: cellY,
      width: CELL_SIZE,
      height: CELL_SIZE,
      kind: 'cell',
      data: cellData,
      opacity: 1.0,
    })
  }

  // Bidirectional arrows between consecutive nodes
  const ARROW_OFFSET_Y = 4
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const fromPos = nodePositions.get(nodeIds[i])!
    const toPos = nodePositions.get(nodeIds[i + 1])!
    const cellCenterY = nodesY + CELL_SIZE / 2

    // Next arrow: left node → right node (top)
    arrows.push({
      fromX: fromPos.x + CELL_SIZE,
      fromY: cellCenterY - ARROW_OFFSET_Y,
      toX: toPos.x,
      toY: cellCenterY - ARROW_OFFSET_Y,
      style: 'straight',
    })

    // Prev arrow: right node → left node (bottom)
    arrows.push({
      fromX: toPos.x,
      fromY: cellCenterY + ARROW_OFFSET_Y,
      toX: fromPos.x + CELL_SIZE,
      toY: cellCenterY + ARROW_OFFSET_Y,
      style: 'straight',
    })
  }

  // S-curve arrow from head field to first node
  const firstNodePos = nodePositions.get(nodeIds[0])!
  arrows.push({
    fromX: headFieldCenterX,
    fromY: headFieldCenterY,
    toX: firstNodePos.x + CELL_SIZE / 2,
    toY: firstNodePos.y,
    style: 's-curve',
  })

  // S-curve arrow from tail field to last node
  const lastNodePos = nodePositions.get(nodeIds[nodeIds.length - 1])!
  arrows.push({
    fromX: tailFieldCenterX,
    fromY: tailFieldCenterY,
    toX: lastNodePos.x + CELL_SIZE / 2,
    toY: lastNodePos.y,
    style: 's-curve',
  })

  // Compute total dimensions
  const lastCellRight = nodesX + nodeIds.length * (CELL_SIZE + NODE_GAP) - NODE_GAP
  const bottomY = nodesY + CELL_SIZE + INDEX_LABEL_HEIGHT

  return {
    elements,
    arrows,
    width: Math.max(lastCellRight + 40, 400),
    height: bottomY + 40,
  }
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

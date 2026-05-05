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
}

// --- Layout constants ---

const STRUCT_X = 40
const STRUCT_Y = 40
const FIELD_GAP = CELL_GAP
const FIELD_LABEL_HEIGHT = 70
const STRUCT_TO_ARRAY_GAP = 60
const NODE_GAP = 30  // Larger gap between nodes for arrow visibility

// --- Helpers ---

/** Get the ordered list of nodes by following the linked list from head. */
function getOrderedNodes(state: ForwardListState): FLNode[] {
  const result: FLNode[] = []
  let currentId = state.headId
  while (currentId !== null) {
    const node = state.nodes.find(n => n.id === currentId)
    if (!node) break
    result.push(node)
    currentId = node.nextId
  }
  return result
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

      // Substep 1: Create new node (not yet linked)
      const step1Nodes = [...state.nodes, newNode]
      const step1State: ForwardListState = {
        nodes: step1Nodes,
        headId: state.headId,
        size: state.size,
        nextNodeId: state.nextNodeId + 1,
      }

      // Substep 2: Link new node as head
      const linkedNode: FLNode = { ...newNode, nextId: state.headId }
      const step2Nodes = step1Nodes.map(n => n.id === newId ? linkedNode : n)
      const step2State: ForwardListState = {
        nodes: step2Nodes,
        headId: newId,
        size: state.size + 1,
        nextNodeId: state.nextNodeId + 1,
      }

      return [
        { state: step1State, description: `Create new node with value ${val}` },
        { state: step2State, description: `Set new.next = head, update head, size = ${state.size + 1}` },
      ]
    }

    case 'pop_front': {
      if (state.headId === null) throw new Error('pop_front on empty forward_list')

      const headNode = state.nodes.find(n => n.id === state.headId)!
      const newHeadId = headNode.nextId

      // Substep 1: Update head pointer
      const step1State: ForwardListState = {
        nodes: [...state.nodes],
        headId: newHeadId,
        size: state.size - 1,
        nextNodeId: state.nextNodeId,
      }

      // Substep 2: Delete old head node
      const step2Nodes = state.nodes.filter(n => n.id !== state.headId)
      const step2State: ForwardListState = {
        nodes: step2Nodes,
        headId: newHeadId,
        size: state.size - 1,
        nextNodeId: state.nextNodeId,
      }

      return [
        { state: step1State, description: `Update head = head.next, size = ${state.size - 1}` },
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

      // Substep 1: Create new node
      const step1Nodes = [...state.nodes, newNode]
      const step1State: ForwardListState = {
        nodes: step1Nodes,
        headId: state.headId,
        size: state.size,
        nextNodeId: state.nextNodeId + 1,
      }

      // Substep 2: Link new node after target
      const linkedNode: FLNode = { ...newNode, nextId: targetNode.nextId }
      const updatedTarget: FLNode = { ...targetNode, nextId: newId }
      const step2Nodes = step1Nodes.map(n => {
        if (n.id === newId) return linkedNode
        if (n.id === targetNode.id) return updatedTarget
        return n
      })
      const step2State: ForwardListState = {
        nodes: step2Nodes,
        headId: state.headId,
        size: state.size + 1,
        nextNodeId: state.nextNodeId + 1,
      }

      return [
        { state: step1State, description: `Create new node with value ${val}` },
        { state: step2State, description: `Link new node after position ${pos}, size = ${state.size + 1}` },
      ]
    }

    case 'erase_after': {
      const pos = args.pos ?? 0
      if (pos < 0 || pos >= state.size - 1) {
        throw new Error(`erase_after position ${pos} out of range [0, ${state.size - 2}]`)
      }

      const targetNode = getNodeAtPosition(state, pos)!
      const removedNode = state.nodes.find(n => n.id === targetNode.nextId)!

      // Substep 1: Unlink the node after target
      const updatedTarget: FLNode = { ...targetNode, nextId: removedNode.nextId }
      const step1Nodes = state.nodes.map(n => n.id === targetNode.id ? updatedTarget : n)
      const step1State: ForwardListState = {
        nodes: step1Nodes,
        headId: state.headId,
        size: state.size - 1,
        nextNodeId: state.nextNodeId,
      }

      // Substep 2: Delete the removed node
      const step2Nodes = step1Nodes.filter(n => n.id !== removedNode.id)
      const step2State: ForwardListState = {
        nodes: step2Nodes,
        headId: state.headId,
        size: state.size - 1,
        nextNodeId: state.nextNodeId,
      }

      return [
        { state: step1State, description: `Unlink node after position ${pos}, size = ${state.size - 1}` },
        { state: step2State, description: `Delete removed node` },
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
    { name: 'head', displayValue: state.headId !== null ? '•' : '∅', isPointer: state.headId !== null },
    { name: 'size', displayValue: String(state.size), isPointer: false },
  ]

  let fieldX = STRUCT_X
  const fieldY = STRUCT_Y
  let headFieldCenterX = 0
  let headFieldCenterY = 0

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

    fieldX += CELL_SIZE + FIELD_GAP
  }

  // Nodes laid out horizontally below struct header
  const nodesY = fieldY + FIELD_LABEL_HEIGHT + CELL_SIZE + STRUCT_TO_ARRAY_GAP
  const orderedNodes = getOrderedNodes(state)

  if (orderedNodes.length === 0 && state.headId === null) {
    // Show null label
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

  for (let i = 0; i < orderedNodes.length; i++) {
    const node = orderedNodes[i]
    const nodeX = STRUCT_X + i * (CELL_SIZE + NODE_GAP)

    const cellData: CellData = {
      arrayName: 'node',
      index: node.id,
      value: { num: node.value, arrays: [] },
      dimmed: false,
    }

    elements.push({
      id: `cell:node:${node.id}`,
      x: nodeX,
      y: nodesY,
      width: CELL_SIZE,
      height: CELL_SIZE,
      kind: 'cell',
      data: cellData,
      opacity: 1.0,
    })

    // Straight arrow to next node
    if (node.nextId !== null) {
      const nextIndex = orderedNodes.findIndex(n => n.id === node.nextId)
      if (nextIndex >= 0) {
        const nextX = STRUCT_X + nextIndex * (CELL_SIZE + NODE_GAP)
        arrows.push({
          fromX: nodeX + CELL_SIZE,
          fromY: nodesY + CELL_SIZE / 2,
          toX: nextX,
          toY: nodesY + CELL_SIZE / 2,
          style: 'straight',
        })
      }
    }
  }

  // S-curve arrow from head field to first node
  if (state.headId !== null && orderedNodes.length > 0) {
    const firstNodeX = STRUCT_X
    arrows.push({
      fromX: headFieldCenterX,
      fromY: headFieldCenterY,
      toX: firstNodeX + CELL_SIZE / 2,
      toY: nodesY,
      style: 's-curve',
    })
  }

  // Compute dimensions
  const lastNodeRight = orderedNodes.length > 0
    ? STRUCT_X + orderedNodes.length * (CELL_SIZE + NODE_GAP) - NODE_GAP
    : fieldX
  const bottomY = orderedNodes.length > 0
    ? nodesY + CELL_SIZE + INDEX_LABEL_HEIGHT
    : nodesY + CELL_SIZE

  return {
    elements,
    arrows,
    width: Math.max(lastNodeRight + 40, 300),
    height: bottomY + 40,
  }
}

// --- Exported definition ---

export const forwardListDS: DataStructure<ForwardListState> = {
  name: 'forward_list<T>',
  operations: [
    { name: 'push_front', label: 'push_front(val)', args: [{ name: 'val', label: 'Value', defaultValue: 0 }] },
    { name: 'pop_front', label: 'pop_front()', args: [] },
    { name: 'insert_after', label: 'insert_after(pos, val)', args: [{ name: 'pos', label: 'Position', defaultValue: 0 }, { name: 'val', label: 'Value', defaultValue: 0 }] },
    { name: 'erase_after', label: 'erase_after(pos)', args: [{ name: 'pos', label: 'Position', defaultValue: 0 }] },
  ],
  createInitialState,
  applyOperation,
  computeLayout,
}

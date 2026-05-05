import type { DataStructure, DSLayout, DSArrow, DSSubstep } from './types.ts'
import type { FlatElement, CellData, LabelData, StructFieldData } from '../layout/types.ts'
import { CELL_SIZE, CELL_GAP } from '../layout/constants.ts'
import { rectEdgeIntersection } from './layout-utils.ts'

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
  /** Hint for layout: node IDs to render in the floating row regardless of linkage. */
  floatingNodeIds?: number[]
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

      // Step 1: Create new node (floating, not linked)
      const s1: ForwardListState = {
        nodes: [...state.nodes, newNode],
        headId: state.headId,
        size: state.size,
        nextNodeId: state.nextNodeId + 1,
        floatingAnchorIdx: 0,
      }

      // Step 2: Set new.next = head
      const s2: ForwardListState = {
        nodes: s1.nodes.map(n => n.id === newId ? { ...n, nextId: state.headId } : n),
        headId: state.headId,
        size: state.size,
        nextNodeId: state.nextNodeId + 1,
        floatingAnchorIdx: 0,
      }

      // Step 3: Set head = new, size++
      const s3: ForwardListState = {
        nodes: s2.nodes,
        headId: newId,
        size: state.size + 1,
        nextNodeId: state.nextNodeId + 1,
      }

      return [
        { state: s1, description: `Create new node with value ${val}` },
        { state: s2, description: `Set new.next = head` },
        { state: s3, description: `Set head = new` },
      ]
    }

    case 'pop_front': {
      if (state.headId === null) throw new Error('pop_front on empty forward_list')

      const headNode = state.nodes.find(n => n.id === state.headId)!
      const newHeadId = headNode.nextId

      // Step 1: Set head = head.next
      const s1: ForwardListState = {
        nodes: [...state.nodes],
        headId: newHeadId,
        size: state.size,
        nextNodeId: state.nextNodeId,
      }

      // Step 2: Delete old head node, size--
      const s2: ForwardListState = {
        nodes: s1.nodes.filter(n => n.id !== state.headId),
        headId: newHeadId,
        size: state.size - 1,
        nextNodeId: state.nextNodeId,
      }

      return [
        { state: s1, description: `Set head = head.next` },
        { state: s2, description: `Delete old head node` },
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

      // Step 1: Create new node (floating)
      const s1: ForwardListState = {
        nodes: [...state.nodes, newNode],
        headId: state.headId,
        size: state.size,
        nextNodeId: state.nextNodeId + 1,
        floatingAnchorIdx: pos,
      }

      // Step 2: Set new.next = target.next
      const s2: ForwardListState = {
        nodes: s1.nodes.map(n => n.id === newId ? { ...n, nextId: targetNode.nextId } : n),
        headId: state.headId,
        size: state.size,
        nextNodeId: state.nextNodeId + 1,
        floatingAnchorIdx: pos,
      }

      // Step 3: Set target.next = new, size++
      const s3: ForwardListState = {
        nodes: s2.nodes.map(n => n.id === targetNode.id ? { ...n, nextId: newId } : n),
        headId: state.headId,
        size: state.size + 1,
        nextNodeId: state.nextNodeId + 1,
      }

      return [
        { state: s1, description: `Create new node with value ${val}` },
        { state: s2, description: `Set new.next = target.next` },
        { state: s3, description: `Set target.next = new` },
      ]
    }

    case 'erase_after': {
      const pos = args.pos ?? 0
      if (pos < 0 || pos >= state.size - 1) {
        throw new Error(`erase_after position ${pos} out of range [0, ${state.size - 2}]`)
      }

      const targetNode = getNodeAtPosition(state, pos)!
      const removedNode = state.nodes.find(n => n.id === targetNode.nextId)!

      // Step 1: Set target.next = removed.next (bypass)
      const s1: ForwardListState = {
        nodes: state.nodes.map(n => n.id === targetNode.id ? { ...n, nextId: removedNode.nextId } : n),
        headId: state.headId,
        size: state.size,
        nextNodeId: state.nextNodeId,
      }

      // Step 2: Delete removed node, size--
      const s2: ForwardListState = {
        nodes: s1.nodes.filter(n => n.id !== removedNode.id),
        headId: state.headId,
        size: state.size - 1,
        nextNodeId: state.nextNodeId,
      }

      return [
        { state: s1, description: `Set target.next = removed.next` },
        { state: s2, description: `Delete removed node` },
      ]
    }

    case 'splice_after': {
      // C++ semantics: splice_after(pos, first, last)
      // Moves nodes in open range (first, last) — i.e., after `first` up to but not including `last`.
      // Inserts them after `pos`.
      // `first` = -1 means before_begin (range starts at head).
      // `last` = size means end (range goes to tail).
      const posIdx = args.pos ?? 0
      const firstIdx = args.first ?? 0
      const lastIdx = args.last ?? state.size

      // Validation
      if (posIdx < -1 || posIdx >= state.size) {
        throw new Error(`splice_after pos ${posIdx} out of range [-1, ${state.size - 1}]`)
      }
      if (firstIdx < -1 || firstIdx >= state.size) {
        throw new Error(`splice_after first ${firstIdx} out of range [-1, ${state.size - 1}]`)
      }
      if (lastIdx < 0 || lastIdx > state.size) {
        throw new Error(`splice_after last ${lastIdx} out of range [0, ${state.size}]`)
      }
      if (firstIdx + 1 >= lastIdx) {
        throw new Error(`splice_after: empty range (first=${firstIdx}, last=${lastIdx})`)
      }

      const ordered = getOrderedNodes(state)

      // Resolve nodes: first and last are boundaries (not moved)
      const firstNode: FLNode | null = firstIdx >= 0 ? ordered[firstIdx] : null
      const lastNode: FLNode | null = lastIdx < state.size ? ordered[lastIdx] : null
      const posNode: FLNode | null = posIdx >= 0 ? ordered[posIdx] : null

      // The subchain to move: nodes at positions (firstIdx+1) .. (lastIdx-1)
      const rangeStart = firstIdx + 1
      const rangeEnd = lastIdx - 1
      const subchainHead = ordered[rangeStart]
      const subchainTail = ordered[rangeEnd]
      const rangeNodeIds = ordered.slice(rangeStart, lastIdx).map(n => n.id)

      // Validate pos is not inside the range being moved
      if (posIdx >= rangeStart && posIdx <= rangeEnd) {
        throw new Error(`splice_after: pos ${posIdx} is inside the range being moved [${rangeStart}, ${rangeEnd}]`)
      }

      // Floating anchor: below the node just before the gap
      const floatAnchor = Math.max(0, rangeStart - 1)

      // Label helper
      const nodeLabel = (idx: number) => `node[${idx}]`

      const steps: Step[] = []
      let currentNodes = state.nodes.map(n => ({ ...n }))
      let currentHeadId = state.headId

      // --- Step 1: Visual pre-step — show subchain below (no pointer changes) ---
      steps.push({
        state: {
          nodes: currentNodes,
          headId: currentHeadId,
          size: state.size,
          nextNodeId: state.nextNodeId,
          floatingNodeIds: rangeNodeIds,
          floatingAnchorIdx: floatAnchor,
        },
        description: `Splicing nodes [${rangeStart}..${rangeEnd}]`,
      })

      // --- Step 2: Unlink — first.next → last (or head → last) ---
      {
        const nodes = currentNodes.map(n => ({ ...n }))
        let headId = currentHeadId
        if (firstNode !== null) {
          const fn = nodes.find(n => n.id === firstNode.id)!
          fn.nextId = lastNode?.id ?? null
        } else {
          headId = lastNode?.id ?? null
        }
        currentNodes = nodes
        currentHeadId = headId
        const desc = firstNode !== null
          ? `Set ${nodeLabel(firstIdx)}.next → ${lastNode ? nodeLabel(lastIdx) : 'null'}`
          : `Set head → ${lastNode ? nodeLabel(lastIdx) : 'null'}`
        steps.push({
          state: {
            nodes: currentNodes,
            headId: currentHeadId,
            size: state.size,
            nextNodeId: state.nextNodeId,
            floatingNodeIds: rangeNodeIds,
            floatingAnchorIdx: floatAnchor,
          },
          description: desc,
        })
      }

      // Compute afterPos: what pos.next is in the current (unlinked) state
      const posNodeNow = posNode ? currentNodes.find(n => n.id === posNode.id)! : null
      const afterPos = posNodeNow ? posNodeNow.nextId : currentHeadId

      // --- Step 3: Connect tail — subchain_tail.next → afterPos ---
      {
        const nodes = currentNodes.map(n => ({ ...n }))
        const tailN = nodes.find(n => n.id === subchainTail.id)!
        tailN.nextId = afterPos
        currentNodes = nodes
        const afterLabel = afterPos !== null
          ? nodeLabel(ordered.findIndex(n => n.id === afterPos))
          : 'null'
        steps.push({
          state: {
            nodes: currentNodes,
            headId: currentHeadId,
            size: state.size,
            nextNodeId: state.nextNodeId,
            floatingNodeIds: rangeNodeIds,
            floatingAnchorIdx: floatAnchor,
          },
          description: `Set subchain_tail.next → ${afterLabel}`,
        })
      }

      // --- Step 4: Connect head — pos.next → subchain_head (or head → subchain_head) ---
      {
        const nodes = currentNodes.map(n => ({ ...n }))
        let headId = currentHeadId
        if (posNode !== null) {
          const pn = nodes.find(n => n.id === posNode.id)!
          pn.nextId = subchainHead.id
        } else {
          headId = subchainHead.id
        }
        currentNodes = nodes
        currentHeadId = headId
        const desc = posNode !== null
          ? `Set ${nodeLabel(posIdx)}.next → subchain_head`
          : `Set head → subchain_head`
        steps.push({
          state: {
            nodes: currentNodes,
            headId: currentHeadId,
            size: state.size,
            nextNodeId: state.nextNodeId,
            floatingNodeIds: rangeNodeIds,
            floatingAnchorIdx: floatAnchor,
          },
          description: desc,
        })
      }

      // --- Step 5: Visual cleanup — nodes return to ordered row ---
      steps.push({
        state: {
          nodes: currentNodes,
          headId: currentHeadId,
          size: state.size,
          nextNodeId: state.nextNodeId,
        },
        description: `Splice complete`,
      })

      return steps
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
  const forcedFloating = new Set(state.floatingNodeIds ?? [])
  const allOrdered = getOrderedNodes(state)
  const orderedNodes = allOrdered.filter(n => !forcedFloating.has(n.id))
  const orderedSet = new Set(orderedNodes.map(n => n.id))
  const floatingNodes = state.nodes.filter(n => !orderedSet.has(n.id))

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

  // Lay out floating nodes BELOW the anchor position, spread horizontally
  const FLOATING_Y_GAP = 20
  const floatingY = nodesY + CELL_SIZE + FLOATING_Y_GAP
  const anchorIdx = state.floatingAnchorIdx ?? 0
  const clampedAnchor = Math.min(anchorIdx, Math.max(0, orderedNodes.length - 1))
  const floatingStartX = orderedNodes.length > 0
    ? STRUCT_X + clampedAnchor * (NODE_WIDTH + NODE_GAP)
    : STRUCT_X

  for (let fi = 0; fi < floatingNodes.length; fi++) {
    const node = floatingNodes[fi]
    const nodeX = floatingStartX + fi * (NODE_WIDTH + NODE_GAP)
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
    { name: 'splice_after', label: 'splice_after(pos, first, last)', args: [{ name: 'pos', label: 'pos', defaultValue: 0 }, { name: 'first', label: 'first', defaultValue: 1 }, { name: 'last', label: 'last', defaultValue: 3 }] },
  ],
  createInitialState,
  applyOperation,
  computeLayout,
}

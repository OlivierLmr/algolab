import type { DataStructure, DSLayout, DSArrow, DSSubstep } from './types.ts'
import type { FlatElement, CellData, LabelData, StructFieldData } from '../layout/types.ts'
import { CELL_SIZE, CELL_GAP, ARRAY_LABEL_HEIGHT, INDEX_LABEL_HEIGHT } from '../layout/constants.ts'

export interface VectorState {
  data: number[]    // Backing array (length === capacity)
  size: number
  capacity: number
}

// --- Layout constants ---

const STRUCT_X = 40
const STRUCT_Y = 40
const FIELD_GAP = CELL_GAP   // Same gap as array cells — fields touch
const FIELD_LABEL_HEIGHT = 70  // Vertical labels need more height
const STRUCT_TO_ARRAY_GAP = 60

function nextPowerOf2(n: number): number {
  if (n <= 0) return 0
  let p = 1
  while (p < n) p *= 2
  return p
}

// --- Operations ---

function createInitialState(values: number[]): VectorState {
  const size = values.length
  const capacity = nextPowerOf2(size)
  const data = [...values]
  // Fill remaining capacity with 0
  while (data.length < capacity) data.push(0)
  return { data, size, capacity }
}

type Step = DSSubstep<VectorState>

/** Produce reallocation substeps if at capacity, returning the grown state. */
function growSteps(state: VectorState): { steps: Step[]; grown: VectorState } {
  if (state.size < state.capacity) return { steps: [], grown: state }
  const newCap = state.capacity === 0 ? 1 : state.capacity * 2
  // Step 1: allocate
  const allocData = new Array(newCap).fill(0)
  const allocated: VectorState = { data: allocData, size: state.size, capacity: newCap }
  // Step 2: copy
  const copyData = [...allocData]
  for (let i = 0; i < state.size; i++) copyData[i] = state.data[i]
  const copied: VectorState = { data: copyData, size: state.size, capacity: newCap }
  return {
    steps: [
      { state: allocated, description: `Allocate new array (capacity ${newCap})` },
      { state: copied, description: `Copy ${state.size} element${state.size !== 1 ? 's' : ''} to new array` },
    ],
    grown: copied,
  }
}

function applyOperation(state: VectorState, op: string, args: Record<string, number>): Step[] {
  switch (op) {
    case 'push_back': {
      const val = args.val ?? 0
      const { steps, grown } = growSteps(state)
      const data = [...grown.data]
      data[grown.size] = val
      const final: VectorState = { data, size: grown.size + 1, capacity: grown.capacity }
      return [...steps, { state: final, description: `Write ${val} at position ${grown.size}` }]
    }
    case 'pop_back': {
      if (state.size === 0) throw new Error('pop_back on empty vector')
      const data = [...state.data]
      data[state.size - 1] = 0
      return [{ state: { data, size: state.size - 1, capacity: state.capacity }, description: `Remove element at position ${state.size - 1}` }]
    }
    case 'insert': {
      const pos = args.pos ?? 0
      const val = args.val ?? 0
      if (pos < 0 || pos > state.size) throw new Error(`insert position ${pos} out of range [0, ${state.size}]`)
      const { steps, grown } = growSteps(state)
      // Shift right
      const shifted = [...grown.data]
      for (let i = grown.size; i > pos; i--) shifted[i] = shifted[i - 1]
      shifted[pos] = 0  // placeholder before write
      const shiftState: VectorState = { data: shifted, size: grown.size + 1, capacity: grown.capacity }
      const shiftSteps: Step[] = grown.size > pos
        ? [{ state: shiftState, description: `Shift elements [${pos}..${grown.size - 1}] right` }]
        : []
      // Write
      const final = [...shifted]
      final[pos] = val
      const finalState: VectorState = { data: final, size: grown.size + 1, capacity: grown.capacity }
      return [...steps, ...shiftSteps, { state: finalState, description: `Write ${val} at position ${pos}` }]
    }
    case 'erase': {
      const pos = args.pos ?? 0
      if (state.size === 0) throw new Error('erase on empty vector')
      if (pos < 0 || pos >= state.size) throw new Error(`erase position ${pos} out of range [0, ${state.size - 1}]`)
      const steps: Step[] = []
      // Shift left
      if (pos < state.size - 1) {
        const shifted = [...state.data]
        for (let i = pos; i < state.size - 1; i++) shifted[i] = shifted[i + 1]
        shifted[state.size - 1] = state.data[state.size - 1]  // not yet cleared
        steps.push({ state: { data: shifted, size: state.size, capacity: state.capacity }, description: `Shift elements [${pos + 1}..${state.size - 1}] left` })
      }
      // Remove last
      const final = steps.length > 0 ? [...steps[steps.length - 1].state.data] : [...state.data]
      final[state.size - 1] = 0
      steps.push({ state: { data: final, size: state.size - 1, capacity: state.capacity }, description: `Remove element at position ${state.size - 1}` })
      return steps
    }
    case 'reserve': {
      const cap = args.cap ?? 0
      if (cap <= state.capacity) return [{ state, description: 'No reallocation needed' }]
      const allocData = new Array(cap).fill(0)
      const allocated: VectorState = { data: allocData, size: state.size, capacity: cap }
      const copyData = [...allocData]
      for (let i = 0; i < state.size; i++) copyData[i] = state.data[i]
      const copied: VectorState = { data: copyData, size: state.size, capacity: cap }
      return [
        { state: allocated, description: `Allocate new array (capacity ${cap})` },
        { state: copied, description: `Copy ${state.size} element${state.size !== 1 ? 's' : ''}` },
      ]
    }
    case 'clear': {
      const data = new Array(state.capacity).fill(0)
      return [{ state: { data, size: 0, capacity: state.capacity }, description: 'Clear all elements' }]
    }
    case 'shrink_to_fit': {
      if (state.capacity === state.size) return [{ state, description: 'Already at minimum capacity' }]
      const data = state.data.slice(0, state.size)
      return [{ state: { data, size: state.size, capacity: state.size }, description: `Reallocate to exact size (${state.size})` }]
    }
    default:
      throw new Error(`Unknown operation: ${op}`)
  }
}

// --- Layout ---

function computeLayout(state: VectorState): DSLayout {
  const elements: FlatElement[] = []
  const arrows: DSArrow[] = []

  // Struct header: size | capacity | data
  const fields = [
    { name: 'size', displayValue: String(state.size), isPointer: false },
    { name: 'capacity', displayValue: String(state.capacity), isPointer: false },
    { name: 'data', displayValue: '\u2022', isPointer: true },
  ]

  let fieldX = STRUCT_X
  const fieldY = STRUCT_Y
  let dataFieldCenterX = 0
  let dataFieldCenterY = 0

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

    if (field.isPointer) {
      dataFieldCenterX = fieldX + CELL_SIZE / 2
      dataFieldCenterY = fieldY + FIELD_LABEL_HEIGHT + CELL_SIZE / 2  // Center of the dot
    }

    fieldX += CELL_SIZE + FIELD_GAP
  }

  // Backing array
  const arrayY = fieldY + FIELD_LABEL_HEIGHT + CELL_SIZE + STRUCT_TO_ARRAY_GAP
  const arrayX = STRUCT_X + CELL_SIZE + FIELD_GAP // Indent array under capacity/data fields

  // Array label
  elements.push({
    id: 'array-label:data',
    x: arrayX,
    y: arrayY,
    width: 100,
    height: ARRAY_LABEL_HEIGHT,
    kind: 'array-label',
    data: { text: '' } as LabelData,
    opacity: 1.0,
  })

  const cellsY = arrayY + ARRAY_LABEL_HEIGHT

  for (let i = 0; i < state.capacity; i++) {
    const cellX = arrayX + i * (CELL_SIZE + CELL_GAP)
    const isDimmed = i >= state.size

    const cellData: CellData = {
      arrayName: 'data',
      index: i,
      value: { num: state.data[i], arrays: [] },
      dimmed: isDimmed,
    }

    elements.push({
      id: `cell:data:${i}`,
      x: cellX,
      y: cellsY,
      width: CELL_SIZE,
      height: CELL_SIZE,
      kind: 'cell',
      data: cellData,
      opacity: 1.0,
    })
  }

  // Arrow from data field to first cell of backing array
  if (state.capacity > 0) {
    const targetX = arrayX + CELL_SIZE / 2
    const targetY = cellsY
    arrows.push({
      fromX: dataFieldCenterX,
      fromY: dataFieldCenterY,
      toX: targetX,
      toY: targetY,
    })
  }

  // Compute total dimensions
  const lastCellRight = state.capacity > 0
    ? arrayX + state.capacity * (CELL_SIZE + CELL_GAP) - CELL_GAP
    : fieldX
  const bottomY = state.capacity > 0
    ? cellsY + CELL_SIZE + INDEX_LABEL_HEIGHT
    : fieldY + FIELD_LABEL_HEIGHT + CELL_SIZE

  return {
    elements,
    arrows,
    width: Math.max(lastCellRight + 40, 400),
    height: bottomY + 40,
  }
}

// --- Exported definition ---

export const vectorDS: DataStructure<VectorState> = {
  name: 'vector<T>',
  operations: [
    { name: 'push_back', label: 'push_back(val)', args: [{ name: 'val', label: 'Value', defaultValue: 0 }] },
    { name: 'pop_back', label: 'pop_back()', args: [] },
    { name: 'insert', label: 'insert(pos, val)', args: [{ name: 'pos', label: 'Position', defaultValue: 0 }, { name: 'val', label: 'Value', defaultValue: 0 }] },
    { name: 'erase', label: 'erase(pos)', args: [{ name: 'pos', label: 'Position', defaultValue: 0 }] },
    { name: 'reserve', label: 'reserve(cap)', args: [{ name: 'cap', label: 'Capacity', defaultValue: 8 }] },
    { name: 'clear', label: 'clear()', args: [] },
    { name: 'shrink_to_fit', label: 'shrink_to_fit()', args: [] },
  ],
  createInitialState,
  applyOperation,
  computeLayout,
}

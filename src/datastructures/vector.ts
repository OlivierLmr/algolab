import type { DataStructure, DSLayout, DSArrow, DSSubstep } from './types.ts'
import type { FlatElement, CellData, LabelData, StructFieldData } from '../layout/types.ts'
import { CELL_SIZE, CELL_GAP, ARRAY_LABEL_HEIGHT, INDEX_LABEL_HEIGHT, DIMMED_OPACITY } from '../layout/constants.ts'

export interface VectorState {
  data: number[]    // Backing array (length === capacity)
  size: number
  capacity: number
  /** During reallocation: the old backing array being replaced. */
  oldData?: number[]
  oldCapacity?: number
  /** During reallocation: which array the data pointer targets ('old' or 'new'). */
  pointerTarget?: 'old' | 'new'
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

/**
 * Produce reallocation substeps when growing capacity.
 * Substeps: allocate new (data→old) → copy (data→old) → switch pointer + delete old (data→new).
 */
function growSteps(state: VectorState, newCap: number): Step[] {
  const oldData = [...state.data]
  const oldCap = state.capacity

  // Step 1: allocate new empty array, data still points to old
  const allocData = new Array(newCap).fill(0)
  const allocated: VectorState = {
    data: allocData, size: state.size, capacity: newCap,
    oldData, oldCapacity: oldCap, pointerTarget: 'old',
  }

  // Step 2: copy elements to new array, data still points to old
  const copyData = [...allocData]
  for (let i = 0; i < state.size; i++) copyData[i] = oldData[i]
  const copied: VectorState = {
    data: copyData, size: state.size, capacity: newCap,
    oldData, oldCapacity: oldCap, pointerTarget: 'old',
  }

  // Step 3: switch pointer to new, delete old
  const switched: VectorState = { data: [...copyData], size: state.size, capacity: newCap }

  return [
    { state: allocated, description: `Allocate new array (capacity ${newCap})` },
    { state: copied, description: `Copy ${state.size} element${state.size !== 1 ? 's' : ''} to new array` },
    { state: switched, description: `Update data pointer, delete old array` },
  ]
}

function applyOperation(state: VectorState, op: string, args: Record<string, number>): Step[] {
  switch (op) {
    case 'push_back': {
      const val = args.val ?? 0
      const needsGrow = state.size >= state.capacity
      const reallocSteps = needsGrow
        ? growSteps(state, state.capacity === 0 ? 1 : state.capacity * 2)
        : []
      const base = needsGrow ? reallocSteps[reallocSteps.length - 1].state : state
      // Write value and increment size
      const data = [...base.data]
      data[base.size] = val
      const final: VectorState = { data, size: base.size + 1, capacity: base.capacity }
      return [...reallocSteps, { state: final, description: `Write ${val} at position ${base.size}, increment size` }]
    }
    case 'pop_back': {
      if (state.size === 0) throw new Error('pop_back on empty vector')
      const data = [...state.data]
      data[state.size - 1] = 0
      return [{ state: { data, size: state.size - 1, capacity: state.capacity }, description: `Remove element at position ${state.size - 1}, decrement size` }]
    }
    case 'insert': {
      const pos = args.pos ?? 0
      const val = args.val ?? 0
      if (pos < 0 || pos > state.size) throw new Error(`insert position ${pos} out of range [0, ${state.size}]`)
      const needsGrow = state.size >= state.capacity
      const reallocSteps = needsGrow
        ? growSteps(state, state.capacity === 0 ? 1 : state.capacity * 2)
        : []
      const base = needsGrow ? reallocSteps[reallocSteps.length - 1].state : state
      const steps: Step[] = [...reallocSteps]
      // Shift right (if not inserting at end)
      if (base.size > pos) {
        const shifted = [...base.data]
        for (let i = base.size; i > pos; i--) shifted[i] = shifted[i - 1]
        shifted[pos] = base.data[pos]  // still shows old value before overwrite
        const shiftState: VectorState = { data: shifted, size: base.size + 1, capacity: base.capacity }
        steps.push({ state: shiftState, description: `Shift elements [${pos}..${base.size - 1}] right` })
      }
      // Write value at position
      const prevData = steps.length > 0 ? [...steps[steps.length - 1].state.data] : [...base.data]
      prevData[pos] = val
      const finalState: VectorState = { data: prevData, size: base.size + 1, capacity: base.capacity }
      steps.push({ state: finalState, description: `Write ${val} at position ${pos}, increment size` })
      return steps
    }
    case 'erase': {
      const pos = args.pos ?? 0
      if (state.size === 0) throw new Error('erase on empty vector')
      if (pos < 0 || pos >= state.size) throw new Error(`erase position ${pos} out of range [0, ${state.size - 1}]`)
      const steps: Step[] = []
      // Shift left (rightmost still has its old value)
      if (pos < state.size - 1) {
        const shifted = [...state.data]
        for (let i = pos; i < state.size - 1; i++) shifted[i] = shifted[i + 1]
        // rightmost still contains its value (not yet cleared)
        steps.push({ state: { data: shifted, size: state.size, capacity: state.capacity }, description: `Shift elements [${pos + 1}..${state.size - 1}] left` })
      }
      // Delete rightmost value
      const prevData = steps.length > 0 ? [...steps[steps.length - 1].state.data] : [...state.data]
      prevData[state.size - 1] = 0
      steps.push({ state: { data: prevData, size: state.size - 1, capacity: state.capacity }, description: `Remove element at position ${state.size - 1}, decrement size` })
      return steps
    }
    case 'reserve': {
      const cap = args.cap ?? 0
      if (cap <= state.capacity) return [{ state, description: 'No reallocation needed' }]
      return growSteps(state, cap)
    }
    case 'clear': {
      const data = new Array(state.capacity).fill(0)
      return [{ state: { data, size: 0, capacity: state.capacity }, description: 'Clear all elements (size = 0)' }]
    }
    case 'shrink_to_fit': {
      if (state.capacity === state.size) return [{ state, description: 'Already at minimum capacity' }]
      const newCap = state.size
      const oldData = [...state.data]
      const oldCap = state.capacity
      // Step 1: allocate new array with capacity = size
      const allocData = state.data.slice(0, newCap)
      const allocated: VectorState = {
        data: allocData, size: state.size, capacity: newCap,
        oldData, oldCapacity: oldCap, pointerTarget: 'old',
      }
      // Step 2: copy values (already in allocData since we sliced)
      const copied: VectorState = {
        data: [...allocData], size: state.size, capacity: newCap,
        oldData, oldCapacity: oldCap, pointerTarget: 'old',
      }
      // Step 3: switch pointer to new, delete old
      const switched: VectorState = { data: [...allocData], size: state.size, capacity: newCap }
      return [
        { state: allocated, description: `Allocate new array (capacity ${newCap})` },
        { state: copied, description: `Copy ${state.size} element${state.size !== 1 ? 's' : ''} to new array` },
        { state: switched, description: `Update data pointer, delete old array` },
      ]
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

  // Backing array (new/current)
  const arrayY = fieldY + FIELD_LABEL_HEIGHT + CELL_SIZE + STRUCT_TO_ARRAY_GAP
  const arrayX = STRUCT_X + CELL_SIZE + FIELD_GAP // Indent array under capacity/data fields

  const hasOldArray = state.oldData != null && state.oldCapacity != null
  const pointsToOld = hasOldArray && state.pointerTarget === 'old'

  // Old array (shown during reallocation, above the new one)
  let oldCellsY = arrayY + ARRAY_LABEL_HEIGHT
  let oldArrayBottomY = arrayY
  if (hasOldArray) {
    const oldOpacity = pointsToOld ? 1.0 : DIMMED_OPACITY

    elements.push({
      id: 'array-label:old',
      x: arrayX,
      y: arrayY,
      width: 100,
      height: ARRAY_LABEL_HEIGHT,
      kind: 'array-label',
      data: { text: pointsToOld ? '' : 'old' } as LabelData,
      opacity: oldOpacity,
    })

    for (let i = 0; i < state.oldCapacity!; i++) {
      const cellX = arrayX + i * (CELL_SIZE + CELL_GAP)
      const isDimmed = i >= state.size

      elements.push({
        id: `cell:old:${i}`,
        x: cellX,
        y: oldCellsY,
        width: CELL_SIZE,
        height: CELL_SIZE,
        kind: 'cell',
        data: {
          arrayName: 'old',
          index: i,
          value: { num: state.oldData![i], arrays: [] },
          dimmed: isDimmed,
        } as CellData,
        opacity: oldOpacity,
      })
    }

    oldArrayBottomY = oldCellsY + CELL_SIZE + INDEX_LABEL_HEIGHT + CELL_GAP
  }

  // New/current array
  const newArrayY = hasOldArray ? oldArrayBottomY + 12 : arrayY
  const newLabel = hasOldArray ? 'new' : ''
  const newOpacity = pointsToOld ? DIMMED_OPACITY : 1.0

  elements.push({
    id: 'array-label:data',
    x: arrayX,
    y: newArrayY,
    width: 100,
    height: ARRAY_LABEL_HEIGHT,
    kind: 'array-label',
    data: { text: newLabel } as LabelData,
    opacity: newOpacity,
  })

  const cellsY = newArrayY + ARRAY_LABEL_HEIGHT

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
      opacity: newOpacity,
    })
  }

  // Arrow from data field to the array it currently points to
  const arrowTargetCellsY = pointsToOld ? oldCellsY : cellsY
  const arrowTargetCap = pointsToOld ? state.oldCapacity! : state.capacity
  if (arrowTargetCap > 0) {
    const targetX = arrayX + CELL_SIZE / 2
    const targetY = arrowTargetCellsY
    arrows.push({
      fromX: dataFieldCenterX,
      fromY: dataFieldCenterY,
      toX: targetX,
      toY: targetY,
    })
  }

  // Compute total dimensions
  const maxCap = Math.max(state.capacity, state.oldCapacity ?? 0)
  const lastCellRight = maxCap > 0
    ? arrayX + maxCap * (CELL_SIZE + CELL_GAP) - CELL_GAP
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

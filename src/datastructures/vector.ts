import type { DataStructure, DSLayout, DSArrow, DSSubstep } from './types.ts'
import type { FlatElement, CellData, LabelData, StructFieldData } from '../layout/types.ts'
import { CELL_SIZE, CELL_GAP, ARRAY_LABEL_HEIGHT, INDEX_LABEL_HEIGHT } from '../layout/constants.ts'

export interface VectorState {
  data: number[]    // Backing array (length === capacity)
  size: number
  capacity: number
  /** During reallocation: the old backing array being replaced. */
  oldData?: number[]
  oldCapacity?: number
  /** During reallocation: which array the data pointer targets ('old' or 'new'). */
  pointerTarget?: 'old' | 'new'
  /** During reallocation: how many cells in the new array have been written to. */
  newUsed?: number
  /** During insert-with-gap: index of the gap cell that should appear dimmed. */
  gapIndex?: number
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
 * Substeps: allocate → copy → switch pointer (old still visible) → delete old.
 */
function growSteps(state: VectorState, newCap: number): Step[] {
  return growStepsWithGap(state, newCap, -1)
}

/**
 * Produce reallocation substeps, optionally leaving a gap at gapPos.
 * When gapPos >= 0, elements [0..gapPos-1] copy to the same positions and
 * elements [gapPos..size-1] copy to positions [gapPos+1..size], leaving
 * position gapPos empty for a subsequent insert.
 * When gapPos < 0, copies all elements contiguously (standard realloc).
 */
function growStepsWithGap(state: VectorState, newCap: number, gapPos: number): Step[] {
  const oldData = [...state.data]
  const oldCap = state.capacity
  const hasGap = gapPos >= 0

  // Step 1: allocate new empty array — nothing written yet
  const allocData = new Array(newCap).fill(0)
  const allocated: VectorState = {
    data: allocData, size: state.size, capacity: newCap,
    oldData, oldCapacity: oldCap, pointerTarget: 'old', newUsed: 0,
  }

  // Step 2: copy elements to new array (with or without gap)
  const copyData = [...allocData]
  if (hasGap) {
    for (let i = 0; i < gapPos; i++) copyData[i] = oldData[i]
    for (let i = gapPos; i < state.size; i++) copyData[i + 1] = oldData[i]
  } else {
    for (let i = 0; i < state.size; i++) copyData[i] = oldData[i]
  }
  const newUsed = hasGap ? state.size + 1 : state.size
  const copied: VectorState = {
    data: copyData, size: state.size, capacity: newCap,
    oldData, oldCapacity: oldCap, pointerTarget: 'old', newUsed,
    ...(hasGap ? { gapIndex: gapPos } : {}),
  }

  // Step 3: switch pointer to new, old array still visible (dimmed)
  const switched: VectorState = {
    data: [...copyData], size: state.size, capacity: newCap,
    oldData, oldCapacity: oldCap, pointerTarget: 'new', newUsed,
    ...(hasGap ? { gapIndex: gapPos } : {}),
  }

  // Step 4: delete old array — when there's a gap, size increases to reflect
  // the space reserved for the upcoming insert (prevents the last copied element
  // from appearing dimmed once newUsed is no longer available).
  const deletedSize = hasGap ? state.size + 1 : state.size
  const deleted: VectorState = {
    data: [...copyData], size: deletedSize, capacity: newCap,
    ...(hasGap ? { gapIndex: gapPos } : {}),
  }

  const copyDesc = hasGap
    ? `Copy ${state.size} element${state.size !== 1 ? 's' : ''}, leaving gap at position ${gapPos}`
    : `Copy ${state.size} element${state.size !== 1 ? 's' : ''} to new array`

  return [
    { state: allocated, description: `Allocate new array (capacity ${newCap})` },
    { state: copied, description: copyDesc },
    { state: switched, description: `Update data pointer to new array` },
    { state: deleted, description: `Delete old array` },
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

      if (needsGrow) {
        // Realloc with gap: copy leaves a hole at pos, no shift needed
        const newCap = state.capacity === 0 ? 1 : state.capacity * 2
        const reallocSteps = growStepsWithGap(state, newCap, pos)
        const base = reallocSteps[reallocSteps.length - 1].state
        const data = [...base.data]
        data[pos] = val
        // Size already incremented in the delete-old step; just write the value
        const finalState: VectorState = { data, size: base.size, capacity: base.capacity }
        return [...reallocSteps, { state: finalState, description: `Write ${val} at position ${pos}` }]
      }

      // No realloc: shift right then write
      const steps: Step[] = []
      if (state.size > pos) {
        const shifted = [...state.data]
        for (let i = state.size; i > pos; i--) shifted[i] = shifted[i - 1]
        const shiftState: VectorState = { data: shifted, size: state.size + 1, capacity: state.capacity }
        steps.push({ state: shiftState, description: `Shift elements [${pos}..${state.size - 1}] right` })
      }
      const prevData = steps.length > 0 ? [...steps[steps.length - 1].state.data] : [...state.data]
      prevData[pos] = val
      const finalState: VectorState = { data: prevData, size: state.size + 1, capacity: state.capacity }
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
      // Use the standard realloc sequence: allocate → copy → switch → delete
      return growSteps(state, state.size)
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
    elements.push({
      id: 'array-label:old',
      x: arrayX,
      y: arrayY,
      width: 100,
      height: ARRAY_LABEL_HEIGHT,
      kind: 'array-label',
      data: { text: 'old' } as LabelData,
      opacity: 1.0,
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
        opacity: 1.0,
      })
    }

    oldArrayBottomY = oldCellsY + CELL_SIZE + INDEX_LABEL_HEIGHT + CELL_GAP
  }

  // New/current array (always full opacity, individual cells dimmed if empty)
  const newArrayY = hasOldArray ? oldArrayBottomY + 12 : arrayY
  const newLabel = hasOldArray ? 'new' : ''

  elements.push({
    id: 'array-label:data',
    x: arrayX,
    y: newArrayY,
    width: 100,
    height: ARRAY_LABEL_HEIGHT,
    kind: 'array-label',
    data: { text: newLabel } as LabelData,
    opacity: 1.0,
  })

  const cellsY = newArrayY + ARRAY_LABEL_HEIGHT

  // When newUsed is set, use it to determine which cells in the new array are initialized
  const newArrayUsed = state.newUsed ?? state.size

  for (let i = 0; i < state.capacity; i++) {
    const cellX = arrayX + i * (CELL_SIZE + CELL_GAP)
    const isDimmed = i >= newArrayUsed || i === state.gapIndex

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

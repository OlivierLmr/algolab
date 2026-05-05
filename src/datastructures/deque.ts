import type { DataStructure, DSLayout, DSArrow, DSSubstep } from './types.ts'
import type { FlatElement, CellData, StructFieldData } from '../layout/types.ts'
import { CELL_SIZE, CELL_GAP } from '../layout/constants.ts'
import { parseNumberList } from './parse-utils.ts'

// =============================================================================
// State — Map-of-Chunks (real std::deque layout)
// =============================================================================

export interface DequeState {
  chunks: (number[] | null)[]  // map array: each entry is a chunk or null
  mapCap: number               // total map slots allocated
  mapBeg: number               // index of first active map slot
  chunkCap: number             // fixed chunk size (always 4)
  chunkBeg: number             // index of first element within first active chunk
  taille: number               // total number of elements
  /** During map growth: the old map being replaced. */
  oldChunks?: (number[] | null)[]
  oldMapCap?: number
  oldMapBeg?: number
}

// =============================================================================
// Helpers — The map is a CIRCULAR BUFFER. Active chunks span from mapBeg
// for numActiveChunks slots, wrapping modularly around mapCap.
// =============================================================================

/** Number of active chunks needed to hold all elements. */
function numActiveChunks(state: DequeState): number {
  if (state.taille === 0) return 0
  return Math.ceil((state.chunkBeg + state.taille) / state.chunkCap)
}

/** Physical map index for the i-th active chunk (wraps around). */
function chunkPhysical(state: DequeState, chunkOffset: number): number {
  return (state.mapBeg + chunkOffset) % state.mapCap
}

/** Map a logical element index to its physical (chunk map index, slot) pair. */
function logicalToPhysical(state: DequeState, i: number): { chunk: number; slot: number } {
  const chunkOffset = Math.floor((state.chunkBeg + i) / state.chunkCap)
  return {
    chunk: chunkPhysical(state, chunkOffset),
    slot: (state.chunkBeg + i) % state.chunkCap,
  }
}

/** Get the value at logical index i. */
export function getAt(state: DequeState, i: number): number {
  const { chunk, slot } = logicalToPhysical(state, i)
  return state.chunks[chunk]![slot]
}

/** Deep-clone a state. */
function cloneState(state: DequeState): DequeState {
  return {
    ...state,
    chunks: state.chunks.map(c => c ? [...c] : null),
  }
}

/** Check whether a given physical (chunkMapIdx, slotIdx) is within the active element range. */
function isSlotActive(state: DequeState, chunkMapIdx: number, slotIdx: number): boolean {
  if (state.taille === 0) return false
  const active = numActiveChunks(state)
  // Compute relative chunk position accounting for wrapping
  const relChunk = (chunkMapIdx - state.mapBeg + state.mapCap) % state.mapCap
  if (relChunk >= active) return false
  const globalSlot = relChunk * state.chunkCap + slotIdx
  return globalSlot >= state.chunkBeg && globalSlot < state.chunkBeg + state.taille
}

/** Check if all map slots are occupied (need to grow before allocating a new chunk). */
function isMapFull(state: DequeState): boolean {
  return numActiveChunks(state) >= state.mapCap
}

// =============================================================================
// Initial State
// =============================================================================

function createInitialState(input: string): DequeState {
  const values = parseNumberList(input)
  const chunkCap = 4
  if (values.length === 0) {
    const mapCap = 4
    const chunks: (number[] | null)[] = new Array(mapCap).fill(null)
    return { chunks, mapCap, mapBeg: 1, chunkCap, chunkBeg: 0, taille: 0 }
  }

  const numChunksNeeded = Math.ceil(values.length / chunkCap)
  const mapCap = Math.max(4, numChunksNeeded + 2)
  const mapBeg = 1
  const chunkBeg = 0

  const chunks: (number[] | null)[] = new Array(mapCap).fill(null)
  let valIdx = 0
  for (let c = 0; c < numChunksNeeded; c++) {
    const chunk = new Array(chunkCap).fill(0)
    for (let s = 0; s < chunkCap && valIdx < values.length; s++, valIdx++) {
      chunk[s] = values[valIdx]
    }
    chunks[mapBeg + c] = chunk
  }

  return { chunks, mapCap, mapBeg, chunkCap, chunkBeg, taille: values.length }
}

// =============================================================================
// Operations
// =============================================================================

type Step = DSSubstep<DequeState>

/**
 * Ensure there is room to expand at the back (new slot after last element).
 * Returns substeps for any allocation needed and the resulting state.
 */
function ensureRoomAtBack(state: DequeState): { steps: Step[]; current: DequeState } {
  const steps: Step[] = []
  let current = cloneState(state)

  const active = numActiveChunks(current)
  const needsNewChunk = active === 0 || (current.chunkBeg + current.taille) % current.chunkCap === 0

  if (needsNewChunk) {
    if (isMapFull(current)) {
      const growSteps = growMapSteps(current)
      steps.push(...growSteps)
      current = cloneState(growSteps[growSteps.length - 1].state)
    }
    const newChunkIdx = chunkPhysical(current, numActiveChunks(current))
    current.chunks[newChunkIdx] = new Array(current.chunkCap).fill(0)
    steps.push({ state: cloneState(current), description: `Allocate new chunk at map[${newChunkIdx}]` })
  }

  return { steps, current }
}

/**
 * Ensure there is room to expand at the front (new slot before first element).
 * Returns substeps for any allocation needed and the resulting state.
 */
function ensureRoomAtFront(state: DequeState): { steps: Step[]; current: DequeState } {
  const steps: Step[] = []
  let current = cloneState(state)

  if (current.chunkBeg === 0) {
    if (isMapFull(current)) {
      const growSteps = growMapSteps(current)
      steps.push(...growSteps)
      current = cloneState(growSteps[growSteps.length - 1].state)
    }
    const newMapBeg = (current.mapBeg - 1 + current.mapCap) % current.mapCap
    current.chunks[newMapBeg] = new Array(current.chunkCap).fill(0)
    current.mapBeg = newMapBeg
    current.chunkBeg = current.chunkCap
    steps.push({ state: cloneState(current), description: `Allocate new chunk at map[${newMapBeg}]` })
  }

  return { steps, current }
}

/** Grow the map: allocate a new map of double size, unwrap circular pointers into linear layout. */
function growMapSteps(state: DequeState): Step[] {
  const steps: Step[] = []
  const newMapCap = state.mapCap * 2
  const active = numActiveChunks(state)

  // Capture old map for visual display during transition
  const oldChunks = state.chunks.map(c => c ? [...c] : null)
  const oldMapCap = state.mapCap
  const oldMapBeg = state.mapBeg

  // Step 1: Allocate new empty map (old map still shown)
  const newChunksEmpty: (number[] | null)[] = new Array(newMapCap).fill(null)
  const newMapBeg = Math.floor((newMapCap - active) / 2)
  const step1: DequeState = {
    chunks: newChunksEmpty.map(c => c ? [...c] : null),
    mapCap: newMapCap,
    mapBeg: newMapBeg,
    chunkCap: state.chunkCap,
    chunkBeg: state.chunkBeg,
    taille: state.taille,
    oldChunks, oldMapCap, oldMapBeg,
  }
  steps.push({ state: step1, description: `Allocate new map (capacity ${newMapCap})` })

  // Step 2: Copy active chunk pointers from old to new (both shown)
  const newChunksCopied: (number[] | null)[] = new Array(newMapCap).fill(null)
  for (let i = 0; i < active; i++) {
    const srcIdx = chunkPhysical(state, i)
    newChunksCopied[newMapBeg + i] = state.chunks[srcIdx]
      ? [...state.chunks[srcIdx]!]
      : null
  }
  const step2: DequeState = {
    chunks: newChunksCopied.map(c => c ? [...c] : null),
    mapCap: newMapCap,
    mapBeg: newMapBeg,
    chunkCap: state.chunkCap,
    chunkBeg: state.chunkBeg,
    taille: state.taille,
    oldChunks, oldMapCap, oldMapBeg,
  }
  steps.push({ state: step2, description: `Copy ${active} map pointer${active !== 1 ? 's' : ''} to new map` })

  // Step 3: Delete old map (only new map remains)
  const step3: DequeState = {
    chunks: newChunksCopied.map(c => c ? [...c] : null),
    mapCap: newMapCap,
    mapBeg: newMapBeg,
    chunkCap: state.chunkCap,
    chunkBeg: state.chunkBeg,
    taille: state.taille,
  }
  steps.push({ state: step3, description: `Delete old map` })

  return steps
}

function applyOperation(state: DequeState, op: string, args: Record<string, number>): Step[] {
  switch (op) {
    case 'push_back': {
      const val = args.val ?? 0
      const { steps, current } = ensureRoomAtBack(state)

      const { chunk, slot } = logicalToPhysical(current, current.taille)
      const finalState = cloneState(current)
      finalState.chunks[chunk]![slot] = val
      finalState.taille += 1
      steps.push({ state: finalState, description: `Write ${val} at chunk[${chunk}][${slot}]` })
      return steps
    }

    case 'push_front': {
      const val = args.val ?? 0
      const { steps, current } = ensureRoomAtFront(state)

      const finalState = cloneState(current)
      finalState.chunkBeg -= 1
      finalState.taille += 1
      const { chunk, slot } = logicalToPhysical(finalState, 0)
      finalState.chunks[chunk]![slot] = val
      steps.push({ state: finalState, description: `Write ${val} at chunk[${chunk}][${slot}]` })
      return steps
    }

    case 'pop_back': {
      if (state.taille === 0) throw new Error('pop_back on empty deque')
      const steps: Step[] = []

      const { chunk, slot } = logicalToPhysical(state, state.taille - 1)
      const removed = cloneState(state)
      removed.chunks[chunk]![slot] = 0
      removed.taille -= 1
      steps.push({ state: cloneState(removed), description: `Remove element at chunk[${chunk}][${slot}]` })

      // Deallocate chunk if it became empty (slot 0 means it was the only element)
      if (slot === 0) {
        const dealloc = cloneState(removed)
        dealloc.chunks[chunk] = null
        steps.push({ state: dealloc, description: `Deallocate empty chunk at map[${chunk}]` })
      }

      return steps
    }

    case 'pop_front': {
      if (state.taille === 0) throw new Error('pop_front on empty deque')
      const steps: Step[] = []

      const { chunk, slot } = logicalToPhysical(state, 0)
      const removed = cloneState(state)
      removed.chunks[chunk]![slot] = 0
      removed.chunkBeg += 1
      removed.taille -= 1
      steps.push({ state: cloneState(removed), description: `Remove element at chunk[${chunk}][${slot}]` })

      // If chunkBeg reaches chunkCap, deallocate chunk and advance mapBeg circularly
      if (removed.chunkBeg >= removed.chunkCap) {
        const dealloc = cloneState(removed)
        dealloc.chunks[chunk] = null
        dealloc.mapBeg = (chunk + 1) % dealloc.mapCap
        dealloc.chunkBeg = 0
        steps.push({ state: dealloc, description: `Deallocate empty chunk at map[${chunk}], advance mapBeg` })
      }

      return steps
    }

    case 'insert': {
      const pos = args.pos ?? 0
      const val = args.val ?? 0
      if (pos < 0 || pos > state.taille) throw new Error(`insert position ${pos} out of range [0, ${state.taille}]`)

      // Edge cases: delegate to push_front/push_back
      if (pos === state.taille) return applyOperation(state, 'push_back', { val })
      if (pos === 0) return applyOperation(state, 'push_front', { val })

      // Choose the side with fewer elements to shift
      const shiftLeft = pos < state.taille - pos

      if (shiftLeft) {
        const { steps, current } = ensureRoomAtFront(state)

        // Expand logical range at front (decrement chunkBeg, increment taille)
        const expanded = cloneState(current)
        expanded.chunkBeg -= 1
        expanded.taille += 1

        // Shift elements [0..pos-1] left by one (into the newly available slot)
        for (let i = 0; i < pos; i++) {
          const src = logicalToPhysical(expanded, i + 1)
          const dst = logicalToPhysical(expanded, i)
          expanded.chunks[dst.chunk]![dst.slot] = expanded.chunks[src.chunk]![src.slot]
        }
        steps.push({ state: cloneState(expanded), description: `Shift elements [0..${pos - 1}] left` })

        // Write value at position pos
        const w = logicalToPhysical(expanded, pos)
        expanded.chunks[w.chunk]![w.slot] = val
        steps.push({ state: cloneState(expanded), description: `Write ${val} at position ${pos}` })

        return steps
      } else {
        const { steps, current } = ensureRoomAtBack(state)

        // Expand logical range at back (increment taille)
        const expanded = cloneState(current)
        expanded.taille += 1

        // Shift elements [pos..taille-2] right by one (into the newly available slot)
        for (let i = expanded.taille - 1; i > pos; i--) {
          const src = logicalToPhysical(expanded, i - 1)
          const dst = logicalToPhysical(expanded, i)
          expanded.chunks[dst.chunk]![dst.slot] = expanded.chunks[src.chunk]![src.slot]
        }
        steps.push({ state: cloneState(expanded), description: `Shift elements [${pos}..${state.taille - 1}] right` })

        // Write value at position pos
        const w = logicalToPhysical(expanded, pos)
        expanded.chunks[w.chunk]![w.slot] = val
        steps.push({ state: cloneState(expanded), description: `Write ${val} at position ${pos}` })

        return steps
      }
    }

    case 'erase': {
      const pos = args.pos ?? 0
      if (state.taille === 0) throw new Error('erase on empty deque')
      if (pos < 0 || pos >= state.taille) throw new Error(`erase position ${pos} out of range [0, ${state.taille - 1}]`)

      const steps: Step[] = []

      // Shift elements left (overwrite erased position)
      const shifted = cloneState(state)
      for (let i = pos; i < shifted.taille - 1; i++) {
        const src = logicalToPhysical(shifted, i + 1)
        const dst = logicalToPhysical(shifted, i)
        shifted.chunks[dst.chunk]![dst.slot] = shifted.chunks[src.chunk]![src.slot]
      }
      steps.push({ state: cloneState(shifted), description: `Shift elements left from position ${pos + 1}` })

      // Pop the now-redundant last element
      const popSteps = applyOperation(shifted, 'pop_back', {})
      steps.push(...popSteps)

      return steps
    }

    default:
      throw new Error(`Unknown operation: ${op}`)
  }
}

// =============================================================================
// Layout — Map-of-Chunks Visualization
// =============================================================================

const STRUCT_X = 40
const STRUCT_Y = 40
const FIELD_LABEL_HEIGHT = 70
const STRUCT_TO_MAP_GAP = 60
const MAP_TO_CHUNKS_GAP = 50
const CHUNK_CELL_GAP = CELL_GAP

function computeLayout(state: DequeState): DSLayout {
  const elements: FlatElement[] = []
  const arrows: DSArrow[] = []
  const hasOldMap = state.oldChunks !== undefined

  // --- Struct fields row ---
  const fields: { name: string; displayValue: string; isPointer: boolean }[] = [
    { name: 'map', displayValue: '\u2022', isPointer: true },
    { name: 'map_cap', displayValue: String(state.mapCap), isPointer: false },
    { name: 'map_beg', displayValue: String(state.mapBeg), isPointer: false },
    { name: 'chunk_cap', displayValue: String(state.chunkCap), isPointer: false },
    { name: 'chunk_beg', displayValue: String(state.chunkBeg), isPointer: false },
    { name: 'taille', displayValue: String(state.taille), isPointer: false },
  ]

  let mapFieldCenterX = 0
  let mapFieldBottomY = 0

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]
    const fieldX = STRUCT_X + i * (CELL_SIZE + CELL_GAP)
    const data: StructFieldData = {
      name: field.name,
      displayValue: field.displayValue,
      isPointer: field.isPointer,
    }

    elements.push({
      id: `field:${field.name}`,
      x: fieldX,
      y: STRUCT_Y,
      width: CELL_SIZE,
      height: FIELD_LABEL_HEIGHT + CELL_SIZE,
      kind: 'struct-field',
      data,
      opacity: 1.0,
    })

    if (field.name === 'map') {
      mapFieldCenterX = fieldX + CELL_SIZE / 2
      mapFieldBottomY = STRUCT_Y + FIELD_LABEL_HEIGHT + CELL_SIZE
    }
  }

  // --- Old map row (shown dimmed during growth, above new map) ---
  let oldMapRowY = STRUCT_Y + FIELD_LABEL_HEIGHT + CELL_SIZE + STRUCT_TO_MAP_GAP
  const oldMapRowX = STRUCT_X

  // Determine if new map has chunks copied (step 2+) vs empty (step 1)
  const newMapHasChunks = state.chunks.some(c => c !== null)

  if (hasOldMap) {
    for (let i = 0; i < state.oldMapCap!; i++) {
      const cellX = oldMapRowX + i * (CELL_SIZE + CELL_GAP)
      const hasChunk = state.oldChunks![i] !== null

      elements.push({
        id: `cell:oldmap:${i}`,
        x: cellX,
        y: oldMapRowY,
        width: CELL_SIZE,
        height: CELL_SIZE,
        kind: 'cell',
        data: {
          arrayName: 'oldmap',
          index: i,
          value: { num: 0, arrays: [] },
          dimmed: !hasChunk,
          displayOverride: hasChunk ? '•' : undefined,
        } as CellData,
        opacity: 0.4,
      })
    }
  }

  // --- New map row ---
  // Position new map below old map (with gap for old map's chunk arrows in step 2)
  const mapRowY = hasOldMap ? oldMapRowY + CELL_SIZE + 20 : oldMapRowY
  const mapRowX = STRUCT_X

  for (let i = 0; i < state.mapCap; i++) {
    const cellX = mapRowX + i * (CELL_SIZE + CELL_GAP)
    const hasChunk = state.chunks[i] !== null

    elements.push({
      id: `cell:map:${i}`,
      x: cellX,
      y: mapRowY,
      width: CELL_SIZE,
      height: CELL_SIZE,
      kind: 'cell',
      data: {
        arrayName: 'map',
        index: i,
        value: { num: 0, arrays: [] },
        dimmed: !hasChunk,
        displayOverride: hasChunk ? '•' : undefined,
      } as CellData,
      opacity: 1.0,
    })
  }

  // Arrow from map struct field to first new map cell
  if (state.mapCap > 0) {
    const firstMapCellCenterX = mapRowX + CELL_SIZE / 2
    arrows.push({
      fromX: mapFieldCenterX,
      fromY: mapFieldBottomY,
      toX: firstMapCellCenterX,
      toY: mapRowY,
      style: 's-curve',
    })
  }

  // --- Chunk columns ---
  // Chunks are shared objects (pointers, not copies). They appear in ONE place:
  // - Step 1 (new map empty): chunks below old map
  // - Step 2+ (new map has chunks): chunks below new map, old map arrows point there too
  const chunksTopY = mapRowY + CELL_SIZE + MAP_TO_CHUNKS_GAP

  // Determine which chunks to render and their source
  const chunksToRender: { mapIdx: number; chunk: number[] }[] = []
  const chunkSourceState: DequeState = newMapHasChunks ? state : {
    ...state,
    chunks: state.oldChunks!,
    mapCap: state.oldMapCap!,
    mapBeg: state.oldMapBeg!,
  }

  if (newMapHasChunks) {
    // Chunks are below new map
    for (let i = 0; i < state.mapCap; i++) {
      if (state.chunks[i] !== null) {
        chunksToRender.push({ mapIdx: i, chunk: state.chunks[i]! })
      }
    }
  } else if (hasOldMap) {
    // Step 1: Chunks are below old map (but positioned at new map's chunk area)
    for (let i = 0; i < state.oldMapCap!; i++) {
      if (state.oldChunks![i] !== null) {
        chunksToRender.push({ mapIdx: i, chunk: state.oldChunks![i]! })
      }
    }
  }

  // Render chunk columns
  for (const { mapIdx, chunk } of chunksToRender) {
    const chunkColX = mapRowX + mapIdx * (CELL_SIZE + CELL_GAP)
    const mapCellCenterX = chunkColX + CELL_SIZE / 2

    // Arrow from relevant map cell to chunk
    if (newMapHasChunks) {
      // Arrow from new map cell to chunk
      arrows.push({
        fromX: mapCellCenterX,
        fromY: mapRowY + CELL_SIZE,
        toX: mapCellCenterX,
        toY: chunksTopY,
        style: 's-curve',
      })
    }

    for (let s = 0; s < state.chunkCap; s++) {
      const cellY = chunksTopY + s * (CELL_SIZE + CHUNK_CELL_GAP)
      const active = isSlotActive(chunkSourceState, mapIdx, s)

      elements.push({
        id: `cell:chunk:${mapIdx}:${s}`,
        x: chunkColX,
        y: cellY,
        width: CELL_SIZE,
        height: CELL_SIZE,
        kind: 'cell',
        data: {
          arrayName: `chunk${mapIdx}`,
          index: s,
          value: { num: chunk[s], arrays: [] },
          dimmed: !active,
        } as CellData,
        opacity: 1.0,
      })
    }
  }

  // Old map arrows pointing to chunks (below new map) in step 2
  if (hasOldMap && newMapHasChunks) {
    // The growth operation unwraps circular old map to linear new map:
    // Old active chunk at offset i → new map at mapBeg + i
    for (let oldIdx = 0; oldIdx < state.oldMapCap!; oldIdx++) {
      if (state.oldChunks![oldIdx] === null) continue
      // Compute active offset of this old chunk
      const activeOffset = (oldIdx - state.oldMapBeg! + state.oldMapCap!) % state.oldMapCap!
      const newIdx = state.mapBeg + activeOffset
      if (newIdx < state.mapCap && state.chunks[newIdx] !== null) {
        const oldCellCenterX = oldMapRowX + oldIdx * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2
        const targetChunkCenterX = mapRowX + newIdx * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2
        arrows.push({
          fromX: oldCellCenterX,
          fromY: oldMapRowY + CELL_SIZE,
          toX: targetChunkCenterX,
          toY: chunksTopY,
          style: 's-curve',
          opacity: 0.4,
        })
      }
    }
  } else if (hasOldMap && !newMapHasChunks) {
    // Step 1: old map arrows point straight down to chunks below new map
    for (let oldIdx = 0; oldIdx < state.oldMapCap!; oldIdx++) {
      if (state.oldChunks![oldIdx] === null) continue
      const oldCellCenterX = oldMapRowX + oldIdx * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2
      const targetChunkCenterX = mapRowX + oldIdx * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2
      arrows.push({
        fromX: oldCellCenterX,
        fromY: oldMapRowY + CELL_SIZE,
        toX: targetChunkCenterX,
        toY: chunksTopY,
        style: 's-curve',
        opacity: 0.4,
      })
    }
  }

  // --- Compute total dimensions ---
  const rightEdge = Math.max(
    mapRowX + state.mapCap * (CELL_SIZE + CELL_GAP) - CELL_GAP,
    hasOldMap ? STRUCT_X + state.oldMapCap! * (CELL_SIZE + CELL_GAP) - CELL_GAP : 0,
  )
  const hasChunks = chunksToRender.length > 0
  const bottomEdge = hasChunks
    ? chunksTopY + state.chunkCap * (CELL_SIZE + CHUNK_CELL_GAP) - CHUNK_CELL_GAP
    : mapRowY + CELL_SIZE

  return {
    elements,
    arrows,
    width: Math.max(rightEdge + 40, 400),
    height: bottomEdge + 40,
  }
}

// =============================================================================
// Exported Definition
// =============================================================================

export const dequeDS: DataStructure<DequeState> = {
  name: 'deque',
  defaultInput: '1, 2, 3, 4, 5',
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

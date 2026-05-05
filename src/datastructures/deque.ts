import type { DataStructure, DSLayout, DSArrow, DSSubstep } from './types.ts'
import type { FlatElement, CellData, StructFieldData } from '../layout/types.ts'
import { CELL_SIZE, CELL_GAP } from '../layout/constants.ts'

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

/** Get the value at logical index i. */
export function getAt(state: DequeState, i: number): number {
  const chunkOffset = Math.floor((state.chunkBeg + i) / state.chunkCap)
  const chunkIdx = chunkPhysical(state, chunkOffset)
  const withinChunk = (state.chunkBeg + i) % state.chunkCap
  return state.chunks[chunkIdx]![withinChunk]
}

/** Set the value at logical index i, returning a new state. */
function setAt(state: DequeState, i: number, val: number): DequeState {
  const chunkOffset = Math.floor((state.chunkBeg + i) / state.chunkCap)
  const chunkIdx = chunkPhysical(state, chunkOffset)
  const withinChunk = (state.chunkBeg + i) % state.chunkCap
  const newChunks = state.chunks.map((c, idx) =>
    idx === chunkIdx ? [...c!] : (c ? [...c] : null)
  )
  newChunks[chunkIdx]![withinChunk] = val
  return { ...state, chunks: newChunks }
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

function createInitialState(values: number[]): DequeState {
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
      const steps: Step[] = []
      let current = cloneState(state)

      // Check if last chunk has room
      const active = numActiveChunks(current)
      const needsNewChunk = active === 0 || (current.chunkBeg + current.taille) % current.chunkCap === 0

      if (needsNewChunk) {
        // Need a new chunk — check if map is full (all slots occupied)
        if (isMapFull(current)) {
          const growSteps = growMapSteps(current)
          steps.push(...growSteps)
          current = cloneState(growSteps[growSteps.length - 1].state)
        }
        // Allocate new chunk at next slot (wraps circularly)
        const newChunkIdx = chunkPhysical(current, numActiveChunks(current))
        const newState = cloneState(current)
        newState.chunks[newChunkIdx] = new Array(current.chunkCap).fill(0)
        steps.push({ state: cloneState(newState), description: `Allocate new chunk at map[${newChunkIdx}]` })
        current = newState
      }

      // Write value
      const writeChunkOffset = Math.floor((current.chunkBeg + current.taille) / current.chunkCap)
      const writeChunkIdx = chunkPhysical(current, writeChunkOffset)
      const writeSlot = (current.chunkBeg + current.taille) % current.chunkCap
      const finalState = cloneState(current)
      finalState.chunks[writeChunkIdx]![writeSlot] = val
      finalState.taille = current.taille + 1
      steps.push({ state: finalState, description: `Write ${val} at chunk[${writeChunkIdx}][${writeSlot}]` })
      return steps
    }

    case 'push_front': {
      const val = args.val ?? 0
      const steps: Step[] = []
      let current = cloneState(state)

      if (current.chunkBeg > 0) {
        // First chunk has room before chunkBeg
        const firstChunkIdx = current.mapBeg
        const finalState = cloneState(current)
        finalState.chunkBeg -= 1
        finalState.chunks[firstChunkIdx]![finalState.chunkBeg] = val
        finalState.taille += 1
        steps.push({ state: finalState, description: `Write ${val} at chunk[${firstChunkIdx}][${current.chunkBeg - 1}]` })
      } else {
        // chunkBeg == 0, need new chunk before mapBeg
        if (isMapFull(current)) {
          // All slots occupied — grow map
          const growSteps = growMapSteps(current)
          steps.push(...growSteps)
          current = cloneState(growSteps[growSteps.length - 1].state)
        }
        // Allocate new chunk at slot before mapBeg (wraps circularly)
        const newMapBeg = (current.mapBeg - 1 + current.mapCap) % current.mapCap
        const newState = cloneState(current)
        newState.chunks[newMapBeg] = new Array(current.chunkCap).fill(0)
        newState.mapBeg = newMapBeg
        newState.chunkBeg = current.chunkCap  // will be decremented next
        steps.push({ state: cloneState(newState), description: `Allocate new chunk at map[${newMapBeg}]` })
        current = newState

        // Write val at end of new chunk
        const finalState = cloneState(current)
        finalState.chunkBeg -= 1
        finalState.chunks[finalState.mapBeg]![finalState.chunkBeg] = val
        finalState.taille += 1
        steps.push({ state: finalState, description: `Write ${val} at chunk[${finalState.mapBeg}][${finalState.chunkBeg}]` })
      }
      return steps
    }

    case 'pop_back': {
      if (state.taille === 0) throw new Error('pop_back on empty deque')
      const steps: Step[] = []
      const current = cloneState(state)

      // Remove last element (using circular chunk index)
      const lastLogical = current.taille - 1
      const chunkOffset = Math.floor((current.chunkBeg + lastLogical) / current.chunkCap)
      const chunkIdx = chunkPhysical(current, chunkOffset)
      const slot = (current.chunkBeg + lastLogical) % current.chunkCap

      const removed = cloneState(current)
      removed.chunks[chunkIdx]![slot] = 0
      removed.taille -= 1
      steps.push({ state: cloneState(removed), description: `Remove element at chunk[${chunkIdx}][${slot}]` })

      // Check if chunk became empty (slot was 0 means this was its only element)
      if (slot === 0) {
        const dealloc = cloneState(removed)
        dealloc.chunks[chunkIdx] = null
        steps.push({ state: dealloc, description: `Deallocate empty chunk at map[${chunkIdx}]` })
      }

      return steps
    }

    case 'pop_front': {
      if (state.taille === 0) throw new Error('pop_front on empty deque')
      const steps: Step[] = []
      const current = cloneState(state)

      const chunkIdx = current.mapBeg
      const slot = current.chunkBeg

      // Remove first element
      const removed = cloneState(current)
      removed.chunks[chunkIdx]![slot] = 0
      removed.chunkBeg += 1
      removed.taille -= 1
      steps.push({ state: cloneState(removed), description: `Remove element at chunk[${chunkIdx}][${slot}]` })

      // If chunkBeg reaches chunkCap, deallocate chunk and advance mapBeg circularly
      if (removed.chunkBeg >= removed.chunkCap) {
        const dealloc = cloneState(removed)
        dealloc.chunks[chunkIdx] = null
        dealloc.mapBeg = (chunkIdx + 1) % dealloc.mapCap
        dealloc.chunkBeg = 0
        steps.push({ state: dealloc, description: `Deallocate empty chunk at map[${chunkIdx}], advance mapBeg` })
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
        // Make room at front
        const pushSteps = applyOperation(state, 'push_front', { val: 0 })
        const afterPush = pushSteps[pushSteps.length - 1].state
        const steps: Step[] = [...pushSteps]

        // Shift elements [1..pos] left by one (position 0 has the placeholder from push_front)
        const shifted = cloneState(afterPush)
        for (let i = 0; i < pos; i++) {
          const srcOffset = Math.floor((shifted.chunkBeg + i + 1) / shifted.chunkCap)
          const srcChunk = chunkPhysical(shifted, srcOffset)
          const srcSlot = (shifted.chunkBeg + i + 1) % shifted.chunkCap
          const dstOffset = Math.floor((shifted.chunkBeg + i) / shifted.chunkCap)
          const dstChunk = chunkPhysical(shifted, dstOffset)
          const dstSlot = (shifted.chunkBeg + i) % shifted.chunkCap
          shifted.chunks[dstChunk]![dstSlot] = shifted.chunks[srcChunk]![srcSlot]
        }
        steps.push({ state: cloneState(shifted), description: `Shift elements [0..${pos - 1}] left` })

        // Write value at position pos
        const wOffset = Math.floor((shifted.chunkBeg + pos) / shifted.chunkCap)
        const wChunk = chunkPhysical(shifted, wOffset)
        const wSlot = (shifted.chunkBeg + pos) % shifted.chunkCap
        shifted.chunks[wChunk]![wSlot] = val
        steps.push({ state: cloneState(shifted), description: `Write ${val} at position ${pos}` })

        return steps
      } else {
        // Make room at back
        const pushSteps = applyOperation(state, 'push_back', { val: 0 })
        const afterPush = pushSteps[pushSteps.length - 1].state
        const steps: Step[] = [...pushSteps]

        // Shift elements [pos..taille-2] right by one (taille already incremented by push_back)
        const shifted = cloneState(afterPush)
        for (let i = shifted.taille - 1; i > pos; i--) {
          const srcOffset = Math.floor((shifted.chunkBeg + i - 1) / shifted.chunkCap)
          const srcChunk = chunkPhysical(shifted, srcOffset)
          const srcSlot = (shifted.chunkBeg + i - 1) % shifted.chunkCap
          const dstOffset = Math.floor((shifted.chunkBeg + i) / shifted.chunkCap)
          const dstChunk = chunkPhysical(shifted, dstOffset)
          const dstSlot = (shifted.chunkBeg + i) % shifted.chunkCap
          shifted.chunks[dstChunk]![dstSlot] = shifted.chunks[srcChunk]![srcSlot]
        }
        steps.push({ state: cloneState(shifted), description: `Shift elements [${pos}..${state.taille - 1}] right` })

        // Write value at position pos
        const wOffset = Math.floor((shifted.chunkBeg + pos) / shifted.chunkCap)
        const wChunk = chunkPhysical(shifted, wOffset)
        const wSlot = (shifted.chunkBeg + pos) % shifted.chunkCap
        shifted.chunks[wChunk]![wSlot] = val
        steps.push({ state: cloneState(shifted), description: `Write ${val} at position ${pos}` })

        return steps
      }
    }

    case 'erase': {
      const pos = args.pos ?? 0
      if (state.taille === 0) throw new Error('erase on empty deque')
      if (pos < 0 || pos >= state.taille) throw new Error(`erase position ${pos} out of range [0, ${state.taille - 1}]`)

      const steps: Step[] = []

      // Shift elements left (using circular chunk addressing)
      const shifted = cloneState(state)
      for (let i = pos; i < shifted.taille - 1; i++) {
        const srcOffset = Math.floor((shifted.chunkBeg + i + 1) / shifted.chunkCap)
        const srcChunk = chunkPhysical(shifted, srcOffset)
        const srcSlot = (shifted.chunkBeg + i + 1) % shifted.chunkCap
        const dstOffset = Math.floor((shifted.chunkBeg + i) / shifted.chunkCap)
        const dstChunk = chunkPhysical(shifted, dstOffset)
        const dstSlot = (shifted.chunkBeg + i) % shifted.chunkCap
        shifted.chunks[dstChunk]![dstSlot] = shifted.chunks[srcChunk]![srcSlot]
      }
      steps.push({ state: cloneState(shifted), description: `Shift elements left from position ${pos + 1}` })

      // Now pop_back on the shifted state
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
  name: 'deque<T>',
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

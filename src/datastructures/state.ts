import { signal, computed } from '@preact/signals'
import type { DataStructure, DSSnapshot, DSLayout } from './types.ts'
import { vectorDS, type VectorState } from './vector.ts'

// Registry of available data structures
export const dataStructures: DataStructure<any>[] = [vectorDS]

// Mode and selection
export const isDSMode = signal(false)
export const currentDSIndex = signal(0)

export const currentDS = computed<DataStructure<any>>(
  () => dataStructures[currentDSIndex.value]
)

// History of snapshots (for undo/redo through operations)
export const dsHistory = signal<DSSnapshot<any>[]>([])
export const dsHistoryIndex = signal(-1)

export const currentDSSnapshot = computed<DSSnapshot<any> | null>(() => {
  const history = dsHistory.value
  const idx = dsHistoryIndex.value
  if (idx < 0 || idx >= history.length) return null
  return history[idx]
})

export const currentDSLayout = computed<DSLayout | null>(() => {
  const snapshot = currentDSSnapshot.value
  if (!snapshot) return null
  return currentDS.value.computeLayout(snapshot.state)
})

// --- Actions ---

export function selectDS(index: number): void {
  currentDSIndex.value = index
  initDS([1, 2, 3, 4, 5])
}

export function initDS(values: number[]): void {
  const ds = currentDS.value
  const state = ds.createInitialState(values)
  dsHistory.value = [{ state, label: 'initial' }]
  dsHistoryIndex.value = 0
}

export function applyDSOp(opName: string, args: Record<string, number>): void {
  const ds = currentDS.value
  const snapshot = currentDSSnapshot.value
  if (!snapshot) return

  const newState = ds.applyOperation(snapshot.state, opName, args)

  // Build label from operation name and args
  const argStr = Object.values(args).join(', ')
  const label = argStr ? `${opName}(${argStr})` : `${opName}()`

  // Truncate any forward history (discard redo stack)
  const history = dsHistory.value.slice(0, dsHistoryIndex.value + 1)
  history.push({ state: newState, label })
  dsHistory.value = history
  dsHistoryIndex.value = history.length - 1
}

export function dsUndo(): void {
  if (dsHistoryIndex.value > 0) {
    dsHistoryIndex.value = dsHistoryIndex.value - 1
  }
}

export function dsRedo(): void {
  if (dsHistoryIndex.value < dsHistory.value.length - 1) {
    dsHistoryIndex.value = dsHistoryIndex.value + 1
  }
}

export function enterDSMode(): void {
  isDSMode.value = true
  if (dsHistory.value.length === 0) {
    initDS([1, 2, 3, 4, 5])
  }
}

export function exitDSMode(): void {
  isDSMode.value = false
}

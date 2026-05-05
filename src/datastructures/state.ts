import { signal, computed } from '@preact/signals'
import type { DataStructure, DSOperation, DSLayout } from './types.ts'
import { vectorDS } from './vector.ts'
import { forwardListDS } from './forward-list.ts'
import { listDS } from './list.ts'
import { dequeDS } from './deque.ts'

// Registry of available data structures
export const dataStructures: DataStructure<any>[] = [vectorDS, forwardListDS, listDS, dequeDS]

// Mode and selection
export const isDSMode = signal(false)
export const currentDSIndex = signal(0)

export const currentDS = computed<DataStructure<any>>(
  () => dataStructures[currentDSIndex.value]
)

// History: list of operations, each with substeps
export const dsHistory = signal<DSOperation[]>([])
export const dsOpIndex = signal(0)
export const dsSubstepIndex = signal(0)

// Animation state
export const dsAnimating = signal(false)
let animationTimer: ReturnType<typeof setTimeout> | null = null
const ANIMATION_DELAY = 500

// Derived state
export const currentDSOp = computed<DSOperation | null>(() => {
  const history = dsHistory.value
  const idx = dsOpIndex.value
  if (idx < 0 || idx >= history.length) return null
  return history[idx]
})

export const currentDSState = computed<any | null>(() => {
  const op = currentDSOp.value
  if (!op) return null
  const si = dsSubstepIndex.value
  if (si < 0 || si >= op.substeps.length) return null
  return op.substeps[si].state
})

export const currentDSDescription = computed<string | null>(() => {
  const op = currentDSOp.value
  if (!op) return null
  const si = dsSubstepIndex.value
  if (si < 0 || si >= op.substeps.length) return null
  return op.substeps[si].description
})

export const isIntermediateSubstep = computed<boolean>(() => {
  const op = currentDSOp.value
  if (!op) return false
  return dsSubstepIndex.value < op.substeps.length - 1
})

export const currentDSLayout = computed<DSLayout | null>(() => {
  const state = currentDSState.value
  if (!state) return null
  return currentDS.value.computeLayout(state)
})

// --- Actions ---

function cancelAnimation(): void {
  if (animationTimer !== null) {
    clearTimeout(animationTimer)
    animationTimer = null
  }
  dsAnimating.value = false
}

export function selectDS(index: number): void {
  cancelAnimation()
  currentDSIndex.value = index
  initDS([1, 2, 3, 4, 5])
}

export function initDS(values: number[]): void {
  cancelAnimation()
  const ds = currentDS.value
  const state = ds.createInitialState(values)
  dsHistory.value = [{
    label: 'initial',
    substeps: [{ state, description: 'Initial state' }],
  }]
  dsOpIndex.value = 0
  dsSubstepIndex.value = 0
}

export function applyDSOp(opName: string, args: Record<string, number>): void {
  cancelAnimation()
  const ds = currentDS.value
  const state = currentFinalState()
  if (!state) return

  const substeps = ds.applyOperation(state, opName, args)

  const argStr = Object.values(args).join(', ')
  const label = argStr ? `${opName}(${argStr})` : `${opName}()`

  // Truncate any forward history
  const history = dsHistory.value.slice(0, dsOpIndex.value + 1)
  history.push({ label, substeps })
  dsHistory.value = history

  const newOpIdx = history.length - 1
  dsOpIndex.value = newOpIdx
  dsSubstepIndex.value = 0

  // Animate through substeps
  if (substeps.length > 1) {
    dsAnimating.value = true
    scheduleNextSubstep()
  }
}

function scheduleNextSubstep(): void {
  animationTimer = setTimeout(() => {
    const op = dsHistory.value[dsOpIndex.value]
    if (!op) { cancelAnimation(); return }
    const nextIdx = dsSubstepIndex.value + 1
    if (nextIdx < op.substeps.length) {
      dsSubstepIndex.value = nextIdx
      if (nextIdx < op.substeps.length - 1) {
        scheduleNextSubstep()
      } else {
        cancelAnimation()
      }
    } else {
      cancelAnimation()
    }
  }, ANIMATION_DELAY)
}

/** Get the final state of the current operation. */
function currentFinalState(): any | null {
  const history = dsHistory.value
  const idx = dsOpIndex.value
  if (idx < 0 || idx >= history.length) return null
  const op = history[idx]
  return op.substeps[op.substeps.length - 1].state
}

// --- Navigation ---

/** Arrow right: next operation, jump to final substep. */
export function dsNext(): void {
  cancelAnimation()
  const history = dsHistory.value
  if (dsOpIndex.value < history.length - 1) {
    dsOpIndex.value = dsOpIndex.value + 1
    dsSubstepIndex.value = history[dsOpIndex.value].substeps.length - 1
  }
}

/** Arrow left: previous operation, jump to final substep. */
export function dsPrev(): void {
  cancelAnimation()
  if (dsOpIndex.value > 0) {
    dsOpIndex.value = dsOpIndex.value - 1
    dsSubstepIndex.value = dsHistory.value[dsOpIndex.value].substeps.length - 1
  }
}

/** Shift+right: next substep (may cross operation boundary). */
export function dsNextSubstep(): void {
  cancelAnimation()
  const history = dsHistory.value
  const op = history[dsOpIndex.value]
  if (!op) return

  if (dsSubstepIndex.value < op.substeps.length - 1) {
    dsSubstepIndex.value = dsSubstepIndex.value + 1
  } else if (dsOpIndex.value < history.length - 1) {
    dsOpIndex.value = dsOpIndex.value + 1
    dsSubstepIndex.value = 0
  }
}

/** Shift+left: previous substep (may cross operation boundary). */
export function dsPrevSubstep(): void {
  cancelAnimation()
  const history = dsHistory.value

  if (dsSubstepIndex.value > 0) {
    dsSubstepIndex.value = dsSubstepIndex.value - 1
  } else if (dsOpIndex.value > 0) {
    dsOpIndex.value = dsOpIndex.value - 1
    dsSubstepIndex.value = history[dsOpIndex.value].substeps.length - 1
  }
}

/** Jump to a specific operation (final substep). */
export function dsGoToOp(opIdx: number): void {
  cancelAnimation()
  const history = dsHistory.value
  if (opIdx < 0 || opIdx >= history.length) return
  dsOpIndex.value = opIdx
  dsSubstepIndex.value = history[opIdx].substeps.length - 1
}

/** Jump to a specific substep within the current operation. */
export function dsGoToSubstep(substepIdx: number): void {
  cancelAnimation()
  const op = dsHistory.value[dsOpIndex.value]
  if (!op || substepIdx < 0 || substepIdx >= op.substeps.length) return
  dsSubstepIndex.value = substepIdx
}

export function enterDSMode(): void {
  isDSMode.value = true
  if (dsHistory.value.length === 0) {
    initDS([1, 2, 3, 4, 5])
  }
}

export function exitDSMode(): void {
  cancelAnimation()
  isDSMode.value = false
}

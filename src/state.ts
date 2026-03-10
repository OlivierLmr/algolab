import { signal, computed, effect } from '@preact/signals'
import type { Step, AlgorithmDefinition } from './types.ts'
import { algorithms } from './algorithms/index.ts'
import { runAlgorithm } from './dsl/index.ts'

export const algorithmList = algorithms

// Read initial state from URL hash
function readHash(): { algo: number; step: number; input: string } | null {
  const hash = window.location.hash.slice(1)
  if (!hash) return null
  const params = new URLSearchParams(hash)
  const algo = params.has('algo') ? Number(params.get('algo')) : NaN
  const step = params.has('step') ? Number(params.get('step')) : NaN
  const input = params.get('input')
  if (Number.isNaN(algo) || algo < 0 || algo >= algorithms.length) return null
  return {
    algo,
    step: Number.isNaN(step) ? 0 : step,
    input: input ?? algorithms[algo].defaultInput.join(', '),
  }
}

const initial = readHash()

export const currentAlgoIndex = signal(initial?.algo ?? 0)
export const currentStepIndex = signal(initial?.step ?? 0)
export const inputText = signal(initial?.input ?? algorithms[0].defaultInput.join(', '))

export const currentAlgo = computed<AlgorithmDefinition>(
  () => algorithmList[currentAlgoIndex.value]
)

const parsedInput = computed<number[]>(() => {
  const nums = inputText.value
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n))
  return nums.length > 0 ? nums : currentAlgo.value.defaultInput
})

export const steps = computed<Step[]>(() => {
  const algo = currentAlgo.value
  const match = algo.source.match(/algo \w+\((\w+):/)
  const paramName = match ? match[1] : 'arr'
  return runAlgorithm(algo.source, paramName, parsedInput.value)
})

export const currentStep = computed<Step>(
  () => steps.value[currentStepIndex.value]
)

export const totalSteps = computed(() => steps.value.length)

export const recentDescriptions = computed<string[]>(() => {
  const idx = currentStepIndex.value
  const all = steps.value
  const result: string[] = []
  for (let i = Math.max(0, idx - 3); i < idx; i++) {
    if (all[i].description) result.push(all[i].description)
  }
  return result
})

// Clamp initial step to valid range
if (initial) {
  const maxStep = steps.value.length - 1
  if (currentStepIndex.value > maxStep) currentStepIndex.value = maxStep
}

// Sync state to URL hash
effect(() => {
  const algo = currentAlgoIndex.value
  const step = currentStepIndex.value
  const input = inputText.value
  const defaultInput = algorithmList[algo].defaultInput.join(', ')
  const params = new URLSearchParams()
  params.set('algo', String(algo))
  params.set('step', String(step))
  if (input !== defaultInput) params.set('input', input)
  window.history.replaceState(null, '', '#' + params.toString())
})

export function selectAlgorithm(index: number): void {
  currentAlgoIndex.value = index
  currentStepIndex.value = 0
  inputText.value = algorithmList[index].defaultInput.join(', ')
}

export function nextStep(): void {
  if (currentStepIndex.value < steps.value.length - 1) {
    currentStepIndex.value++
  }
}

export function prevStep(): void {
  if (currentStepIndex.value > 0) {
    currentStepIndex.value--
  }
}

export function goToStep(index: number): void {
  currentStepIndex.value = Math.max(0, Math.min(index, steps.value.length - 1))
}

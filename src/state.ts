import { signal, computed } from '@preact/signals'
import type { Step, AlgorithmDefinition } from './types.ts'
import { algorithms } from './algorithms/index.ts'
import { runAlgorithm } from './dsl/index.ts'

export const algorithmList = algorithms

export const currentAlgoIndex = signal(0)
export const currentStepIndex = signal(0)

export const currentAlgo = computed<AlgorithmDefinition>(
  () => algorithmList[currentAlgoIndex.value]
)

export const steps = computed<Step[]>(() => {
  const algo = currentAlgo.value
  // Extract first param name from source (the array param)
  const match = algo.source.match(/algo \w+\((\w+):/)
  const paramName = match ? match[1] : 'arr'
  return runAlgorithm(algo.source, paramName, algo.defaultInput)
})

export const currentStep = computed<Step>(
  () => steps.value[currentStepIndex.value]
)

export const totalSteps = computed(() => steps.value.length)

export function selectAlgorithm(index: number): void {
  currentAlgoIndex.value = index
  currentStepIndex.value = 0
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

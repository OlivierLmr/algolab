import { signal, computed, effect } from '@preact/signals'
import type { Step, AlgorithmDefinition } from './types.ts'
import { algorithms } from './algorithms/index.ts'
import { runAlgorithm } from './dsl/index.ts'

export const algorithmList = algorithms

const CUSTOM_TEMPLATE = `algo MySort(arr: int[])
  #: comment "Custom algorithm"
  for i from 0 to len(arr) - 2
    for j from 0 to len(arr) - 2 - i
      if arr[j] > arr[j + 1]
        swap arr[j], arr[j + 1]`

// Read initial state from URL hash
function readHash(): { algo: number | 'custom'; step: number; input: string } | null {
  const hash = window.location.hash.slice(1)
  if (!hash) return null
  const params = new URLSearchParams(hash)
  const algoRaw = params.get('algo')
  const step = params.has('step') ? Number(params.get('step')) : NaN
  const input = params.get('input')

  if (algoRaw === 'custom') {
    return {
      algo: 'custom',
      step: Number.isNaN(step) ? 0 : step,
      input: input ?? '5, 3, 8, 1, 2',
    }
  }

  const algo = algoRaw !== null ? Number(algoRaw) : NaN
  if (Number.isNaN(algo) || algo < 0 || algo >= algorithms.length) return null
  return {
    algo,
    step: Number.isNaN(step) ? 0 : step,
    input: input ?? algorithms[algo].defaultInput.join(', '),
  }
}

const initial = readHash()

export const currentAlgoIndex = signal(initial?.algo === 'custom' ? 0 : (initial?.algo ?? 0))
export const currentStepIndex = signal(initial?.step ?? 0)
export const inputText = signal(
  initial?.algo === 'custom'
    ? algorithms[0].defaultInput.join(', ')
    : (initial?.input ?? algorithms[0].defaultInput.join(', '))
)

// Layout
export const codePanelWidth = signal(400)

// Custom mode state
export const isCustomMode = signal(initial?.algo === 'custom')
export const isRunMode = signal(false)
export const customSource = signal(CUSTOM_TEMPLATE)
export const customInput = signal(
  initial?.algo === 'custom' ? (initial?.input ?? '5, 3, 8, 1, 2') : '5, 3, 8, 1, 2'
)

export const currentAlgo = computed<AlgorithmDefinition>(() => {
  if (isCustomMode.value) {
    return {
      name: 'Custom',
      source: customSource.value,
      defaultInput: [5, 3, 8, 1, 2],
    }
  }
  return algorithmList[currentAlgoIndex.value]
})

const parsedInput = computed<number[]>(() => {
  const raw = isCustomMode.value ? customInput.value : inputText.value
  const nums = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n))
  return nums.length > 0 ? nums : currentAlgo.value.defaultInput
})

const stepsResult = computed<{ steps: Step[]; error: string | null }>(() => {
  if (isCustomMode.value && !isRunMode.value) {
    return { steps: [], error: null }
  }
  const algo = currentAlgo.value
  try {
    const match = algo.source.match(/algo \w+\((\w+):/)
    const paramName = match ? match[1] : 'arr'
    const result = runAlgorithm(algo.source, paramName, parsedInput.value)
    return { steps: result, error: null }
  } catch (e) {
    return { steps: [], error: e instanceof Error ? e.message : String(e) }
  }
})

export const steps = computed<Step[]>(() => stepsResult.value.steps)
export const parseError = computed<string | null>(() => stepsResult.value.error)

export const currentStep = computed<Step>(
  () => steps.value[currentStepIndex.value]
)

export const totalSteps = computed(() => steps.value.length)

// Skip function state
export const skippedFunctions = signal<Set<string>>(new Set())

export const availableFunctions = computed<string[]>(() => {
  const source = currentAlgo.value.source
  const names: string[] = []
  for (const m of source.matchAll(/^\s*def\s+(\w+)\s*\(/gm)) {
    names.push(m[1])
  }
  return names
})

/** Parse function line ranges from source using indentation-based blocks. */
export function getFunctionLineRanges(source: string): { name: string; startLine: number; endLine: number }[] {
  const lines = source.split('\n')
  const ranges: { name: string; startLine: number; endLine: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)def\s+(\w+)\s*\(/)
    if (!match) continue
    const defIndent = match[1].length
    const name = match[2]
    const startLine = i
    let endLine = i
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j]
      if (line.trim() === '') { endLine = j; continue }
      const indent = line.match(/^(\s*)/)![1].length
      if (indent <= defIndent) break
      endLine = j
    }
    ranges.push({ name, startLine, endLine })
  }
  return ranges
}

export const functionLineRanges = computed(() => getFunctionLineRanges(currentAlgo.value.source))

/** Returns true if any call stack frame's function name is in skippedFunctions. */
function isStepInSkippedFunction(step: Step): boolean {
  const skipped = skippedFunctions.value
  if (skipped.size === 0) return false
  return step.callStack.some((frame) => {
    const name = frame.label.replace(/\(.*$/, '')
    return skipped.has(name)
  })
}

export function stepOver(): void {
  const allSteps = steps.value
  const idx = currentStepIndex.value
  if (idx >= allSteps.length - 1) return
  const currentDepth = allSteps[idx].callStack.length
  let i = idx + 1
  while (i < allSteps.length && allSteps[i].callStack.length > currentDepth) {
    i++
  }
  if (i >= allSteps.length) i = allSteps.length - 1
  // Skip past skipped functions
  while (i < allSteps.length - 1 && isStepInSkippedFunction(allSteps[i])) {
    i++
  }
  currentStepIndex.value = i
}

export function stepOut(): void {
  const allSteps = steps.value
  const idx = currentStepIndex.value
  if (idx >= allSteps.length - 1) return
  const currentDepth = allSteps[idx].callStack.length
  if (currentDepth === 0) return
  let i = idx + 1
  while (i < allSteps.length && allSteps[i].callStack.length >= currentDepth) {
    i++
  }
  if (i >= allSteps.length) i = allSteps.length - 1
  // Skip past skipped functions
  while (i < allSteps.length - 1 && isStepInSkippedFunction(allSteps[i])) {
    i++
  }
  currentStepIndex.value = i
}

export function stepOverBack(): void {
  const allSteps = steps.value
  const idx = currentStepIndex.value
  if (idx <= 0) return
  const currentDepth = allSteps[idx].callStack.length
  let i = idx - 1
  while (i > 0 && allSteps[i].callStack.length > currentDepth) {
    i--
  }
  // Skip past skipped functions
  while (i > 0 && isStepInSkippedFunction(allSteps[i])) {
    i--
  }
  currentStepIndex.value = i
}

export function stepOutBack(): void {
  const allSteps = steps.value
  const idx = currentStepIndex.value
  if (idx <= 0) return
  const currentDepth = allSteps[idx].callStack.length
  if (currentDepth === 0) return
  let i = idx - 1
  while (i > 0 && allSteps[i].callStack.length >= currentDepth) {
    i--
  }
  // Skip past skipped functions
  while (i > 0 && isStepInSkippedFunction(allSteps[i])) {
    i--
  }
  currentStepIndex.value = i
}

export function toggleSkipFunction(name: string): void {
  const next = new Set(skippedFunctions.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  skippedFunctions.value = next
}

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
  if (currentStepIndex.value > maxStep) currentStepIndex.value = Math.max(0, maxStep)
}

// Sync state to URL hash
effect(() => {
  const params = new URLSearchParams()
  if (isCustomMode.value) {
    params.set('algo', 'custom')
  } else {
    params.set('algo', String(currentAlgoIndex.value))
  }
  params.set('step', String(currentStepIndex.value))
  const input = isCustomMode.value ? customInput.value : inputText.value
  const defaultInput = isCustomMode.value
    ? '5, 3, 8, 1, 2'
    : algorithmList[currentAlgoIndex.value].defaultInput.join(', ')
  if (input !== defaultInput) params.set('input', input)
  window.history.replaceState(null, '', '#' + params.toString())
})

export function selectAlgorithm(index: number): void {
  isCustomMode.value = false
  isRunMode.value = false
  currentAlgoIndex.value = index
  currentStepIndex.value = 0
  inputText.value = algorithmList[index].defaultInput.join(', ')
  skippedFunctions.value = new Set()
}

export function selectCustom(): void {
  isCustomMode.value = true
  isRunMode.value = false
  currentStepIndex.value = 0
  skippedFunctions.value = new Set()
}

export function editBuiltIn(): void {
  const algo = algorithmList[currentAlgoIndex.value]
  customSource.value = algo.source
  customInput.value = inputText.value
  isCustomMode.value = true
  isRunMode.value = false
  currentStepIndex.value = 0
}

export function toggleRunMode(): void {
  isRunMode.value = !isRunMode.value
  if (isRunMode.value) {
    currentStepIndex.value = 0
  }
}

/** Try to parse the custom source. Returns null on success, error message on failure. */
export function tryParseCustom(): string | null {
  try {
    const source = customSource.value
    const match = source.match(/algo \w+\((\w+):/)
    const paramName = match ? match[1] : 'arr'
    const raw = customInput.value
    const nums = raw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n))
    const input = nums.length > 0 ? nums : [5, 3, 8, 1, 2]
    runAlgorithm(source, paramName, input)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

export function nextStep(): void {
  const allSteps = steps.value
  let i = currentStepIndex.value
  if (i >= allSteps.length - 1) return
  i++
  while (i < allSteps.length - 1 && isStepInSkippedFunction(allSteps[i])) {
    i++
  }
  currentStepIndex.value = i
}

export function prevStep(): void {
  const allSteps = steps.value
  let i = currentStepIndex.value
  if (i <= 0) return
  i--
  while (i > 0 && isStepInSkippedFunction(allSteps[i])) {
    i--
  }
  currentStepIndex.value = i
}

export function goToStep(index: number): void {
  currentStepIndex.value = Math.max(0, Math.min(index, steps.value.length - 1))
}

import { signal, computed, effect } from '@preact/signals'
import type { Step, AlgorithmDefinition, DescriptionSegment } from './types.ts'
import { algorithms } from './algorithms/index.ts'
import { compilePipeline, runAlgorithm } from './dsl/index.ts'
import type { PipelineResult } from './dsl/index.ts'
import { isDSMode } from './datastructures/state.ts'

export const algorithmList = algorithms

const CUSTOM_TEMPLATE = `algo MySort(arr[])
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
  // DS mode has its own initialization — don't restore algo state
  if (params.has('ds')) return null
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
export const sidebarOpen = signal(true)

// Custom mode state
export const isCustomMode = signal(initial?.algo === 'custom')
export const isRunMode = signal(false)
export const customSource = signal(CUSTOM_TEMPLATE)
export const customInput = signal(
  initial?.algo === 'custom' ? (initial?.input ?? '5, 3, 8, 1, 2') : '5, 3, 8, 1, 2'
)

/**
 * Extract the parameter list from an algo signature like `algo Name(arr[], k, m)`.
 * Tolerant of whitespace; returns an empty list if the signature can't be parsed.
 */
export function extractAlgoParams(source: string): { name: string; isArray: boolean }[] {
  const match = source.match(/algo\s+\w+\s*\(([^)]*)\)/)
  if (!match) return []
  const inside = match[1].trim()
  if (inside.length === 0) return []
  return inside.split(',').map(s => {
    const tok = s.trim()
    const isArray = tok.endsWith('[]')
    const name = isArray ? tok.slice(0, -2).trim() : tok
    return { name, isArray }
  }).filter(p => /^\w+$/.test(p.name))
}

/** User-provided values for scalar inputs, keyed by param name. Stale entries are
 *  harmless: the runner ignores any name not declared in the current algo signature. */
export const scalarInputs = signal<Record<string, number>>(
  Object.fromEntries(
    (algorithmList[currentAlgoIndex.value]?.scalarInputs ?? []).map(s => [s.name, s.defaultValue])
  )
)

/** Scalar param names declared in the current algorithm's source, in order. */
export const currentScalarParams = computed<string[]>(() => {
  const src = isCustomMode.value ? customSource.value : currentAlgo.value.source
  return extractAlgoParams(src).filter(p => !p.isArray).map(p => p.name)
})

/** Resolve a default value for a scalar param: from the algo's declared defaults, else 0. */
export function scalarDefault(paramName: string): number {
  const algo = currentAlgo.value
  const def = algo.scalarInputs?.find(s => s.name === paramName)
  return def?.defaultValue ?? 0
}

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

const pipelineResult = computed<{ result: PipelineResult | null; error: string | null }>(() => {
  if (isCustomMode.value && !isRunMode.value) {
    return { result: null, error: null }
  }
  const algo = currentAlgo.value
  try {
    const match = algo.source.match(/algo \w+\((\w+):/)
    const paramName = match ? match[1] : 'arr'
    const result = compilePipeline(algo.source, paramName, parsedInput.value, scalarInputs.value)
    return { result, error: null }
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : String(e) }
  }
})

export const steps = computed<Step[]>(() => pipelineResult.value.result?.steps ?? [])
export const parseError = computed<string | null>(() => pipelineResult.value.error)
export const pipelineColorMap = computed(() => pipelineResult.value.result?.colorMap ?? new Map<string, string>())
export const pipelineBlockRanges = computed(() => pipelineResult.value.result?.blockRanges ?? [])
export const pipelineDisplayInfo = computed(() => pipelineResult.value.result?.displayInfo ?? null)
export const pipelineDefaultDisabledLines = computed(() => pipelineResult.value.result?.defaultDisabledLines ?? new Set<number>())

export const currentStep = computed<Step>(
  () => steps.value[currentStepIndex.value]
)

export const totalSteps = computed(() => steps.value.length)

// Per-line breakpoint state (disabled lines)
export const disabledLines = signal<Set<number>>(new Set())

/** Toggle breakpoint on a source line. If it's a block head (def/for/while/if), toggle the entire block. */
export function toggleBreakpoint(sourceLine: number): void {
  const next = new Set(disabledLines.value)
  const ranges = pipelineBlockRanges.value
  const range = ranges.find((r) => r.startLine === sourceLine)
  if (range) {
    // Toggle all lines in the function (def line + body)
    const allDisabled = Array.from({ length: range.endLine - range.startLine + 1 }, (_, i) => range.startLine + i)
      .every((l) => next.has(l))
    for (let l = range.startLine; l <= range.endLine; l++) {
      if (allDisabled) next.delete(l)
      else next.add(l)
    }
  } else {
    if (next.has(sourceLine)) next.delete(sourceLine)
    else next.add(sourceLine)
  }
  disabledLines.value = next
}

function isStepOnDisabledLine(step: Step): boolean {
  return disabledLines.value.has(step.currentLine)
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
  while (i < allSteps.length - 1 && isStepOnDisabledLine(allSteps[i])) {
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
  while (i < allSteps.length - 1 && isStepOnDisabledLine(allSteps[i])) {
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
  while (i > 0 && isStepOnDisabledLine(allSteps[i])) {
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
  while (i > 0 && isStepOnDisabledLine(allSteps[i])) {
    i--
  }
  currentStepIndex.value = i
}

export interface RecentDescription {
  parts: DescriptionSegment[]
  line: number
}

export const recentDescriptions = computed<RecentDescription[]>(() => {
  const idx = currentStepIndex.value
  const all = steps.value
  if (idx >= all.length) return []
  const currentBlockDepth = all[idx].blockDescriptions.length
  const result: RecentDescription[] = []
  // Look back for one-shot #: comment descriptions at the same block depth.
  // Only collect steps explicitly marked as comments (not auto-generated descriptions).
  // - Lower depth means we left the current block → stop (boundary).
  // - Higher depth means a function call went deeper → skip over those
  //   steps but keep scanning (the call returned to our level).
  for (let i = idx - 1; i >= 0 && result.length < 3; i--) {
    const stepDepth = all[i].blockDescriptions.length
    if (stepDepth < currentBlockDepth) break
    if (stepDepth > currentBlockDepth) continue
    if (all[i].isComment) {
      result.unshift({ parts: all[i].descriptionParts, line: all[i].currentLine })
    }
  }
  return result
})

/** Line number to highlight in code panel when hovering a description entry. */
export const hoveredDescriptionLine = signal<number | null>(null)

// Clamp initial step to valid range and apply default disabled lines
if (initial) {
  const maxStep = steps.value.length - 1
  if (currentStepIndex.value > maxStep) currentStepIndex.value = Math.max(0, maxStep)
}
disabledLines.value = new Set(pipelineDefaultDisabledLines.value)

// Sync state to URL hash (only when not in DS mode — DS mode has its own sync)
effect(() => {
  if (isDSMode.value) return
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
  scalarInputs.value = Object.fromEntries(
    (algorithmList[index].scalarInputs ?? []).map(s => [s.name, s.defaultValue])
  )
  disabledLines.value = new Set(pipelineDefaultDisabledLines.value)
}

export function selectCustom(): void {
  isCustomMode.value = true
  isRunMode.value = false
  currentStepIndex.value = 0
  // Leave scalarInputs alone — the user's current edits may already declare
  // scalar params, and the runner ignores stale entries.
  disabledLines.value = new Set()
}

export function editBuiltIn(): void {
  const algo = algorithmList[currentAlgoIndex.value]
  customSource.value = algo.source
  customInput.value = inputText.value
  // scalarInputs already holds whatever values the user picked for this algo;
  // they carry over into the custom editor (its signature is the same to start).
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
    const match = source.match(/algo \w+\((\w+)\[/)
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
  while (i < allSteps.length - 1 && isStepOnDisabledLine(allSteps[i])) {
    i++
  }
  currentStepIndex.value = i
}

export function prevStep(): void {
  const allSteps = steps.value
  let i = currentStepIndex.value
  if (i <= 0) return
  i--
  while (i > 0 && isStepOnDisabledLine(allSteps[i])) {
    i--
  }
  currentStepIndex.value = i
}

export function goToStep(index: number): void {
  currentStepIndex.value = Math.max(0, Math.min(index, steps.value.length - 1))
}

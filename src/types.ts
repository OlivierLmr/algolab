import type { Value } from './dsl/value.ts'
export type { Value } from './dsl/value.ts'

export interface TrackedArray {
  name: string
  values: Value[]
}

export interface Highlight {
  arrayName: string
  indices: number[]
  type: 'compare' | 'swap' | 'sorted' | 'active'
}

export interface VarHighlight {
  varName: string
  type: 'compare' | 'swap' | 'sorted' | 'active'
}

export interface DimRange {
  arrayName: string
  from: number
  to: number
}

export interface CallFrame {
  label: string
  variables: Record<string, Value>
  arrayRefs: { paramName: string; targetName: string }[]
  arrays: TrackedArray[]
  highlights: Highlight[]
  varHighlights: VarHighlight[]
  dimRanges: DimRange[]
  gaugeArrays: string[]
}

export interface BlockDescription {
  text: string
  depth: number
}

export interface Step {
  arrays: TrackedArray[]
  highlights: Highlight[]
  varHighlights: VarHighlight[]
  dimRanges: DimRange[]
  gaugeArrays: string[]
  variables: Record<string, Value>
  callStack: CallFrame[]
  currentLine: number
  description: string
  blockDescriptions: BlockDescription[]
  scopeDepth: number
}

export interface AlgorithmDefinition {
  name: string
  source: string
  defaultInput: number[]
}

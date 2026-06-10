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

export interface HeapInfo {
  arrayName: string
  kind: 'max' | 'min'
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
  heapArrays: HeapInfo[]
}

export type DescriptionSegment =
  | { type: 'text'; text: string }
  | { type: 'pill'; name: string; value: number; color: string | undefined; display: 'name' | 'name-value' | 'value' }

export interface BlockDescription {
  text: string
  parts: DescriptionSegment[]
  depth: number
  line: number
}

export interface Step {
  arrays: TrackedArray[]
  highlights: Highlight[]
  varHighlights: VarHighlight[]
  dimRanges: DimRange[]
  gaugeArrays: string[]
  heapArrays: HeapInfo[]
  variables: Record<string, Value>
  callStack: CallFrame[]
  currentLine: number
  description: string
  descriptionParts: DescriptionSegment[]
  isComment: boolean
  blockDescriptions: BlockDescription[]
  tooltips: Record<string, string>
  scopeDepth: number
}

export function segmentsToString(parts: DescriptionSegment[]): string {
  return parts.map(p => {
    if (p.type === 'text') return p.text
    switch (p.display) {
      case 'name': return p.name
      case 'value': return String(p.value)
      default: return `${p.name}=${p.value}`
    }
  }).join('')
}

export interface ScalarInputDef {
  name: string           // matches a top-level param in the algo signature
  label?: string         // optional UI label (defaults to name)
  defaultValue: number
}

export interface AlgorithmDefinition {
  name: string
  source: string
  defaultInput: number[]
  /** Extra scalar inputs (besides the main array). Each must match a top-level param. */
  scalarInputs?: ScalarInputDef[]
}

export interface TrackedArray {
  name: string
  values: number[]
}

export interface Pointer {
  name: string
  arrayName: string
  index: number
  color: string
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
  variables: Record<string, number>
  arrays: TrackedArray[]
  pointers: Pointer[]
  highlights: Highlight[]
  varHighlights: VarHighlight[]
  dimRanges: DimRange[]
}

export interface Step {
  arrays: TrackedArray[]
  pointers: Pointer[]
  highlights: Highlight[]
  varHighlights: VarHighlight[]
  dimRanges: DimRange[]
  variables: Record<string, number>
  callStack: CallFrame[]
  currentLine: number
  description: string
}

export interface AlgorithmDefinition {
  name: string
  source: string
  defaultInput: number[]
}

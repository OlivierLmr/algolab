import type { FlatElement } from '../layout/types.ts'

/** Arrow drawn between elements in a data structure visualization. */
export interface DSArrow {
  fromX: number
  fromY: number
  toX: number
  toY: number
  color?: string
  /** 's-curve' for vertical struct→array arrows, 'straight' for horizontal node→node. Default: 's-curve'. */
  style?: 's-curve' | 'straight'
  /** Opacity for dimmed arrows (e.g. old map during reallocation). Default: 1.0. */
  opacity?: number
  /** Suppress the arrowhead (e.g. for undirected tree edges). Default: false. */
  noArrowhead?: boolean
}

/** Layout output for a data structure visualization. */
export interface DSLayout {
  elements: FlatElement[]
  arrows: DSArrow[]
  width: number
  height: number
}

/** Definition of an argument for a data structure operation. */
export interface ArgDef {
  name: string
  label: string
  defaultValue?: number
}

/** Definition of an operation that can be performed on a data structure. */
export interface OperationDef {
  name: string
  label: string
  args: ArgDef[]
}

/** A single intermediate step within an operation. */
export interface DSSubstep<S> {
  state: S
  description: string     // e.g. "Allocate new array (capacity 16)"
}

/** A recorded operation with all its substeps. */
export interface DSOperation {
  label: string           // e.g. "insert(0, 99)" or "initial"
  substeps: DSSubstep<any>[]
}

/**
 * A data structure definition. Each concrete data structure (vector, list, deque)
 * implements this interface with its own state type.
 *
 * The design separates state (pure data), operations (pure functions that produce
 * new states with intermediate substeps), and layout (pure function from state to
 * visual elements). This keeps each concern independently testable.
 */
export interface DataStructure<S> {
  name: string
  operations: OperationDef[]
  /** Default text shown in the input field when this DS is selected. */
  defaultInput?: string
  /** Parse a user-provided input string into the initial state. */
  createInitialState(input: string): S
  applyOperation(state: S, op: string, args: Record<string, number>): DSSubstep<S>[]
  computeLayout(state: S): DSLayout
}

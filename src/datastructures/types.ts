import type { FlatElement } from '../layout/types.ts'

/** Arrow drawn from a struct field to an internal memory structure. */
export interface DSArrow {
  fromX: number
  fromY: number
  toX: number
  toY: number
  color?: string
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

/** Snapshot of a data structure state with metadata about what produced it. */
export interface DSSnapshot<S> {
  state: S
  label: string           // e.g. "push_back(42)" or "initial"
}

/**
 * A data structure definition. Each concrete data structure (vector, list, deque)
 * implements this interface with its own state type.
 *
 * The design separates state (pure data), operations (pure functions that produce
 * new states), and layout (pure function from state to visual elements). This
 * keeps each concern independently testable.
 */
export interface DataStructure<S> {
  name: string
  operations: OperationDef[]
  createInitialState(values: number[]): S
  applyOperation(state: S, op: string, args: Record<string, number>): S
  computeLayout(state: S): DSLayout
}

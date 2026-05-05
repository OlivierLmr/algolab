import type { Value } from '../types.ts'

/** Unique identifier for layout nodes. */
export type NodeId = string

// --- Node data payloads ---

export interface CellData {
  arrayName: string
  index: number
  value: Value
  highlightType?: 'compare' | 'swap' | 'sorted' | 'active'
  dimmed: boolean
  /** Gauge fill ratio (0–1), undefined if not gauged. */
  gaugeRatio?: number
  /** Override the displayed text (e.g. "•" or "∅" for pointer cells). */
  displayOverride?: string
  /** A short label shown above the cell on hover (e.g. struct field name). */
  hoverLabel?: string
}

export interface LabelData {
  text: string
  /** Render the text rotated 90° (used for struct field name headers). */
  vertical?: boolean
}

export interface VariableData {
  name: string
  value: Value
  highlightType?: 'compare' | 'swap' | 'sorted' | 'active'
}

export interface FrameData {
  label: string
  arrayRefs: { paramName: string; targetName: string }[]
  isInnermost: boolean
  nestingIndex: number
}

export interface PointerData {
  name: string
  arrayName: string
  index: number
  color: string
  highlightType?: 'compare' | 'swap' | 'sorted' | 'active'
  /** Y coordinate of the target array's cell row */
  arrayCellY: number
  /** Vertical stacking position among pointers on the same array */
  stackIndex: number
}

export interface TreePointerInfo {
  name: string
  color: string
}

export interface TreeNodeData {
  arrayName: string
  index: number
  value: Value
  highlightType?: 'compare' | 'swap' | 'sorted' | 'active'
  dimmed: boolean
  /** Whether the heap property is violated at this node */
  violated: boolean
  /** Pointers (iterator variables) targeting this node's index */
  pointers: TreePointerInfo[]
}

export interface StructFieldData {
  name: string
  displayValue: string
  isPointer: boolean
}

/** A circle-with-label node, used for abstract tree visualizations. */
export interface TreeCircleData {
  label: string
}

export interface GroupData {
  role: 'array-row' | 'variables-row' | 'callstack' | 'heap-tree'
}

export type NodeData = CellData | LabelData | VariableData | FrameData | PointerData | TreeNodeData | StructFieldData | TreeCircleData | GroupData

// --- Layout node ---

export interface LayoutNode {
  id: NodeId
  x: number
  y: number
  width: number
  height: number
  kind: 'cell' | 'array-label' | 'variable' | 'frame' | 'pointer' | 'tree-node' | 'tree-circle' | 'struct-field' | 'group'
  data: NodeData
  children?: LayoutNode[]
}

// --- Layout edge ---

export interface LayoutEdge {
  id: string
  from: NodeId
  to: NodeId
  label?: string
  style: 'pointer' | 'hover' | 'tree-edge'
  color: string
  highlightType?: 'compare' | 'swap' | 'sorted' | 'active'
}

// --- Flat element for rendering ---

export interface FlatElement {
  id: NodeId
  x: number
  y: number
  width: number
  height: number
  kind: LayoutNode['kind']
  data: NodeData
  opacity: number
}

// --- Scene layout (top-level output) ---

export interface SceneLayout {
  nodes: LayoutNode[]
  flatElements: FlatElement[]
  edges: LayoutEdge[]
  width: number
  height: number
}

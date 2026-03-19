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
}

export interface LabelData {
  text: string
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

export interface GroupData {
  role: 'array-row' | 'variables-row' | 'callstack'
}

export type NodeData = CellData | LabelData | VariableData | FrameData | GroupData

// --- Layout node ---

export interface LayoutNode {
  id: NodeId
  x: number
  y: number
  width: number
  height: number
  kind: 'cell' | 'array-label' | 'variable' | 'frame' | 'group'
  data: NodeData
  children?: LayoutNode[]
}

// --- Layout edge ---

export interface LayoutEdge {
  id: string
  from: NodeId
  to: NodeId
  label?: string
  style: 'pointer' | 'hover'
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

import type { TrackedArray, Highlight, DimRange } from '../types.ts'
import type { LayoutNode, CellData, LabelData } from './types.ts'
import {
  CELL_SIZE, CELL_GAP, ARRAY_LABEL_HEIGHT, INDEX_LABEL_HEIGHT,
} from './constants.ts'

/**
 * Total height for one array group: label + cells + index labels.
 */
export function arrayGroupHeight(): number {
  return ARRAY_LABEL_HEIGHT + CELL_SIZE + INDEX_LABEL_HEIGHT
}

/**
 * Total width for an array of `length` cells.
 */
export function arrayGroupWidth(length: number): number {
  if (length === 0) return 0
  return length * CELL_SIZE + (length - 1) * CELL_GAP
}

/**
 * Lay out a single array as a label + row of cells.
 */
export function layoutArray(
  array: TrackedArray,
  x: number,
  y: number,
  highlights: Highlight[],
  dimRanges: DimRange[],
  gaugeArrays: string[],
): LayoutNode {
  const { name, values } = array

  // Pre-compute dimmed indices
  const dimmedIndices = new Set<number>()
  for (const d of dimRanges) {
    if (d.arrayName === name) {
      for (let idx = Math.max(0, d.from); idx <= Math.min(d.to, values.length - 1); idx++) {
        dimmedIndices.add(idx)
      }
    }
  }

  // Pre-compute gauge range
  const isGauged = gaugeArrays.includes(name)
  let gaugeMin = 0
  let gaugeMax = 0
  if (isGauged) {
    const finiteValues = values.map(v => v.num).filter(n => isFinite(n))
    if (finiteValues.length > 0) {
      gaugeMin = Math.min(...finiteValues)
      gaugeMax = Math.max(...finiteValues)
    }
  }

  // Label node
  const labelNode: LayoutNode = {
    id: `label:${name}`,
    x,
    y,
    width: arrayGroupWidth(values.length),
    height: ARRAY_LABEL_HEIGHT,
    kind: 'array-label',
    data: { text: name } as LabelData,
  }

  // Cell nodes
  const cellNodes: LayoutNode[] = values.map((cellValue, i) => {
    const cellX = x + i * (CELL_SIZE + CELL_GAP)
    const cellY = y + ARRAY_LABEL_HEIGHT
    const hl = highlights.find(h => h.arrayName === name && h.indices.includes(i))

    let gaugeRatio: number | undefined
    if (isGauged) {
      if (!isFinite(cellValue.num)) {
        gaugeRatio = 1
      } else if (gaugeMin === gaugeMax) {
        gaugeRatio = 0.5
      } else {
        gaugeRatio = (cellValue.num - gaugeMin) / (gaugeMax - gaugeMin)
      }
    }

    const data: CellData = {
      arrayName: name,
      index: i,
      value: cellValue,
      highlightType: hl?.type,
      dimmed: dimmedIndices.has(i),
      gaugeRatio,
    }

    return {
      id: `cell:${name}:${i}`,
      x: cellX,
      y: cellY,
      width: CELL_SIZE,
      height: CELL_SIZE,
      kind: 'cell' as const,
      data,
    }
  })

  const totalWidth = arrayGroupWidth(values.length)
  const totalHeight = arrayGroupHeight()

  return {
    id: `array:${name}`,
    x,
    y,
    width: totalWidth,
    height: totalHeight,
    kind: 'group',
    data: { role: 'array-row' },
    children: [labelNode, ...cellNodes],
  }
}

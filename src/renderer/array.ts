import type { TrackedArray, Highlight, DimRange } from '../types.ts'
import { getHighlightColor } from './colors.ts'

export const CELL_SIZE = 48
export const CELL_GAP = 2
export const ARRAY_Y_START = 60
export const ARRAY_LABEL_HEIGHT = 30

export function drawArray(
  ctx: CanvasRenderingContext2D,
  array: TrackedArray,
  highlights: Highlight[],
  dimRanges: DimRange[],
  yOffset: number,
  xOffset: number = 40,
  gaugeArrays: string[] = [],
): void {
  const { name, values } = array
  const startX = xOffset

  // Array label
  ctx.fillStyle = '#333'
  ctx.font = 'bold 14px monospace'
  ctx.fillText(name, startX, yOffset - 8)

  // Pre-compute dimmed indices for O(1) lookup per cell
  const dimmedIndices = new Set<number>()
  for (const d of dimRanges) {
    if (d.arrayName === name) {
      for (let idx = Math.max(0, d.from); idx <= Math.min(d.to, values.length - 1); idx++) {
        dimmedIndices.add(idx)
      }
    }
  }

  // Pre-compute gauge min/max if this array is gauged
  const isGauged = gaugeArrays.includes(name)
  let gaugeMin = 0
  let gaugeMax = 0
  if (isGauged) {
    const finiteValues = values.filter(v => isFinite(v))
    if (finiteValues.length > 0) {
      gaugeMin = Math.min(...finiteValues)
      gaugeMax = Math.max(...finiteValues)
    }
  }

  for (let i = 0; i < values.length; i++) {
    const x = startX + i * (CELL_SIZE + CELL_GAP)
    const y = yOffset

    const isDimmed = dimmedIndices.has(i)

    if (isDimmed) {
      ctx.save()
      ctx.globalAlpha = 0.3
    }

    const hl = highlights.find(h => h.arrayName === name && h.indices.includes(i))

    // Cell background
    ctx.fillStyle = '#fff'
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)

    // Gauge fill (after background, before border/text)
    if (isGauged) {
      let ratio: number
      if (!isFinite(values[i])) {
        ratio = 1
      } else if (gaugeMin === gaugeMax) {
        ratio = 1
      } else {
        ratio = Math.max(0, Math.min(1, (values[i] - gaugeMin) / (gaugeMax - gaugeMin)))
      }
      const fillHeight = ratio * CELL_SIZE
      ctx.fillStyle = 'rgba(52, 152, 219, 0.15)'
      ctx.fillRect(x, y + CELL_SIZE - fillHeight, CELL_SIZE, fillHeight)
    }

    // Cell border
    ctx.strokeStyle = hl ? getHighlightColor(hl.type) : '#999'
    ctx.lineWidth = hl ? 3 : 1.5
    ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE)

    // Value
    ctx.fillStyle = '#222'
    ctx.font = 'bold 18px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const displayVal = values[i] === Infinity ? '∞' : String(values[i])
    ctx.fillText(displayVal, x + CELL_SIZE / 2, y + CELL_SIZE / 2)

    // Index label below
    ctx.fillStyle = '#999'
    ctx.font = '11px monospace'
    ctx.fillText(String(i), x + CELL_SIZE / 2, y + CELL_SIZE + 14)

    if (isDimmed) ctx.restore()
  }

  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

export function getArrayHeight(): number {
  return CELL_SIZE + ARRAY_LABEL_HEIGHT + 20 // cell + index labels + gap
}

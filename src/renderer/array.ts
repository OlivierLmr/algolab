import type { TrackedArray, Highlight } from '../types.ts'
import { getHighlightColor } from './colors.ts'

export const CELL_SIZE = 48
export const CELL_GAP = 2
export const ARRAY_Y_START = 60
export const ARRAY_LABEL_HEIGHT = 30

export function drawArray(
  ctx: CanvasRenderingContext2D,
  array: TrackedArray,
  highlights: Highlight[],
  yOffset: number,
): void {
  const { name, values } = array
  const startX = 40

  // Array label
  ctx.fillStyle = '#333'
  ctx.font = 'bold 14px monospace'
  ctx.fillText(name, startX, yOffset - 8)

  for (let i = 0; i < values.length; i++) {
    const x = startX + i * (CELL_SIZE + CELL_GAP)
    const y = yOffset

    // Highlight background
    const hl = highlights.find(h => h.arrayName === name && h.indices.includes(i))
    if (hl) {
      ctx.fillStyle = getHighlightColor(hl.type)
      ctx.fillRect(x - 2, y - 2, CELL_SIZE + 4, CELL_SIZE + 4)
    }

    // Cell background
    ctx.fillStyle = '#fff'
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)

    // Cell border
    ctx.strokeStyle = '#999'
    ctx.lineWidth = 1.5
    ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE)

    // Value
    ctx.fillStyle = '#222'
    ctx.font = 'bold 18px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(values[i]), x + CELL_SIZE / 2, y + CELL_SIZE / 2)

    // Index label below
    ctx.fillStyle = '#999'
    ctx.font = '11px monospace'
    ctx.fillText(String(i), x + CELL_SIZE / 2, y + CELL_SIZE + 14)
  }

  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

export function getArrayHeight(): number {
  return CELL_SIZE + ARRAY_LABEL_HEIGHT + 20 // cell + index labels + gap
}

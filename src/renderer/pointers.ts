import type { Pointer } from '../types.ts'
import { CELL_SIZE, CELL_GAP } from './array.ts'
import { getHighlightColor } from './colors.ts'

const ARROW_Y_GAP = 18

export function drawPointers(
  ctx: CanvasRenderingContext2D,
  pointers: Pointer[],
  arrayYPositions: Map<string, number>,
  xOffset: number = 40,
): void {
  const startX = xOffset

  // Group pointers by array, sort by index for label stacking
  const grouped = new Map<string, Pointer[]>()
  for (const p of pointers) {
    if (!grouped.has(p.arrayName)) grouped.set(p.arrayName, [])
    grouped.get(p.arrayName)!.push(p)
  }

  for (const [arrayName, ptrs] of grouped) {
    const baseY = arrayYPositions.get(arrayName)
    if (baseY === undefined) continue

    // Sort by index so overlapping pointers stack nicely
    ptrs.sort((a, b) => a.index - b.index)

    for (let pi = 0; pi < ptrs.length; pi++) {
      const p = ptrs[pi]
      const x = startX + p.index * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2
      const arrowTop = baseY - 4
      const arrowBottom = baseY - 4 - ARROW_Y_GAP * (pi + 1)
      const color = p.highlight ? getHighlightColor(p.highlight) : p.color
      const lineWidth = p.highlight ? 3 : 2

      // Arrow line
      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.beginPath()
      ctx.moveTo(x, arrowBottom)
      ctx.lineTo(x, arrowTop)
      ctx.stroke()

      // Arrow head (pointing down into the array)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x, arrowTop)
      ctx.lineTo(x - 5, arrowTop - 8)
      ctx.lineTo(x + 5, arrowTop - 8)
      ctx.closePath()
      ctx.fill()

      // Label
      ctx.fillStyle = color
      ctx.font = `bold ${p.highlight ? 13 : 12}px monospace`
      ctx.textAlign = 'center'
      ctx.fillText(`${p.name}=${p.index}`, x, arrowBottom - 4)
      ctx.textAlign = 'start'
    }
  }
}

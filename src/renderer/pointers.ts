import type { Value, VarHighlight } from '../types.ts'
import { CELL_SIZE, CELL_GAP } from './array.ts'
import { getHighlightColor } from './colors.ts'

const ARROW_Y_GAP = 18

/** A derived pointer arrow for rendering. */
interface PointerArrow {
  name: string
  arrayName: string
  index: number
  color: string
  highlight?: 'compare' | 'swap' | 'sorted' | 'active'
}

/**
 * Derive pointer arrows from variables and expression pointers.
 * Variables with non-empty .arrays are iterator variables → draw as pointers.
 * Expression pointers similarly map to arrows.
 */
export function derivePointers(
  variables: Record<string, Value>,
  expressionPointers: Record<string, Value>,
  colorMap: Map<string, string>,
  varHighlights: VarHighlight[],
): PointerArrow[] {
  const arrows: PointerArrow[] = []
  const seen = new Set<string>()

  // From iterator variables
  for (const [name, val] of Object.entries(variables)) {
    if (val.arrays.length === 0) continue
    for (const arrayName of val.arrays) {
      const key = `${arrayName}:${name}`
      if (seen.has(key)) continue
      seen.add(key)
      const hl = varHighlights.find(h => h.varName === name)
      arrows.push({
        name,
        arrayName,
        index: val.num,
        color: colorMap.get(name) || '#888',
        highlight: hl?.type,
      })
    }
  }

  // From expression pointers
  for (const [label, val] of Object.entries(expressionPointers)) {
    if (val.arrays.length === 0) continue
    for (const arrayName of val.arrays) {
      const key = `${arrayName}:${label}`
      if (seen.has(key)) continue
      seen.add(key)
      arrows.push({
        name: label,
        arrayName,
        index: val.num,
        color: colorMap.get(label) || '#888',
      })
    }
  }

  return arrows
}

/** Get the set of variable names that are shown as pointers (not in the variables panel). */
export function getPointerVarNames(
  variables: Record<string, Value>,
  expressionPointers: Record<string, Value>,
): Set<string> {
  const names = new Set<string>()
  for (const [name, val] of Object.entries(variables)) {
    if (val.arrays.length > 0) names.add(name)
  }
  for (const label of Object.keys(expressionPointers)) {
    names.add(label)
  }
  return names
}

export function drawPointers(
  ctx: CanvasRenderingContext2D,
  pointers: PointerArrow[],
  arrayYPositions: Map<string, number>,
  xOffset: number = 40,
): void {
  const startX = xOffset

  // Group pointers by array, sort by index for label stacking
  const grouped = new Map<string, PointerArrow[]>()
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
      // Arrow line
      ctx.strokeStyle = p.color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, arrowBottom)
      ctx.lineTo(x, arrowTop)
      ctx.stroke()

      // Arrow head (pointing down into the array)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.moveTo(x, arrowTop)
      ctx.lineTo(x - 5, arrowTop - 8)
      ctx.lineTo(x + 5, arrowTop - 8)
      ctx.closePath()
      ctx.fill()

      // Label
      const labelText = `${p.name}=${p.index}`
      ctx.font = 'bold 12px monospace'
      ctx.textAlign = 'center'

      if (p.highlight) {
        const textWidth = ctx.measureText(labelText).width
        const boxPad = 3
        const boxX = x - textWidth / 2 - boxPad
        const boxY = arrowBottom - 14
        const boxW = textWidth + boxPad * 2
        const boxH = 16
        ctx.strokeStyle = getHighlightColor(p.highlight)
        ctx.lineWidth = 2
        ctx.strokeRect(boxX, boxY, boxW, boxH)
      }

      ctx.fillStyle = p.color
      ctx.fillText(labelText, x, arrowBottom - 4 + (p.highlight ? 1 : 0))
      ctx.textAlign = 'start'
    }
  }
}

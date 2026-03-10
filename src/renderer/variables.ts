import type { VarHighlight } from '../types.ts'
import { CELL_SIZE } from './array.ts'
import { getHighlightColor } from './colors.ts'

const VAR_GAP = 20

export function drawVariables(
  ctx: CanvasRenderingContext2D,
  variables: Record<string, number>,
  varHighlights: VarHighlight[],
  pointerNames: Set<string>,
  yOffset: number,
  xOffset: number = 40,
): void {
  const displayVars = Object.entries(variables).filter(([name]) => !pointerNames.has(name))
  if (displayVars.length === 0) return

  const startX = xOffset
  let x = startX

  for (const [name, value] of displayVars) {
    const hl = varHighlights.find(h => h.varName === name)

    // Label above cell
    ctx.fillStyle = '#333'
    ctx.font = 'bold 14px monospace'
    ctx.fillText(name, x, yOffset - 8)

    // Cell background
    ctx.fillStyle = '#fff'
    ctx.fillRect(x, yOffset, CELL_SIZE, CELL_SIZE)

    // Cell border
    ctx.strokeStyle = hl ? getHighlightColor(hl.type) : '#999'
    ctx.lineWidth = hl ? 3 : 1.5
    ctx.strokeRect(x, yOffset, CELL_SIZE, CELL_SIZE)

    // Value
    ctx.fillStyle = '#222'
    ctx.font = 'bold 18px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(value), x + CELL_SIZE / 2, yOffset + CELL_SIZE / 2)

    x += CELL_SIZE + VAR_GAP
  }

  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

export function getVariablesHeight(varCount: number): number {
  return varCount > 0 ? CELL_SIZE + 30 : 0
}

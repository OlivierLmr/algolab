import type { Value, VarHighlight } from '../types.ts'
import type { LayoutNode, VariableData } from './types.ts'
import { CELL_SIZE, VARIABLE_GAP, VARIABLE_LABEL_HEIGHT } from './constants.ts'

/**
 * Height of the variables row (label + cell).
 */
export function variablesRowHeight(varCount: number): number {
  return varCount > 0 ? VARIABLE_LABEL_HEIGHT + CELL_SIZE : 0
}

/**
 * Lay out non-pointer variables as a horizontal row of labeled cells.
 */
export function layoutVariables(
  variables: Record<string, Value>,
  varHighlights: VarHighlight[],
  pointerNames: Set<string>,
  x: number,
  y: number,
): LayoutNode | null {
  const displayVars = Object.entries(variables).filter(
    ([name, val]) => val.arrays.length === 0 && !pointerNames.has(name),
  )
  if (displayVars.length === 0) return null

  const children: LayoutNode[] = displayVars.map(([name, value], i) => {
    const cellX = x + i * (CELL_SIZE + VARIABLE_GAP)
    const hl = varHighlights.find(h => h.varName === name)

    const data: VariableData = {
      name,
      value,
      highlightType: hl?.type,
    }

    return {
      id: `var:${name}`,
      x: cellX,
      y,
      width: CELL_SIZE,
      height: VARIABLE_LABEL_HEIGHT + CELL_SIZE,
      kind: 'variable' as const,
      data,
    }
  })

  const totalWidth = displayVars.length * CELL_SIZE + (displayVars.length - 1) * VARIABLE_GAP

  return {
    id: 'variables',
    x,
    y,
    width: totalWidth,
    height: variablesRowHeight(displayVars.length),
    kind: 'group',
    data: { role: 'variables-row' },
    children,
  }
}

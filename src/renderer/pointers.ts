import type { Value, VarHighlight } from '../types.ts'

/** A derived pointer arrow for rendering. */
export interface PointerArrow {
  name: string
  arrayName: string
  index: number
  color: string
  highlight?: 'compare' | 'swap' | 'sorted' | 'active'
}

/**
 * Derive pointer arrows from variables.
 * Variables with non-empty .arrays are iterator variables (including
 * expression-variables synthesized from pointer nodes) → draw as pointers.
 */
export function derivePointers(
  variables: Record<string, Value>,
  colorMap: Map<string, string>,
  varHighlights: VarHighlight[],
): PointerArrow[] {
  const arrows: PointerArrow[] = []
  const seen = new Set<string>()

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

  return arrows
}

/** Get the set of variable names that are shown as pointers (not in the variables panel). */
export function getPointerVarNames(
  variables: Record<string, Value>,
): Set<string> {
  const names = new Set<string>()
  for (const [name, val] of Object.entries(variables)) {
    if (val.arrays.length > 0) names.add(name)
  }
  return names
}

/** Count variables that are NOT pointers (shown in the variables panel, not as arrows). */
export function countNonPointerVars(variables: Record<string, Value>, pointerNames: Set<string>): number {
  let count = 0
  for (const [name, val] of Object.entries(variables)) {
    if (val.arrays.length === 0 && !pointerNames.has(name)) count++
  }
  return count
}

const PALETTE = [
  '#e74c3c', // red
  '#3498db', // blue
  '#2ecc71', // green
  '#f39c12', // orange
  '#9b59b6', // purple
  '#1abc9c', // teal
  '#e67e22', // dark orange
  '#e84393', // pink
]

/** Assign a stable color to each pointer variable name. */
export function assignPointerColors(varNames: string[]): Map<string, string> {
  const map = new Map<string, string>()
  const sorted = [...varNames].sort() // stable ordering
  for (let i = 0; i < sorted.length; i++) {
    map.set(sorted[i], PALETTE[i % PALETTE.length])
  }
  return map
}

export function getHighlightColor(type: string): string {
  switch (type) {
    case 'compare': return '#3498db'  // blue
    case 'swap': return '#e74c3c'      // red
    case 'sorted': return '#2ecc71'    // green
    case 'active': return '#f39c12'    // orange
    default: return '#999'
  }
}

export { PALETTE }

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
    case 'compare': return 'rgba(52, 152, 219, 0.3)'  // blue
    case 'swap': return 'rgba(231, 76, 60, 0.3)'      // red
    case 'sorted': return 'rgba(46, 204, 113, 0.3)'   // green
    case 'active': return 'rgba(243, 156, 18, 0.3)'   // orange
    default: return 'rgba(200, 200, 200, 0.3)'
  }
}

export { PALETTE }

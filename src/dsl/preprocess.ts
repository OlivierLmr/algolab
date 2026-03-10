/**
 * Pre-processing for hidden visualization directives.
 * Lines prefixed with `#:` are executed as DSL but hidden from the code panel.
 */

/** Replace `#: <content>` with `<content>`, preserving indentation and line count. */
export function stripDirectivePrefix(source: string): string {
  return source
    .split('\n')
    .map(line => {
      const match = line.match(/^(\s*)#:\s?(.*)$/)
      if (match) return match[1] + match[2]
      return line
    })
    .join('\n')
}

/** Returns display lines (hidden lines excluded) and a map from exec line to display line. */
export function getDisplayInfo(source: string): { lines: string[]; lineMap: Map<number, number> } {
  const rawLines = source.split('\n')
  const lines: string[] = []
  const lineMap = new Map<number, number>()

  for (let i = 0; i < rawLines.length; i++) {
    if (/^\s*#:/.test(rawLines[i])) continue
    lineMap.set(i, lines.length)
    lines.push(rawLines[i])
  }

  return { lines, lineMap }
}

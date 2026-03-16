/**
 * Pre-processing for hidden visualization directives.
 * Lines prefixed with `#:` are executed as DSL but hidden from the code panel.
 */

export interface DisplayInfo {
  lines: string[]
  lineMap: Map<number, number>
}

/** Full preprocessing: strip directives, detect directive lines, compute display info. */
export function preprocessSource(source: string): {
  stripped: string
  directiveLines: Set<number>
  displayInfo: DisplayInfo
} {
  const rawLines = source.split('\n')
  const directiveLines = new Set<number>()
  const strippedLines: string[] = []

  // Display info (non-directive lines for code panel)
  const displayLines: string[] = []
  const lineMap = new Map<number, number>()

  for (let i = 0; i < rawLines.length; i++) {
    const match = rawLines[i].match(/^(\s*)#:\s?(.*)$/)
    if (match) {
      directiveLines.add(i)
      strippedLines.push(match[1] + match[2])
    } else {
      strippedLines.push(rawLines[i])
      lineMap.set(i, displayLines.length)
      displayLines.push(rawLines[i])
    }
  }

  return {
    stripped: strippedLines.join('\n'),
    directiveLines,
    displayInfo: { lines: displayLines, lineMap },
  }
}

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

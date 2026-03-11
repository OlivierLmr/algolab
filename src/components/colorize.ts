import { h } from 'preact'
import { assignPointerColors } from '../renderer/colors.ts'
import { lex } from '../dsl/lexer.ts'
import { parse } from '../dsl/parser.ts'
import { stripDirectivePrefix } from '../dsl/preprocess.ts'
import { collectAllPointerLabels, collectDirectivePointerLabels } from '../dsl/analysis.ts'

/** Extract all pointer labels from the algorithm source. */
export function extractPointerLabels(source: string): string[] {
  try {
    const tokens = lex(stripDirectivePrefix(source))
    const ast = parse(tokens)
    const labels = collectAllPointerLabels(ast.body)
    const dirLabels = collectDirectivePointerLabels(ast.body)
    for (const label of dirLabels) {
      if (!labels.includes(label)) labels.push(label)
    }
    return labels
  } catch {
    return []
  }
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Build a color map from source code pointer labels. */
export function buildColorMap(source: string): Map<string, string> {
  return assignPointerColors(extractPointerLabels(source))
}

/** Render a line of code with colored variable names as a JSX element. */
export function colorizeTokens(line: string, colorMap: Map<string, string>): preact.JSX.Element {
  if (colorMap.size === 0) return h('span', null, line)

  const varNames = [...colorMap.keys()].sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`\\b(${varNames.map(escapeRegex).join('|')})\\b`, 'g')

  const parts: preact.JSX.Element[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(h('span', null, line.slice(lastIndex, match.index)))
    }
    const varName = match[1]
    parts.push(
      h('span', { style: { color: colorMap.get(varName), fontWeight: 'bold' } }, varName)
    )
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < line.length) {
    parts.push(h('span', null, line.slice(lastIndex)))
  }

  return h('span', null, ...parts)
}

/** Colorize a full source string into an HTML string (for overlay <pre>). */
export function colorizeToHtml(source: string, colorMap: Map<string, string>): string {
  if (colorMap.size === 0) return escapeHtml(source)

  const varNames = [...colorMap.keys()].sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`\\b(${varNames.map(escapeRegex).join('|')})\\b`, 'g')

  return source.split('\n').map(line => {
    let result = ''
    let lastIndex = 0
    let match: RegExpExecArray | null
    pattern.lastIndex = 0

    while ((match = pattern.exec(line)) !== null) {
      if (match.index > lastIndex) {
        result += escapeHtml(line.slice(lastIndex, match.index))
      }
      const varName = match[1]
      const color = colorMap.get(varName)
      result += `<span style="color:${color};font-weight:bold">${escapeHtml(varName)}</span>`
      lastIndex = pattern.lastIndex
    }
    if (lastIndex < line.length) {
      result += escapeHtml(line.slice(lastIndex))
    }
    return result
  }).join('\n')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

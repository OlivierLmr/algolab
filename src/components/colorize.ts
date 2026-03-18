import { h } from 'preact'
import { assignPointerColors } from '../renderer/colors.ts'
import { lex } from '../dsl/lexer.ts'
import { parse } from '../dsl/parser.ts'
import { stripDirectivePrefix } from '../dsl/preprocess.ts'
import { inferTypes } from '../dsl/typeinfer.ts'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Turn a label like "j - 1" into a pattern like "j\s*-\s*1" that matches
 *  regardless of whitespace around operators. */
function labelToPattern(label: string): string {
  return label.split(/(\s+)/).map(part =>
    /^\s+$/.test(part) ? '\\s*' : escapeRegex(part)
  ).join('')
}

/** Build a compiled pattern + lookup from a color map. */
function buildMatchPattern(colorMap: Map<string, string>): { pattern: RegExp; groupToKey: string[] } | null {
  if (colorMap.size === 0) return null
  const keys = [...colorMap.keys()].sort((a, b) => b.length - a.length)
  const groupToKey: string[] = []
  const parts = keys.map(key => {
    groupToKey.push(key)
    return `(${labelToPattern(key)})`
  })
  const pattern = new RegExp(`\\b(?:${parts.join('|')})\\b`, 'g')
  return { pattern, groupToKey }
}

function matchedKey(match: RegExpExecArray, groupToKey: string[]): string {
  for (let i = 0; i < groupToKey.length; i++) {
    if (match[i + 1] !== undefined) return groupToKey[i]
  }
  return groupToKey[0]
}

/** Build a color map from source code by parsing and running type inference.
 *  Used by EditorPanel for live syntax highlighting during editing. */
export function buildColorMap(source: string): Map<string, string> {
  try {
    const tokens = lex(stripDirectivePrefix(source))
    const ast = parse(tokens)
    const inputArrays = ast.params.filter(p => p.isArray).map(p => p.name)
    const typeContext = inferTypes(ast, inputArrays)
    return assignPointerColors(typeContext.iteratorLabels)
  } catch {
    return new Map()
  }
}

/** Render a line of code with colored variable names as a JSX element. */
export function colorizeTokens(line: string, colorMap: Map<string, string>): preact.JSX.Element {
  const compiled = buildMatchPattern(colorMap)
  if (!compiled) return h('span', null, line)
  const { pattern, groupToKey } = compiled

  const parts: preact.JSX.Element[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(h('span', null, line.slice(lastIndex, match.index)))
    }
    const key = matchedKey(match, groupToKey)
    const color = colorMap.get(key)
    parts.push(
      h('span', { style: { color, fontWeight: 'bold' } }, match[0])
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
  const compiled = buildMatchPattern(colorMap)

  return source.split('\n').map(line => {
    const isDirective = /^\s*#:/.test(line)
    let colorized = colorizeLine(line, colorMap, compiled)
    if (isDirective) {
      colorized = `<span class="directive-line">${colorized}</span>`
    }
    return colorized
  }).join('\n')
}

function colorizeLine(
  line: string,
  colorMap: Map<string, string>,
  compiled: { pattern: RegExp; groupToKey: string[] } | null,
): string {
  if (!compiled) return escapeHtml(line)
  const { pattern, groupToKey } = compiled

  let result = ''
  let lastIndex = 0
  let match: RegExpExecArray | null
  pattern.lastIndex = 0

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      result += escapeHtml(line.slice(lastIndex, match.index))
    }
    const key = matchedKey(match, groupToKey)
    const color = colorMap.get(key)
    result += `<span style="color:${color};font-weight:bold">${escapeHtml(match[0])}</span>`
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < line.length) {
    result += escapeHtml(line.slice(lastIndex))
  }
  return result
}

/** Check if a source line is a directive line. */
export function isDirectiveLine(line: string): boolean {
  return /^\s*#:/.test(line)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

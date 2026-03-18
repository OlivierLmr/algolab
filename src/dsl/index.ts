import { lex } from './lexer.ts'
import { parse } from './parser.ts'
import { createRunner } from './interpreter.ts'
import { preprocessSource } from './preprocess.ts'
import type { DisplayInfo } from './preprocess.ts'
import type { Step } from '../types.ts'
import type { ASTNode, AlgoNode, CommentPart, Expr } from './ast.ts'
import { collectIteratorVarNames } from './analysis.ts'
import { assignPointerColors } from '../renderer/colors.ts'
import { validateAST } from './validate.ts'

export interface PipelineResult {
  steps: Step[]
  colorMap: Map<string, string>
  blockRanges: { startLine: number; endLine: number }[]
  displayInfo: DisplayInfo
  directiveLines: Set<number>
  defaultDisabledLines: Set<number>
}

/** Full pipeline: source → preprocess → lex → parse → analyze → interpret → PipelineResult */
export function compilePipeline(source: string, paramName: string, input: number[]): PipelineResult {
  const { stripped, directiveLines, displayInfo } = preprocessSource(source)

  const tokens = lex(stripped)
  const ast = parse(tokens)

  const validationErrors = validateAST(ast)
  if (validationErrors.length > 0) {
    throw new Error(`Line ${validationErrors[0].line + 1}: ${validationErrors[0].message}`)
  }

  // Collect iterator variable names for color assignment
  const labels = collectIteratorVarNames(ast.body)
  const colorMap = assignPointerColors(labels)

  // Pre-parse comment templates
  preParseCommentTemplates(ast.body)

  // Compute block ranges from AST
  const blockRanges = getBlockRangesFromAST(ast)

  // Run interpreter with shared colorMap
  const runner = createRunner(ast, colorMap)
  const inputMap = new Map([[paramName, input]])
  const steps = runner(inputMap)

  // Compute default disabled lines from skip directives
  const defaultDisabledLines = getDefaultDisabledLines(ast, blockRanges)

  return { steps, colorMap, blockRanges, displayInfo, directiveLines, defaultDisabledLines }
}

/** Convenience wrapper: returns just the steps (for tryParseCustom etc.) */
export function runAlgorithm(source: string, paramName: string, input: number[]): Step[] {
  return compilePipeline(source, paramName, input).steps
}

// --- Comment template pre-parsing ---

function preParseCommentTemplates(nodes: ASTNode[]): void {
  for (const node of nodes) {
    if (node.type === 'comment') {
      node.parts = parseCommentTemplate(node.text)
    }
    if ('body' in node && Array.isArray((node as any).body)) {
      preParseCommentTemplates((node as any).body)
    }
    if ('elseBody' in node && Array.isArray((node as any).elseBody)) {
      preParseCommentTemplates((node as any).elseBody)
    }
  }
}

function parseCommentTemplate(text: string): CommentPart[] {
  const parts: CommentPart[] = []
  let lastIndex = 0
  const regex = /\{([^}]+)\}/g
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }
    const inner = match[1]
    try {
      // Check for ternary: expr ? 'trueText' : 'falseText'
      const qIdx = inner.indexOf('?')
      if (qIdx !== -1) {
        const condStr = inner.slice(0, qIdx).trim()
        const rest = inner.slice(qIdx + 1).trim()
        const branchMatch = rest.match(/^'([^']*)'\s*:\s*'([^']*)'$/)
        if (branchMatch) {
          const condition = parseExprFromString(condStr)
          parts.push({ type: 'ternary', condition, trueText: branchMatch[1], falseText: branchMatch[2] })
          lastIndex = regex.lastIndex
          continue
        }
      }
      const expr = parseExprFromString(inner)
      parts.push({ type: 'expr', expr })
    } catch {
      // If parsing fails, keep as literal text
      parts.push({ type: 'text', text: match[0] })
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', text: text.slice(lastIndex) })
  }
  return parts
}

function parseExprFromString(exprStr: string): Expr {
  const tokens = lex(`algo _(_: int[])\n  let _r = ${exprStr}`)
  const ast = parse(tokens)
  const node = ast.body[0]
  if (node.type === 'let') return node.value
  throw new Error('Failed to parse expression')
}

// --- Block range extraction from AST ---

function getBlockRangesFromAST(ast: AlgoNode): { startLine: number; endLine: number }[] {
  const ranges: { startLine: number; endLine: number }[] = []

  function maxLine(nodes: ASTNode[]): number {
    let m = -1
    for (const n of nodes) {
      m = Math.max(m, n.line)
      if (n.type === 'for' || n.type === 'while' || n.type === 'def') {
        m = Math.max(m, maxLine(n.body))
      } else if (n.type === 'if') {
        m = Math.max(m, maxLine(n.body))
        if (n.elseBody.length > 0) m = Math.max(m, maxLine(n.elseBody))
      }
    }
    return m
  }

  function walk(nodes: ASTNode[]): void {
    for (const node of nodes) {
      if (node.type === 'for' || node.type === 'while' || node.type === 'def') {
        const endLine = maxLine(node.body)
        if (endLine > node.line) ranges.push({ startLine: node.line, endLine })
        walk(node.body)
      } else if (node.type === 'if') {
        const allBodies = [...node.body, ...node.elseBody]
        const endLine = maxLine(allBodies)
        if (endLine > node.line) ranges.push({ startLine: node.line, endLine })
        walk(node.body)
        walk(node.elseBody)
      }
    }
  }

  walk(ast.body)
  return ranges
}

/** Collect default disabled lines from `stepover` directives applied to the next sibling node. */
function getDefaultDisabledLines(
  ast: AlgoNode,
  blockRanges: { startLine: number; endLine: number }[],
): Set<number> {
  const disabled = new Set<number>()

  function processNodes(nodes: ASTNode[]): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (node.type === 'stepover') {
        // Find next non-directive sibling
        const next = nodes[i + 1]
        if (!next) continue
        // If it's a block node (def/for/while/if), disable the whole block range
        const range = blockRanges.find(r => r.startLine === next.line)
        if (range) {
          for (let l = range.startLine; l <= range.endLine; l++) {
            disabled.add(l)
          }
        } else {
          // Single line
          disabled.add(next.line)
        }
      }
      // Recurse into child blocks
      if (node.type === 'for' || node.type === 'while' || node.type === 'def') {
        processNodes(node.body)
      } else if (node.type === 'if') {
        processNodes(node.body)
        processNodes(node.elseBody)
      }
    }
  }

  processNodes(ast.body)
  return disabled
}

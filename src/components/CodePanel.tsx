import { currentAlgo, currentStep } from '../state.ts'
import { assignPointerColors } from '../renderer/colors.ts'
import { lex } from '../dsl/lexer.ts'
import { parse } from '../dsl/parser.ts'
import type { ASTNode, Expr } from '../dsl/ast.ts'
import { useMemo } from 'preact/hooks'

/** Extract pointer variable names from the algorithm source. */
function getPointerVarNames(source: string): string[] {
  try {
    const tokens = lex(source)
    const ast = parse(tokens)
    const vars = new Set<string>()
    collectPointerVars(ast.body, vars)
    return [...vars]
  } catch {
    return []
  }
}

function collectPointerVars(nodes: ASTNode[], vars: Set<string>): void {
  for (const node of nodes) {
    switch (node.type) {
      case 'for':
        scanExprForPointers(node.from, vars)
        scanExprForPointers(node.to, vars)
        collectPointerVars(node.body, vars)
        break
      case 'while':
        scanExprForPointers(node.condition, vars)
        collectPointerVars(node.body, vars)
        break
      case 'if':
        scanExprForPointers(node.condition, vars)
        collectPointerVars(node.body, vars)
        collectPointerVars(node.elseBody, vars)
        break
      case 'let': scanExprForPointers(node.value, vars); break
      case 'assign':
        scanExprForPointers(node.target, vars)
        scanExprForPointers(node.value, vars)
        break
      case 'swap':
        scanExprForPointers(node.left, vars)
        scanExprForPointers(node.right, vars)
        break
      case 'exprStmt': scanExprForPointers(node.expr, vars); break
    }
  }
}

function scanExprForPointers(expr: Expr, vars: Set<string>): void {
  if (expr.type === 'index' && expr.array.type === 'identifier') {
    collectIdents(expr.index, vars)
  }
  if (expr.type === 'binary') {
    scanExprForPointers(expr.left, vars)
    scanExprForPointers(expr.right, vars)
  }
  if (expr.type === 'unary') scanExprForPointers(expr.operand, vars)
  if (expr.type === 'call') expr.args.forEach(a => scanExprForPointers(a, vars))
  if (expr.type === 'index') {
    scanExprForPointers(expr.array, vars)
    scanExprForPointers(expr.index, vars)
  }
}

function collectIdents(expr: Expr, vars: Set<string>): void {
  if (expr.type === 'identifier') vars.add(expr.name)
  if (expr.type === 'binary') {
    collectIdents(expr.left, vars)
    collectIdents(expr.right, vars)
  }
}

/** Render a line of code with colored variable names. */
function colorizeTokens(line: string, colorMap: Map<string, string>): preact.JSX.Element {
  if (colorMap.size === 0) return <>{line}</>

  // Build a regex that matches any of the pointer variable names as whole words
  const varNames = [...colorMap.keys()].sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`\\b(${varNames.map(escapeRegex).join('|')})\\b`, 'g')

  const parts: preact.JSX.Element[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span>{line.slice(lastIndex, match.index)}</span>)
    }
    const varName = match[1]
    parts.push(
      <span style={{ color: colorMap.get(varName), fontWeight: 'bold' }}>{varName}</span>
    )
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < line.length) {
    parts.push(<span>{line.slice(lastIndex)}</span>)
  }

  return <>{parts}</>
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function CodePanel() {
  const algo = currentAlgo.value
  const step = currentStep.value
  const lines = algo.source.split('\n')

  const colorMap = useMemo(() => {
    const varNames = getPointerVarNames(algo.source)
    return assignPointerColors(varNames)
  }, [algo.source])

  return (
    <div class="code-panel">
      <pre>
        {lines.map((line, i) => (
          <div
            key={i}
            class={`code-line ${i === step?.currentLine ? 'code-line-active' : ''}`}
          >
            <span class="line-number">{i + 1}</span>
            {colorizeTokens(line, colorMap)}
          </div>
        ))}
      </pre>
    </div>
  )
}

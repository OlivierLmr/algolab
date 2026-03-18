import type { ASTNode, Expr } from './ast.ts'
import { exprToString } from './ast.ts'

/**
 * Collect all iterator variable names from an AST.
 * These are variable names that appear as bare identifiers in arr[var] patterns,
 * plus labels from #: pointer directives and complex index expressions (arr[expr]).
 * Used for upfront color assignment in the pipeline.
 */
export function collectIteratorVarNames(nodes: ASTNode[]): string[] {
  const labels = new Set<string>()

  /** Extract bare identifiers from dim/undim range expressions. */
  function scanDimExpr(expr: Expr): void {
    if (expr.type === 'identifier') {
      labels.add(expr.name)
    }
    switch (expr.type) {
      case 'binary': scanDimExpr(expr.left); scanDimExpr(expr.right); break
      case 'unary': scanDimExpr(expr.operand); break
      case 'call': expr.args.forEach(scanDimExpr); break
      case 'index': break // don't recurse through array indexing
    }
  }

  function scanExpr(expr: Expr): void {
    if (expr.type === 'index' && expr.array.type === 'identifier') {
      // Bare identifier → variable name as label
      if (expr.index.type === 'identifier') {
        labels.add(expr.index.name)
      } else {
        // Complex expression → expression string as label
        labels.add(exprToString(expr.index))
      }
    }
    switch (expr.type) {
      case 'binary': scanExpr(expr.left); scanExpr(expr.right); break
      case 'unary': scanExpr(expr.operand); break
      case 'call': expr.args.forEach(scanExpr); break
      case 'index': scanExpr(expr.array); scanExpr(expr.index); break
    }
  }

  function scanNode(node: ASTNode): void {
    switch (node.type) {
      case 'algo': node.body.forEach(scanNode); break
      case 'for':
        scanExpr(node.from); scanExpr(node.to); node.body.forEach(scanNode); break
      case 'while':
        scanExpr(node.condition); node.body.forEach(scanNode); break
      case 'if':
        scanExpr(node.condition); node.body.forEach(scanNode); node.elseBody.forEach(scanNode); break
      case 'let': scanExpr(node.value); break
      case 'assign': scanExpr(node.target); scanExpr(node.value); break
      case 'swap': scanExpr(node.left); scanExpr(node.right); break
      case 'exprStmt': scanExpr(node.expr); break
      case 'return': scanExpr(node.value); break
      case 'pointer': labels.add(node.label); break
      case 'def': node.body.forEach(scanNode); break
      case 'dim': scanDimExpr(node.from); scanDimExpr(node.to); break
      case 'undim': scanDimExpr(node.from); scanDimExpr(node.to); break
      case 'comment': break
      case 'alloc': break
    }
  }

  nodes.forEach(scanNode)

  // Also include labels propagated through comparisons per scope
  const bodies = collectBodies(nodes)
  for (const body of bodies) {
    const comparisons = collectComparisons(body)
    propagateLabels(labels, comparisons, body)
  }

  return [...labels]
}

/** Collect all distinct bodies that form their own scope (algo + for + while + def). */
function collectBodies(nodes: ASTNode[]): ASTNode[][] {
  const bodies: ASTNode[][] = []
  for (const node of nodes) {
    switch (node.type) {
      case 'algo':
        bodies.push(node.body)
        bodies.push(...collectBodies(node.body))
        break
      case 'def':
        bodies.push(node.body)
        bodies.push(...collectBodies(node.body))
        break
      case 'for':
        bodies.push(node.body)
        bodies.push(...collectBodies(node.body))
        break
      case 'while':
        bodies.push(node.body)
        bodies.push(...collectBodies(node.body))
        break
      case 'if':
        bodies.push(...collectBodies(node.body))
        bodies.push(...collectBodies(node.elseBody))
        break
    }
  }
  return bodies
}

interface ComparisonPair { left: Expr; right: Expr }

/** Extract comparison pairs from conditions in a body. */
function collectComparisons(body: ASTNode[]): ComparisonPair[] {
  const pairs: ComparisonPair[] = []

  function fromExpr(expr: Expr): void {
    if (expr.type === 'binary') {
      if (['<', '>', '<=', '>=', '==', '!='].includes(expr.op)) {
        pairs.push({ left: expr.left, right: expr.right })
      } else if (expr.op === 'and' || expr.op === 'or') {
        fromExpr(expr.left)
        fromExpr(expr.right)
      }
    }
  }

  function fromBody(stmts: ASTNode[]): void {
    for (const stmt of stmts) {
      switch (stmt.type) {
        case 'if': fromExpr(stmt.condition); fromBody(stmt.body); fromBody(stmt.elseBody); break
        case 'while': fromExpr(stmt.condition); break
        case 'for': break
        default: break
      }
    }
  }

  fromBody(body)
  return pairs
}

/** If one side of a comparison matches a known label and the other is a plain
 *  identifier not yet in the set, add it. */
function propagateLabels(labels: Set<string>, comparisons: ComparisonPair[], _body: ASTNode[]): void {
  let changed = true
  while (changed) {
    changed = false
    for (const { left, right } of comparisons) {
      if (right.type === 'identifier' && !labels.has(right.name) && labels.has(exprToString(left))) {
        labels.add(right.name)
        changed = true
      }
      if (left.type === 'identifier' && !labels.has(left.name) && labels.has(exprToString(right))) {
        labels.add(left.name)
        changed = true
      }
    }
  }
}

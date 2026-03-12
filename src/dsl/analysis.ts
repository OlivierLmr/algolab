import type { ASTNode, Expr } from './ast.ts'
import { exprToString } from './ast.ts'

export interface ScopePointer {
  arrayName: string
  expr: Expr
  label: string
}

/** Scan a body's statements (recursively into nested blocks) for arr[expr] index patterns. */
export function collectScopePointers(body: ASTNode[]): ScopePointer[] {
  const result: ScopePointer[] = []
  const seen = new Set<string>()

  function addFromExpr(expr: Expr): void {
    if (expr.type === 'index' && expr.array.type === 'identifier') {
      const arrayName = expr.array.name
      const label = exprToString(expr.index)
      const key = `${arrayName}:${label}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push({ arrayName, expr: expr.index, label })
      }
    }
    // Recurse into sub-expressions but not into nested index arrays
    switch (expr.type) {
      case 'binary': addFromExpr(expr.left); addFromExpr(expr.right); break
      case 'unary': addFromExpr(expr.operand); break
      case 'call': expr.args.forEach(addFromExpr); break
      case 'index': addFromExpr(expr.array); addFromExpr(expr.index); break
    }
  }

  function scanExprs(...exprs: Expr[]): void {
    exprs.forEach(addFromExpr)
  }

  function scanBody(stmts: ASTNode[]): void {
    for (const stmt of stmts) {
      switch (stmt.type) {
        case 'if':
          scanExprs(stmt.condition)
          scanBody(stmt.body)
          scanBody(stmt.elseBody)
          break
        case 'while':
          scanExprs(stmt.condition)
          scanBody(stmt.body)
          break
        case 'for':
          scanExprs(stmt.from, stmt.to)
          scanBody(stmt.body)
          break
        case 'let': scanExprs(stmt.value); break
        case 'assign': scanExprs(stmt.target, stmt.value); break
        case 'swap': scanExprs(stmt.left, stmt.right); break
        case 'exprStmt': scanExprs(stmt.expr); break
        case 'return': scanExprs(stmt.value); break
        case 'pointer': {
          const key = `${stmt.arrayName}:${stmt.label}`
          if (!seen.has(key)) {
            seen.add(key)
            result.push({ arrayName: stmt.arrayName, expr: stmt.at, label: stmt.label })
          }
          break
        }
        case 'def': case 'dim': case 'undim': case 'comment': case 'alloc': break
      }
    }
  }

  scanBody(body)

  // Propagate: if a variable is compared to a known pointer expression,
  // the variable becomes a pointer on the same array.
  const comparisons = collectComparisons(body)
  propagatePointersThroughComparisons(result, seen, comparisons)

  return result
}

interface ComparisonPair { left: Expr; right: Expr }

/** Extract all comparison pairs from conditions in the body (recursively). */
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
        case 'while': fromExpr(stmt.condition); fromBody(stmt.body); break
        case 'for': fromBody(stmt.body); break
        // Don't recurse into def — function bodies get their own pointer set
        default: break
      }
    }
  }

  fromBody(body)
  return pairs
}

/** If one side of a comparison matches a known pointer label and the other is a
 *  plain variable not yet registered, add it as a pointer on the same array.
 *  Iterates to fixed point for transitivity. */
function propagatePointersThroughComparisons(
  result: ScopePointer[],
  seen: Set<string>,
  comparisons: ComparisonPair[],
): void {
  let changed = true
  while (changed) {
    changed = false
    for (const { left, right } of comparisons) {
      if (tryPropagate(right, left, result, seen)) changed = true
      if (tryPropagate(left, right, result, seen)) changed = true
    }
  }
}

/** If knownSide's string matches a pointer label on some array, and newSide is a
 *  plain identifier not yet a pointer on that array, add it. */
function tryPropagate(
  knownSide: Expr,
  newSide: Expr,
  result: ScopePointer[],
  seen: Set<string>,
): boolean {
  if (newSide.type !== 'identifier') return false
  const knownLabel = exprToString(knownSide)
  let added = false
  // Snapshot length since we may push during iteration
  const len = result.length
  for (let i = 0; i < len; i++) {
    const ptr = result[i]
    if (ptr.label === knownLabel) {
      const key = `${ptr.arrayName}:${newSide.name}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push({ arrayName: ptr.arrayName, expr: newSide, label: newSide.name })
        added = true
      }
    }
  }
  return added
}

/** Full recursive scan for all pointer labels — used for static color pre-assignment.
 *  Includes labels inferred through comparison propagation. */
export function collectAllPointerLabels(nodes: ASTNode[]): string[] {
  const labels = new Set<string>()

  function scanExpr(expr: Expr): void {
    if (expr.type === 'index' && expr.array.type === 'identifier') {
      labels.add(exprToString(expr.index))
    }
    switch (expr.type) {
      case 'binary': scanExpr(expr.left); scanExpr(expr.right); break
      case 'unary': scanExpr(expr.operand); break
      case 'call': expr.args.forEach(scanExpr); break
      case 'index': scanExpr(expr.array); scanExpr(expr.index); break
    }
  }

  // Collect body from each scope that gets its own pointer set (algo + defs)
  function collectBodies(node: ASTNode): ASTNode[][] {
    const bodies: ASTNode[][] = []
    switch (node.type) {
      case 'algo':
        bodies.push(node.body)
        for (const child of node.body) bodies.push(...collectBodies(child))
        break
      case 'def':
        bodies.push(node.body)
        for (const child of node.body) bodies.push(...collectBodies(child))
        break
      case 'for': for (const child of node.body) bodies.push(...collectBodies(child)); break
      case 'while': for (const child of node.body) bodies.push(...collectBodies(child)); break
      case 'if':
        for (const child of node.body) bodies.push(...collectBodies(child))
        for (const child of node.elseBody) bodies.push(...collectBodies(child))
        break
      default: break
    }
    return bodies
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
      case 'dim': break
      case 'undim': break
      case 'pointer': break
      case 'comment': break
      case 'alloc': break
      case 'def': node.body.forEach(scanNode); break
    }
  }

  nodes.forEach(scanNode)

  // Also include labels inferred through comparison propagation per scope
  for (const node of nodes) {
    for (const body of collectBodies(node)) {
      const pointers = collectScopePointers(body)
      for (const p of pointers) labels.add(p.label)
    }
  }

  return [...labels]
}

/** Collect directive pointer labels from AST. */
export function collectDirectivePointerLabels(nodes: ASTNode[]): string[] {
  const labels: string[] = []
  function scan(node: ASTNode): void {
    switch (node.type) {
      case 'pointer': labels.push(node.label); break
      case 'algo': node.body.forEach(scan); break
      case 'for': node.body.forEach(scan); break
      case 'while': node.body.forEach(scan); break
      case 'if': node.body.forEach(scan); node.elseBody.forEach(scan); break
      case 'def': node.body.forEach(scan); break
      default: break
    }
  }
  nodes.forEach(scan)
  return labels
}

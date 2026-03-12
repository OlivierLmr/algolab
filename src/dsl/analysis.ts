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
        case 'def': case 'dim': case 'undim': case 'pointer': case 'comment': case 'alloc': break
      }
    }
  }

  scanBody(body)
  return result
}

/** Full recursive scan for all pointer labels — used for static color pre-assignment. */
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

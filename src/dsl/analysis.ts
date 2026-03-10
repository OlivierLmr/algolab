import type { ASTNode, Expr } from './ast.ts'

/** Scan AST for arr[x] patterns to identify pointer variables per array. */
export function detectPointers(nodes: ASTNode[]): Map<string, Set<string>> {
  const pointers = new Map<string, Set<string>>()

  function addPointer(arrayName: string, varName: string): void {
    if (!pointers.has(arrayName)) pointers.set(arrayName, new Set())
    pointers.get(arrayName)!.add(varName)
  }

  function scanExpr(expr: Expr): void {
    switch (expr.type) {
      case 'index':
        if (expr.array.type === 'identifier') {
          collectIdentsFromExpr(expr.array.name, expr.index)
        }
        scanExpr(expr.array)
        scanExpr(expr.index)
        break
      case 'binary':
        scanExpr(expr.left)
        scanExpr(expr.right)
        break
      case 'unary':
        scanExpr(expr.operand)
        break
      case 'call':
        expr.args.forEach(scanExpr)
        break
    }
  }

  function collectIdentsFromExpr(arrayName: string, expr: Expr): void {
    if (expr.type === 'identifier') {
      addPointer(arrayName, expr.name)
    } else if (expr.type === 'binary') {
      collectIdentsFromExpr(arrayName, expr.left)
      collectIdentsFromExpr(arrayName, expr.right)
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
      case 'dim': break
      case 'pointer': break
      case 'comment': break
    }
  }

  nodes.forEach(scanNode)
  return pointers
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
      default: break
    }
  }
  nodes.forEach(scan)
  return labels
}

/** Get all pointer variable names (flat set) from AST nodes. */
export function getPointerVarNames(nodes: ASTNode[]): string[] {
  const pointerMap = detectPointers(nodes)
  const vars = new Set<string>()
  for (const varSet of pointerMap.values()) {
    for (const v of varSet) vars.add(v)
  }
  const labels = collectDirectivePointerLabels(nodes)
  for (const label of labels) vars.add(label)
  return [...vars]
}

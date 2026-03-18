/**
 * AST transformation: synthesize PointerNode for implicit expression pointers.
 *
 * For each `arr[complexExpr]` (where the index is not a bare identifier),
 * insert a synthetic PointerNode at the earliest point where all constituent
 * variables AND the indexed array are defined.
 *
 * This unifies implicit and explicit expression pointers — after this pass,
 * all expression pointers are represented as `pointer` AST nodes and follow
 * normal scope push/pop during interpretation.
 */
import type { ASTNode, AlgoNode, DefNode, ForNode, Expr, PointerNode } from './ast.ts'
import { exprToString } from './ast.ts'

/** Collect all variable names referenced in an expression. */
function collectVarNames(expr: Expr): Set<string> {
  const names = new Set<string>()
  function walk(e: Expr): void {
    switch (e.type) {
      case 'identifier': names.add(e.name); break
      case 'binary': walk(e.left); walk(e.right); break
      case 'unary': walk(e.operand); break
      case 'index': walk(e.array); walk(e.index); break
      case 'call': e.args.forEach(walk); break
    }
  }
  walk(expr)
  return names
}

interface PendingPointer {
  label: string
  arrayName: string
  expr: Expr
  line: number
  deps: Set<string>  // variable names + array name needed
}

/**
 * Synthesize expression pointers into the AST in-place.
 * Call after parsing, before type inference.
 */
export function synthesizeExpressionPointers(ast: AlgoNode, inputArrayNames: string[]): void {
  const inputArrays = new Set(inputArrayNames)

  // Collect all existing explicit pointer keys to avoid duplicates
  const existingPointerKeys = new Set<string>()
  collectExplicitPointers(ast.body, existingPointerKeys)

  // Process algo body with algo params as available names
  const algoParams = new Set(ast.params.map(p => p.name))
  processBody(ast.body, algoParams, inputArrays, existingPointerKeys)
}

/** Collect all explicit `pointer` node keys ("arrayName:label") in the AST. */
function collectExplicitPointers(nodes: ASTNode[], keys: Set<string>): void {
  for (const node of nodes) {
    if (node.type === 'pointer') {
      keys.add(`${node.arrayName}:${node.label}`)
    }
    if ('body' in node && Array.isArray((node as any).body)) {
      collectExplicitPointers((node as any).body, keys)
    }
    if ('elseBody' in node && Array.isArray((node as any).elseBody)) {
      collectExplicitPointers((node as any).elseBody, keys)
    }
  }
}

/** Scan all expressions in a body for implicit expression pointers. */
function collectImplicitPointers(nodes: ASTNode[]): PendingPointer[] {
  const pending: PendingPointer[] = []
  const seen = new Set<string>()  // dedup by "arrayName:label"

  function scanExpr(expr: Expr, line: number): void {
    // arr[complexExpr] where index is not a bare identifier
    if (expr.type === 'index' && expr.array.type === 'identifier' && expr.index.type !== 'identifier') {
      const label = exprToString(expr.index)
      const arrayName = expr.array.name
      const key = `${arrayName}:${label}`
      if (!seen.has(key)) {
        seen.add(key)
        const deps = collectVarNames(expr.index)
        deps.add(arrayName)  // array itself must be available
        pending.push({ label, arrayName, expr: expr.index, line, deps })
      }
    }
    // Recurse into sub-expressions
    switch (expr.type) {
      case 'binary': scanExpr(expr.left, line); scanExpr(expr.right, line); break
      case 'unary': scanExpr(expr.operand, line); break
      case 'index': scanExpr(expr.array, line); scanExpr(expr.index, line); break
      case 'call': expr.args.forEach(a => scanExpr(a, line)); break
    }
  }

  for (const node of nodes) {
    switch (node.type) {
      case 'let': scanExpr(node.value, node.line); break
      case 'assign': scanExpr(node.target, node.line); scanExpr(node.value, node.line); break
      case 'swap': scanExpr(node.left, node.line); scanExpr(node.right, node.line); break
      case 'if': scanExpr(node.condition, node.line); break
      case 'while': scanExpr(node.condition, node.line); break
      case 'for': scanExpr(node.from, node.line); scanExpr(node.to, node.line); break
      case 'exprStmt': scanExpr(node.expr, node.line); break
      case 'return': scanExpr(node.value, node.line); break
    }
    // Note: we don't recurse into child bodies here — those are handled
    // by the recursive processBody call.
  }

  return pending
}

/**
 * Process a body of statements: find implicit expression pointers in THIS
 * body's direct statements and insert synthetic PointerNodes, then recurse
 * into child bodies.
 */
function processBody(
  body: ASTNode[],
  availableParams: Set<string>,
  inputArrays: Set<string>,
  existingPointerKeys: Set<string>,
): void {
  // 1. Collect implicit expression pointers from this body level
  const pending = collectImplicitPointers(body)

  // 2. Build a map of where each name becomes available in this body
  //    - params/input arrays: available at index -1 (before any statement)
  //    - let x = ...: available after that statement's index
  //    - alloc arr ...: available after that statement's index
  //    - for x from ...: x available inside the for body (handled separately)
  const declIndex = new Map<string, number>()  // name → body index after which it's available

  for (const name of availableParams) {
    declIndex.set(name, -1)
  }
  for (const name of inputArrays) {
    declIndex.set(name, -1)
  }

  for (let i = 0; i < body.length; i++) {
    const node = body[i]
    if (node.type === 'let') {
      declIndex.set(node.name, i)
    } else if (node.type === 'alloc') {
      declIndex.set(node.arrayName, i)
    }
  }

  // 3. For each pending pointer, determine insertion point
  const insertions: { afterIndex: number; node: PointerNode }[] = []

  for (const pp of pending) {
    const key = `${pp.arrayName}:${pp.label}`
    if (existingPointerKeys.has(key)) continue  // explicit pointer wins

    // Find the latest declaration index among all dependencies
    let latestIndex = -1
    let allAvailable = true
    let hasForDep = false

    for (const dep of pp.deps) {
      const idx = declIndex.get(dep)
      if (idx !== undefined) {
        latestIndex = Math.max(latestIndex, idx)
      } else {
        // Check if this dep is a for-loop variable in this body
        // If so, the pointer must go inside that for-loop body
        const forNode = body.find(n => n.type === 'for' && n.variable === dep) as ForNode | undefined
        if (forNode) {
          hasForDep = true
        } else {
          // Dependency not available at this body level — can't place here
          allAvailable = false
        }
      }
    }

    if (!allAvailable) continue  // will be handled in a child body if all deps are there

    if (hasForDep) continue  // handled when we recurse into the for-loop body

    // Insert right after the latest declaration
    const pointerNode: PointerNode = {
      type: 'pointer',
      label: pp.label,
      arrayName: pp.arrayName,
      at: pp.expr,
      line: pp.line,
    }
    existingPointerKeys.add(key)
    insertions.push({ afterIndex: latestIndex, node: pointerNode })
  }

  // 4. Insert pointer nodes (in reverse order to preserve indices)
  insertions.sort((a, b) => b.afterIndex - a.afterIndex)
  for (const ins of insertions) {
    body.splice(ins.afterIndex + 1, 0, ins.node)
  }

  // 5. Recurse into child bodies
  for (const node of body) {
    switch (node.type) {
      case 'for': {
        // For-loop variable is available as param inside its body
        const forParams = new Set(availableParams)
        // Also include all let/alloc names from enclosing scope (they're visible inside the for)
        for (const [name, _idx] of declIndex) {
          forParams.add(name)
        }
        forParams.add(node.variable)
        processBody(node.body, forParams, inputArrays, existingPointerKeys)
        break
      }
      case 'while': {
        const whileParams = new Set(availableParams)
        for (const [name, _idx] of declIndex) {
          whileParams.add(name)
        }
        processBody(node.body, whileParams, inputArrays, existingPointerKeys)
        break
      }
      case 'if': {
        const ifParams = new Set(availableParams)
        for (const [name, _idx] of declIndex) {
          ifParams.add(name)
        }
        processBody(node.body, ifParams, inputArrays, existingPointerKeys)
        processBody(node.elseBody, ifParams, inputArrays, existingPointerKeys)
        break
      }
      case 'def': {
        const defParams = new Set<string>()
        for (const p of (node as DefNode).params) {
          defParams.add(p.name)
        }
        processBody((node as DefNode).body, defParams, inputArrays, existingPointerKeys)
        break
      }
    }
  }
}

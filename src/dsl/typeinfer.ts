/**
 * Static type inference for iterator types.
 *
 * Determines all iterator types before execution via constraint-based
 * forward dataflow analysis with fixed-point iteration over a finite lattice.
 *
 * Type system:
 *   Num       — plain number, no array association    (arrays: [])
 *   Iter<S>   — iterator/position in arrays S         (arrays: [...S])
 *   Array<τ>  — array whose elements have type τ
 *
 * Lattice:  Num ⊑ Iter<S>,  Iter<S₁> ⊔ Iter<S₂> = Iter<S₁ ∪ S₂>
 * Finite, monotone → fixed-point iteration terminates.
 */
import type { ASTNode, AlgoNode, DefNode, Expr } from './ast.ts'
import { exprToString } from './ast.ts'

// --- Public interfaces ---

export interface ExprPointerDef {
  label: string
  arrayName: string   // syntactic array name (resolved at runtime)
  expr: Expr
  varNames: string[]  // constituent variable names (for scope checking)
  explicit: boolean   // from #: pointer directive?
}

export interface TypeContext {
  /** Variable types: key = "varName@line" → arrays the variable iterates on */
  varTypes: Map<string, string[]>

  /** Array element types: key = array name → arrays the elements iterate on */
  arrayElementTypes: Map<string, string[]>

  /** Statically identified expression pointers */
  expressionPointers: ExprPointerDef[]

  /** All iterator label names (for color assignment) */
  iteratorLabels: string[]
}

// --- Internal types ---

interface FuncInfo {
  node: DefNode
  paramKeys: string[]      // "paramName@line" for each param
  returnType: string[]     // accumulated return type (arrays)
}

/** Variable key: "name@line" where line is the declaration line */
type VarKey = string

function varKey(name: string, line: number): VarKey {
  return `${name}@${line}`
}

// --- Scope tracking ---

interface ScopeEntry {
  key: VarKey
  line: number
}

class ScopeStack {
  private scopes: Map<string, ScopeEntry>[] = []

  push(): void { this.scopes.push(new Map()) }
  pop(): void { this.scopes.pop() }

  define(name: string, line: number): VarKey {
    const key = varKey(name, line)
    this.scopes[this.scopes.length - 1].set(name, { key, line })
    return key
  }

  lookup(name: string): VarKey | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const entry = this.scopes[i].get(name)
      if (entry) return entry.key
    }
    return undefined
  }
}

// --- Main inference function ---

export function inferTypes(ast: AlgoNode, inputArrayNames: string[]): TypeContext {
  const varTypes = new Map<VarKey, string[]>()    // all start as Num (empty)
  const arrayElemTypes = new Map<string, string[]>()
  const exprPointers: ExprPointerDef[] = []
  const functions = new Map<string, FuncInfo>()

  // All known array names (input + alloc)
  const allArrayNames = new Set<string>(inputArrayNames)

  // Initialize element types for input arrays
  for (const name of inputArrayNames) {
    arrayElemTypes.set(name, [])
  }

  // --- Helper: join (add arrays to a var type, return true if changed) ---

  function joinVar(key: VarKey, arrays: string[]): boolean {
    if (arrays.length === 0) return false
    const existing = varTypes.get(key) ?? []
    let changed = false
    const merged = [...existing]
    for (const a of arrays) {
      if (!merged.includes(a)) {
        merged.push(a)
        changed = true
      }
    }
    if (changed) varTypes.set(key, merged)
    return changed
  }

  function joinElemType(arrName: string, arrays: string[]): boolean {
    if (arrays.length === 0) return false
    const existing = arrayElemTypes.get(arrName) ?? []
    let changed = false
    const merged = [...existing]
    for (const a of arrays) {
      if (!merged.includes(a)) {
        merged.push(a)
        changed = true
      }
    }
    if (changed) arrayElemTypes.set(arrName, merged)
    return changed
  }

  function joinReturn(funcName: string, arrays: string[]): boolean {
    const info = functions.get(funcName)
    if (!info || arrays.length === 0) return false
    let changed = false
    for (const a of arrays) {
      if (!info.returnType.includes(a)) {
        info.returnType.push(a)
        changed = true
      }
    }
    return changed
  }

  function getVarType(key: VarKey): string[] {
    return varTypes.get(key) ?? []
  }

  // --- Phase 0: Collect structure ---

  // Collect all def nodes and alloc nodes
  function collectStructure(nodes: ASTNode[]): void {
    for (const node of nodes) {
      if (node.type === 'def') {
        const paramKeys: string[] = []
        for (const p of node.params) {
          if (!p.isArray) {
            const key = varKey(p.name, node.line)
            paramKeys.push(key)
            varTypes.set(key, [])
          } else {
            paramKeys.push('')  // placeholder for array params
          }
        }
        functions.set(node.name, { node, paramKeys, returnType: [] })
        collectStructure(node.body)
      } else if (node.type === 'alloc') {
        allArrayNames.add(node.arrayName)
        arrayElemTypes.set(node.arrayName, [])
        collectStructure_children(node)
      } else {
        collectStructure_children(node)
      }
    }
  }

  function collectStructure_children(node: ASTNode): void {
    if (node.type === 'for' || node.type === 'while') {
      collectStructure(node.body)
    } else if (node.type === 'if') {
      collectStructure(node.body)
      collectStructure(node.elseBody)
    }
  }

  collectStructure(ast.body)

  // --- Phase 0.5: Collect expression pointers ---

  function collectExprPointers(nodes: ASTNode[]): void {
    function scanExpr(expr: Expr): void {
      if (expr.type === 'index' && expr.array.type === 'identifier' && expr.index.type !== 'identifier') {
        registerExprPtr(exprToString(expr.index), expr.array.name, expr.index, false)
      }
      switch (expr.type) {
        case 'binary': scanExpr(expr.left); scanExpr(expr.right); break
        case 'unary': scanExpr(expr.operand); break
        case 'call': expr.args.forEach(scanExpr); break
        case 'index': scanExpr(expr.array); scanExpr(expr.index); break
      }
    }
    function scanBody(stmts: ASTNode[]): void {
      for (const stmt of stmts) {
        switch (stmt.type) {
          case 'let': scanExpr(stmt.value); break
          case 'assign': scanExpr(stmt.target); scanExpr(stmt.value); break
          case 'swap': scanExpr(stmt.left); scanExpr(stmt.right); break
          case 'if': scanExpr(stmt.condition); scanBody(stmt.body); scanBody(stmt.elseBody); break
          case 'while': scanExpr(stmt.condition); scanBody(stmt.body); break
          case 'for': scanExpr(stmt.from); scanExpr(stmt.to); scanBody(stmt.body); break
          case 'exprStmt': scanExpr(stmt.expr); break
          case 'return': scanExpr(stmt.value); break
          case 'def': scanBody(stmt.body); break
          case 'pointer': registerExprPtr(stmt.label, stmt.arrayName, stmt.at, true); break
        }
      }
    }
    scanBody(nodes)
  }

  function registerExprPtr(label: string, arrayName: string, expr: Expr, explicit: boolean): void {
    const key = `${arrayName}:${label}`
    const existing = exprPointers.find(e => `${e.arrayName}:${e.label}` === key)
    if (existing) {
      if (explicit && !existing.explicit) {
        existing.explicit = true
        existing.expr = expr
        existing.varNames = collectVarNamesFromExpr(expr)
      }
      return
    }
    exprPointers.push({
      label,
      arrayName,
      expr,
      varNames: collectVarNamesFromExpr(expr),
      explicit,
    })
  }

  collectExprPointers(ast.body)

  // --- Phase 1: Fixed-point iteration ---

  let changed = true
  let iterations = 0
  const MAX_ITERATIONS = 100

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false
    iterations++

    // Process algo body
    const algoScope = new ScopeStack()
    algoScope.push()
    for (const p of ast.params) {
      if (!p.isArray) {
        algoScope.define(p.name, ast.line)
      }
    }
    if (processBody(ast.body, algoScope, null)) changed = true
    algoScope.pop()
  }

  // --- Phase 2: Collect labels ---

  const labels = new Set<string>()
  for (const [key, arrays] of varTypes) {
    if (arrays.length > 0) {
      const name = key.split('@')[0]
      labels.add(name)
    }
  }
  for (const ep of exprPointers) {
    labels.add(ep.label)
  }

  return {
    varTypes,
    arrayElementTypes: arrayElemTypes,
    expressionPointers: exprPointers,
    iteratorLabels: [...labels],
  }

  // --- Core: process a body of statements ---

  function processBody(stmts: ASTNode[], scope: ScopeStack, currentFunc: string | null): boolean {
    let bodyChanged = false
    for (const stmt of stmts) {
      if (processNode(stmt, scope, currentFunc)) bodyChanged = true
    }
    return bodyChanged
  }

  function processNode(node: ASTNode, scope: ScopeStack, currentFunc: string | null): boolean {
    let nodeChanged = false

    switch (node.type) {
      case 'let': {
        const key = scope.define(node.name, node.line)
        if (!varTypes.has(key)) varTypes.set(key, [])
        const exprType = typeOfExpr(node.value, scope)
        if (joinVar(key, exprType)) nodeChanged = true
        // Process constraints (arr[var] patterns, retroactive tagging) in the value expression
        if (processExprConstraints(node.value, scope)) nodeChanged = true
        break
      }

      case 'assign': {
        if (node.target.type === 'identifier') {
          const key = scope.lookup(node.target.name)
          if (key) {
            const exprType = typeOfExpr(node.value, scope)
            if (joinVar(key, exprType)) nodeChanged = true
          }
          // Process constraints in the value expression
          if (processExprConstraints(node.value, scope)) nodeChanged = true
        } else if (node.target.type === 'index') {
          // arr[idx] = val  →  constraint on idx and arr element type
          if (node.target.array.type === 'identifier') {
            const arrName = node.target.array.name
            if (processIndexExpr(node.target, scope)) nodeChanged = true
            // Array element type absorbs value type
            const valType = typeOfExpr(node.value, scope)
            if (joinElemType(arrName, valType)) nodeChanged = true
          }
          // Process constraints in both the target index and value expressions
          if (processExprConstraints(node.target.index, scope)) nodeChanged = true
          if (processExprConstraints(node.value, scope)) nodeChanged = true
        }
        break
      }

      case 'for': {
        scope.push()
        const key = scope.define(node.variable, node.line)
        if (!varTypes.has(key)) varTypes.set(key, [])

        // Process from/to expressions for any constraints
        if (processExprConstraints(node.from, scope)) nodeChanged = true
        if (processExprConstraints(node.to, scope)) nodeChanged = true

        // Process body (may add constraints to i)
        if (processBody(node.body, scope, currentFunc)) nodeChanged = true

        // Backward propagation: if i is Iter<S>, bare idents in from/to get ⊇ S
        const iType = getVarType(key)
        if (iType.length > 0) {
          if (propagateToExprBareIdents(node.from, iType, scope)) nodeChanged = true
          if (propagateToExprBareIdents(node.to, iType, scope)) nodeChanged = true
        }

        scope.pop()
        break
      }

      case 'while': {
        scope.push()
        if (processExprConstraints(node.condition, scope)) nodeChanged = true
        if (processBody(node.body, scope, currentFunc)) nodeChanged = true
        scope.pop()
        break
      }

      case 'if': {
        if (processExprConstraints(node.condition, scope)) nodeChanged = true
        scope.push()
        if (processBody(node.body, scope, currentFunc)) nodeChanged = true
        scope.pop()
        if (node.elseBody.length > 0) {
          scope.push()
          if (processBody(node.elseBody, scope, currentFunc)) nodeChanged = true
          scope.pop()
        }
        break
      }

      case 'swap': {
        if (processExprConstraints(node.left, scope)) nodeChanged = true
        if (processExprConstraints(node.right, scope)) nodeChanged = true
        break
      }

      case 'dim':
      case 'undim': {
        // Bare idents in from/to are iterators on arrayName
        if (propagateToExprBareIdents(node.from, [node.arrayName], scope)) nodeChanged = true
        if (propagateToExprBareIdents(node.to, [node.arrayName], scope)) nodeChanged = true
        break
      }

      case 'pointer': {
        // #: pointer label on arr at expr → bare idents in expr ⊇ {arr}
        if (propagateToExprBareIdents(node.at, [node.arrayName], scope)) nodeChanged = true
        break
      }

      case 'return': {
        if (currentFunc) {
          const retType = typeOfExpr(node.value, scope)
          if (joinReturn(currentFunc, retType)) nodeChanged = true
        }
        if (processExprConstraints(node.value, scope)) nodeChanged = true
        break
      }

      case 'def': {
        // Process function body with its own scope
        scope.push()
        for (const p of node.params) {
          if (p.isArray) {
            // Array param: not a variable in the type context
          } else {
            const key = scope.define(p.name, node.line)
            if (!varTypes.has(key)) varTypes.set(key, [])
          }
        }
        if (processBody(node.body, scope, node.name)) nodeChanged = true
        scope.pop()
        break
      }

      case 'exprStmt': {
        // Could be a function call
        if (processExprConstraints(node.expr, scope)) nodeChanged = true
        // If it's a call, process call constraints
        if (node.expr.type === 'call') {
          if (processCallConstraints(node.expr, scope)) nodeChanged = true
        }
        break
      }

      case 'alloc': {
        if (processExprConstraints(node.size, scope)) nodeChanged = true
        break
      }

      case 'comment':
      case 'gauge':
      case 'ungauge':
      case 'stepover':
        break
    }

    return nodeChanged
  }

  // --- Expression typing ---

  function typeOfExpr(expr: Expr, scope: ScopeStack): string[] {
    switch (expr.type) {
      case 'number':
        return []  // Num

      case 'identifier': {
        const key = scope.lookup(expr.name)
        if (key) return getVarType(key)
        return []
      }

      case 'binary': {
        const leftType = typeOfExpr(expr.left, scope)
        const rightType = typeOfExpr(expr.right, scope)
        return applyArithmeticAlgebra(expr.op, leftType, rightType)
      }

      case 'unary': {
        if (expr.op === '-') return typeOfExpr(expr.operand, scope)
        return []  // 'not' → Num
      }

      case 'index': {
        // arr[idx] → elemType(arr)
        if (expr.array.type === 'identifier') {
          return arrayElemTypes.get(expr.array.name) ?? []
        }
        return []
      }

      case 'call': {
        if (expr.callee === 'len') return []  // Num
        const info = functions.get(expr.callee)
        if (info) return [...info.returnType]
        return []
      }
    }
  }

  /** Apply the type algebra for arithmetic operations */
  function applyArithmeticAlgebra(op: string, left: string[], right: string[]): string[] {
    // Comparisons and logical ops → Num
    if (['<', '>', '<=', '>=', '==', '!=', 'and', 'or'].includes(op)) return []
    // Multiplication, division, modulo → Num
    if (['*', '/', '%'].includes(op)) return []
    // Addition
    if (op === '+') {
      if (left.length > 0 && right.length > 0) return []  // Iter + Iter = Num
      return left.length > 0 ? [...left] : [...right]
    }
    // Subtraction
    if (op === '-') {
      if (left.length > 0 && right.length > 0) return []  // Iter - Iter = Num
      if (left.length > 0) return [...left]  // Iter - Num = Iter
      return []  // Num - Iter = Num
    }
    return []
  }

  // --- Constraint processing ---

  /** Process an expression for indexing constraints (arr[var] patterns).
   *  Returns true if any type changed. */
  function processExprConstraints(expr: Expr, scope: ScopeStack): boolean {
    let changed = false
    if (expr.type === 'index') {
      if (processIndexExpr(expr, scope)) changed = true
    }
    switch (expr.type) {
      case 'binary':
        if (processExprConstraints(expr.left, scope)) changed = true
        if (processExprConstraints(expr.right, scope)) changed = true
        break
      case 'unary':
        if (processExprConstraints(expr.operand, scope)) changed = true
        break
      case 'call':
        if (processCallConstraints(expr, scope)) changed = true
        for (const arg of expr.args) {
          if (processExprConstraints(arg, scope)) changed = true
        }
        break
      case 'index':
        if (processExprConstraints(expr.array, scope)) changed = true
        if (processExprConstraints(expr.index, scope)) changed = true
        break
    }
    return changed
  }

  /** Process arr[idx] pattern for constraints */
  function processIndexExpr(expr: Expr, scope: ScopeStack): boolean {
    if (expr.type !== 'index' || expr.array.type !== 'identifier') return false
    let changed = false
    const arrName = expr.array.name

    if (expr.index.type === 'identifier') {
      // arr[bareVar] → var ⊇ {arr}
      const key = scope.lookup(expr.index.name)
      if (key && joinVar(key, [arrName])) changed = true
    } else {
      // arr[complexExpr] → expression pointer, bare idents in expr ⊇ {arr}
      if (propagateToExprBareIdents(expr.index, [arrName], scope)) changed = true
    }

    // Retroactive cell tagging: target[source[x]] → elemType(source) ⊇ {target}
    // Only outermost IndexExpr tags its source
    if (expr.index.type === 'index' && expr.index.array.type === 'identifier') {
      if (joinElemType(expr.index.array.name, [arrName])) changed = true
    } else {
      // Walk the index expression for nested IndexExpr at top level
      if (processRetroactiveTags(expr.index, arrName)) changed = true
    }

    return changed
  }

  /** Walk an expression to find IndexExpr nodes at the top level (stop at IndexExpr boundaries) */
  function processRetroactiveTags(expr: Expr, targetArray: string): boolean {
    let changed = false
    if (expr.type === 'index' && expr.array.type === 'identifier') {
      if (joinElemType(expr.array.name, [targetArray])) changed = true
      return changed  // Stop at IndexExpr boundary
    }
    switch (expr.type) {
      case 'binary':
        if (processRetroactiveTags(expr.left, targetArray)) changed = true
        if (processRetroactiveTags(expr.right, targetArray)) changed = true
        break
      case 'unary':
        if (processRetroactiveTags(expr.operand, targetArray)) changed = true
        break
      case 'call':
        for (const arg of expr.args) {
          if (processRetroactiveTags(arg, targetArray)) changed = true
        }
        break
    }
    return changed
  }

  /** Process function call constraints: propagate arg types to param types and vice versa */
  function processCallConstraints(expr: Expr, scope: ScopeStack): boolean {
    if (expr.type !== 'call') return false
    if (expr.callee === 'len') return false
    const info = functions.get(expr.callee)
    if (!info) return false
    let changed = false

    for (let i = 0; i < info.node.params.length; i++) {
      const param = info.node.params[i]
      if (param.isArray) continue  // Skip array params
      const argExpr = expr.args[i]
      if (!argExpr) continue
      const argType = typeOfExpr(argExpr, scope)
      const paramKey = info.paramKeys[i]
      if (paramKey && joinVar(paramKey, argType)) changed = true
    }

    return changed
  }

  /** Propagate types to bare identifiers in an expression (for dim/undim, for-loop bounds, pointer at) */
  function propagateToExprBareIdents(expr: Expr, arrays: string[], scope: ScopeStack): boolean {
    let changed = false
    if (expr.type === 'identifier') {
      const key = scope.lookup(expr.name)
      if (key && joinVar(key, arrays)) changed = true
    }
    switch (expr.type) {
      case 'binary':
        if (propagateToExprBareIdents(expr.left, arrays, scope)) changed = true
        if (propagateToExprBareIdents(expr.right, arrays, scope)) changed = true
        break
      case 'unary':
        if (propagateToExprBareIdents(expr.operand, arrays, scope)) changed = true
        break
      case 'call':
        for (const arg of expr.args) {
          if (propagateToExprBareIdents(arg, arrays, scope)) changed = true
        }
        break
      case 'index':
        // Don't recurse through array indexing (stop at IndexExpr boundary)
        break
    }
    return changed
  }
}

// --- Utility ---

function collectVarNamesFromExpr(expr: Expr): string[] {
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
  return [...names]
}

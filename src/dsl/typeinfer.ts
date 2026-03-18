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
 * Two-tier constraint resolution (AND/OR):
 *   Each variable carries two sets of array associations:
 *     AND — structural evidence: the variable IS used as a position (arr[x], dim, swap)
 *     OR  — value flow evidence: the variable MIGHT be a position (let x = y, arg→param)
 *   During fixed-point iteration, both tiers propagate (and ∪ or) for monotonicity.
 *   After convergence, resolution applies: and ≠ ∅ → and, else or.
 *   This prevents value-flow contamination (e.g. `let i = lo` where lo: {src, dst}
 *   won't override structural evidence from `src[i]`).
 *
 * Lattice:  Num ⊑ Iter<S>,  Iter<S₁> ⊔ Iter<S₂> = Iter<S₁ ∪ S₂>
 * Finite, monotone → fixed-point iteration terminates.
 */
import type { ASTNode, AlgoNode, DefNode, Expr } from './ast.ts'

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
  // Two-tier type maps: AND = structural evidence, OR = value flow evidence
  const varAnd = new Map<VarKey, string[]>()    // direct structural: arr[x], dim, undim, pointer, swap
  const varOr  = new Map<VarKey, string[]>()    // value flow: let x = expr, x = expr, arg→param, backward
  const arrayElemTypes = new Map<string, string[]>()
  const exprPointers: ExprPointerDef[] = []
  const functions = new Map<string, FuncInfo>()

  // Initialize element types for input arrays
  for (const name of inputArrayNames) {
    arrayElemTypes.set(name, [])
  }

  // --- Helpers ---

  /** Merge `additions` into `target` (set-as-sorted-array). Returns true if any new element was added. */
  function joinSet(target: string[], additions: string[]): boolean {
    let changed = false
    for (const a of additions) {
      if (!target.includes(a)) {
        target.push(a)
        changed = true
      }
    }
    return changed
  }

  function initVar(key: VarKey): void {
    if (!varAnd.has(key)) varAnd.set(key, [])
    if (!varOr.has(key)) varOr.set(key, [])
  }

  function joinVarAnd(key: VarKey, arrays: string[]): boolean {
    if (arrays.length === 0) return false
    const existing = varAnd.get(key)
    if (!existing) { varAnd.set(key, [...arrays]); return true }
    return joinSet(existing, arrays)
  }

  function joinVarOr(key: VarKey, arrays: string[]): boolean {
    if (arrays.length === 0) return false
    const existing = varOr.get(key)
    if (!existing) { varOr.set(key, [...arrays]); return true }
    return joinSet(existing, arrays)
  }

  function joinElemType(arrName: string, arrays: string[]): boolean {
    if (arrays.length === 0) return false
    const existing = arrayElemTypes.get(arrName)
    if (!existing) { arrayElemTypes.set(arrName, [...arrays]); return true }
    return joinSet(existing, arrays)
  }

  function joinReturn(funcName: string, arrays: string[]): boolean {
    const info = functions.get(funcName)
    if (!info || arrays.length === 0) return false
    return joinSet(info.returnType, arrays)
  }

  /** During iteration, return and ∪ or for maximum propagation (monotone). */
  function getVarType(key: VarKey): string[] {
    const a = varAnd.get(key) ?? []
    const o = varOr.get(key) ?? []
    if (a.length === 0) return o
    if (o.length === 0) return a
    const merged = [...a]
    for (const x of o) {
      if (!merged.includes(x)) merged.push(x)
    }
    return merged
  }

  // --- Collect structure (defs, allocs) ---

  function collectStructure(nodes: ASTNode[]): void {
    for (const node of nodes) {
      if (node.type === 'def') {
        const paramKeys: string[] = []
        for (const p of node.params) {
          if (!p.isArray) {
            const key = varKey(p.name, node.line)
            paramKeys.push(key)
            initVar(key)
          } else {
            paramKeys.push('')  // placeholder for array params
          }
        }
        functions.set(node.name, { node, paramKeys, returnType: [] })
        collectStructure(node.body)
      } else if (node.type === 'alloc') {
        arrayElemTypes.set(node.arrayName, [])
        collectStructureChildren(node)
      } else {
        collectStructureChildren(node)
      }
    }
  }

  function collectStructureChildren(node: ASTNode): void {
    if (node.type === 'for' || node.type === 'while') {
      collectStructure(node.body)
    } else if (node.type === 'if') {
      collectStructure(node.body)
      collectStructure(node.elseBody)
    }
  }

  collectStructure(ast.body)

  // --- Collect expression pointers (all are now explicit pointer nodes after AST transform) ---

  function collectExprPointers(nodes: ASTNode[]): void {
    for (const node of nodes) {
      if (node.type === 'pointer') {
        const key = `${node.arrayName}:${node.label}`
        if (!exprPointers.find(e => `${e.arrayName}:${e.label}` === key)) {
          exprPointers.push({
            label: node.label,
            arrayName: node.arrayName,
            expr: node.at,
            varNames: collectVarNamesFromExpr(node.at),
            explicit: true,
          })
        }
      }
      if ('body' in node && Array.isArray((node as any).body)) {
        collectExprPointers((node as any).body)
      }
      if ('elseBody' in node && Array.isArray((node as any).elseBody)) {
        collectExprPointers((node as any).elseBody)
      }
    }
  }

  collectExprPointers(ast.body)

  // --- Fixed-point iteration ---

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

  // --- Resolve AND/OR to final varTypes ---
  // resolve(and, or) = and if and ≠ ∅, else or

  const varTypes = new Map<VarKey, string[]>()
  const allKeys = new Set<VarKey>([...varAnd.keys(), ...varOr.keys()])
  for (const key of allKeys) {
    const a = varAnd.get(key) ?? []
    const o = varOr.get(key) ?? []
    varTypes.set(key, a.length > 0 ? a : o)
  }

  // --- Collect labels ---

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
        initVar(key)
        const exprType = typeOfExpr(node.value, scope)
        if (joinVarOr(key, exprType)) nodeChanged = true
        // Process constraints (arr[var] patterns, retroactive tagging) in the value expression
        if (processExprConstraints(node.value, scope)) nodeChanged = true
        break
      }

      case 'assign': {
        if (node.target.type === 'identifier') {
          const key = scope.lookup(node.target.name)
          if (key) {
            const exprType = typeOfExpr(node.value, scope)
            if (joinVarOr(key, exprType)) nodeChanged = true
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
        initVar(key)

        // Process from/to expressions for any constraints
        if (processExprConstraints(node.from, scope)) nodeChanged = true
        if (processExprConstraints(node.to, scope)) nodeChanged = true

        // Process body (may add constraints to i)
        if (processBody(node.body, scope, currentFunc)) nodeChanged = true

        // Backward propagation: if i is Iter<S>, bare idents in from/to get OR ⊇ S
        const iType = getVarType(key)
        if (iType.length > 0) {
          if (propagateToExprBareIdents(node.from, iType, scope, false)) nodeChanged = true
          if (propagateToExprBareIdents(node.to, iType, scope, false)) nodeChanged = true
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
        // Bare idents in from/to are iterators on arrayName (structural AND evidence)
        if (propagateToExprBareIdents(node.from, [node.arrayName], scope, true)) nodeChanged = true
        if (propagateToExprBareIdents(node.to, [node.arrayName], scope, true)) nodeChanged = true
        break
      }

      case 'pointer': {
        // #: pointer label on arr at expr → bare idents in expr ⊇ {arr} (structural AND)
        if (propagateToExprBareIdents(node.at, [node.arrayName], scope, true)) nodeChanged = true
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
        scope.push()
        for (const p of node.params) {
          if (!p.isArray) {
            const key = scope.define(p.name, node.line)
            initVar(key)
          }
        }
        if (processBody(node.body, scope, node.name)) nodeChanged = true
        scope.pop()
        break
      }

      case 'exprStmt': {
        if (processExprConstraints(node.expr, scope)) nodeChanged = true
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
      // arr[bareVar] → var.and ⊇ {arr} (structural evidence)
      const key = scope.lookup(expr.index.name)
      if (key && joinVarAnd(key, [arrName])) changed = true
    } else {
      // arr[complexExpr] → bare idents in expr get AND ⊇ {arr} (structural)
      if (propagateToExprBareIdents(expr.index, [arrName], scope, true)) changed = true
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

  /** Process function call constraints: propagate arg types to param types (OR / value flow) */
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
      if (paramKey && joinVarOr(paramKey, argType)) changed = true
    }

    return changed
  }

  /** Propagate types to bare identifiers in an expression.
   *  @param definite — true → AND (structural evidence), false → OR (value flow) */
  function propagateToExprBareIdents(expr: Expr, arrays: string[], scope: ScopeStack, definite: boolean): boolean {
    const join = definite ? joinVarAnd : joinVarOr
    let changed = false
    if (expr.type === 'identifier') {
      const key = scope.lookup(expr.name)
      if (key && join(key, arrays)) changed = true
    }
    switch (expr.type) {
      case 'binary':
        if (propagateToExprBareIdents(expr.left, arrays, scope, definite)) changed = true
        if (propagateToExprBareIdents(expr.right, arrays, scope, definite)) changed = true
        break
      case 'unary':
        if (propagateToExprBareIdents(expr.operand, arrays, scope, definite)) changed = true
        break
      case 'call':
        for (const arg of expr.args) {
          if (propagateToExprBareIdents(arg, arrays, scope, definite)) changed = true
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

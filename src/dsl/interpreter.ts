import type {
  ASTNode, AlgoNode, ForNode, WhileNode, IfNode, LetNode, AssignNode, SwapNode, DimNode, UndimNode, CommentNode, AllocNode, DefNode, ReturnNode, PointerNode,
  Expr, CommentPart,
} from './ast.ts'
import { exprToString } from './ast.ts'
import type { Value } from './value.ts'
import { plainVal, addArray, mergeArrays, propagateArithmetic } from './value.ts'

/** Sentinel thrown by `return` statements to unwind execution. */
class ReturnSignal {
  value: Value
  constructor(value: Value) { this.value = value }
}
import type { Step, TrackedArray, Highlight, VarHighlight, DimRange, CallFrame } from '../types.ts'

/**
 * Create a runner for the given algorithm AST.
 * colorMap is computed once in the pipeline and shared.
 */
export function createRunner(algo: AlgoNode, _colorMap: Map<string, string>): (input: Map<string, number[]>) => Step[] {

  return function run(input: Map<string, number[]>): Step[] {
    const steps: Step[] = []
    const arrays = new Map<string, Value[]>()
    const scopeStack: Map<string, Value>[] = [new Map()]
    const procedures = new Map<string, { params: { name: string; paramType?: string }[]; body: ASTNode[] }>()
    let callDepth = 0

    interface ActiveFrame {
      name: string
      argStrings: string[]
      allocatedArrays: Set<string>
      arrayAliases: Map<string, string>
      scopeBase: number
    }
    const callFrameStack: ActiveFrame[] = []
    const arrayAliasStack: Map<string, string>[] = []

    // --- Expression pointer registry ---
    interface ExprPtrEntry {
      label: string
      arrayName: string  // syntactic name (resolved at snapshot time)
      expr: Expr
      varNames: string[]
      explicit: boolean  // true = from #: pointer directive
    }
    const exprPointerRegistry: ExprPtrEntry[] = []

    // Stack of pre-scanned iterator associations per scope
    const associationStack: Map<string, Set<string>>[] = []

    /** Look up pre-scanned associations for a variable name across all active scopes. */
    function lookupAssociations(varName: string): string[] {
      const result = new Set<string>()
      for (const assoc of associationStack) {
        const arrNames = assoc.get(varName)
        if (arrNames) {
          for (const n of arrNames) result.add(n)
        }
      }
      return [...result]
    }

    /** Apply looked-up associations to a value for a variable name. */
    function applyAssociations(value: Value, varName: string): Value {
      const arrNames = lookupAssociations(varName)
      if (arrNames.length === 0) return value
      const resolved = arrNames.map(n => resolveArrayName(n)).filter(n => arrays.has(n))
      if (resolved.length === 0) return value
      return { num: value.num, arrays: mergeArrays(value.arrays, resolved) }
    }

    function resolveArrayName(name: string): string {
      const seen = new Set<string>()
      let current = name
      for (;;) {
        let found = false
        for (let i = arrayAliasStack.length - 1; i >= 0; i--) {
          if (arrayAliasStack[i].has(current)) {
            current = arrayAliasStack[i].get(current)!
            if (seen.has(current)) return current
            seen.add(current)
            found = true
            break
          }
        }
        if (!found) return current
      }
    }
    // --- Visualization state (highlights, dims) ---
    let currentHighlights: Highlight[] = []
    let currentVarHighlights: VarHighlight[] = []
    let dimRanges: DimRange[] = []
    let gaugeArrays = new Set<string>()

    type HighlightType = 'compare' | 'swap' | 'sorted' | 'active'

    function clearHighlights(): void {
      currentHighlights = []
      currentVarHighlights = []
    }

    /** Add array cell highlights, merging indices into existing highlight of same type. */
    function addArrayHighlight(arrayName: string, indices: number[], type: HighlightType): void {
      const existing = currentHighlights.find(h => h.arrayName === arrayName && h.type === type)
      if (existing) {
        for (const idx of indices) {
          if (!existing.indices.includes(idx)) existing.indices.push(idx)
        }
      } else {
        currentHighlights.push({ arrayName, indices: [...indices], type })
      }
    }

    /** Replace all array highlights with a single one (for primary actions like swap/assign). */
    function setArrayHighlight(arrayName: string, indices: number[], type: HighlightType): void {
      currentHighlights = [{ arrayName, indices, type }]
    }

    let pendingCommentParts: CommentPart[] | null = null

    for (const [name, values] of input) {
      arrays.set(name, values.map(v => plainVal(v)))
    }

    function getVar(name: string): Value | undefined {
      for (let i = scopeStack.length - 1; i >= 0; i--) {
        if (scopeStack[i].has(name)) return scopeStack[i].get(name)
      }
      return undefined
    }

    function setVar(name: string, value: Value): void {
      scopeStack[scopeStack.length - 1].set(name, value)
    }

    function updateVar(name: string, value: Value): void {
      for (let i = scopeStack.length - 1; i >= 0; i--) {
        if (scopeStack[i].has(name)) {
          scopeStack[i].set(name, value)
          return
        }
      }
      scopeStack[scopeStack.length - 1].set(name, value)
    }

    function hasVar(name: string): boolean {
      for (let i = scopeStack.length - 1; i >= 0; i--) {
        if (scopeStack[i].has(name)) return true
      }
      return false
    }

    function pushScope(): void {
      scopeStack.push(new Map())
    }

    function popScope(): void {
      scopeStack.pop()
    }

    function collectVarNames(expr: Expr, out: Set<string>): void {
      switch (expr.type) {
        case 'identifier': out.add(expr.name); break
        case 'binary': collectVarNames(expr.left, out); collectVarNames(expr.right, out); break
        case 'unary': collectVarNames(expr.operand, out); break
        case 'index': collectVarNames(expr.array, out); collectVarNames(expr.index, out); break
        case 'call': expr.args.forEach(a => collectVarNames(a, out)); break
      }
    }

    /** Check that all variables in an expression exist in the current function's
     *  own scope (or global scope), not inherited from parent call scopes. */
    function exprVarsInCurrentScope(expr: Expr): boolean {
      const vars = new Set<string>()
      collectVarNames(expr, vars)
      for (const name of vars) {
        let found = false
        // Check current function's scopes (from scopeBase to stack top)
        if (callFrameStack.length > 0) {
          const base = callFrameStack[callFrameStack.length - 1].scopeBase
          for (let si = base; si < scopeStack.length; si++) {
            if (scopeStack[si].has(name)) { found = true; break }
          }
        }
        if (found) continue
        // Check algo-level scopes
        const algoTop = callFrameStack.length > 0
          ? callFrameStack[0].scopeBase
          : scopeStack.length
        for (let si = 0; si < algoTop; si++) {
          if (scopeStack[si].has(name)) { found = true; break }
        }
        if (found) continue
        return false
      }
      return true
    }

    /** Register an expression pointer (from arr[complex_expr] or #: pointer directive). */
    function registerExprPointer(label: string, arrayName: string, expr: Expr, explicit: boolean): void {
      const key = `${arrayName}:${label}`
      const existing = exprPointerRegistry.find(e => `${e.arrayName}:${e.label}` === key)
      if (existing) {
        // Explicit overrides implicit
        if (explicit && !existing.explicit) {
          existing.explicit = true
          existing.expr = expr
          const varNames = new Set<string>()
          collectVarNames(expr, varNames)
          existing.varNames = [...varNames]
        }
        return
      }
      const varNames = new Set<string>()
      collectVarNames(expr, varNames)
      exprPointerRegistry.push({ label, arrayName, expr, varNames: [...varNames], explicit })
    }

    /** Pre-scan a body for expression pointers and register them. */
    function prescanExpressionPointers(body: ASTNode[]): void {
      function scanExpr(expr: Expr): void {
        if (expr.type === 'index' && expr.array.type === 'identifier' && expr.index.type !== 'identifier') {
          const label = exprToString(expr.index)
          registerExprPointer(label, expr.array.name, expr.index, false)
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
            case 'pointer': registerExprPointer(stmt.label, stmt.arrayName, stmt.at, true); break
          }
        }
      }
      scanBody(body)
    }

    /** Pre-scan a body for bare identifier indexing patterns: arr[var],
     *  and dim/undim expressions (variables in dim/undim ranges are iterators).
     *  Returns map: variable_name → set of syntactic array names. */
    function prescanIteratorAssociations(body: ASTNode[]): Map<string, Set<string>> {
      const assoc = new Map<string, Set<string>>()
      function addAssoc(varName: string, arrName: string): void {
        if (!assoc.has(varName)) assoc.set(varName, new Set())
        assoc.get(varName)!.add(arrName)
      }
      function scanExpr(expr: Expr): void {
        if (expr.type === 'index' && expr.array.type === 'identifier' && expr.index.type === 'identifier') {
          addAssoc(expr.index.name, expr.array.name)
        }
        switch (expr.type) {
          case 'binary': scanExpr(expr.left); scanExpr(expr.right); break
          case 'unary': scanExpr(expr.operand); break
          case 'call': expr.args.forEach(scanExpr); break
          case 'index': scanExpr(expr.array); scanExpr(expr.index); break
        }
      }
      /** Extract bare identifiers from dim/undim range expressions as iterator associations. */
      function scanDimExpr(expr: Expr, arrName: string): void {
        if (expr.type === 'identifier') {
          addAssoc(expr.name, arrName)
        }
        switch (expr.type) {
          case 'binary': scanDimExpr(expr.left, arrName); scanDimExpr(expr.right, arrName); break
          case 'unary': scanDimExpr(expr.operand, arrName); break
          case 'call': expr.args.forEach(a => scanDimExpr(a, arrName)); break
          case 'index': break // don't recurse through array indexing
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
            case 'dim': scanDimExpr(stmt.from, stmt.arrayName); scanDimExpr(stmt.to, stmt.arrayName); break
            case 'undim': scanDimExpr(stmt.from, stmt.arrayName); scanDimExpr(stmt.to, stmt.arrayName); break
          }
        }
      }
      scanBody(body)
      return assoc
    }

    /** Tag a variable as iterator on an array (runtime tagging). */
    function tagVar(varName: string, arrayName: string): void {
      const val = getVar(varName)
      if (!val) return
      if (!val.arrays.includes(arrayName)) {
        updateVar(varName, addArray(val, arrayName))
      }
    }

    /** Retroactively tag array cells that are used as indices into another array.
     *  Walks the expression to find IndexExpr nodes and tags those cells.
     *  Stops at IndexExpr boundaries (doesn't recurse through nested IndexExpr). */
    function retroactivelyTagCells(expr: Expr, targetArrayName: string): void {
      if (expr.type === 'index' && expr.array.type === 'identifier') {
        const arrName = resolveArrayName(expr.array.name)
        const arr = arrays.get(arrName)
        if (arr) {
          try {
            const idx = evalExpr(expr.index).num
            if (idx >= 0 && idx < arr.length) {
              if (!arr[idx].arrays.includes(targetArrayName)) {
                arr[idx] = addArray(arr[idx], targetArrayName)
              }
            }
          } catch { /* skip */ }
        }
        // Stop — don't recurse past this IndexExpr
        return
      }
      switch (expr.type) {
        case 'binary': retroactivelyTagCells(expr.left, targetArrayName); retroactivelyTagCells(expr.right, targetArrayName); break
        case 'unary': retroactivelyTagCells(expr.operand, targetArrayName); break
        case 'call': expr.args.forEach(a => retroactivelyTagCells(a, targetArrayName)); break
      }
    }

    function evaluateCommentParts(parts: CommentPart[]): string {
      return parts.map(part => {
        switch (part.type) {
          case 'text': return part.text
          case 'expr':
            try { return String(evalExpr(part.expr).num) }
            catch { return '{?}' }
          case 'ternary':
            try {
              const val = evalExpr(part.condition)
              return val.num !== 0 ? part.trueText : part.falseText
            }
            catch { return '{?}' }
        }
      }).join('')
    }

    function snapshot(line: number, description: string): void {
      if (pendingCommentParts !== null) {
        description = evaluateCommentParts(pendingCommentParts)
        pendingCommentParts = null
      }

      // Evaluate expression pointers
      const allExprPointers: Record<string, Value> = {}
      for (const entry of exprPointerRegistry) {
        // Check all varNames are in current scope
        const allInScope = entry.varNames.every(name => hasVar(name))
        if (!allInScope) continue
        if (!exprVarsInCurrentScope(entry.expr)) continue
        const resolvedArr = resolveArrayName(entry.arrayName)
        if (!arrays.has(resolvedArr)) continue
        try {
          const val = evalExpr(entry.expr)
          const existing = allExprPointers[entry.label]
          if (existing) {
            allExprPointers[entry.label] = { num: val.num, arrays: mergeArrays(existing.arrays, [resolvedArr]) }
          } else {
            allExprPointers[entry.label] = { num: val.num, arrays: [resolvedArr] }
          }
        } catch { /* skip */ }
      }

      const allDimRanges: DimRange[] = [...dimRanges]

      // Build call stack frames
      const frameArrayNames = new Set<string>()
      const frameVarNames = new Set<string>()
      const frameExprPtrLabels = new Set<string>()
      const callStackFrames: CallFrame[] = []

      if (callFrameStack.length > 0) {
        for (let fi = 0; fi < callFrameStack.length; fi++) {
          const af = callFrameStack[fi]
          const label = `${af.name}(${af.argStrings.join(', ')})`

          // Build arrayRefs from aliases
          const arrayRefs = [...af.arrayAliases.entries()].map(
            ([paramName, targetName]) => ({ paramName, targetName })
          )

          // Frame's variables come from all scopes in this frame
          const frameVars: Record<string, Value> = {}
          const scopeFrom = af.scopeBase
          const scopeTo = fi + 1 < callFrameStack.length
            ? callFrameStack[fi + 1].scopeBase
            : scopeStack.length
          for (let si = scopeFrom; si < scopeTo; si++) {
            for (const [k, v] of scopeStack[si]) {
              frameVars[k] = v
              frameVarNames.add(k)
            }
          }

          // Frame's arrays
          const frameArrays: TrackedArray[] = []
          for (const arrName of af.allocatedArrays) {
            const arr = arrays.get(arrName)
            if (arr) {
              frameArrays.push({ name: arrName, values: arr.map(v => ({ ...v })) })
              frameArrayNames.add(arrName)
            }
          }

          // Filter highlights for this frame's arrays
          const frameHighlights = currentHighlights.filter(h => af.allocatedArrays.has(h.arrayName))
          // Only highlight variables in the innermost (currently executing) frame
          const isInnermostFrame = fi === callFrameStack.length - 1
          const frameVarHighlights = isInnermostFrame
            ? currentVarHighlights.filter(h => h.varName in frameVars)
            : []
          // Filter dim ranges for this frame's arrays
          const frameDimRanges = allDimRanges.filter(d => af.allocatedArrays.has(d.arrayName))
          const frameGaugeArrays = [...gaugeArrays].filter(n => af.allocatedArrays.has(n))

          // Frame expression pointers: those whose arrays are in this frame
          const frameExprPtrs: Record<string, Value> = {}
          for (const [epLabel, epVal] of Object.entries(allExprPointers)) {
            const frameArrays2 = epVal.arrays.filter(a => af.allocatedArrays.has(a))
            if (frameArrays2.length > 0) {
              frameExprPtrs[epLabel] = { num: epVal.num, arrays: frameArrays2 }
              frameExprPtrLabels.add(epLabel)
            }
          }

          callStackFrames.push({
            label,
            variables: frameVars,
            expressionPointers: frameExprPtrs,
            arrayRefs,
            arrays: frameArrays,
            highlights: frameHighlights,
            varHighlights: frameVarHighlights,
            dimRanges: frameDimRanges,
            gaugeArrays: frameGaugeArrays,
          })
        }
      }

      // Global arrays: not owned by any frame
      const globalArrays: TrackedArray[] = []
      for (const [name, values] of arrays) {
        if (!frameArrayNames.has(name)) {
          globalArrays.push({ name, values: values.map(v => ({ ...v })) })
        }
      }

      // Global variables: from algo-level scopes only
      const globalVars: Record<string, Value> = {}
      const globalScopeTo = callFrameStack.length > 0
        ? callFrameStack[0].scopeBase
        : scopeStack.length
      for (let si = 0; si < globalScopeTo; si++) {
        for (const [k, v] of scopeStack[si]) {
          if (!frameVarNames.has(k)) {
            globalVars[k] = v
          }
        }
      }

      // Global expression pointers: not belonging to any frame's arrays
      const globalExprPtrs: Record<string, Value> = {}
      for (const [epLabel, epVal] of Object.entries(allExprPointers)) {
        if (frameExprPtrLabels.has(epLabel)) continue
        const globalArrays2 = epVal.arrays.filter(a => !frameArrayNames.has(a))
        if (globalArrays2.length > 0) {
          globalExprPtrs[epLabel] = { num: epVal.num, arrays: globalArrays2 }
        }
      }

      const globalHighlights = currentHighlights.filter(h => !frameArrayNames.has(h.arrayName))
      const globalVarHighlights = currentVarHighlights.filter(h => !frameVarNames.has(h.varName))
      const globalDimRanges = allDimRanges.filter(d => !frameArrayNames.has(d.arrayName))
      const globalGaugeArrays = [...gaugeArrays].filter(n => !frameArrayNames.has(n))

      steps.push({
        arrays: globalArrays,
        expressionPointers: globalExprPtrs,
        highlights: globalHighlights,
        varHighlights: globalVarHighlights,
        dimRanges: globalDimRanges,
        gaugeArrays: globalGaugeArrays,
        variables: globalVars,
        callStack: callStackFrames,
        currentLine: line,
        description,
      })
      clearHighlights()
    }

    function evalExpr(expr: Expr): Value {
      switch (expr.type) {
        case 'number': return plainVal(expr.value)
        case 'identifier': {
          const val = getVar(expr.name)
          if (val === undefined) throw new Error(`Undefined variable: ${expr.name}`)
          return val
        }
        case 'binary': {
          // Short-circuit for and/or
          if (expr.op === 'and') {
            const left = evalExpr(expr.left)
            return left.num === 0 ? plainVal(0) : (evalExpr(expr.right).num !== 0 ? plainVal(1) : plainVal(0))
          }
          if (expr.op === 'or') {
            const left = evalExpr(expr.left)
            return left.num !== 0 ? plainVal(1) : (evalExpr(expr.right).num !== 0 ? plainVal(1) : plainVal(0))
          }
          const left = evalExpr(expr.left)
          const right = evalExpr(expr.right)
          const numResult = evalBinary(expr.op, left.num, right.num)
          return propagateArithmetic(expr.op, left, right, numResult)
        }
        case 'unary':
          if (expr.op === '-') {
            const operand = evalExpr(expr.operand)
            return { num: -operand.num, arrays: operand.arrays }
          }
          if (expr.op === 'not') return evalExpr(expr.operand).num === 0 ? plainVal(1) : plainVal(0)
          throw new Error(`Unknown unary op: ${expr.op}`)
        case 'index': {
          const arr = getArray(expr.array)
          const idxVal = evalExpr(expr.index)
          const idx = idxVal.num
          if (idx < 0 || idx >= arr.length) {
            const name = expr.array.type === 'identifier' ? expr.array.name : 'array'
            throw new Error(`Index ${idx} out of bounds for ${name}[0..${arr.length - 1}]`)
          }

          // Direct variable tagging: arr[var] with bare identifier
          if (expr.index.type === 'identifier' && expr.array.type === 'identifier') {
            const arrayName = resolveArrayName(expr.array.name)
            tagVar(expr.index.name, arrayName)
          }

          // Retroactive cell tagging: if the index expression contains an IndexExpr
          if (expr.array.type === 'identifier') {
            const targetArray = resolveArrayName(expr.array.name)
            retroactivelyTagCells(expr.index, targetArray)
          }

          return arr[idx]
        }
        case 'call': return evalCall(expr.callee, expr.args)
      }
    }

    function evalBinary(op: string, left: number, right: number): number {
      switch (op) {
        case '+': return left + right
        case '-': return left - right
        case '*': return left * right
        case '/': return Math.floor(left / right)
        case '%': return left % right
        case '<': return left < right ? 1 : 0
        case '>': return left > right ? 1 : 0
        case '<=': return left <= right ? 1 : 0
        case '>=': return left >= right ? 1 : 0
        case '==': return left === right ? 1 : 0
        case '!=': return left !== right ? 1 : 0
        case 'and': return (left !== 0 && right !== 0) ? 1 : 0
        case 'or': return (left !== 0 || right !== 0) ? 1 : 0
        default: throw new Error(`Unknown operator: ${op}`)
      }
    }

    function evalCall(name: string, args: Expr[]): Value {
      if (name === 'len') {
        const arg = args[0]
        if (arg.type === 'identifier') {
          const resolved = resolveArrayName(arg.name)
          const arr = arrays.get(resolved)
          if (arr) return plainVal(arr.length)
        }
        throw new Error(`len() expects an array identifier`)
      }
      // User-defined procedure call
      const proc = procedures.get(name)
      if (proc) {
        if (++callDepth > 1000) throw new Error('Max recursion depth exceeded (1000 nested calls). Check for infinite recursion in your algorithm.')

        // Phase 1: evaluate args — array params get aliases, scalar params get values
        const aliasMap = new Map<string, string>()
        const scalarBindings: { name: string; value: Value }[] = []
        const argStrings: string[] = []

        for (let i = 0; i < proc.params.length; i++) {
          const param = proc.params[i]
          if (param.paramType === 'int[]') {
            // Array reference param: extract identifier name and resolve
            const arg = args[i]
            if (arg.type !== 'identifier') throw new Error(`Expected array identifier for param ${param.name}`)
            const resolved = resolveArrayName(arg.name)
            aliasMap.set(param.name, resolved)
            argStrings.push(resolved)
          } else {
            // Scalar param
            const val = evalExpr(args[i])
            scalarBindings.push({ name: param.name, value: val })
            argStrings.push(String(val.num))
          }
        }

        // Phase 2: push frame, alias stack, scope, bind scalars
        const frame: ActiveFrame = { name, argStrings, allocatedArrays: new Set(), arrayAliases: aliasMap, scopeBase: 0 }
        callFrameStack.push(frame)
        arrayAliasStack.push(aliasMap)
        pushScope()
        frame.scopeBase = scopeStack.length - 1

        // Pre-scan function body for iterator associations
        const funcAssociations = prescanIteratorAssociations(proc.body)
        associationStack.push(funcAssociations)

        for (const binding of scalarBindings) {
          const tagged = applyAssociations(binding.value, binding.name)
          setVar(binding.name, tagged)
        }

        // Save caller's expression pointer registry and dim ranges
        const savedExprPtrLen = exprPointerRegistry.length
        const savedDimRanges = [...dimRanges]
        const savedGaugeArrays = new Set(gaugeArrays)
        const savedAssocStackLen = associationStack.length

        // Pre-scan function body for expression pointers
        prescanExpressionPointers(proc.body)

        // Execute body
        let returnValue: Value = plainVal(0)
        try {
          for (const stmt of proc.body) execNode(stmt)
          flushPendingComment(proc.body.length > 0 ? proc.body[proc.body.length - 1].line : 0)
        } catch (e) {
          if (e instanceof ReturnSignal) {
            returnValue = e.value
          } else {
            throw e
          }
        }

        // Restore caller's state
        exprPointerRegistry.length = savedExprPtrLen
        associationStack.length = savedAssocStackLen
        dimRanges = savedDimRanges
        gaugeArrays = savedGaugeArrays

        // Cleanup: pop all scopes back to (and including) the function's base scope
        while (scopeStack.length > frame.scopeBase) popScope()
        arrayAliasStack.pop()
        for (const arrName of frame.allocatedArrays) {
          arrays.delete(arrName)
        }
        callFrameStack.pop()
        callDepth--
        return returnValue
      }
      throw new Error(`Unknown function: ${name}`)
    }

    function getArray(expr: Expr): Value[] {
      if (expr.type === 'identifier') {
        const resolved = resolveArrayName(expr.name)
        const arr = arrays.get(resolved)
        if (!arr) throw new Error(`Undefined array: ${expr.name}`)
        return arr
      }
      throw new Error('Expected array identifier')
    }

    function getArrayName(expr: Expr): string {
      if (expr.type === 'identifier') return resolveArrayName(expr.name)
      throw new Error('Expected array identifier')
    }

    function formatValue(expr: Expr): string {
      if (expr.type === 'index' && expr.array.type === 'identifier') {
        const arrName = resolveArrayName(expr.array.name)
        const idx = evalExpr(expr.index).num
        const arr = arrays.get(arrName)
        const val = arr ? arr[idx].num : '?'
        return `${arrName}[${idx}]=${val}`
      }
      return String(evalExpr(expr).num)
    }

    function addComparisonHighlights(condition: Expr): void {
      if (condition.type !== 'binary') return
      if (condition.op === 'and' || condition.op === 'or') {
        addComparisonHighlights(condition.left)
        try { addComparisonHighlights(condition.right) } catch { /* skip if eval fails */ }
        return
      }
      if (!['<', '>', '<=', '>=', '==', '!='].includes(condition.op)) return
      highlightComparisonSide(condition.left)
      highlightComparisonSide(condition.right)
    }

    function highlightComparisonSide(expr: Expr): void {
      try {
        if (expr.type === 'index' && expr.array.type === 'identifier') {
          addArrayHighlight(resolveArrayName(expr.array.name), [evalExpr(expr.index).num], 'compare')
        } else if (expr.type === 'identifier' && hasVar(expr.name)) {
          // Add as VarHighlight — renderer decides if it's a pointer arrow or variable cell
          currentVarHighlights.push({ varName: expr.name, type: 'compare' })
        }
      } catch { /* skip */ }
    }

    function snapshotCallIfProcedure(expr: Expr, line: number): void {
      if (expr.type === 'call' && procedures.has(expr.callee)) {
        const proc = procedures.get(expr.callee)!
        const argDisplayParts: string[] = []
        for (let i = 0; i < expr.args.length; i++) {
          const param = proc.params[i]
          if (param?.paramType === 'int[]') {
            const arg = expr.args[i]
            argDisplayParts.push(arg.type === 'identifier' ? resolveArrayName(arg.name) : '?')
          } else {
            argDisplayParts.push(String(evalExpr(expr.args[i]).num))
          }
        }
        snapshot(line, `Call ${expr.callee}(${argDisplayParts.join(', ')})`)
      }
    }

    function execNode(node: ASTNode): void {
      switch (node.type) {
        case 'for': execFor(node); break
        case 'while': execWhile(node); break
        case 'if': execIf(node); break
        case 'let': execLet(node); break
        case 'assign': execAssign(node); break
        case 'swap': execSwap(node); break
        case 'dim': execDim(node); break
        case 'undim': execUndim(node); break
        case 'gauge': execGauge(node); break
        case 'ungauge': execUngauge(node); break
        case 'pointer': execPointer(node); break
        case 'stepover': break
        case 'comment': execComment(node); break
        case 'alloc': execAlloc(node); break
        case 'def': execDef(node); break
        case 'return': execReturn(node); break
        case 'exprStmt':
          snapshotCallIfProcedure(node.expr, node.line)
          if (!(node.expr.type === 'call' && procedures.has(node.expr.callee))) {
            evalExpr(node.expr)
            snapshot(node.line, '')
          } else {
            evalCall(node.expr.callee, node.expr.args)
          }
          break
      }
    }

    function execFor(node: ForNode): void {
      const fromVal = evalExpr(node.from).num
      const toVal = evalExpr(node.to).num
      if (toVal - fromVal > 10000) throw new Error(`For loop range too large (${fromVal} to ${toVal}). Check your loop bounds.`)
      pushScope()

      // Pre-scan body for iterator associations and expression pointers
      const associations = prescanIteratorAssociations(node.body)
      associationStack.push(associations)
      prescanExpressionPointers(node.body)

      for (let i = fromVal; i <= toVal; i++) {
        const val = applyAssociations(plainVal(i), node.variable)
        setVar(node.variable, val)
        highlightComparisonSide({ type: 'identifier', name: node.variable })
        highlightComparisonSide(node.to)
        snapshot(node.line, `Set ${node.variable} = ${i}`)
        for (const stmt of node.body) execNode(stmt)
        flushPendingComment(node.line)
      }
      associationStack.pop()
      popScope()
    }

    function execWhile(node: WhileNode): void {
      let guard = 0
      pushScope()
      const whileAssoc = prescanIteratorAssociations(node.body)
      associationStack.push(whileAssoc)
      prescanExpressionPointers(node.body)
      while (evalExpr(node.condition).num !== 0) {
        addComparisonHighlights(node.condition)
        snapshot(node.line, 'While condition is true')
        for (const stmt of node.body) execNode(stmt)
        flushPendingComment(node.line)
        if (++guard > 10000) throw new Error('Infinite loop detected (10000 iterations). Check your while loop condition.')
      }
      addComparisonHighlights(node.condition)
      snapshot(node.line, 'While condition is false')
      associationStack.pop()
      popScope()
    }

    function execIf(node: IfNode): void {
      let desc = 'Check condition'
      addComparisonHighlights(node.condition)
      if (node.condition.type === 'binary' && ['<', '>', '<=', '>=', '==', '!='].includes(node.condition.op)) {
        const leftStr = formatValue(node.condition.left)
        const rightStr = formatValue(node.condition.right)
        desc = `Compare ${leftStr} ${node.condition.op} ${rightStr}`
      }

      const cond = evalExpr(node.condition).num
      snapshot(node.line, desc)

      if (cond !== 0) {
        pushScope()
        for (const stmt of node.body) execNode(stmt)
        flushPendingComment(node.line)
        popScope()
      } else if (node.elseBody.length > 0) {
        pushScope()
        for (const stmt of node.elseBody) execNode(stmt)
        flushPendingComment(node.line)
        popScope()
      }
    }

    function execLet(node: LetNode): void {
      snapshotCallIfProcedure(node.value, node.line)
      const rawVal = evalExpr(node.value)
      const val = applyAssociations(rawVal, node.name)
      setVar(node.name, val)
      if (val.arrays.length === 0) {
        currentVarHighlights.push({ varName: node.name, type: 'active' })
      }
      if (node.value.type === 'index' && node.value.array.type === 'identifier') {
        addArrayHighlight(node.value.array.name, [evalExpr(node.value.index).num], 'active')
      }
      snapshot(node.line, `Set ${node.name} = ${val.num}`)
    }

    function execAssign(node: AssignNode): void {
      snapshotCallIfProcedure(node.value, node.line)
      const val = evalExpr(node.value)
      if (node.target.type === 'identifier') {
        updateVar(node.target.name, val)
        if (val.arrays.length === 0) {
          currentVarHighlights.push({ varName: node.target.name, type: 'active' })
        }
        snapshot(node.line, `Set ${node.target.name} = ${val.num}`)
      } else if (node.target.type === 'index') {
        const arr = getArray(node.target.array)
        const idx = evalExpr(node.target.index).num

        // Direct variable tagging for assignment target: arr[var]
        if (node.target.index.type === 'identifier' && node.target.array.type === 'identifier') {
          tagVar(node.target.index.name, resolveArrayName(node.target.array.name))
        }

        // Retroactive cell tagging for assignment target: targetArr[sourceArr[x]]
        if (node.target.array.type === 'identifier') {
          retroactivelyTagCells(node.target.index, resolveArrayName(node.target.array.name))
        }

        arr[idx] = val
        const arrayName = getArrayName(node.target.array)
        setArrayHighlight(arrayName, [idx], 'active')
        if (node.value.type === 'identifier') {
          const srcVal = getVar(node.value.name)
          if (srcVal && srcVal.arrays.length === 0) {
            currentVarHighlights.push({ varName: node.value.name, type: 'active' })
          }
        }
        snapshot(node.line, `Set ${arrayName}[${idx}] = ${val.num}`)
      }
    }

    function execDim(node: DimNode): void {
      const from = evalExpr(node.from).num
      const to = evalExpr(node.to).num
      dimRanges.push({ arrayName: resolveArrayName(node.arrayName), from, to })
    }

    function execUndim(node: UndimNode): void {
      const from = evalExpr(node.from).num
      const to = evalExpr(node.to).num
      const name = resolveArrayName(node.arrayName)
      dimRanges = dimRanges.filter(d => !(d.arrayName === name && d.from === from && d.to === to))
    }


    function execGauge(node: { arrayName: string }): void {
      gaugeArrays.add(resolveArrayName(node.arrayName))
    }

    function execUngauge(node: { arrayName: string }): void {
      gaugeArrays.delete(resolveArrayName(node.arrayName))
    }

    function execPointer(node: PointerNode): void {
      // Register explicit expression pointer from #: pointer directive
      registerExprPointer(node.label, node.arrayName, node.at, true)
    }

    function execComment(node: CommentNode): void {
      pendingCommentParts = node.parts ?? [{ type: 'text', text: node.text }]
    }

    function flushPendingComment(line: number): void {
      if (pendingCommentParts !== null) {
        snapshot(line, '')
      }
    }

    function execAlloc(node: AllocNode): void {
      const size = evalExpr(node.size).num
      arrays.set(node.arrayName, new Array(size).fill(null).map(() => plainVal(0)))
      if (callFrameStack.length > 0) {
        callFrameStack[callFrameStack.length - 1].allocatedArrays.add(node.arrayName)
      }
    }

    function execDef(node: DefNode): void {
      procedures.set(node.name, { params: node.params, body: node.body })
    }

    function execReturn(node: ReturnNode): void {
      const val = evalExpr(node.value)
      snapshot(node.line, `Return ${val.num}`)
      throw new ReturnSignal(val)
    }

    function execSwap(node: SwapNode): void {
      if (node.left.type !== 'index' || node.right.type !== 'index') {
        throw new Error('swap requires array index expressions')
      }
      const leftIdx = node.left
      const rightIdx = node.right
      const arr = getArray(leftIdx.array)
      const i = evalExpr(leftIdx.index).num
      const j = evalExpr(rightIdx.index).num
      const arrayName = getArrayName(leftIdx.array)

      setArrayHighlight(arrayName, [i, j], 'swap')
      const desc = `Swap ${arrayName}[${i}]=${arr[i].num} and ${arrayName}[${j}]=${arr[j].num}`

      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp

      snapshot(node.line, desc)
    }

    // Execute
    const algoAssociations = prescanIteratorAssociations(algo.body)
    associationStack.push(algoAssociations)
    prescanExpressionPointers(algo.body)

    snapshot(algo.line, `Start ${algo.name}`)
    for (const stmt of algo.body) execNode(stmt)
    flushPendingComment(algo.body[algo.body.length - 1].line)
    snapshot(algo.body[algo.body.length - 1].line, 'Done')

    return steps
  }
}

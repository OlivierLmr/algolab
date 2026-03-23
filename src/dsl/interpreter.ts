import type {
  ASTNode, AlgoNode, ForNode, WhileNode, IfNode, LetNode, AssignNode, SwapNode, DimNode, UndimNode, CommentNode, TooltipNode, AllocNode, DefNode, ReturnNode, PointerNode,
  Expr, CommentPart,
} from './ast.ts'
import type { Value } from './value.ts'
import { plainVal, mergeArrays, propagateArithmetic } from './value.ts'
import type { TypeContext } from './typeinfer.ts'

const MAX_CALL_DEPTH = 1000
const MAX_LOOP_ITERATIONS = 10000
const MAX_LOOP_RANGE = 10000

/** Sentinel thrown by `return` statements to unwind execution. */
class ReturnSignal {
  value: Value
  constructor(value: Value) { this.value = value }
}
import type { Step, TrackedArray, Highlight, VarHighlight, DimRange, CallFrame } from '../types.ts'

/**
 * Create a runner for the given algorithm AST.
 * colorMap is computed once in the pipeline and shared.
 * typeContext provides statically inferred iterator types.
 */
export function createRunner(algo: AlgoNode, _colorMap: Map<string, string>, typeContext: TypeContext): (input: Map<string, number[]>) => Step[] {

  return function run(input: Map<string, number[]>): Step[] {
    const steps: Step[] = []
    const arrays = new Map<string, Value[]>()
    const scopeStack: Map<string, Value>[] = [new Map()]
    const procedures = new Map<string, { params: { name: string; isArray: boolean }[]; body: ASTNode[]; defLine: number; describe?: { text: string; parts?: CommentPart[] } }>()
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

    // --- Live expression variables (scoped pointer registrations) ---
    // Parallel to scopeStack: each scope level has its own list of registered expr vars.
    // When a scope is popped, its registrations vanish — natural scoping.
    interface ExprVarReg {
      label: string
      arrayName: string  // syntactic name (resolved at eval time)
      expr: Expr
    }
    const liveExprVars: ExprVarReg[][] = [[]]  // parallel to scopeStack

    // --- Block descriptions (sticky per-block comments) ---
    // Each entry has the evaluated text and the scope depth at which it was registered.
    // On scope pop, entries at deeper scope depths are removed.
    const blockDescs: { text: string; scopeDepth: number }[] = []

    // --- Tooltips (hover descriptions for variables/arrays) ---
    // Each scope level maps variable names to their tooltip template strings.
    // Parallel to scopeStack: tooltipStack[i] contains tooltips registered at scope level i.
    const tooltipStack: Map<string, string>[] = [new Map()]

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

    // --- Static type lookup helpers ---

    /** Look up the static type for a variable by name and declaration line. */
    function staticVarType(name: string, line: number): string[] {
      return typeContext.varTypes.get(`${name}@${line}`) ?? []
    }

    /** Look up the static element type for an array. */
    function staticElemType(arrName: string): string[] {
      return typeContext.arrayElementTypes.get(arrName) ?? []
    }

    /** Stamp a value with static type arrays (resolved through aliases). */
    function stampValue(num: number, staticArrays: string[]): Value {
      if (staticArrays.length === 0) return plainVal(num)
      const resolved = staticArrays.map(n => resolveArrayName(n))
      return { num, arrays: resolved }
    }

    /** Stamp a cell value with the element type of an array. */
    function stampCell(num: number, arrName: string): Value {
      const elemType = staticElemType(arrName)
      if (elemType.length === 0) return plainVal(num)
      const resolved = elemType.map(n => resolveArrayName(n))
      return { num, arrays: resolved }
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
      const elemType = staticElemType(name)
      arrays.set(name, values.map(v =>
        elemType.length > 0 ? { num: v, arrays: [...elemType] } : plainVal(v)
      ))
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
      liveExprVars.push([])
      tooltipStack.push(new Map())
    }

    function popScope(): void {
      scopeStack.pop()
      liveExprVars.pop()
      tooltipStack.pop()
      // Remove block descriptions registered at the popped scope depth or deeper
      while (blockDescs.length > 0 && blockDescs[blockDescs.length - 1].scopeDepth > scopeStack.length) {
        blockDescs.pop()
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

    /**
     * Evaluate all live expression variables in a scope range and inject
     * them into a variables record. Each registration produces a Value
     * with arrays: [resolvedArrayName].
     */
    function evaluateExprVars(scopeFrom: number, scopeTo: number): Record<string, Value> {
      const result: Record<string, Value> = {}
      for (let si = scopeFrom; si < scopeTo; si++) {
        if (si >= liveExprVars.length) break
        for (const reg of liveExprVars[si]) {
          const resolvedArr = resolveArrayName(reg.arrayName)
          if (!arrays.has(resolvedArr)) continue
          try {
            const val = evalExpr(reg.expr)
            const existing = result[reg.label]
            if (existing) {
              result[reg.label] = { num: val.num, arrays: mergeArrays(existing.arrays, [resolvedArr]) }
            } else {
              result[reg.label] = { num: val.num, arrays: [resolvedArr] }
            }
          } catch { /* skip — variables may not be available yet */ }
        }
      }
      return result
    }

    function snapshot(line: number, description: string): void {
      if (pendingCommentParts !== null) {
        description = evaluateCommentParts(pendingCommentParts)
        pendingCommentParts = null
      }

      const allDimRanges: DimRange[] = [...dimRanges]

      // Build call stack frames
      const frameArrayNames = new Set<string>()
      const frameVarNames = new Set<string>()
      const callStackFrames: CallFrame[] = []

      if (callFrameStack.length > 0) {
        for (let fi = 0; fi < callFrameStack.length; fi++) {
          const af = callFrameStack[fi]
          const label = `${af.name}(${af.argStrings.join(', ')})`

          // Build arrayRefs from aliases
          const arrayRefs = [...af.arrayAliases.entries()].map(
            ([paramName, targetName]) => ({ paramName, targetName })
          )

          // Frame's scope range
          const scopeFrom = af.scopeBase
          const scopeTo = fi + 1 < callFrameStack.length
            ? callFrameStack[fi + 1].scopeBase
            : scopeStack.length

          // Frame's variables: regular vars + evaluated expression vars
          const frameVars: Record<string, Value> = {}
          for (let si = scopeFrom; si < scopeTo; si++) {
            for (const [k, v] of scopeStack[si]) {
              frameVars[k] = v
              frameVarNames.add(k)
            }
          }
          // Inject scoped expression variables
          const exprVars = evaluateExprVars(scopeFrom, scopeTo)
          for (const [k, v] of Object.entries(exprVars)) {
            frameVars[k] = v
            frameVarNames.add(k)
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

          callStackFrames.push({
            label,
            variables: frameVars,
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

      // Global variables: from algo-level scopes only + their expression vars
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
      // Inject global-scope expression variables
      const globalExprVars = evaluateExprVars(0, globalScopeTo)
      for (const [k, v] of Object.entries(globalExprVars)) {
        if (!frameVarNames.has(k)) {
          globalVars[k] = v
        }
      }

      const globalHighlights = currentHighlights.filter(h => !frameArrayNames.has(h.arrayName))
      const globalVarHighlights = currentVarHighlights.filter(h => !frameVarNames.has(h.varName))
      const globalDimRanges = allDimRanges.filter(d => !frameArrayNames.has(d.arrayName))
      const globalGaugeArrays = [...gaugeArrays].filter(n => !frameArrayNames.has(n))

      steps.push({
        arrays: globalArrays,
        highlights: globalHighlights,
        varHighlights: globalVarHighlights,
        dimRanges: globalDimRanges,
        gaugeArrays: globalGaugeArrays,
        variables: globalVars,
        callStack: callStackFrames,
        currentLine: line,
        description,
        blockDescriptions: blockDescs.map((bd, i) => ({
          text: bd.text,
          depth: i,
        })),
        tooltips: collectTooltips(),
        scopeDepth: scopeStack.length,
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
        if (++callDepth > MAX_CALL_DEPTH) throw new Error(`Max recursion depth exceeded (${MAX_CALL_DEPTH} nested calls). Check for infinite recursion in your algorithm.`)

        // Phase 1: evaluate args — array params get aliases, scalar params get values
        const aliasMap = new Map<string, string>()
        const scalarBindings: { name: string; value: Value; defLine: number }[] = []
        const argStrings: string[] = []

        for (let i = 0; i < proc.params.length; i++) {
          const param = proc.params[i]
          if (param.isArray) {
            // Array reference param: extract identifier name and resolve
            const arg = args[i]
            if (arg.type !== 'identifier') throw new Error(`Expected array identifier for param ${param.name}`)
            const resolved = resolveArrayName(arg.name)
            aliasMap.set(param.name, resolved)
            argStrings.push(resolved)
          } else {
            // Scalar param — stamp with static type
            const rawVal = evalExpr(args[i])
            const paramType = staticVarType(param.name, proc.defLine)
            const val = stampValue(rawVal.num, paramType)
            scalarBindings.push({ name: param.name, value: val, defLine: proc.defLine })
            argStrings.push(String(rawVal.num))
          }
        }

        // Phase 2: push frame, alias stack, scope, bind scalars
        const frame: ActiveFrame = { name, argStrings, allocatedArrays: new Set(), arrayAliases: aliasMap, scopeBase: 0 }
        callFrameStack.push(frame)
        arrayAliasStack.push(aliasMap)
        pushScope()
        frame.scopeBase = scopeStack.length - 1

        for (const binding of scalarBindings) {
          setVar(binding.name, binding.value)
        }

        // Apply describe annotation if present on the def
        if (proc.describe) applyDescribe(proc.describe)

        // Save caller's dim ranges and gauge arrays
        const savedDimRanges = [...dimRanges]
        const savedGaugeArrays = new Set(gaugeArrays)

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
          if (param?.isArray) {
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
        case 'tooltip': execTooltip(node); break
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

    function execPointer(node: PointerNode): void {
      // Register this expression variable for re-evaluation at each snapshot.
      // It lives in the current scope level and vanishes when the scope is popped.
      liveExprVars[liveExprVars.length - 1].push({
        label: node.label,
        arrayName: node.arrayName,
        expr: node.at,
      })
    }

    function execFor(node: ForNode): void {
      const fromVal = evalExpr(node.from).num
      const toVal = evalExpr(node.to).num
      if (toVal - fromVal > MAX_LOOP_RANGE) throw new Error(`For loop range too large (${fromVal} to ${toVal}). Check your loop bounds.`)
      pushScope()

      // Static type for the loop variable
      const loopVarType = staticVarType(node.variable, node.line)

      for (let i = fromVal; i <= toVal; i++) {
        const val = stampValue(i, loopVarType)
        setVar(node.variable, val)
        if (node.describe) applyDescribe(node.describe)
        highlightComparisonSide({ type: 'identifier', name: node.variable })
        highlightComparisonSide(node.to)
        snapshot(node.line, `Set ${node.variable} = ${i}`)
        for (const stmt of node.body) execNode(stmt)
        flushPendingComment(node.line)
      }
      popScope()
    }

    function execWhile(node: WhileNode): void {
      let guard = 0
      pushScope()
      while (evalExpr(node.condition).num !== 0) {
        if (node.describe) applyDescribe(node.describe)
        addComparisonHighlights(node.condition)
        snapshot(node.line, 'While condition is true')
        for (const stmt of node.body) execNode(stmt)
        flushPendingComment(node.line)
        if (++guard > MAX_LOOP_ITERATIONS) throw new Error(`Infinite loop detected (${MAX_LOOP_ITERATIONS} iterations). Check your while loop condition.`)
      }
      addComparisonHighlights(node.condition)
      snapshot(node.line, 'While condition is false')
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
        if (node.describe) applyDescribe(node.describe)
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
      // Stamp with static type
      const letType = staticVarType(node.name, node.line)
      const val = stampValue(rawVal.num, letType)
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
        // For variable updates, preserve the existing type (from initial declaration)
        const existing = getVar(node.target.name)
        const updatedVal = existing && existing.arrays.length > 0
          ? { num: val.num, arrays: existing.arrays }
          : val
        updateVar(node.target.name, updatedVal)
        if (updatedVal.arrays.length === 0) {
          currentVarHighlights.push({ varName: node.target.name, type: 'active' })
        }
        snapshot(node.line, `Set ${node.target.name} = ${val.num}`)
      } else if (node.target.type === 'index') {
        const arr = getArray(node.target.array)
        const idx = evalExpr(node.target.index).num

        // Stamp stored cell value with static element type
        const arrayName = getArrayName(node.target.array)
        arr[idx] = stampCell(val.num, arrayName)

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

    function execComment(node: CommentNode): void {
      pendingCommentParts = node.parts ?? [{ type: 'text', text: node.text }]
    }

    /** Evaluate a describe annotation and push/upsert it in blockDescs. */
    function applyDescribe(describe: { text: string; parts?: CommentPart[] }): void {
      const parts = describe.parts ?? [{ type: 'text', text: describe.text }]
      const text = evaluateCommentParts(parts)
      const depth = scopeStack.length
      // Upsert: replace existing entry at same depth, or push new
      const existing = blockDescs.findIndex(bd => bd.scopeDepth === depth)
      if (existing !== -1) {
        blockDescs[existing] = { text, scopeDepth: depth }
      } else {
        blockDescs.push({ text, scopeDepth: depth })
      }
    }

    function execTooltip(node: TooltipNode): void {
      // Register tooltip template for the target variable in the current scope
      tooltipStack[tooltipStack.length - 1].set(node.target, node.text)
    }

    /** Collect all active tooltips from the tooltip stack (inner scopes shadow outer). */
    function collectTooltips(): Record<string, string> {
      const result: Record<string, string> = {}
      for (const scope of tooltipStack) {
        for (const [name, text] of scope) {
          result[name] = text
        }
      }
      return result
    }

    function flushPendingComment(line: number): void {
      if (pendingCommentParts !== null) {
        snapshot(line, '')
      }
    }

    function execAlloc(node: AllocNode): void {
      const size = evalExpr(node.size).num
      // Stamp allocated cells with static element type
      const elemType = staticElemType(node.arrayName)
      arrays.set(node.arrayName, new Array(size).fill(null).map(() =>
        elemType.length > 0 ? { num: 0, arrays: [...elemType] } : plainVal(0)
      ))
      if (callFrameStack.length > 0) {
        callFrameStack[callFrameStack.length - 1].allocatedArrays.add(node.arrayName)
      }
    }

    function execDef(node: DefNode): void {
      procedures.set(node.name, { params: node.params, body: node.body, defLine: node.line, describe: node.describe })
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

      // Re-stamp swapped cells with element type
      const elemType = staticElemType(arrayName)
      if (elemType.length > 0) {
        arr[i] = { num: arr[i].num, arrays: [...elemType] }
        arr[j] = { num: arr[j].num, arrays: [...elemType] }
      }

      snapshot(node.line, desc)
    }

    // Execute
    snapshot(algo.line, `Start ${algo.name}`)
    for (const stmt of algo.body) execNode(stmt)
    flushPendingComment(algo.body[algo.body.length - 1].line)
    snapshot(algo.body[algo.body.length - 1].line, 'Done')

    return steps
  }
}

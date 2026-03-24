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
import type { Step, TrackedArray, Highlight, VarHighlight, DimRange, CallFrame, DescriptionSegment } from '../types.ts'

interface StoredProcedure {
  params: { name: string; isArray: boolean }[]
  body: ASTNode[]
  defLine: number
  describe?: { text: string; parts?: CommentPart[] }
}

/** Convert evaluated segments back to plain text (for the Step.description string). */
function segmentsToText(segments: DescriptionSegment[]): string {
  return segments.map(seg => {
    if (seg.type === 'text') return seg.text
    switch (seg.display) {
      case 'name': return seg.name
      case 'value': return String(seg.value)
      default: return `${seg.name}=${seg.value}`
    }
  }).join('')
}

interface ActiveFrame {
  name: string
  argStrings: string[]
  allocatedArrays: Set<string>
  arrayAliases: Map<string, string>
  scopeBase: number
}

interface ExprVarReg {
  label: string
  arrayName: string  // syntactic name (resolved at eval time)
  expr: Expr
}

type HighlightType = 'compare' | 'swap' | 'sorted' | 'active'

class ExecutionContext {
  private readonly steps: Step[] = []
  private readonly arrays = new Map<string, Value[]>()
  private readonly scopeStack: Map<string, Value>[] = [new Map()]
  private readonly procedures = new Map<string, StoredProcedure>()
  private callDepth = 0
  private readonly callFrameStack: ActiveFrame[] = []
  private readonly arrayAliasStack: Map<string, string>[] = []
  private readonly liveExprVars: ExprVarReg[][] = [[]]
  private readonly blockDescs: { text: string; parts: DescriptionSegment[]; scopeDepth: number; line: number }[] = []
  private readonly tooltipStack: Map<string, string>[] = [new Map()]
  private currentHighlights: Highlight[] = []
  private currentVarHighlights: VarHighlight[] = []
  private dimRanges: DimRange[] = []
  private gaugeArrays = new Set<string>()
  private pendingCommentParts: CommentPart[] | null = null
  private readonly algo: AlgoNode
  private readonly colorMap: Map<string, string>
  private readonly typeContext: TypeContext

  constructor(
    algo: AlgoNode,
    colorMap: Map<string, string>,
    typeContext: TypeContext,
    input: Map<string, number[]>,
  ) {
    this.algo = algo
    this.colorMap = colorMap
    this.typeContext = typeContext
    for (const [name, values] of input) {
      const elemType = this.staticElemType(name)
      this.arrays.set(name, values.map(v =>
        elemType.length > 0 ? { num: v, arrays: [...elemType] } : plainVal(v)
      ))
    }
  }

  /** Run the algorithm and return steps. */
  execute(): Step[] {
    this.snapshot(this.algo.line, `Start ${this.algo.name}`)
    for (const stmt of this.algo.body) this.execNode(stmt)
    this.flushPendingComment(this.algo.body[this.algo.body.length - 1].line)
    this.snapshot(this.algo.body[this.algo.body.length - 1].line, 'Done')
    return this.steps
  }

  private resolveArrayName(name: string): string {
    const seen = new Set<string>()
    let current = name
    for (;;) {
      let found = false
      for (let i = this.arrayAliasStack.length - 1; i >= 0; i--) {
        if (this.arrayAliasStack[i].has(current)) {
          current = this.arrayAliasStack[i].get(current)!
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
  private staticVarType(name: string, line: number): string[] {
    return this.typeContext.varTypes.get(`${name}@${line}`) ?? []
  }

  /** Look up the static element type for an array. */
  private staticElemType(arrName: string): string[] {
    return this.typeContext.arrayElementTypes.get(arrName) ?? []
  }

  /** Stamp a value with static type arrays (resolved through aliases). */
  private stampValue(num: number, staticArrays: string[]): Value {
    if (staticArrays.length === 0) return plainVal(num)
    const resolved = staticArrays.map(n => this.resolveArrayName(n))
    return { num, arrays: resolved }
  }

  /** Stamp a cell value with the element type of an array. */
  private stampCell(num: number, arrName: string): Value {
    const elemType = this.staticElemType(arrName)
    if (elemType.length === 0) return plainVal(num)
    const resolved = elemType.map(n => this.resolveArrayName(n))
    return { num, arrays: resolved }
  }

  private clearHighlights(): void {
    this.currentHighlights = []
    this.currentVarHighlights = []
  }

  /** Add array cell highlights, merging indices into existing highlight of same type. */
  private addArrayHighlight(arrayName: string, indices: number[], type: HighlightType): void {
    const existing = this.currentHighlights.find(h => h.arrayName === arrayName && h.type === type)
    if (existing) {
      for (const idx of indices) {
        if (!existing.indices.includes(idx)) existing.indices.push(idx)
      }
    } else {
      this.currentHighlights.push({ arrayName, indices: [...indices], type })
    }
  }

  /** Replace all array highlights with a single one (for primary actions like swap/assign). */
  private setArrayHighlight(arrayName: string, indices: number[], type: HighlightType): void {
    this.currentHighlights = [{ arrayName, indices, type }]
  }

  private getVar(name: string): Value | undefined {
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      if (this.scopeStack[i].has(name)) return this.scopeStack[i].get(name)
    }
    return undefined
  }

  private setVar(name: string, value: Value): void {
    this.scopeStack[this.scopeStack.length - 1].set(name, value)
  }

  private updateVar(name: string, value: Value): void {
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      if (this.scopeStack[i].has(name)) {
        this.scopeStack[i].set(name, value)
        return
      }
    }
    this.scopeStack[this.scopeStack.length - 1].set(name, value)
  }

  private hasVar(name: string): boolean {
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      if (this.scopeStack[i].has(name)) return true
    }
    return false
  }

  private pushScope(): void {
    this.scopeStack.push(new Map())
    this.liveExprVars.push([])
    this.tooltipStack.push(new Map())
  }

  private popScope(): void {
    this.scopeStack.pop()
    this.liveExprVars.pop()
    this.tooltipStack.pop()
    // Remove block descriptions registered at the popped scope depth or deeper
    while (this.blockDescs.length > 0 && this.blockDescs[this.blockDescs.length - 1].scopeDepth > this.scopeStack.length) {
      this.blockDescs.pop()
    }
  }

  /**
   * Evaluate comment parts into description segments.
   * This is the single evaluation function — text is derived via segmentsToText().
   */
  private evaluateCommentSegments(parts: CommentPart[]): DescriptionSegment[] {
    return parts.map(part => {
      switch (part.type) {
        case 'text': return { type: 'text' as const, text: part.text }
        case 'expr':
          try { return { type: 'text' as const, text: String(this.evalExpr(part.expr).num) } }
          catch { return { type: 'text' as const, text: '{?}' } }
        case 'ternary':
          try {
            const val = this.evalExpr(part.condition)
            return { type: 'text' as const, text: val.num !== 0 ? part.trueText : part.falseText }
          }
          catch { return { type: 'text' as const, text: '{?}' } }
        case 'pill':
          try {
            const val = this.evalExpr(part.expr)
            return { type: 'pill' as const, name: part.name, value: val.num, color: this.colorMap.get(part.name), display: part.display }
          }
          catch { return { type: 'text' as const, text: `${part.name}=?` } }
      }
    })
  }

  /**
   * Evaluate all live expression variables in a scope range and inject
   * them into a variables record. Each registration produces a Value
   * with arrays: [resolvedArrayName].
   */
  private evaluateExprVars(scopeFrom: number, scopeTo: number): Record<string, Value> {
    const result: Record<string, Value> = {}
    for (let si = scopeFrom; si < scopeTo; si++) {
      if (si >= this.liveExprVars.length) break
      for (const reg of this.liveExprVars[si]) {
        const resolvedArr = this.resolveArrayName(reg.arrayName)
        if (!this.arrays.has(resolvedArr)) continue
        try {
          const val = this.evalExpr(reg.expr)
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

  /** Build a CallFrame for a single active frame. */
  private buildFrame(fi: number): { frame: CallFrame; ownedArrays: Set<string>; ownedVars: Set<string> } {
    const af = this.callFrameStack[fi]
    const label = `${af.name}(${af.argStrings.join(', ')})`
    const arrayRefs = [...af.arrayAliases.entries()].map(
      ([paramName, targetName]) => ({ paramName, targetName })
    )

    // Frame's scope range
    const scopeFrom = af.scopeBase
    const scopeTo = fi + 1 < this.callFrameStack.length
      ? this.callFrameStack[fi + 1].scopeBase
      : this.scopeStack.length

    // Frame's variables: regular vars + evaluated expression vars
    const ownedVars = new Set<string>()
    const frameVars: Record<string, Value> = {}
    for (let si = scopeFrom; si < scopeTo; si++) {
      for (const [k, v] of this.scopeStack[si]) {
        frameVars[k] = v
        ownedVars.add(k)
      }
    }
    const exprVars = this.evaluateExprVars(scopeFrom, scopeTo)
    for (const [k, v] of Object.entries(exprVars)) {
      frameVars[k] = v
      ownedVars.add(k)
    }

    // Frame's arrays
    const ownedArrays = new Set<string>()
    const frameArrays: TrackedArray[] = []
    for (const arrName of af.allocatedArrays) {
      const arr = this.arrays.get(arrName)
      if (arr) {
        frameArrays.push({ name: arrName, values: arr.map(v => ({ ...v })) })
        ownedArrays.add(arrName)
      }
    }

    // Filter highlights/dims/gauges for this frame
    const isInnermost = fi === this.callFrameStack.length - 1
    const frame: CallFrame = {
      label,
      variables: frameVars,
      arrayRefs,
      arrays: frameArrays,
      highlights: this.currentHighlights.filter(h => af.allocatedArrays.has(h.arrayName)),
      varHighlights: isInnermost ? this.currentVarHighlights.filter(h => h.varName in frameVars) : [],
      dimRanges: this.dimRanges.filter(d => af.allocatedArrays.has(d.arrayName)),
      gaugeArrays: [...this.gaugeArrays].filter(n => af.allocatedArrays.has(n)),
    }
    return { frame, ownedArrays, ownedVars }
  }

  /** Collect global (non-frame-owned) arrays, variables, highlights, dims, gauges. */
  private buildGlobalState(frameArrayNames: Set<string>, frameVarNames: Set<string>) {
    const globalArrays: TrackedArray[] = []
    for (const [name, values] of this.arrays) {
      if (!frameArrayNames.has(name)) {
        globalArrays.push({ name, values: values.map(v => ({ ...v })) })
      }
    }

    const globalVars: Record<string, Value> = {}
    const globalScopeTo = this.callFrameStack.length > 0 ? this.callFrameStack[0].scopeBase : this.scopeStack.length
    for (let si = 0; si < globalScopeTo; si++) {
      for (const [k, v] of this.scopeStack[si]) {
        if (!frameVarNames.has(k)) globalVars[k] = v
      }
    }
    const globalExprVars = this.evaluateExprVars(0, globalScopeTo)
    for (const [k, v] of Object.entries(globalExprVars)) {
      if (!frameVarNames.has(k)) globalVars[k] = v
    }

    return {
      arrays: globalArrays,
      variables: globalVars,
      highlights: this.currentHighlights.filter(h => !frameArrayNames.has(h.arrayName)),
      varHighlights: this.currentVarHighlights.filter(h => !frameVarNames.has(h.varName)),
      dimRanges: this.dimRanges.filter(d => !frameArrayNames.has(d.arrayName)),
      gaugeArrays: [...this.gaugeArrays].filter(n => !frameArrayNames.has(n)),
    }
  }

  private snapshot(line: number, description: string, commentParts?: CommentPart[]): void {
    // Use explicit commentParts if provided, otherwise consume pending
    const parts = commentParts ?? this.pendingCommentParts
    let isComment = false
    let descriptionParts: DescriptionSegment[] = [{ type: 'text', text: description }]
    if (parts !== null) {
      descriptionParts = this.evaluateCommentSegments(parts)
      description = segmentsToText(descriptionParts)
      if (!commentParts) this.pendingCommentParts = null  // only clear pending if we consumed it
      isComment = true
    }

    // Build call stack frames, tracking which arrays/vars are frame-owned
    const frameArrayNames = new Set<string>()
    const frameVarNames = new Set<string>()
    const callStackFrames: CallFrame[] = []
    for (let fi = 0; fi < this.callFrameStack.length; fi++) {
      const { frame, ownedArrays, ownedVars } = this.buildFrame(fi)
      callStackFrames.push(frame)
      for (const n of ownedArrays) frameArrayNames.add(n)
      for (const n of ownedVars) frameVarNames.add(n)
    }

    const global = this.buildGlobalState(frameArrayNames, frameVarNames)

    this.steps.push({
      ...global,
      callStack: callStackFrames,
      currentLine: line,
      description,
      descriptionParts,
      isComment,
      blockDescriptions: this.blockDescs.map((bd, i) => ({
        text: bd.text,
        parts: bd.parts,
        depth: i,
        line: bd.line,
      })),
      tooltips: this.collectTooltips(),
      scopeDepth: this.scopeStack.length,
    })
    this.clearHighlights()
  }

  private evalExpr(expr: Expr): Value {
    switch (expr.type) {
      case 'number': return plainVal(expr.value)
      case 'identifier': {
        const val = this.getVar(expr.name)
        if (val === undefined) throw new Error(`Undefined variable: ${expr.name}`)
        return val
      }
      case 'binary': {
        // Short-circuit for and/or
        if (expr.op === 'and') {
          const left = this.evalExpr(expr.left)
          return left.num === 0 ? plainVal(0) : (this.evalExpr(expr.right).num !== 0 ? plainVal(1) : plainVal(0))
        }
        if (expr.op === 'or') {
          const left = this.evalExpr(expr.left)
          return left.num !== 0 ? plainVal(1) : (this.evalExpr(expr.right).num !== 0 ? plainVal(1) : plainVal(0))
        }
        const left = this.evalExpr(expr.left)
        const right = this.evalExpr(expr.right)
        const numResult = this.evalBinary(expr.op, left.num, right.num)
        return propagateArithmetic(expr.op, left, right, numResult)
      }
      case 'unary':
        if (expr.op === '-') {
          const operand = this.evalExpr(expr.operand)
          return { num: -operand.num, arrays: operand.arrays }
        }
        if (expr.op === 'not') return this.evalExpr(expr.operand).num === 0 ? plainVal(1) : plainVal(0)
        throw new Error(`Unknown unary op: ${expr.op}`)
      case 'index': {
        const arr = this.getArray(expr.array)
        const idxVal = this.evalExpr(expr.index)
        const idx = idxVal.num
        if (idx < 0 || idx >= arr.length) {
          const name = expr.array.type === 'identifier' ? expr.array.name : 'array'
          throw new Error(`Index ${idx} out of bounds for ${name}[0..${arr.length - 1}]`)
        }
        return arr[idx]
      }
      case 'call': return this.evalCall(expr.callee, expr.args)
    }
  }

  private evalBinary(op: string, left: number, right: number): number {
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

  private evalCall(name: string, args: Expr[]): Value {
    if (name === 'len') {
      const arg = args[0]
      if (arg.type === 'identifier') {
        const resolved = this.resolveArrayName(arg.name)
        const arr = this.arrays.get(resolved)
        if (arr) return plainVal(arr.length)
      }
      throw new Error(`len() expects an array identifier`)
    }
    // User-defined procedure call
    const proc = this.procedures.get(name)
    if (proc) {
      if (++this.callDepth > MAX_CALL_DEPTH) throw new Error(`Max recursion depth exceeded (${MAX_CALL_DEPTH} nested calls). Check for infinite recursion in your algorithm.`)

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
          const resolved = this.resolveArrayName(arg.name)
          aliasMap.set(param.name, resolved)
          argStrings.push(resolved)
        } else {
          // Scalar param — stamp with static type
          const rawVal = this.evalExpr(args[i])
          const paramType = this.staticVarType(param.name, proc.defLine)
          const val = this.stampValue(rawVal.num, paramType)
          scalarBindings.push({ name: param.name, value: val, defLine: proc.defLine })
          argStrings.push(String(rawVal.num))
        }
      }

      // Phase 2: push frame, alias stack, scope, bind scalars
      const frame: ActiveFrame = { name, argStrings, allocatedArrays: new Set(), arrayAliases: aliasMap, scopeBase: 0 }
      this.callFrameStack.push(frame)
      this.arrayAliasStack.push(aliasMap)
      this.pushScope()
      frame.scopeBase = this.scopeStack.length - 1

      for (const binding of scalarBindings) {
        this.setVar(binding.name, binding.value)
      }

      // Apply describe annotation if present on the def
      if (proc.describe) this.applyDescribe(proc.describe, proc.defLine)

      // Save caller's dim ranges and gauge arrays
      const savedDimRanges = [...this.dimRanges]
      const savedGaugeArrays = new Set(this.gaugeArrays)

      // Execute body
      let returnValue: Value = plainVal(0)
      try {
        for (const stmt of proc.body) this.execNode(stmt)
        this.flushPendingComment(proc.body.length > 0 ? proc.body[proc.body.length - 1].line : 0)
      } catch (e) {
        if (e instanceof ReturnSignal) {
          returnValue = e.value
        } else {
          throw e
        }
      }

      // Restore caller's state
      this.dimRanges = savedDimRanges
      this.gaugeArrays = savedGaugeArrays

      // Cleanup: pop all scopes back to (and including) the function's base scope
      while (this.scopeStack.length > frame.scopeBase) this.popScope()
      this.arrayAliasStack.pop()
      for (const arrName of frame.allocatedArrays) {
        this.arrays.delete(arrName)
      }
      this.callFrameStack.pop()
      this.callDepth--
      return returnValue
    }
    throw new Error(`Unknown function: ${name}`)
  }

  private getArray(expr: Expr): Value[] {
    if (expr.type === 'identifier') {
      const resolved = this.resolveArrayName(expr.name)
      const arr = this.arrays.get(resolved)
      if (!arr) throw new Error(`Undefined array: ${expr.name}`)
      return arr
    }
    throw new Error('Expected array identifier')
  }

  private getArrayName(expr: Expr): string {
    if (expr.type === 'identifier') return this.resolveArrayName(expr.name)
    throw new Error('Expected array identifier')
  }

  private formatValue(expr: Expr): string {
    if (expr.type === 'index' && expr.array.type === 'identifier') {
      const arrName = this.resolveArrayName(expr.array.name)
      const idx = this.evalExpr(expr.index).num
      const arr = this.arrays.get(arrName)
      const val = arr ? arr[idx].num : '?'
      return `${arrName}[${idx}]=${val}`
    }
    return String(this.evalExpr(expr).num)
  }

  private addComparisonHighlights(condition: Expr): void {
    if (condition.type !== 'binary') return
    if (condition.op === 'and' || condition.op === 'or') {
      this.addComparisonHighlights(condition.left)
      try { this.addComparisonHighlights(condition.right) } catch { /* skip if eval fails */ }
      return
    }
    if (!['<', '>', '<=', '>=', '==', '!='].includes(condition.op)) return
    this.highlightComparisonSide(condition.left)
    this.highlightComparisonSide(condition.right)
  }

  private highlightComparisonSide(expr: Expr): void {
    try {
      if (expr.type === 'index' && expr.array.type === 'identifier') {
        this.addArrayHighlight(this.resolveArrayName(expr.array.name), [this.evalExpr(expr.index).num], 'compare')
      } else if (expr.type === 'identifier' && this.hasVar(expr.name)) {
        // Add as VarHighlight — renderer decides if it's a pointer arrow or variable cell
        this.currentVarHighlights.push({ varName: expr.name, type: 'compare' })
      }
    } catch { /* skip */ }
  }

  private snapshotCallIfProcedure(expr: Expr, line: number): void {
    if (expr.type === 'call' && this.procedures.has(expr.callee)) {
      const proc = this.procedures.get(expr.callee)!
      const argDisplayParts: string[] = []
      for (let i = 0; i < expr.args.length; i++) {
        const param = proc.params[i]
        if (param?.isArray) {
          const arg = expr.args[i]
          argDisplayParts.push(arg.type === 'identifier' ? this.resolveArrayName(arg.name) : '?')
        } else {
          argDisplayParts.push(String(this.evalExpr(expr.args[i]).num))
        }
      }
      this.snapshot(line, `Call ${expr.callee}(${argDisplayParts.join(', ')})`)
    }
  }

  private execNode(node: ASTNode): void {
    switch (node.type) {
      case 'for': this.execFor(node); break
      case 'while': this.execWhile(node); break
      case 'if': this.execIf(node); break
      case 'let': this.execLet(node); break
      case 'assign': this.execAssign(node); break
      case 'swap': this.execSwap(node); break
      case 'dim': this.execDim(node); break
      case 'undim': this.execUndim(node); break
      case 'gauge': this.execGauge(node); break
      case 'ungauge': this.execUngauge(node); break
      case 'pointer': this.execPointer(node); break
      case 'stepover': break
      case 'comment': this.execComment(node); break
      case 'tooltip': this.execTooltip(node); break
      case 'alloc': this.execAlloc(node); break
      case 'def': this.execDef(node); break
      case 'return': this.execReturn(node); break
      case 'exprStmt':
        this.snapshotCallIfProcedure(node.expr, node.line)
        if (!(node.expr.type === 'call' && this.procedures.has(node.expr.callee))) {
          this.evalExpr(node.expr)
          this.snapshot(node.line, '')
        } else {
          this.evalCall(node.expr.callee, node.expr.args)
        }
        break
    }
  }

  private execPointer(node: PointerNode): void {
    // Register this expression variable for re-evaluation at each snapshot.
    // It lives in the current scope level and vanishes when the scope is popped.
    this.liveExprVars[this.liveExprVars.length - 1].push({
      label: node.label,
      arrayName: node.arrayName,
      expr: node.at,
    })
  }

  private execFor(node: ForNode): void {
    const fromVal = this.evalExpr(node.from).num
    const toVal = this.evalExpr(node.to).num
    if (toVal - fromVal > MAX_LOOP_RANGE) throw new Error(`For loop range too large (${fromVal} to ${toVal}). Check your loop bounds.`)
    this.pushScope()

    // Static type for the loop variable
    const loopVarType = this.staticVarType(node.variable, node.line)

    for (let i = fromVal; i <= toVal; i++) {
      const val = this.stampValue(i, loopVarType)
      this.setVar(node.variable, val)
      if (node.describe) this.applyDescribe(node.describe, node.line)
      this.highlightComparisonSide({ type: 'identifier', name: node.variable })
      this.highlightComparisonSide(node.to)
      this.snapshot(node.line, `Set ${node.variable} = ${i}`)
      for (const stmt of node.body) this.execNode(stmt)
      this.flushPendingComment(node.line)
    }
    this.popScope()
  }

  private execWhile(node: WhileNode): void {
    let guard = 0
    // Capture any #: comment preceding the while loop so it can be
    // re-evaluated on every condition check, not just the first.
    const loopComment = this.pendingCommentParts
    this.pendingCommentParts = null  // consumed — will be passed explicitly
    this.pushScope()
    while (this.evalExpr(node.condition).num !== 0) {
      if (node.describe) this.applyDescribe(node.describe, node.line)
      this.addComparisonHighlights(node.condition)
      this.snapshot(node.line, 'While condition is true', loopComment ?? undefined)
      for (const stmt of node.body) this.execNode(stmt)
      this.flushPendingComment(node.line)
      if (++guard > MAX_LOOP_ITERATIONS) throw new Error(`Infinite loop detected (${MAX_LOOP_ITERATIONS} iterations). Check your while loop condition.`)
    }
    this.addComparisonHighlights(node.condition)
    this.snapshot(node.line, 'While condition is false', loopComment ?? undefined)
    this.popScope()
  }

  private execIf(node: IfNode): void {
    let desc = 'Check condition'
    this.addComparisonHighlights(node.condition)
    if (node.condition.type === 'binary' && ['<', '>', '<=', '>=', '==', '!='].includes(node.condition.op)) {
      const leftStr = this.formatValue(node.condition.left)
      const rightStr = this.formatValue(node.condition.right)
      desc = `Compare ${leftStr} ${node.condition.op} ${rightStr}`
    }

    const cond = this.evalExpr(node.condition).num
    this.snapshot(node.line, desc)

    if (cond !== 0) {
      this.pushScope()
      if (node.describe) this.applyDescribe(node.describe, node.line)
      for (const stmt of node.body) this.execNode(stmt)
      this.flushPendingComment(node.line)
      this.popScope()
    } else if (node.elseBody.length > 0) {
      this.pushScope()
      for (const stmt of node.elseBody) this.execNode(stmt)
      this.flushPendingComment(node.line)
      this.popScope()
    }
  }

  private execLet(node: LetNode): void {
    this.snapshotCallIfProcedure(node.value, node.line)
    const rawVal = this.evalExpr(node.value)
    // Stamp with static type
    const letType = this.staticVarType(node.name, node.line)
    const val = this.stampValue(rawVal.num, letType)
    this.setVar(node.name, val)
    if (val.arrays.length === 0) {
      this.currentVarHighlights.push({ varName: node.name, type: 'active' })
    }
    if (node.value.type === 'index' && node.value.array.type === 'identifier') {
      this.addArrayHighlight(node.value.array.name, [this.evalExpr(node.value.index).num], 'active')
    }
    this.snapshot(node.line, `Set ${node.name} = ${val.num}`)
  }

  private execAssign(node: AssignNode): void {
    this.snapshotCallIfProcedure(node.value, node.line)
    const val = this.evalExpr(node.value)
    if (node.target.type === 'identifier') {
      // For variable updates, preserve the existing type (from initial declaration)
      const existing = this.getVar(node.target.name)
      const updatedVal = existing && existing.arrays.length > 0
        ? { num: val.num, arrays: existing.arrays }
        : val
      this.updateVar(node.target.name, updatedVal)
      if (updatedVal.arrays.length === 0) {
        this.currentVarHighlights.push({ varName: node.target.name, type: 'active' })
      }
      this.snapshot(node.line, `Set ${node.target.name} = ${val.num}`)
    } else if (node.target.type === 'index') {
      const arr = this.getArray(node.target.array)
      const idx = this.evalExpr(node.target.index).num

      // Stamp stored cell value with static element type
      const arrayName = this.getArrayName(node.target.array)
      arr[idx] = this.stampCell(val.num, arrayName)

      this.setArrayHighlight(arrayName, [idx], 'active')
      if (node.value.type === 'identifier') {
        const srcVal = this.getVar(node.value.name)
        if (srcVal && srcVal.arrays.length === 0) {
          this.currentVarHighlights.push({ varName: node.value.name, type: 'active' })
        }
      }
      this.snapshot(node.line, `Set ${arrayName}[${idx}] = ${val.num}`)
    }
  }

  private execDim(node: DimNode): void {
    const from = this.evalExpr(node.from).num
    const to = this.evalExpr(node.to).num
    this.dimRanges.push({ arrayName: this.resolveArrayName(node.arrayName), from, to })
  }

  private execUndim(node: UndimNode): void {
    const from = this.evalExpr(node.from).num
    const to = this.evalExpr(node.to).num
    const name = this.resolveArrayName(node.arrayName)
    this.dimRanges = this.dimRanges.filter(d => !(d.arrayName === name && d.from === from && d.to === to))
  }

  private execGauge(node: { arrayName: string }): void {
    this.gaugeArrays.add(this.resolveArrayName(node.arrayName))
  }

  private execUngauge(node: { arrayName: string }): void {
    this.gaugeArrays.delete(this.resolveArrayName(node.arrayName))
  }

  private execComment(node: CommentNode): void {
    this.pendingCommentParts = node.parts ?? [{ type: 'text', text: node.text }]
  }

  /** Evaluate a describe annotation and push/upsert it in blockDescs. */
  private applyDescribe(describe: { text: string; parts?: CommentPart[] }, line: number): void {
    const rawParts = describe.parts ?? [{ type: 'text', text: describe.text }]
    const segments = this.evaluateCommentSegments(rawParts)
    const text = segmentsToText(segments)
    const depth = this.scopeStack.length
    // Upsert: replace existing entry at same depth, or push new
    const existing = this.blockDescs.findIndex(bd => bd.scopeDepth === depth)
    if (existing !== -1) {
      this.blockDescs[existing] = { text, parts: segments, scopeDepth: depth, line }
    } else {
      this.blockDescs.push({ text, parts: segments, scopeDepth: depth, line })
    }
  }

  private execTooltip(node: TooltipNode): void {
    // Register tooltip template for the target variable in the current scope
    this.tooltipStack[this.tooltipStack.length - 1].set(node.target, node.text)
  }

  /** Collect all active tooltips from the tooltip stack (inner scopes shadow outer). */
  private collectTooltips(): Record<string, string> {
    const result: Record<string, string> = {}
    for (const scope of this.tooltipStack) {
      for (const [name, text] of scope) {
        result[name] = text
      }
    }
    return result
  }

  private flushPendingComment(line: number): void {
    if (this.pendingCommentParts !== null) {
      this.snapshot(line, '')
    }
  }

  private execAlloc(node: AllocNode): void {
    const size = this.evalExpr(node.size).num
    // Stamp allocated cells with static element type
    const elemType = this.staticElemType(node.arrayName)
    this.arrays.set(node.arrayName, new Array(size).fill(null).map(() =>
      elemType.length > 0 ? { num: 0, arrays: [...elemType] } : plainVal(0)
    ))
    if (this.callFrameStack.length > 0) {
      this.callFrameStack[this.callFrameStack.length - 1].allocatedArrays.add(node.arrayName)
    }
  }

  private execDef(node: DefNode): void {
    this.procedures.set(node.name, { params: node.params, body: node.body, defLine: node.line, describe: node.describe })
  }

  private execReturn(node: ReturnNode): void {
    const val = this.evalExpr(node.value)
    this.snapshot(node.line, `Return ${val.num}`)
    throw new ReturnSignal(val)
  }

  private execSwap(node: SwapNode): void {
    if (node.left.type !== 'index' || node.right.type !== 'index') {
      throw new Error('swap requires array index expressions')
    }
    const leftIdx = node.left
    const rightIdx = node.right
    const arr = this.getArray(leftIdx.array)
    const i = this.evalExpr(leftIdx.index).num
    const j = this.evalExpr(rightIdx.index).num
    const arrayName = this.getArrayName(leftIdx.array)

    this.setArrayHighlight(arrayName, [i, j], 'swap')
    const desc = `Swap ${arrayName}[${i}]=${arr[i].num} and ${arrayName}[${j}]=${arr[j].num}`

    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp

    // Re-stamp swapped cells with element type
    const elemType = this.staticElemType(arrayName)
    if (elemType.length > 0) {
      arr[i] = { num: arr[i].num, arrays: [...elemType] }
      arr[j] = { num: arr[j].num, arrays: [...elemType] }
    }

    this.snapshot(node.line, desc)
  }
}

/**
 * Create a runner for the given algorithm AST.
 * colorMap is computed once in the pipeline and shared.
 * typeContext provides statically inferred iterator types.
 */
export function createRunner(algo: AlgoNode, colorMap: Map<string, string>, typeContext: TypeContext): (input: Map<string, number[]>) => Step[] {

  return function run(input: Map<string, number[]>): Step[] {
    const ctx = new ExecutionContext(algo, colorMap, typeContext, input)
    return ctx.execute()
  }
}

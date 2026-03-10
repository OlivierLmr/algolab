import type {
  ASTNode, AlgoNode, ForNode, WhileNode, IfNode, LetNode, AssignNode, SwapNode, DimNode, PointerNode, CommentNode, AllocNode, DefNode,
  Expr,
} from './ast.ts'
import { lex } from './lexer.ts'
import { parse as parseSource } from './parser.ts'
import type { Step, TrackedArray, Pointer, Highlight, VarHighlight, DimRange } from '../types.ts'
import { assignPointerColors } from '../renderer/colors.ts'
import { collectScopePointers, collectAllPointerLabels, collectDirectivePointerLabels } from './analysis.ts'
import type { ScopePointer } from './analysis.ts'

/**
 * Create a runner for the given algorithm AST.
 * Returns a function that takes input arrays and produces Step[].
 */
export function createRunner(algo: AlgoNode): (input: Map<string, number[]>) => Step[] {
  const allLabels = collectAllPointerLabels(algo.body)
  const directiveLabels = collectDirectivePointerLabels(algo.body)
  for (const label of directiveLabels) {
    if (!allLabels.includes(label)) allLabels.push(label)
  }
  const colorMap = assignPointerColors(allLabels)

  return function run(input: Map<string, number[]>): Step[] {
    const steps: Step[] = []
    const arrays = new Map<string, number[]>()
    const scopeStack: Map<string, number>[] = [new Map()]
    const procedures = new Map<string, { params: string[]; body: ASTNode[] }>()
    let callDepth = 0
    let currentHighlights: Highlight[] = []
    let currentVarHighlights: VarHighlight[] = []
    const dimRanges = new Map<string, { from: number; to: number }>()
    const directivePointers = new Map<string, { arrayName: string; expr: Expr }>()
    const activePointerStack: ScopePointer[][] = []
    let pendingComment: string | null = null

    for (const [name, values] of input) {
      arrays.set(name, [...values])
    }

    function getVar(name: string): number | undefined {
      for (let i = scopeStack.length - 1; i >= 0; i--) {
        if (scopeStack[i].has(name)) return scopeStack[i].get(name)
      }
      return undefined
    }

    function setVar(name: string, value: number): void {
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

    function pushPointers(body: ASTNode[]): void {
      activePointerStack.push(collectScopePointers(body))
    }

    function popPointers(): void {
      activePointerStack.pop()
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

    function isActivePointerVar(name: string): boolean {
      for (const level of activePointerStack) {
        for (const entry of level) {
          if (exprContainsVar(entry.expr, name)) return true
        }
      }
      return false
    }

    function exprContainsVar(expr: Expr, name: string): boolean {
      switch (expr.type) {
        case 'identifier': return expr.name === name
        case 'binary': return exprContainsVar(expr.left, name) || exprContainsVar(expr.right, name)
        case 'unary': return exprContainsVar(expr.operand, name)
        case 'index': return exprContainsVar(expr.array, name) || exprContainsVar(expr.index, name)
        case 'call': return expr.args.some(a => exprContainsVar(a, name))
        case 'number': return false
      }
    }

    function evalExprString(exprStr: string): number {
      const tokens = lex(`algo _(_: int[])\n  let _r = ${exprStr}`)
      const ast = parseSource(tokens)
      const node = ast.body[0]
      if (node.type === 'let') return evalExpr(node.value)
      throw new Error('Failed to parse expression')
    }

    function interpolateComment(template: string): string {
      return template.replace(/\{([^}]+)\}/g, (full, inner: string) => {
        // Check for ternary: expr ? 'trueText' : 'falseText'
        const qIdx = inner.indexOf('?')
        if (qIdx !== -1) {
          const condStr = inner.slice(0, qIdx).trim()
          const rest = inner.slice(qIdx + 1).trim()
          const branchMatch = rest.match(/^'([^']*)'\s*:\s*'([^']*)'$/)
          if (branchMatch) {
            try {
              const val = evalExprString(condStr)
              return val !== 0 ? branchMatch[1] : branchMatch[2]
            } catch { /* fall through to regular eval */ }
          }
        }

        // Regular expression interpolation
        try {
          return String(evalExprString(inner))
        } catch {
          return full
        }
      })
    }

    function snapshot(line: number, description: string): void {
      if (pendingComment !== null) {
        description = interpolateComment(pendingComment)
        pendingComment = null
      }

      const trackedArrays: TrackedArray[] = []
      for (const [name, values] of arrays) {
        trackedArrays.push({ name, values: [...values] })
      }

      const pointers: Pointer[] = []
      const seenPointers = new Set<string>()
      const activePointerVarNames = new Set<string>()
      for (const level of activePointerStack) {
        for (const entry of level) {
          const key = `${entry.arrayName}:${entry.label}`
          if (seenPointers.has(key)) continue
          try {
            const index = evalExpr(entry.expr)
            seenPointers.add(key)
            pointers.push({
              name: entry.label,
              arrayName: entry.arrayName,
              index,
              color: colorMap.get(entry.label) || '#888',
            })
            collectVarNames(entry.expr, activePointerVarNames)
          } catch { /* variable not yet defined — skip */ }
        }
      }

      for (const [label, def] of directivePointers) {
        try {
          const index = evalExpr(def.expr)
          pointers.push({
            name: label,
            arrayName: def.arrayName,
            index,
            color: colorMap.get(label) || '#888',
          })
        } catch { /* skip */ }
      }

      const variables: Record<string, number> = {}
      for (const scope of scopeStack) {
        for (const [k, v] of scope) {
          variables[k] = v
        }
      }

      const dimRangeList: DimRange[] = []
      for (const [arrayName, range] of dimRanges) {
        dimRangeList.push({ arrayName, from: range.from, to: range.to })
      }

      steps.push({
        arrays: trackedArrays,
        pointers,
        highlights: [...currentHighlights],
        varHighlights: [...currentVarHighlights],
        dimRanges: dimRangeList,
        variables,
        currentLine: line,
        description,
      })
      currentHighlights = []
      currentVarHighlights = []
    }

    function evalExpr(expr: Expr): number {
      switch (expr.type) {
        case 'number': return expr.value
        case 'identifier': {
          const val = getVar(expr.name)
          if (val === undefined) throw new Error(`Undefined variable: ${expr.name}`)
          return val
        }
        case 'binary': {
          // Short-circuit for and/or
          if (expr.op === 'and') {
            const left = evalExpr(expr.left)
            return left === 0 ? 0 : (evalExpr(expr.right) !== 0 ? 1 : 0)
          }
          if (expr.op === 'or') {
            const left = evalExpr(expr.left)
            return left !== 0 ? 1 : (evalExpr(expr.right) !== 0 ? 1 : 0)
          }
          return evalBinary(expr.op, evalExpr(expr.left), evalExpr(expr.right))
        }
        case 'unary':
          if (expr.op === '-') return -evalExpr(expr.operand)
          if (expr.op === 'not') return evalExpr(expr.operand) === 0 ? 1 : 0
          throw new Error(`Unknown unary op: ${expr.op}`)
        case 'index': {
          const arr = getArray(expr.array)
          const idx = evalExpr(expr.index)
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

    function evalCall(name: string, args: Expr[]): number {
      if (name === 'len') {
        const arg = args[0]
        if (arg.type === 'identifier') {
          const arr = arrays.get(arg.name)
          if (arr) return arr.length
        }
        throw new Error(`len() expects an array identifier`)
      }
      // User-defined procedure call
      const proc = procedures.get(name)
      if (proc) {
        if (++callDepth > 1000) throw new Error('Max recursion depth exceeded')
        const argValues = args.map(a => evalExpr(a))
        pushScope()
        pushPointers(proc.body)
        for (let i = 0; i < proc.params.length; i++) {
          setVar(proc.params[i], argValues[i])
        }
        for (const stmt of proc.body) execNode(stmt)
        popPointers()
        popScope()
        callDepth--
        return 0
      }
      throw new Error(`Unknown function: ${name}`)
    }

    function getArray(expr: Expr): number[] {
      if (expr.type === 'identifier') {
        const arr = arrays.get(expr.name)
        if (!arr) throw new Error(`Undefined array: ${expr.name}`)
        return arr
      }
      throw new Error('Expected array identifier')
    }

    function getArrayName(expr: Expr): string {
      if (expr.type === 'identifier') return expr.name
      throw new Error('Expected array identifier')
    }

    function formatValue(expr: Expr): string {
      if (expr.type === 'index' && expr.array.type === 'identifier') {
        const arrName = expr.array.name
        const idx = evalExpr(expr.index)
        const arr = arrays.get(arrName)
        const val = arr ? arr[idx] : '?'
        return `${arrName}[${idx}]=${val}`
      }
      return String(evalExpr(expr))
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
          const arrayName = expr.array.name
          const idx = evalExpr(expr.index)
          const existing = currentHighlights.find(h => h.arrayName === arrayName && h.type === 'compare')
          if (existing) {
            if (!existing.indices.includes(idx)) existing.indices.push(idx)
          } else {
            currentHighlights.push({ arrayName, indices: [idx], type: 'compare' })
          }
        } else if (expr.type === 'identifier' && hasVar(expr.name)) {
          currentVarHighlights.push({ varName: expr.name, type: 'compare' })
        }
      } catch { /* skip */ }
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
        case 'pointer': execPointer(node); break
        case 'comment': execComment(node); break
        case 'alloc': execAlloc(node); break
        case 'def': execDef(node); break
        case 'exprStmt':
          if (node.expr.type === 'call' && procedures.has(node.expr.callee)) {
            const call = node.expr
            const argVals = call.args.map(a => evalExpr(a))
            snapshot(node.line, `Call ${call.callee}(${argVals.join(', ')})`)
            evalCall(call.callee, call.args)
          } else {
            evalExpr(node.expr)
            snapshot(node.line, '')
          }
          break
      }
    }

    function deleteVar(name: string): void {
      for (let i = scopeStack.length - 1; i >= 0; i--) {
        if (scopeStack[i].has(name)) { scopeStack[i].delete(name); return }
      }
    }

    function execFor(node: ForNode): void {
      const fromVal = evalExpr(node.from)
      const toVal = evalExpr(node.to)
      if (toVal - fromVal > 10000) throw new Error('For loop range too large')
      pushPointers(node.body)
      for (let i = fromVal; i <= toVal; i++) {
        setVar(node.variable, i)
        snapshot(node.line, `Set ${node.variable} = ${i}`)
        for (const stmt of node.body) execNode(stmt)
      }
      popPointers()
      deleteVar(node.variable)
    }

    function execWhile(node: WhileNode): void {
      let guard = 0
      pushPointers(node.body)
      while (evalExpr(node.condition) !== 0) {
        addComparisonHighlights(node.condition)
        snapshot(node.line, 'While condition is true')
        for (const stmt of node.body) execNode(stmt)
        if (++guard > 10000) throw new Error('Infinite loop detected')
      }
      snapshot(node.line, 'While condition is false')
      popPointers()
    }

    function execIf(node: IfNode): void {
      let desc = 'Check condition'
      addComparisonHighlights(node.condition)
      if (node.condition.type === 'binary' && ['<', '>', '<=', '>=', '==', '!='].includes(node.condition.op)) {
        const leftStr = formatValue(node.condition.left)
        const rightStr = formatValue(node.condition.right)
        desc = `Compare ${leftStr} ${node.condition.op} ${rightStr}`
      }

      const cond = evalExpr(node.condition)
      snapshot(node.line, desc)

      if (cond !== 0) {
        pushPointers(node.body)
        for (const stmt of node.body) execNode(stmt)
        popPointers()
      } else if (node.elseBody.length > 0) {
        pushPointers(node.elseBody)
        for (const stmt of node.elseBody) execNode(stmt)
        popPointers()
      }
    }

    function execLet(node: LetNode): void {
      const val = evalExpr(node.value)
      setVar(node.name, val)
      if (!isActivePointerVar(node.name)) {
        currentVarHighlights.push({ varName: node.name, type: 'active' })
      }
      if (node.value.type === 'index' && node.value.array.type === 'identifier') {
        const arrayName = node.value.array.name
        const idx = evalExpr(node.value.index)
        currentHighlights.push({ arrayName, indices: [idx], type: 'active' })
      }
      snapshot(node.line, `Set ${node.name} = ${val}`)
    }

    function execAssign(node: AssignNode): void {
      const val = evalExpr(node.value)
      if (node.target.type === 'identifier') {
        setVar(node.target.name, val)
        if (!isActivePointerVar(node.target.name)) {
          currentVarHighlights.push({ varName: node.target.name, type: 'active' })
        }
        snapshot(node.line, `Set ${node.target.name} = ${val}`)
      } else if (node.target.type === 'index') {
        const arr = getArray(node.target.array)
        const idx = evalExpr(node.target.index)
        arr[idx] = val
        const arrayName = getArrayName(node.target.array)
        currentHighlights = [{ arrayName, indices: [idx], type: 'active' }]
        if (node.value.type === 'identifier' && !isActivePointerVar(node.value.name)) {
          currentVarHighlights.push({ varName: node.value.name, type: 'active' })
        }
        snapshot(node.line, `Set ${arrayName}[${idx}] = ${val}`)
      }
    }

    function execDim(node: DimNode): void {
      const from = evalExpr(node.from)
      const to = evalExpr(node.to)
      dimRanges.set(node.arrayName, { from, to })
    }

    function execPointer(node: PointerNode): void {
      directivePointers.set(node.label, { arrayName: node.arrayName, expr: node.at })
    }

    function execComment(node: CommentNode): void {
      pendingComment = node.text
    }

    function execAlloc(node: AllocNode): void {
      const size = evalExpr(node.size)
      arrays.set(node.arrayName, new Array(size).fill(0))
    }

    function execDef(node: DefNode): void {
      procedures.set(node.name, { params: node.params, body: node.body })
    }

    function execSwap(node: SwapNode): void {
      if (node.left.type !== 'index' || node.right.type !== 'index') {
        throw new Error('swap requires array index expressions')
      }
      const leftIdx = node.left
      const rightIdx = node.right
      const arr = getArray(leftIdx.array)
      const i = evalExpr(leftIdx.index)
      const j = evalExpr(rightIdx.index)
      const arrayName = getArrayName(leftIdx.array)

      currentHighlights = [{ arrayName, indices: [i, j], type: 'swap' }]
      const desc = `Swap ${arrayName}[${i}]=${arr[i]} and ${arrayName}[${j}]=${arr[j]}`

      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp

      snapshot(node.line, desc)
    }

    // Execute
    pushPointers(algo.body)
    snapshot(algo.line, `Start ${algo.name}`)
    for (const stmt of algo.body) execNode(stmt)
    snapshot(algo.body[algo.body.length - 1].line, 'Done')
    popPointers()

    return steps
  }
}

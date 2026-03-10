import type {
  ASTNode, AlgoNode, ForNode, WhileNode, IfNode, LetNode, AssignNode, SwapNode, DimNode, PointerNode,
  Expr,
} from './ast.ts'
import type { Step, TrackedArray, Pointer, Highlight, VarHighlight, DimRange } from '../types.ts'
import { assignPointerColors } from '../renderer/colors.ts'
import { detectPointers, collectDirectivePointerLabels } from './analysis.ts'

interface Env {
  arrays: Map<string, number[]>
  vars: Map<string, number>
}

/**
 * Create a runner for the given algorithm AST.
 * Returns a function that takes input arrays and produces Step[].
 */
export function createRunner(algo: AlgoNode): (input: Map<string, number[]>) => Step[] {
  const pointerMap = detectPointers(algo.body)
  const allPointerVars = new Set<string>()
  for (const vars of pointerMap.values()) {
    for (const v of vars) allPointerVars.add(v)
  }
  const directiveLabels = collectDirectivePointerLabels(algo.body)
  for (const label of directiveLabels) allPointerVars.add(label)
  const colorMap = assignPointerColors([...allPointerVars])

  return function run(input: Map<string, number[]>): Step[] {
    const steps: Step[] = []
    const env: Env = { arrays: new Map(), vars: new Map() }
    let currentHighlights: Highlight[] = []
    let currentVarHighlights: VarHighlight[] = []
    const dimRanges = new Map<string, { from: number; to: number }>()
    const directivePointers = new Map<string, { arrayName: string; expr: Expr }>()

    for (const [name, values] of input) {
      env.arrays.set(name, [...values])
    }

    function snapshot(line: number, description: string): void {
      const arrays: TrackedArray[] = []
      for (const [name, values] of env.arrays) {
        arrays.push({ name, values: [...values] })
      }

      const pointers: Pointer[] = []
      for (const [arrayName, varNames] of pointerMap) {
        for (const varName of varNames) {
          if (env.vars.has(varName)) {
            pointers.push({
              name: varName,
              arrayName,
              index: env.vars.get(varName)!,
              color: colorMap.get(varName) || '#888',
            })
          }
        }
      }

      for (const [label, def] of directivePointers) {
        const index = evalExpr(def.expr)
        pointers.push({
          name: label,
          arrayName: def.arrayName,
          index,
          color: colorMap.get(label) || '#888',
        })
      }

      const variables: Record<string, number> = {}
      for (const [k, v] of env.vars) {
        variables[k] = v
      }

      const dimRangeList: DimRange[] = []
      for (const [arrayName, range] of dimRanges) {
        dimRangeList.push({ arrayName, from: range.from, to: range.to })
      }

      steps.push({
        arrays,
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
          const val = env.vars.get(expr.name)
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
          const arr = env.arrays.get(arg.name)
          if (arr) return arr.length
        }
        throw new Error(`len() expects an array identifier`)
      }
      throw new Error(`Unknown function: ${name}`)
    }

    function getArray(expr: Expr): number[] {
      if (expr.type === 'identifier') {
        const arr = env.arrays.get(expr.name)
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
        const arr = env.arrays.get(arrName)
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
        } else if (expr.type === 'identifier' && env.vars.has(expr.name)) {
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
        case 'exprStmt':
          evalExpr(node.expr)
          snapshot(node.line, '')
          break
      }
    }

    function execFor(node: ForNode): void {
      const fromVal = evalExpr(node.from)
      const toVal = evalExpr(node.to)
      if (toVal - fromVal > 10000) throw new Error('For loop range too large')
      for (let i = fromVal; i <= toVal; i++) {
        env.vars.set(node.variable, i)
        snapshot(node.line, `Set ${node.variable} = ${i}`)
        for (const stmt of node.body) execNode(stmt)
      }
    }

    function execWhile(node: WhileNode): void {
      let guard = 0
      while (evalExpr(node.condition) !== 0) {
        addComparisonHighlights(node.condition)
        snapshot(node.line, 'While condition is true')
        for (const stmt of node.body) execNode(stmt)
        if (++guard > 10000) throw new Error('Infinite loop detected')
      }
      snapshot(node.line, 'While condition is false')
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
        for (const stmt of node.body) execNode(stmt)
      } else if (node.elseBody.length > 0) {
        for (const stmt of node.elseBody) execNode(stmt)
      }
    }

    function execLet(node: LetNode): void {
      const val = evalExpr(node.value)
      env.vars.set(node.name, val)
      if (!allPointerVars.has(node.name)) {
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
        env.vars.set(node.target.name, val)
        if (!allPointerVars.has(node.target.name)) {
          currentVarHighlights.push({ varName: node.target.name, type: 'active' })
        }
        snapshot(node.line, `Set ${node.target.name} = ${val}`)
      } else if (node.target.type === 'index') {
        const arr = getArray(node.target.array)
        const idx = evalExpr(node.target.index)
        arr[idx] = val
        const arrayName = getArrayName(node.target.array)
        currentHighlights = [{ arrayName, indices: [idx], type: 'active' }]
        if (node.value.type === 'identifier' && !allPointerVars.has(node.value.name)) {
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
    snapshot(algo.line, `Start ${algo.name}`)
    for (const stmt of algo.body) execNode(stmt)
    snapshot(algo.body[algo.body.length - 1].line, 'Done')

    return steps
  }
}

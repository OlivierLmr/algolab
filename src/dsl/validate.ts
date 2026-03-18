import type { AlgoNode, ASTNode, Expr, DefNode } from './ast.ts'

export interface ValidationError {
  line: number
  message: string
}

type SymbolType = 'scalar' | 'array'

interface FunctionInfo {
  params: { name: string; isArray: boolean }[]
}

const BUILTIN_FUNCTIONS: Record<string, { paramCount: number; arrayArgs: number[] }> = {
  len: { paramCount: 1, arrayArgs: [0] },
}

export function validateAST(ast: AlgoNode): ValidationError[] {
  const errors: ValidationError[] = []
  const functions = new Map<string, FunctionInfo>()
  const scopeStack: Map<string, SymbolType>[] = []
  // Track all array names from alloc across the entire AST (arrays are global in the interpreter)
  const globalArrays = new Set<string>()

  // --- First pass: collect all function definitions and all alloc names ---
  function collectDefs(nodes: ASTNode[]): void {
    for (const node of nodes) {
      if (node.type === 'def') {
        functions.set(node.name, { params: node.params })
        collectDefs(node.body)
      } else if (node.type === 'alloc') {
        globalArrays.add(node.arrayName)
      } else if (node.type === 'for' || node.type === 'while') {
        collectDefs(node.body)
      } else if (node.type === 'if') {
        collectDefs(node.body)
        collectDefs(node.elseBody)
      }
    }
  }
  collectDefs(ast.body)

  // --- Scope helpers ---
  function pushScope(): void {
    scopeStack.push(new Map())
  }

  function popScope(): void {
    scopeStack.pop()
  }

  function defineSymbol(name: string, type: SymbolType): void {
    scopeStack[scopeStack.length - 1].set(name, type)
  }

  function lookupSymbol(name: string): SymbolType | undefined {
    for (let i = scopeStack.length - 1; i >= 0; i--) {
      if (scopeStack[i].has(name)) return scopeStack[i].get(name)
    }
    if (globalArrays.has(name)) return 'array'
    return undefined
  }

  function symbolExists(name: string): boolean {
    return lookupSymbol(name) !== undefined
  }

  // --- Expression validation ---
  function validateExpr(expr: Expr, line: number): void {
    switch (expr.type) {
      case 'number':
        break
      case 'identifier':
        if (!symbolExists(expr.name)) {
          errors.push({ line, message: `Undefined variable '${expr.name}'` })
        }
        break
      case 'binary':
        validateExpr(expr.left, line)
        validateExpr(expr.right, line)
        break
      case 'unary':
        validateExpr(expr.operand, line)
        break
      case 'index': {
        // The array part must be an array
        if (expr.array.type === 'identifier') {
          const sym = lookupSymbol(expr.array.name)
          if (sym === undefined) {
            errors.push({ line, message: `Undefined array '${expr.array.name}'` })
          } else if (sym === 'scalar') {
            errors.push({ line, message: `'${expr.array.name}' is not an array` })
          }
        } else {
          validateExpr(expr.array, line)
        }
        validateExpr(expr.index, line)
        break
      }
      case 'call':
        validateCall(expr.callee, expr.args, line)
        break
    }
  }

  function validateCall(name: string, args: Expr[], line: number): void {
    const builtin = BUILTIN_FUNCTIONS[name]
    if (builtin) {
      if (args.length !== builtin.paramCount) {
        errors.push({ line, message: `'${name}' expects ${builtin.paramCount} argument(s), got ${args.length}` })
      }
      for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (builtin.arrayArgs.includes(i)) {
          // This argument must be an array identifier
          if (arg.type === 'identifier') {
            const sym = lookupSymbol(arg.name)
            if (sym === undefined) {
              errors.push({ line, message: `Undefined array '${arg.name}'` })
            } else if (sym === 'scalar') {
              errors.push({ line, message: `'${arg.name}' is not an array (expected by '${name}')` })
            }
          } else {
            validateExpr(arg, line)
          }
        } else {
          validateExpr(arg, line)
        }
      }
      return
    }

    const func = functions.get(name)
    if (!func) {
      errors.push({ line, message: `Unknown function '${name}'` })
      args.forEach(a => validateExpr(a, line))
      return
    }

    if (args.length !== func.params.length) {
      errors.push({ line, message: `'${name}' expects ${func.params.length} argument(s), got ${args.length}` })
    }

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      const param = func.params[i]
      if (!param) continue
      if (param.isArray) {
        // Must pass an array identifier
        if (arg.type === 'identifier') {
          const sym = lookupSymbol(arg.name)
          if (sym === undefined) {
            errors.push({ line, message: `Undefined array '${arg.name}'` })
          } else if (sym === 'scalar') {
            errors.push({ line, message: `'${arg.name}' is not an array (expected for parameter '${param.name}')` })
          }
        } else if (arg.type !== 'call') {
          // Allow call expressions (they might return arrays in future), but flag literals/scalars
          errors.push({ line, message: `Expected array identifier for parameter '${param.name}'` })
        }
      } else {
        validateExpr(arg, line)
      }
    }
  }

  // --- Statement validation ---
  function validateStatements(nodes: ASTNode[]): void {
    for (const node of nodes) {
      validateNode(node)
    }
  }

  function validateNode(node: ASTNode): void {
    switch (node.type) {
      case 'let': {
        validateExpr(node.value, node.line)
        defineSymbol(node.name, 'scalar')
        break
      }
      case 'assign': {
        if (node.target.type === 'identifier') {
          if (!symbolExists(node.target.name)) {
            errors.push({ line: node.line, message: `Undefined variable '${node.target.name}'` })
          }
          validateExpr(node.value, node.line)
        } else if (node.target.type === 'index') {
          // Array index assignment
          if (node.target.array.type === 'identifier') {
            const sym = lookupSymbol(node.target.array.name)
            if (sym === undefined) {
              errors.push({ line: node.line, message: `Undefined array '${node.target.array.name}'` })
            } else if (sym === 'scalar') {
              errors.push({ line: node.line, message: `'${node.target.array.name}' is not an array` })
            }
          }
          validateExpr(node.target.index, node.line)
          validateExpr(node.value, node.line)
        }
        break
      }
      case 'swap': {
        // Both sides must be index expressions
        if (node.left.type !== 'index') {
          errors.push({ line: node.line, message: `'swap' requires array index expressions` })
        } else {
          if (node.left.array.type === 'identifier') {
            const sym = lookupSymbol(node.left.array.name)
            if (sym === undefined) {
              errors.push({ line: node.line, message: `Undefined array '${node.left.array.name}'` })
            } else if (sym === 'scalar') {
              errors.push({ line: node.line, message: `'${node.left.array.name}' is not an array` })
            }
          }
          validateExpr(node.left.index, node.line)
        }
        if (node.right.type !== 'index') {
          errors.push({ line: node.line, message: `'swap' requires array index expressions` })
        } else {
          if (node.right.array.type === 'identifier') {
            const sym = lookupSymbol(node.right.array.name)
            if (sym === undefined) {
              errors.push({ line: node.line, message: `Undefined array '${node.right.array.name}'` })
            } else if (sym === 'scalar') {
              errors.push({ line: node.line, message: `'${node.right.array.name}' is not an array` })
            }
          }
          validateExpr(node.right.index, node.line)
        }
        break
      }
      case 'for': {
        validateExpr(node.from, node.line)
        validateExpr(node.to, node.line)
        pushScope()
        defineSymbol(node.variable, 'scalar')
        validateStatements(node.body)
        popScope()
        break
      }
      case 'while': {
        validateExpr(node.condition, node.line)
        pushScope()
        validateStatements(node.body)
        popScope()
        break
      }
      case 'if': {
        validateExpr(node.condition, node.line)
        pushScope()
        validateStatements(node.body)
        popScope()
        if (node.elseBody.length > 0) {
          pushScope()
          validateStatements(node.elseBody)
          popScope()
        }
        break
      }
      case 'alloc': {
        validateExpr(node.size, node.line)
        defineSymbol(node.arrayName, 'array')
        break
      }
      case 'def': {
        validateFunction(node)
        break
      }
      case 'return': {
        validateExpr(node.value, node.line)
        break
      }
      case 'dim':
      case 'undim': {
        const sym = lookupSymbol(node.arrayName)
        if (sym === undefined) {
          errors.push({ line: node.line, message: `Undefined array '${node.arrayName}'` })
        } else if (sym === 'scalar') {
          errors.push({ line: node.line, message: `'${node.arrayName}' is not an array` })
        }
        validateExpr(node.from, node.line)
        validateExpr(node.to, node.line)
        break
      }
      case 'stepover':
        break
      case 'gauge':
      case 'ungauge': {
        const sym = lookupSymbol(node.arrayName)
        if (sym === undefined) {
          errors.push({ line: node.line, message: `Undefined array '${node.arrayName}'` })
        } else if (sym === 'scalar') {
          errors.push({ line: node.line, message: `'${node.arrayName}' is not an array` })
        }
        break
      }
      case 'pointer': {
        const sym = lookupSymbol(node.arrayName)
        if (sym === undefined) {
          errors.push({ line: node.line, message: `Undefined array '${node.arrayName}'` })
        } else if (sym === 'scalar') {
          errors.push({ line: node.line, message: `'${node.arrayName}' is not an array` })
        }
        validateExpr(node.at, node.line)
        break
      }
      case 'exprStmt': {
        validateExpr(node.expr, node.line)
        break
      }
      case 'comment':
      case 'algo':
        break
    }
  }

  function validateFunction(node: DefNode): void {
    pushScope()
    for (const param of node.params) {
      defineSymbol(param.name, param.isArray ? 'array' : 'scalar')
    }
    validateStatements(node.body)
    popScope()
  }

  // --- Main validation ---

  // Initialize global scope with algo params
  pushScope()
  for (const param of ast.params) {
    defineSymbol(param.name, param.isArray ? 'array' : 'scalar')
  }

  // Second pass: validate all statements
  validateStatements(ast.body)

  popScope()
  return errors
}

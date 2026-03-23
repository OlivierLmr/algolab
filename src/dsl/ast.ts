export type ASTNode =
  | AlgoNode
  | ForNode
  | WhileNode
  | IfNode
  | LetNode
  | AssignNode
  | SwapNode
  | ExprStmtNode
  | DimNode
  | UndimNode
  | PointerNode
  | CommentNode
  | AllocNode
  | DefNode
  | ReturnNode
  | GaugeNode
  | UngaugeNode
  | StepoverNode
  | TooltipNode

export interface AlgoNode {
  type: 'algo'
  name: string
  params: { name: string; isArray: boolean }[]
  body: ASTNode[]
  line: number
}

export interface DescribeAnnotation {
  text: string
  parts?: CommentPart[]
}

export interface ForNode {
  type: 'for'
  variable: string
  from: Expr
  to: Expr
  body: ASTNode[]
  describe?: DescribeAnnotation
  line: number
}

export interface WhileNode {
  type: 'while'
  condition: Expr
  body: ASTNode[]
  describe?: DescribeAnnotation
  line: number
}

export interface IfNode {
  type: 'if'
  condition: Expr
  body: ASTNode[]
  elseBody: ASTNode[]
  describe?: DescribeAnnotation
  line: number
}

export interface LetNode {
  type: 'let'
  name: string
  value: Expr
  line: number
}

export interface AssignNode {
  type: 'assign'
  target: Expr
  value: Expr
  line: number
}

export interface SwapNode {
  type: 'swap'
  left: Expr
  right: Expr
  line: number
}

export interface ExprStmtNode {
  type: 'exprStmt'
  expr: Expr
  line: number
}

export interface DimNode {
  type: 'dim'
  arrayName: string
  from: Expr
  to: Expr
  line: number
}

export interface UndimNode {
  type: 'undim'
  arrayName: string
  from: Expr
  to: Expr
  line: number
}

export interface PointerNode {
  type: 'pointer'
  label: string
  arrayName: string
  at: Expr
  line: number
}

export type CommentPart =
  | { type: 'text'; text: string }
  | { type: 'expr'; expr: Expr }
  | { type: 'ternary'; condition: Expr; trueText: string; falseText: string }
  | { type: 'pill'; name: string; expr: Expr }

export interface CommentNode {
  type: 'comment'
  text: string
  parts?: CommentPart[]
  line: number
}

export interface AllocNode {
  type: 'alloc'
  arrayName: string
  size: Expr
  line: number
}

export interface DefNode {
  type: 'def'
  name: string
  params: { name: string; isArray: boolean }[]
  body: ASTNode[]
  describe?: DescribeAnnotation
  line: number
}

export interface ReturnNode {
  type: 'return'
  value: Expr
  line: number
}

export interface GaugeNode {
  type: 'gauge'
  arrayName: string
  line: number
}

export interface UngaugeNode {
  type: 'ungauge'
  arrayName: string
  line: number
}

export interface StepoverNode {
  type: 'stepover'
  line: number
}

export interface TooltipNode {
  type: 'tooltip'
  target: string
  text: string
  line: number
}

// Expressions
export type Expr =
  | NumberLiteral
  | Identifier
  | BinaryExpr
  | UnaryExpr
  | IndexExpr
  | CallExpr

export interface NumberLiteral {
  type: 'number'
  value: number
}

export interface Identifier {
  type: 'identifier'
  name: string
}

export interface BinaryExpr {
  type: 'binary'
  op: string
  left: Expr
  right: Expr
}

export interface UnaryExpr {
  type: 'unary'
  op: string
  operand: Expr
}

export interface IndexExpr {
  type: 'index'
  array: Expr
  index: Expr
}

export interface CallExpr {
  type: 'call'
  callee: string
  args: Expr[]
}

export function exprToString(expr: Expr): string {
  switch (expr.type) {
    case 'number': return String(expr.value)
    case 'identifier': return expr.name
    case 'binary': {
      const l = exprToString(expr.left)
      const r = exprToString(expr.right)
      const needParensL = expr.left.type === 'binary' && precedence(expr.left.op) < precedence(expr.op)
      const needParensR = expr.right.type === 'binary' && precedence(expr.right.op) < precedence(expr.op)
      const ls = needParensL ? `(${l})` : l
      const rs = needParensR ? `(${r})` : r
      return `${ls} ${expr.op} ${rs}`
    }
    case 'unary':
      if (expr.op === '-') return `-${exprToString(expr.operand)}`
      return `${expr.op} ${exprToString(expr.operand)}`
    case 'index': return `${exprToString(expr.array)}[${exprToString(expr.index)}]`
    case 'call': return `${expr.callee}(${expr.args.map(exprToString).join(', ')})`
  }
}

/** Call `fn` for each child body (body, elseBody) of an AST node. */
export function forEachChildBody(node: ASTNode, fn: (body: ASTNode[]) => void): void {
  switch (node.type) {
    case 'algo':
    case 'for':
    case 'while':
    case 'def':
      fn(node.body)
      break
    case 'if':
      fn(node.body)
      fn(node.elseBody)
      break
  }
}

function precedence(op: string): number {
  switch (op) {
    case 'or': return 1
    case 'and': return 2
    case '==': case '!=': return 3
    case '<': case '>': case '<=': case '>=': return 4
    case '+': case '-': return 5
    case '*': case '/': case '%': return 6
    default: return 0
  }
}

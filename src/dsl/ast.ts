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
  | PointerNode
  | CommentNode

export interface AlgoNode {
  type: 'algo'
  name: string
  params: { name: string; paramType: string }[]
  body: ASTNode[]
  line: number
}

export interface ForNode {
  type: 'for'
  variable: string
  from: Expr
  to: Expr
  body: ASTNode[]
  line: number
}

export interface WhileNode {
  type: 'while'
  condition: Expr
  body: ASTNode[]
  line: number
}

export interface IfNode {
  type: 'if'
  condition: Expr
  body: ASTNode[]
  elseBody: ASTNode[]
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

export interface PointerNode {
  type: 'pointer'
  label: string
  arrayName: string
  at: Expr
  line: number
}

export interface CommentNode {
  type: 'comment'
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

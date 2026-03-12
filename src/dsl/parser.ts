import type { Token } from './lexer.ts'
import type {
  ASTNode, AlgoNode, ForNode, WhileNode, IfNode, LetNode, SwapNode, DimNode, UndimNode, PointerNode, CommentNode, AllocNode, DefNode, ReturnNode,
  Expr,
} from './ast.ts'

export function parse(tokens: Token[]): AlgoNode {
  let pos = 0

  function peek(): Token {
    return tokens[pos]
  }

  function advance(): Token {
    return tokens[pos++]
  }

  function expect(type: Token['type'], value?: string): Token {
    const tok = advance()
    if (tok.type !== type || (value !== undefined && tok.value !== value)) {
      throw new Error(
        `Expected ${type}${value ? ` '${value}'` : ''} but got ${tok.type} '${tok.value}' at line ${tok.line + 1}`
      )
    }
    return tok
  }

  function match(type: Token['type'], value?: string): boolean {
    const tok = peek()
    return tok.type === type && (value === undefined || tok.value === value)
  }

  function skipNewlines(): void {
    while (peek() && peek().type === 'newline') advance()
  }

  // algo Name(param: type)
  function parseAlgo(): AlgoNode {
    skipNewlines()
    const tok = expect('keyword', 'algo')
    const line = tok.line
    const name = expect('ident').value
    expect('paren', '(')
    const params: { name: string; paramType: string }[] = []
    while (!match('paren', ')')) {
      if (params.length > 0) expect('comma')
      const pName = expect('ident').value
      expect('colon')
      let pType = expect('ident').value
      // Handle int[] type
      if (match('bracket', '[')) {
        advance()
        expect('bracket', ']')
        pType += '[]'
      }
      params.push({ name: pName, paramType: pType })
    }
    expect('paren', ')')
    skipNewlines()
    const body = parseBlock()
    return { type: 'algo', name, params, body, line }
  }

  function parseBlock(): ASTNode[] {
    expect('indent')
    const stmts: ASTNode[] = []
    skipNewlines()
    while (!match('dedent') && !match('eof')) {
      stmts.push(parseStatement())
      skipNewlines()
    }
    if (match('dedent')) advance()
    return stmts
  }

  function parseStatement(): ASTNode {
    const tok = peek()

    if (tok.type === 'keyword') {
      switch (tok.value) {
        case 'for': return parseFor()
        case 'while': return parseWhile()
        case 'if': return parseIf()
        case 'let': return parseLet()
        case 'swap': return parseSwap()
        case 'dim': return parseDim()
        case 'undim': return parseUndim()
        case 'pointer': return parsePointer()
        case 'comment': return parseComment()
        case 'alloc': return parseAlloc()
        case 'def': return parseDef()
        case 'return': return parseReturn()
      }
    }

    // Assignment: ident = expr  OR  arr[i] = expr
    // We need to parse the left side as an expression, then check for =
    return parseAssignOrExpr()
  }

  function parseFor(): ForNode {
    const tok = expect('keyword', 'for')
    const variable = expect('ident').value
    expect('keyword', 'from')
    const from = parseExpr()
    expect('keyword', 'to')
    const to = parseExpr()
    skipNewlines()
    const body = parseBlock()
    return { type: 'for', variable, from, to, body, line: tok.line }
  }

  function parseWhile(): WhileNode {
    const tok = expect('keyword', 'while')
    const condition = parseExpr()
    skipNewlines()
    const body = parseBlock()
    return { type: 'while', condition, body, line: tok.line }
  }

  function parseIf(): IfNode {
    const tok = expect('keyword', 'if')
    const condition = parseExpr()
    skipNewlines()
    const body = parseBlock()
    let elseBody: ASTNode[] = []
    skipNewlines()
    if (match('keyword', 'else')) {
      advance()
      skipNewlines()
      elseBody = parseBlock()
    }
    return { type: 'if', condition, body, elseBody, line: tok.line }
  }

  function parseLet(): LetNode {
    const tok = expect('keyword', 'let')
    const name = expect('ident').value
    expect('op', '=')
    const value = parseExpr()
    expectNewline()
    return { type: 'let', name, value, line: tok.line }
  }

  function parseSwap(): SwapNode {
    const tok = expect('keyword', 'swap')
    const left = parseExpr()
    expect('comma')
    const right = parseExpr()
    expectNewline()
    return { type: 'swap', left, right, line: tok.line }
  }

  function parseDim(): DimNode {
    const tok = expect('keyword', 'dim')
    const arrayName = expect('ident').value
    expect('keyword', 'from')
    const from = parseExpr()
    expect('keyword', 'to')
    const to = parseExpr()
    expectNewline()
    return { type: 'dim', arrayName, from, to, line: tok.line }
  }

  function parseUndim(): UndimNode {
    const tok = expect('keyword', 'undim')
    const arrayName = expect('ident').value
    expect('keyword', 'from')
    const from = parseExpr()
    expect('keyword', 'to')
    const to = parseExpr()
    expectNewline()
    return { type: 'undim', arrayName, from, to, line: tok.line }
  }

  function parsePointer(): PointerNode {
    const tok = expect('keyword', 'pointer')
    const labelTok = peek()
    if (labelTok.type !== 'ident' && labelTok.type !== 'string') {
      throw new Error(`Expected identifier or string for pointer label but got ${labelTok.type} '${labelTok.value}' at line ${labelTok.line + 1}`)
    }
    advance()
    const label = labelTok.value
    expect('keyword', 'on')
    const arrayName = expect('ident').value
    expect('keyword', 'at')
    const at = parseExpr()
    expectNewline()
    return { type: 'pointer', label, arrayName, at, line: tok.line }
  }

  function parseComment(): CommentNode {
    const tok = expect('keyword', 'comment')
    const text = expect('string').value
    expectNewline()
    return { type: 'comment', text, line: tok.line }
  }

  function parseDef(): DefNode {
    const tok = expect('keyword', 'def')
    const name = expect('ident').value
    expect('paren', '(')
    const params: { name: string; paramType?: string }[] = []
    while (!match('paren', ')')) {
      if (params.length > 0) expect('comma')
      const pName = expect('ident').value
      let pType: string | undefined
      if (match('colon')) {
        advance()
        pType = expect('ident').value
        if (match('bracket', '[')) {
          advance()
          expect('bracket', ']')
          pType += '[]'
        }
      }
      params.push({ name: pName, paramType: pType })
    }
    expect('paren', ')')
    skipNewlines()
    const body = parseBlock()
    return { type: 'def', name, params, body, line: tok.line }
  }

  function parseAlloc(): AllocNode {
    const tok = expect('keyword', 'alloc')
    const arrayName = expect('ident').value
    const size = parseExpr()
    expectNewline()
    return { type: 'alloc', arrayName, size, line: tok.line }
  }

  function parseReturn(): ReturnNode {
    const tok = expect('keyword', 'return')
    const value = parseExpr()
    expectNewline()
    return { type: 'return', value, line: tok.line }
  }

  function parseAssignOrExpr(): ASTNode {
    const line = peek().line
    const expr = parseExpr()
    if (match('op', '=')) {
      advance()
      const value = parseExpr()
      expectNewline()
      return { type: 'assign', target: expr, value, line }
    }
    expectNewline()
    return { type: 'exprStmt', expr, line }
  }

  function expectNewline(): void {
    if (match('newline')) advance()
    // Also accept dedent/eof as line terminator
  }

  // Expression parsing with precedence climbing
  function parseExpr(): Expr {
    return parseOr()
  }

  function parseOr(): Expr {
    let left = parseAnd()
    while (match('keyword', 'or')) {
      advance()
      const right = parseAnd()
      left = { type: 'binary', op: 'or', left, right }
    }
    return left
  }

  function parseAnd(): Expr {
    let left = parseNot()
    while (match('keyword', 'and')) {
      advance()
      const right = parseNot()
      left = { type: 'binary', op: 'and', left, right }
    }
    return left
  }

  function parseNot(): Expr {
    if (match('keyword', 'not')) {
      advance()
      const operand = parseNot()
      return { type: 'unary', op: 'not', operand }
    }
    return parseComparison()
  }

  function parseComparison(): Expr {
    let left = parseAddSub()
    const compOps = ['<', '>', '<=', '>=', '==', '!=']
    while (peek().type === 'op' && compOps.includes(peek().value)) {
      const op = advance().value
      const right = parseAddSub()
      left = { type: 'binary', op, left, right }
    }
    return left
  }

  function parseAddSub(): Expr {
    let left = parseMulDiv()
    while (match('op', '+') || match('op', '-')) {
      const op = advance().value
      const right = parseMulDiv()
      left = { type: 'binary', op, left, right }
    }
    return left
  }

  function parseMulDiv(): Expr {
    let left = parseUnary()
    while (match('op', '*') || match('op', '/') || match('op', '%')) {
      const op = advance().value
      const right = parseUnary()
      left = { type: 'binary', op, left, right }
    }
    return left
  }

  function parseUnary(): Expr {
    if (match('op', '-')) {
      advance()
      const operand = parseUnary()
      return { type: 'unary', op: '-', operand }
    }
    return parsePostfix()
  }

  function parsePostfix(): Expr {
    let expr = parsePrimary()

    // Handle indexing: arr[i]
    while (match('bracket', '[')) {
      advance()
      const index = parseExpr()
      expect('bracket', ']')
      expr = { type: 'index', array: expr, index }
    }

    return expr
  }

  function parsePrimary(): Expr {
    const tok = peek()

    // Number literal
    if (tok.type === 'number') {
      advance()
      return { type: 'number', value: parseInt(tok.value, 10) }
    }

    // Infinity
    if (tok.type === 'keyword' && tok.value === 'inf') {
      advance()
      return { type: 'number', value: Infinity }
    }

    // Parenthesized expression
    if (tok.type === 'paren' && tok.value === '(') {
      advance()
      const expr = parseExpr()
      expect('paren', ')')
      return expr
    }

    // Identifier or function call
    if (tok.type === 'ident') {
      advance()
      if (match('paren', '(')) {
        advance()
        const args: Expr[] = []
        while (!match('paren', ')')) {
          if (args.length > 0) expect('comma')
          args.push(parseExpr())
        }
        expect('paren', ')')
        return { type: 'call', callee: tok.value, args }
      }
      return { type: 'identifier', name: tok.value }
    }

    throw new Error(`Unexpected token ${tok.type} '${tok.value}' at line ${tok.line + 1}`)
  }

  return parseAlgo()
}

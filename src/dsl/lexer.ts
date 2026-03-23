export interface Token {
  type: TokenType
  value: string
  line: number
}

export type TokenType =
  | 'keyword'
  | 'ident'
  | 'number'
  | 'op'
  | 'paren'
  | 'bracket'
  | 'comma'
  | 'colon'
  | 'indent'
  | 'dedent'
  | 'string'
  | 'newline'
  | 'eof'

const KEYWORDS = new Set([
  'algo', 'let', 'for', 'from', 'to', 'while', 'if', 'else', 'swap', 'and', 'or', 'not',
  'dim', 'undim', 'pointer', 'on', 'at', 'comment', 'describe', 'alloc', 'def', 'inf', 'return',
  'gauge', 'ungauge', 'stepover', 'tooltip',
])

const OPERATORS = ['<=', '>=', '==', '!=', '<', '>', '+', '-', '*', '/', '%', '=']

export function lex(source: string): Token[] {
  const lines = source.split('\n')
  const tokens: Token[] = []
  const indentStack: number[] = [0]

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const raw = lines[lineNum]

    // Skip empty lines and comment-only lines
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue

    // Count indentation (spaces)
    let indent = 0
    while (indent < raw.length && raw[indent] === ' ') indent++

    // Emit indent/dedent tokens
    const currentIndent = indentStack[indentStack.length - 1]
    if (indent > currentIndent) {
      indentStack.push(indent)
      tokens.push({ type: 'indent', value: '', line: lineNum })
    } else {
      while (indent < indentStack[indentStack.length - 1]) {
        indentStack.pop()
        tokens.push({ type: 'dedent', value: '', line: lineNum })
      }
    }

    // Tokenize the line content
    let pos = indent
    const line = raw

    while (pos < line.length) {
      // Skip whitespace
      if (line[pos] === ' ') {
        pos++
        continue
      }

      // String literal
      if (line[pos] === '"') {
        pos++
        let start = pos
        while (pos < line.length && line[pos] !== '"') pos++
        if (pos >= line.length) throw new Error(`Unterminated string at line ${lineNum + 1}`)
        tokens.push({ type: 'string', value: line.slice(start, pos), line: lineNum })
        pos++ // skip closing quote
        continue
      }

      // Number
      if (isDigit(line[pos])) {
        let start = pos
        while (pos < line.length && isDigit(line[pos])) pos++
        tokens.push({ type: 'number', value: line.slice(start, pos), line: lineNum })
        continue
      }

      // Identifier or keyword
      if (isAlpha(line[pos])) {
        let start = pos
        while (pos < line.length && isAlphaNum(line[pos])) pos++
        const word = line.slice(start, pos)
        tokens.push({
          type: KEYWORDS.has(word) ? 'keyword' : 'ident',
          value: word,
          line: lineNum,
        })
        continue
      }

      // Operators (multi-char first)
      const oneChar = line[pos]
      const matched = OPERATORS.find(op => line.slice(pos, pos + op.length) === op)
      if (matched) {
        tokens.push({ type: 'op', value: matched, line: lineNum })
        pos += matched.length
        continue
      }

      // Parens, brackets, comma, colon
      if (oneChar === '(' || oneChar === ')') {
        tokens.push({ type: 'paren', value: oneChar, line: lineNum })
        pos++
        continue
      }
      if (oneChar === '[' || oneChar === ']') {
        tokens.push({ type: 'bracket', value: oneChar, line: lineNum })
        pos++
        continue
      }
      if (oneChar === ',') {
        tokens.push({ type: 'comma', value: oneChar, line: lineNum })
        pos++
        continue
      }
      if (oneChar === ':') {
        tokens.push({ type: 'colon', value: oneChar, line: lineNum })
        pos++
        continue
      }

      throw new Error(`Unexpected character '${oneChar}' at line ${lineNum + 1}, col ${pos + 1}`)
    }

    tokens.push({ type: 'newline', value: '', line: lineNum })
  }

  // Close remaining indents
  while (indentStack.length > 1) {
    indentStack.pop()
    tokens.push({ type: 'dedent', value: '', line: lines.length - 1 })
  }

  tokens.push({ type: 'eof', value: '', line: lines.length - 1 })
  return tokens
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

function isAlpha(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_'
}

function isAlphaNum(ch: string): boolean {
  return isAlpha(ch) || isDigit(ch)
}

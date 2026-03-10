import { lex } from './lexer.ts'
import { parse } from './parser.ts'
import { createRunner } from './interpreter.ts'
import { stripDirectivePrefix } from './preprocess.ts'
import type { Step } from '../types.ts'

/** Full pipeline: source → pre-process → lex → parse → interpret → Step[] */
export function runAlgorithm(source: string, paramName: string, input: number[]): Step[] {
  const tokens = lex(stripDirectivePrefix(source))
  const ast = parse(tokens)
  const runner = createRunner(ast)
  const inputMap = new Map([[paramName, input]])
  return runner(inputMap)
}

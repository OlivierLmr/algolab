import { compilePipeline } from '../src/dsl/index.ts'
import type { Step } from '../src/types.ts'

/** Compile a DSL source string into a full pipeline result. */
export function compile(source: string, input: number[] = [5, 3, 4, 1, 2]) {
  return compilePipeline(source, 'arr', input)
}

/** Check whether a step is inside a function call matching funcName. */
export function isInFrame(step: Step, funcName: string): boolean {
  return step.callStack.some(f => f.label.startsWith(funcName + '('))
}

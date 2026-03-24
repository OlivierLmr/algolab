import { describe, it, expect } from 'vitest'
import { compilePipeline } from '../src/dsl/index.ts'
import type { Step } from '../src/types.ts'

/**
 * Tests for the description-to-code-line highlight mapping.
 *
 * Each step has:
 * - `currentLine`: the source line being executed
 * - `blockDescriptions[].line`: the source line of each active describe block
 * - `isComment` + `descriptionParts`: the current one-shot comment
 *
 * The code panel uses a `lineMap` (source line → display line) to translate.
 * These tests verify that all description entries carry correct line numbers
 * and that those lines exist in the lineMap.
 */

function run(source: string, input: number[] = [3, 1, 2]) {
  const result = compilePipeline(source, 'arr', input)
  return { steps: result.steps, lineMap: result.displayInfo.lineMap }
}

describe('block description line tracking', () => {
  it('describe on for loop points to the for line', () => {
    const { steps, lineMap } = run(`algo Test(arr[])
  #: describe "Outer loop i={i}"
  for i from 0 to len(arr) - 1
    #: describe "Inner work"
    if i < len(arr) - 1
      let x = arr[i]`)

    // Find a step inside the for loop that has a block description
    const step = steps.find(s => s.blockDescriptions.length >= 1)
    expect(step).toBeDefined()

    const bd = step!.blockDescriptions[0]
    expect(bd.text).toContain('Outer loop')
    // bd.line should be the 'for' line (line 2), not the '#: describe' line (line 1)
    expect(bd.line).toBe(2)
    // The for line must be in the lineMap (it's not a directive)
    expect(lineMap.has(bd.line)).toBe(true)
  })

  it('describe on def points to the def line', () => {
    const { steps, lineMap } = run(`algo Test(arr[])
  #: describe "Working on {lo}..{hi}"
  def work(lo, hi)
    let x = arr[lo]
  work(0, len(arr) - 1)`)

    const step = steps.find(s =>
      s.blockDescriptions.some(bd => bd.text.includes('Working on'))
    )
    expect(step).toBeDefined()

    const bd = step!.blockDescriptions.find(bd => bd.text.includes('Working on'))!
    // bd.line should be the 'def' line (line 2)
    expect(bd.line).toBe(2)
    expect(lineMap.has(bd.line)).toBe(true)
  })

  it('describe on while loop points to the while line', () => {
    const { steps, lineMap } = run(`algo Test(arr[])
  let i = 0
  #: describe "Scanning with i"
  while i < len(arr)
    let x = arr[i]
    i = i + 1`)

    const step = steps.find(s =>
      s.blockDescriptions.some(bd => bd.text.includes('Scanning'))
    )
    expect(step).toBeDefined()

    const bd = step!.blockDescriptions.find(bd => bd.text.includes('Scanning'))!
    // bd.line should be the 'while' line (line 3)
    expect(bd.line).toBe(3)
    expect(lineMap.has(bd.line)).toBe(true)
  })

  it('nested describes each carry their own line', () => {
    const { steps, lineMap } = run(`algo Test(arr[])
  #: describe "Outer i={i}"
  for i from 0 to len(arr) - 2
    #: describe "Inner j={j}"
    for j from 0 to len(arr) - 2
      let x = arr[j]`)

    const step = steps.find(s => s.blockDescriptions.length === 2)
    expect(step).toBeDefined()

    const outer = step!.blockDescriptions[0]
    const inner = step!.blockDescriptions[1]
    expect(outer.text).toContain('Outer')
    expect(inner.text).toContain('Inner')
    // Different lines
    expect(outer.line).toBe(2) // outer for
    expect(inner.line).toBe(4) // inner for
    expect(outer.line).not.toBe(inner.line)
    // Both must be in lineMap
    expect(lineMap.has(outer.line)).toBe(true)
    expect(lineMap.has(inner.line)).toBe(true)
  })
})

describe('one-shot comment line tracking', () => {
  it('comment steps have currentLine pointing to the next statement', () => {
    const { steps, lineMap } = run(`algo Test(arr[])
  #: comment "Starting"
  let x = arr[0]
  #: comment "Done"
  let y = arr[1]`)

    const commentSteps = steps.filter(s => s.isComment)
    expect(commentSteps.length).toBeGreaterThanOrEqual(2)

    // "Starting" comment should be on the 'let x' line (line 2)
    const starting = commentSteps.find(s => s.description.includes('Starting'))!
    expect(starting.currentLine).toBe(2)
    expect(lineMap.has(starting.currentLine)).toBe(true)

    // "Done" comment should be on the 'let y' line (line 4)
    const done = commentSteps.find(s => s.description.includes('Done'))!
    expect(done.currentLine).toBe(4)
    expect(lineMap.has(done.currentLine)).toBe(true)
  })
})

describe('recent descriptions carry line numbers', () => {
  it('history entries reference the correct source lines', () => {
    const { steps } = run(`algo Test(arr[])
  #: describe "Working"
  for i from 0 to len(arr) - 1
    #: comment "Step i={i}"
    let x = arr[i]`)

    // Find consecutive comment steps at the same block depth
    const commentSteps = steps.filter(s => s.isComment)
    expect(commentSteps.length).toBeGreaterThanOrEqual(2)

    // All comment steps should have the same currentLine (the 'let x' line)
    for (const cs of commentSteps) {
      expect(cs.currentLine).toBe(4)
    }
  })
})

describe('real algorithm block description lines', () => {
  it('QuickSort block descriptions have valid lines in lineMap', () => {
    const algo = require('../src/algorithms/quick-sort.ts').quickSort
    const result = compilePipeline(algo.source, 'arr', [5, 3, 4, 1, 2])
    const { steps, displayInfo } = result
    const { lineMap } = displayInfo

    // Find steps with block descriptions
    const withDesc = steps.filter(s => s.blockDescriptions.length > 0)
    expect(withDesc.length).toBeGreaterThan(0)

    for (const step of withDesc) {
      for (const bd of step.blockDescriptions) {
        expect(bd.line).toBeDefined()
        expect(typeof bd.line).toBe('number')
        // The line must be in the lineMap (not a directive line)
        expect(lineMap.has(bd.line)).toBe(true)
      }
    }
  })
})

describe('block description line survives across iterations', () => {
  it('describe line stays correct as loop variable changes', () => {
    const { steps } = run(`algo Test(arr[])
  #: describe "Pass i={i}"
  for i from 0 to len(arr) - 1
    let x = arr[i]`)

    const withDesc = steps.filter(s =>
      s.blockDescriptions.some(bd => bd.text.includes('Pass'))
    )
    expect(withDesc.length).toBeGreaterThanOrEqual(2)

    // All should point to the same for-loop line
    for (const step of withDesc) {
      const bd = step.blockDescriptions.find(bd => bd.text.includes('Pass'))!
      expect(bd.line).toBe(2)
    }
  })
})

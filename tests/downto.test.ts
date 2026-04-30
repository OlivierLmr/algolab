import { describe, it, expect } from 'vitest'
import { lex } from '../src/dsl/lexer.ts'
import { parse } from '../src/dsl/parser.ts'
import { runAlgorithm } from '../src/dsl/index.ts'

describe('downto keyword', () => {
  it('lexer recognizes downto as a keyword', () => {
    const tokens = lex('algo Test(arr[])\n  for i from 5 downto 0\n    let x = i')
    const downtoToken = tokens.find(t => t.value === 'downto')
    expect(downtoToken).toBeDefined()
    expect(downtoToken!.type).toBe('keyword')
  })

  it('parser produces ForNode with direction descending', () => {
    const tokens = lex('algo Test(arr[])\n  for i from 5 downto 0\n    let x = i')
    const ast = parse(tokens)
    const forNode = ast.body[0]
    expect(forNode.type).toBe('for')
    if (forNode.type === 'for') {
      expect(forNode.direction).toBe('downto')
    }
  })

  it('ascending for loop still works (direction = to)', () => {
    const tokens = lex('algo Test(arr[])\n  for i from 0 to 5\n    let x = i')
    const ast = parse(tokens)
    const forNode = ast.body[0]
    expect(forNode.type).toBe('for')
    if (forNode.type === 'for') {
      expect(forNode.direction).toBe('to')
    }
  })

  it('interpreter iterates in descending order', () => {
    const source = `algo Test(arr[])
  for i from len(arr) - 1 downto 0
    arr[i] = arr[i] * 2`
    const steps = runAlgorithm(source, 'arr', [1, 2, 3, 4, 5])
    const lastStep = steps[steps.length - 1]
    const arrData = lastStep.arrays.find(a => a.name === 'arr')!
    expect(arrData.values.map(v => v.num)).toEqual([2, 4, 6, 8, 10])
  })

  it('downto with from < to produces no iterations', () => {
    const source = `algo Test(arr[])
  for i from 0 downto 5
    arr[0] = 99`
    const steps = runAlgorithm(source, 'arr', [1, 2, 3])
    const lastStep = steps[steps.length - 1]
    const arrData = lastStep.arrays.find(a => a.name === 'arr')!
    // Should not have executed the body
    expect(arrData.values[0].num).toBe(1)
  })

  it('downto loop variable is correctly typed as iterator', () => {
    const source = `algo Test(arr[])
  for i from len(arr) - 1 downto 0
    let x = arr[i]`
    const steps = runAlgorithm(source, 'arr', [10, 20, 30])
    // The loop should iterate 3 times (i=2, i=1, i=0)
    // Check that x gets the values in reverse order
    const xSteps = steps.filter(s => s.description.includes('Set i ='))
    expect(xSteps.length).toBe(3)
    expect(xSteps[0].variables['i']?.num).toBe(2)
    expect(xSteps[1].variables['i']?.num).toBe(1)
    expect(xSteps[2].variables['i']?.num).toBe(0)
  })
})

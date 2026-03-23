import { describe, it, expect } from 'vitest'
import { compilePipeline } from '../src/dsl/index.ts'
import { evaluateTooltip } from '../src/tooltip.ts'

function compile(source: string, input: number[] = [5, 3, 4, 1, 2]) {
  return compilePipeline(source, 'arr', input)
}

describe('tooltips (tooltip directive)', () => {
  describe('basic variable tooltips', () => {
    it('attaches a tooltip to the next let variable', () => {
      const { steps } = compile(`algo Test(arr[])
  #: tooltip "current scanning position"
  let i = 0
  i = 1`)

      // All steps where i is in scope should carry the tooltip
      const stepsWithI = steps.filter(s => 'i' in s.variables)
      expect(stepsWithI.length).toBeGreaterThan(0)
      for (const step of stepsWithI) {
        expect(step.tooltips['i']).toBe('current scanning position')
      }
    })

    it('attaches a tooltip to a for-loop variable', () => {
      const { steps } = compile(`algo Test(arr[])
  #: tooltip "loop index"
  for i from 0 to 2
    let x = i`)

      const loopSteps = steps.filter(s =>
        s.description.includes('Set x')
      )
      expect(loopSteps.length).toBeGreaterThan(0)
      for (const step of loopSteps) {
        expect(step.tooltips['i']).toBe('loop index')
      }
    })

    it('attaches a tooltip to an alloc array', () => {
      const { steps } = compile(`algo Test(arr[])
  #: tooltip "bucket counts"
  alloc count 5
  let x = 0`)

      const stepsAfterAlloc = steps.filter(s => 'x' in s.variables)
      expect(stepsAfterAlloc.length).toBeGreaterThan(0)
      for (const step of stepsAfterAlloc) {
        expect(step.tooltips['count']).toBe('bucket counts')
      }
    })
  })

  describe('scoping', () => {
    it('removes tooltip when the variable goes out of scope', () => {
      const { steps } = compile(`algo Test(arr[])
  def work(n)
    #: tooltip "iteration counter"
    let i = 0
    i = 1

  work(1)
  let x = 0`)

      // Inside work: tooltip should exist
      const insideSteps = steps.filter(s => s.callStack.length > 0)
      const withTooltip = insideSteps.filter(s => s.tooltips['i'])
      expect(withTooltip.length).toBeGreaterThan(0)

      // After work returns: tooltip for i should be gone
      const afterWork = steps.filter(s =>
        s.callStack.length === 0 && 'x' in s.variables
      )
      expect(afterWork.length).toBeGreaterThan(0)
      for (const step of afterWork) {
        expect(step.tooltips['i']).toBeUndefined()
      }
    })

    it('tooltip in inner scope does not leak to outer scope', () => {
      const { steps } = compile(`algo Test(arr[])
  let x = 0
  if x == 0
    #: tooltip "inner variable"
    let y = 1
  x = 1`)

      // After if block, tooltip for y should not exist
      const afterIf = steps.filter(s =>
        s.description.includes('Set x') && !s.description.includes('Set x = 0')
      )
      expect(afterIf.length).toBeGreaterThan(0)
      for (const step of afterIf) {
        expect(step.tooltips['y']).toBeUndefined()
      }
    })
  })

  describe('multiple tooltips', () => {
    it('supports multiple tooltips for different variables', () => {
      const { steps } = compile(`algo Test(arr[])
  #: tooltip "left pointer"
  let i = 0
  #: tooltip "right pointer"
  let j = 4
  i = 1`)

      const stepsWithBoth = steps.filter(s =>
        'i' in s.variables && 'j' in s.variables
      )
      expect(stepsWithBoth.length).toBeGreaterThan(0)
      for (const step of stepsWithBoth) {
        expect(step.tooltips['i']).toBe('left pointer')
        expect(step.tooltips['j']).toBe('right pointer')
      }
    })
  })

  describe('template evaluation', () => {
    it('tooltip templates are stored as raw strings (not evaluated at execution time)', () => {
      const { steps } = compile(`algo Test(arr[])
  #: tooltip "count[{index}] has {value} items"
  alloc count 5
  let x = 0`)

      const stepsWithTooltip = steps.filter(s => s.tooltips['count'])
      expect(stepsWithTooltip.length).toBeGreaterThan(0)
      // Template should be stored as-is, not evaluated
      expect(stepsWithTooltip[0].tooltips['count']).toBe('count[{index}] has {value} items')
    })
  })

  describe('render-time evaluation', () => {
    it('evaluateTooltip substitutes {index} and {value} for array cells', () => {
      const { steps } = compile(`algo Test(arr[])
  #: tooltip "count[{index}] has {value} items"
  alloc count 5
  let x = 0`)

      const step = steps.find(s => s.tooltips['count'])!
      const result = evaluateTooltip(step.tooltips['count'], step, { index: 2, value: 42 })
      expect(result).toBe('count[2] has 42 items')
    })

    it('evaluateTooltip substitutes {varname} from step variables', () => {
      const { steps } = compile(`algo Test(arr[])
  let lo = 0
  #: tooltip "scanning from {lo}"
  let i = 0
  i = 1`)

      const step = steps.find(s => s.tooltips['i'] && 'lo' in s.variables)!
      const result = evaluateTooltip(step.tooltips['i'], step, { value: 1 })
      expect(result).toBe('scanning from 0')
    })

    it('evaluateTooltip leaves unknown placeholders as-is', () => {
      const result = evaluateTooltip('{unknown} text', { variables: {}, callStack: [] } as any, {})
      expect(result).toBe('{unknown} text')
    })
  })
})

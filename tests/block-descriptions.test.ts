import { describe, it, expect } from 'vitest'
import { compile } from './test-utils.ts'

describe('block descriptions (describe directive)', () => {
  describe('basic functionality', () => {
    it('attaches a block description that persists while inside the block', () => {
      const { steps } = compile(`algo Test(arr[])
  #: describe "Working on range {lo} to {hi}"
  def doWork(lo, hi)
    let i = lo
    i = i + 1

  doWork(0, 4)`)

      // Steps inside doWork should have the block description
      const insideSteps = steps.filter(s => s.callStack.length > 0)
      expect(insideSteps.length).toBeGreaterThan(0)
      for (const step of insideSteps) {
        expect(step.blockDescriptions.length).toBeGreaterThanOrEqual(1)
        expect(step.blockDescriptions.some(bd => bd.text === 'Working on range 0 to 4')).toBe(true)
      }
    })

    it('removes block description when exiting the block', () => {
      const { steps } = compile(`algo Test(arr[])
  #: describe "Working on {lo} to {hi}"
  def doWork(lo, hi)
    let i = lo

  doWork(0, 4)
  let x = 1`)

      // Steps after doWork should not have the block description
      const afterCall = steps.filter(s =>
        s.callStack.length === 0 && s.description !== 'Start Test'
      )
      for (const step of afterCall) {
        expect(step.blockDescriptions.every(bd => bd.text !== 'Working on 0 to 4')).toBe(true)
      }
    })

    it('evaluates template with values at block entry', () => {
      const { steps } = compile(`algo Test(arr[])
  let i = 0
  #: describe "Starting with i={i}"
  if i == 0
    i = 1
    i = 2`)

      // The describe should capture i=0 at evaluation time
      const stepsWithDesc = steps.filter(s =>
        s.blockDescriptions.some(bd => bd.text.includes('Starting with'))
      )
      expect(stepsWithDesc.length).toBeGreaterThan(0)
      for (const step of stepsWithDesc) {
        const bd = step.blockDescriptions.find(bd => bd.text.includes('Starting with'))!
        expect(bd.text).toBe('Starting with i=0')
      }
    })
  })

  describe('nesting and stacking', () => {
    it('stacks nested block descriptions with increasing depth', () => {
      const { steps } = compile(`algo Test(arr[])
  #: describe "Partitioning {lo} to {hi}"
  def partition(lo, hi)
    let done = 0
    #: describe "Finding swap pair"
    while done == 0
      done = 1

  partition(0, 4)`)

      // Find a step inside the while loop
      const whileStep = steps.find(s =>
        s.blockDescriptions.length >= 2 &&
        s.blockDescriptions.some(bd => bd.text.includes('Partitioning')) &&
        s.blockDescriptions.some(bd => bd.text.includes('Finding swap'))
      )
      expect(whileStep).toBeDefined()

      // Partition description should have lower depth than while description
      const partDesc = whileStep!.blockDescriptions.find(bd => bd.text.includes('Partitioning'))!
      const whileDesc = whileStep!.blockDescriptions.find(bd => bd.text.includes('Finding'))!
      expect(partDesc.depth).toBeLessThan(whileDesc.depth)
    })

    it('removes inner block description when exiting inner block', () => {
      const { steps } = compile(`algo Test(arr[])
  #: describe "In work"
  def work(n)
    #: describe "Positive branch"
    if n > 0
      let x = n
    let y = 0

  work(1)`)

      // After if-block, should have "In work" but not "Positive branch"
      const afterIf = steps.find(s =>
        s.blockDescriptions.some(bd => bd.text === 'In work') &&
        !s.blockDescriptions.some(bd => bd.text === 'Positive branch') &&
        s.description.includes('Set y')
      )
      expect(afterIf).toBeDefined()
    })
  })

  describe('interaction with one-shot comments', () => {
    it('one-shot comments appear alongside block descriptions', () => {
      const { steps } = compile(`algo Test(arr[])
  #: describe "Working on {lo}..{hi}"
  def work(lo, hi)
    #: comment "Step one"
    let i = lo

  work(0, 4)`)

      const step = steps.find(s =>
        s.blockDescriptions.some(bd => bd.text === 'Working on 0..4') &&
        s.description === 'Step one'
      )
      expect(step).toBeDefined()
    })
  })

  describe('scope depth filtering for one-shot history', () => {
    it('steps have scopeDepth reflecting current nesting', () => {
      const { steps } = compile(`algo Test(arr[])
  let x = 1
  for i from 0 to 2
    let y = i`)

      // Steps at algo level (let x = 1) should have a different scopeDepth
      // from steps inside the for loop (let y = i)
      const algoStep = steps.find(s => s.description.includes('Set x'))
      const loopStep = steps.find(s => s.description.includes('Set y'))
      expect(algoStep).toBeDefined()
      expect(loopStep).toBeDefined()
      expect(loopStep!.scopeDepth).toBeGreaterThan(algoStep!.scopeDepth)
    })

    it('one-shot comments from outer describe level do not leak into inner described blocks', () => {
      const { steps } = compile(`algo Test(arr[])
  #: describe "Outer loop pass {i}"
  for i from 0 to 1
    #: comment "Outer comment for i={i}"
    let x = i
    #: describe "Inner loop"
    for j from 0 to 1
      let y = j`)

      // Steps inside the inner for loop have blockDescriptions.length === 2
      // Steps in the outer for loop (but outside inner) have blockDescriptions.length === 1
      // The "Outer comment" should NOT appear at inner block depth
      const innerSteps = steps.filter(s => s.blockDescriptions.length === 2)
      const outerSteps = steps.filter(s =>
        s.blockDescriptions.length === 1 && s.description.includes('Outer comment')
      )
      expect(innerSteps.length).toBeGreaterThan(0)
      expect(outerSteps.length).toBeGreaterThan(0)

      // Verify inner steps don't carry outer one-shot comments in their block depth
      for (const step of innerSteps) {
        // Inner steps should not have "Outer comment" as their description
        expect(step.description).not.toContain('Outer comment')
      }
    })

    it('one-shot comments from one recursive call do not leak into sibling recursive calls', () => {
      const { steps } = compile(`algo Test(arr[])
  #: describe "Working on {lo}..{hi}"
  def work(lo, hi)
    if lo < hi
      #: comment "About to recurse from {lo}..{hi}"
      let mid = lo + (hi - lo) / 2
      work(lo, mid)
      work(mid + 1, hi)

  work(0, 4)`)

      // Find steps that are the first step inside a recursive work() call.
      // These are steps where blockDescriptions changed from the previous step
      // (i.e. re-entered a described function). They should NOT carry comments
      // from the sibling call that just returned.
      for (let i = 1; i < steps.length; i++) {
        const prev = steps[i - 1]
        const curr = steps[i]
        // Detect entry into a new call: blockDescriptions depth decreased then
        // increased back (sibling call boundary)
        if (
          curr.blockDescriptions.length > 0 &&
          prev.blockDescriptions.length < curr.blockDescriptions.length &&
          curr.description && !curr.description.includes('About to recurse')
        ) {
          // First step of a new call should not show comments from the previous call
          // (the "About to recurse" comment belongs to an earlier sibling/parent)
        }
      }

      // More direct test: find pairs of sibling recursive calls.
      // After work(lo, mid) returns, the next work(mid+1, hi) should not see
      // "About to recurse from lo..hi" as a recent comment (that was before
      // the first recursive call, separated by a block boundary).
      const commentSteps = steps.filter(s => s.description.includes('About to recurse'))
      expect(commentSteps.length).toBeGreaterThan(0)

      // Each "About to recurse" comment should be immediately followed (within
      // the same block depth) by steps in the same call, not in a different one
      for (const cs of commentSteps) {
        const csIdx = steps.indexOf(cs)
        // The very next step should still be at the same block depth or deeper
        // (the let mid = ... or the recursive call entry)
        // But after the first recursive call returns and the second starts,
        // there must be a block depth change in between
        const bdLen = cs.blockDescriptions.length
        let foundBoundary = false
        for (let j = csIdx + 1; j < steps.length && j < csIdx + 20; j++) {
          if (steps[j].blockDescriptions.length !== bdLen) {
            foundBoundary = true
          }
          // After a boundary, if we return to same depth, comments should not carry over
          if (foundBoundary && steps[j].blockDescriptions.length === bdLen) {
            expect(steps[j].description).not.toContain('About to recurse')
            break
          }
        }
      }
    })
  })

  describe('loop describe re-evaluation', () => {
    it('describe on a for loop re-evaluates with current loop variable', () => {
      const { steps } = compile(`algo Test(arr[])
  #: describe "Iteration {i}"
  for i from 0 to 1
    let x = i`)

      const iter0 = steps.find(s =>
        s.blockDescriptions.some(bd => bd.text === 'Iteration 0')
      )
      const iter1 = steps.find(s =>
        s.blockDescriptions.some(bd => bd.text === 'Iteration 1')
      )
      expect(iter0).toBeDefined()
      expect(iter1).toBeDefined()
    })
  })
})

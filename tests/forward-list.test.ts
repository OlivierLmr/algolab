import { describe, it, expect } from 'vitest'
import { forwardListDS, type ForwardListState } from '../src/datastructures/forward-list.ts'

/** Apply operation and return the final state (last substep). */
function apply(state: ForwardListState, op: string, args: Record<string, number> = {}): ForwardListState {
  const substeps = forwardListDS.applyOperation(state, op, args)
  expect(substeps.length).toBeGreaterThan(0)
  return substeps[substeps.length - 1].state
}

/** Apply operation and return all substeps. */
function applySteps(state: ForwardListState, op: string, args: Record<string, number> = {}) {
  return forwardListDS.applyOperation(state, op, args)
}

describe('forward_list: initial state', () => {
  it('creates empty list', () => {
    const state = forwardListDS.createInitialState([])
    expect(state.size).toBe(0)
    expect(state.headId).toBeNull()
    expect(state.nodes).toEqual([])
    expect(state.nextNodeId).toBe(0)
  })

  it('creates single-element list', () => {
    const state = forwardListDS.createInitialState([42])
    expect(state.size).toBe(1)
    expect(state.headId).toBe(0)
    expect(state.nodes.length).toBe(1)
    expect(state.nodes[0].value).toBe(42)
    expect(state.nodes[0].nextId).toBeNull()
  })

  it('creates multi-element list with correct linkage', () => {
    const state = forwardListDS.createInitialState([10, 20, 30])
    expect(state.size).toBe(3)
    expect(state.headId).toBe(0)
    expect(state.nodes[0]).toEqual({ id: 0, value: 10, nextId: 1 })
    expect(state.nodes[1]).toEqual({ id: 1, value: 20, nextId: 2 })
    expect(state.nodes[2]).toEqual({ id: 2, value: 30, nextId: null })
    expect(state.nextNodeId).toBe(3)
  })
})

describe('forward_list: push_front', () => {
  it('pushes to empty list', () => {
    const state = forwardListDS.createInitialState([])
    const s2 = apply(state, 'push_front', { val: 5 })
    expect(s2.size).toBe(1)
    expect(s2.headId).toBe(0)
    expect(s2.nodes[0].value).toBe(5)
    expect(s2.nodes[0].nextId).toBeNull()
  })

  it('pushes to non-empty list', () => {
    const state = forwardListDS.createInitialState([10, 20])
    const s2 = apply(state, 'push_front', { val: 5 })
    expect(s2.size).toBe(3)
    expect(s2.headId).toBe(2) // new node id
    const head = s2.nodes.find(n => n.id === s2.headId)!
    expect(head.value).toBe(5)
    expect(head.nextId).toBe(0) // points to old head
  })

  it('produces 2 substeps', () => {
    const state = forwardListDS.createInitialState([1, 2])
    const steps = applySteps(state, 'push_front', { val: 0 })
    expect(steps.length).toBe(2)
    expect(steps[0].description).toContain('Create new node')
    expect(steps[1].description).toContain('head')
  })

  it('first substep has unlinked node', () => {
    const state = forwardListDS.createInitialState([1, 2])
    const steps = applySteps(state, 'push_front', { val: 0 })
    // In substep 1, the new node exists but head hasn't changed
    expect(steps[0].state.headId).toBe(state.headId)
    const newNode = steps[0].state.nodes.find(n => n.id === state.nextNodeId)!
    expect(newNode.value).toBe(0)
    expect(newNode.nextId).toBeNull()
  })
})

describe('forward_list: pop_front', () => {
  it('pops from single-element list', () => {
    const state = forwardListDS.createInitialState([42])
    const s2 = apply(state, 'pop_front')
    expect(s2.size).toBe(0)
    expect(s2.headId).toBeNull()
    expect(s2.nodes.length).toBe(0)
  })

  it('pops from multi-element list', () => {
    const state = forwardListDS.createInitialState([10, 20, 30])
    const s2 = apply(state, 'pop_front')
    expect(s2.size).toBe(2)
    expect(s2.headId).toBe(1) // second node becomes head
    expect(s2.nodes.find(n => n.id === 0)).toBeUndefined() // old head deleted
  })

  it('throws on empty list', () => {
    const state = forwardListDS.createInitialState([])
    expect(() => apply(state, 'pop_front')).toThrow('pop_front on empty forward_list')
  })

  it('produces 2 substeps', () => {
    const state = forwardListDS.createInitialState([1, 2, 3])
    const steps = applySteps(state, 'pop_front')
    expect(steps.length).toBe(2)
    expect(steps[0].description).toContain('head')
    expect(steps[1].description).toContain('Delete')
  })

  it('first substep still has old node in nodes array', () => {
    const state = forwardListDS.createInitialState([1, 2])
    const steps = applySteps(state, 'pop_front')
    // Substep 1: head updated but old node still present
    expect(steps[0].state.headId).toBe(1)
    expect(steps[0].state.nodes.find(n => n.id === 0)).toBeDefined()
    // Substep 2: old node removed
    expect(steps[1].state.nodes.find(n => n.id === 0)).toBeUndefined()
  })
})

describe('forward_list: insert_after', () => {
  it('inserts after first node', () => {
    const state = forwardListDS.createInitialState([10, 30])
    const s2 = apply(state, 'insert_after', { pos: 0, val: 20 })
    expect(s2.size).toBe(3)
    // Verify ordering: 10 -> 20 -> 30
    const head = s2.nodes.find(n => n.id === 0)!
    expect(head.value).toBe(10)
    const inserted = s2.nodes.find(n => n.id === head.nextId)!
    expect(inserted.value).toBe(20)
    expect(inserted.nextId).toBe(1) // original second node
  })

  it('inserts after last node', () => {
    const state = forwardListDS.createInitialState([10, 20])
    const s2 = apply(state, 'insert_after', { pos: 1, val: 30 })
    expect(s2.size).toBe(3)
    const lastOriginal = s2.nodes.find(n => n.id === 1)!
    expect(lastOriginal.nextId).toBe(2)
    const newNode = s2.nodes.find(n => n.id === 2)!
    expect(newNode.value).toBe(30)
    expect(newNode.nextId).toBeNull()
  })

  it('throws on invalid position (negative)', () => {
    const state = forwardListDS.createInitialState([1, 2])
    expect(() => apply(state, 'insert_after', { pos: -1, val: 0 })).toThrow()
  })

  it('throws on invalid position (>= size)', () => {
    const state = forwardListDS.createInitialState([1, 2])
    expect(() => apply(state, 'insert_after', { pos: 2, val: 0 })).toThrow()
  })

  it('throws on empty list', () => {
    const state = forwardListDS.createInitialState([])
    expect(() => apply(state, 'insert_after', { pos: 0, val: 1 })).toThrow()
  })

  it('produces 2 substeps', () => {
    const state = forwardListDS.createInitialState([1, 2, 3])
    const steps = applySteps(state, 'insert_after', { pos: 1, val: 99 })
    expect(steps.length).toBe(2)
    expect(steps[0].description).toContain('Create new node')
    expect(steps[1].description).toContain('Link')
  })
})

describe('forward_list: erase_after', () => {
  it('erases node after first', () => {
    const state = forwardListDS.createInitialState([10, 20, 30])
    const s2 = apply(state, 'erase_after', { pos: 0 })
    expect(s2.size).toBe(2)
    // 10 -> 30 (node 20 removed)
    const head = s2.nodes.find(n => n.id === 0)!
    expect(head.nextId).toBe(2) // skips over deleted node
    expect(s2.nodes.find(n => n.id === 1)).toBeUndefined()
  })

  it('erases last node (after second-to-last)', () => {
    const state = forwardListDS.createInitialState([10, 20, 30])
    const s2 = apply(state, 'erase_after', { pos: 1 })
    expect(s2.size).toBe(2)
    const secondNode = s2.nodes.find(n => n.id === 1)!
    expect(secondNode.nextId).toBeNull()
    expect(s2.nodes.find(n => n.id === 2)).toBeUndefined()
  })

  it('throws on invalid position (negative)', () => {
    const state = forwardListDS.createInitialState([1, 2])
    expect(() => apply(state, 'erase_after', { pos: -1 })).toThrow()
  })

  it('throws on invalid position (last element — nothing after)', () => {
    const state = forwardListDS.createInitialState([1, 2])
    expect(() => apply(state, 'erase_after', { pos: 1 })).toThrow()
  })

  it('throws on single-element list', () => {
    const state = forwardListDS.createInitialState([1])
    expect(() => apply(state, 'erase_after', { pos: 0 })).toThrow()
  })

  it('produces 2 substeps', () => {
    const state = forwardListDS.createInitialState([1, 2, 3])
    const steps = applySteps(state, 'erase_after', { pos: 0 })
    expect(steps.length).toBe(2)
    expect(steps[0].description).toContain('Unlink')
    expect(steps[1].description).toContain('Delete')
  })
})

describe('forward_list: layout', () => {
  it('produces struct header fields', () => {
    const state = forwardListDS.createInitialState([1, 2, 3])
    const layout = forwardListDS.computeLayout(state)
    const fields = layout.elements.filter(e => e.kind === 'struct-field')
    expect(fields.length).toBe(2) // head, size
  })

  it('produces node cells for each node', () => {
    const state = forwardListDS.createInitialState([10, 20, 30])
    const layout = forwardListDS.computeLayout(state)
    const cells = layout.elements.filter(e => e.kind === 'cell')
    expect(cells.length).toBe(3)
  })

  it('produces straight arrows between consecutive nodes', () => {
    const state = forwardListDS.createInitialState([10, 20, 30])
    const layout = forwardListDS.computeLayout(state)
    const straightArrows = layout.arrows.filter(a => a.style === 'straight')
    expect(straightArrows.length).toBe(2) // 10->20, 20->30
  })

  it('produces s-curve arrow from head to first node', () => {
    const state = forwardListDS.createInitialState([10, 20])
    const layout = forwardListDS.computeLayout(state)
    const sCurveArrows = layout.arrows.filter(a => a.style === 's-curve')
    expect(sCurveArrows.length).toBe(1)
  })

  it('empty list shows null label and no node cells', () => {
    const state = forwardListDS.createInitialState([])
    const layout = forwardListDS.computeLayout(state)
    const cells = layout.elements.filter(e => e.kind === 'cell')
    expect(cells.length).toBe(0)
    const labels = layout.elements.filter(e => e.kind === 'array-label')
    expect(labels.length).toBe(1)
    expect((labels[0].data as any).text).toBe('∅')
    // No arrows when empty
    expect(layout.arrows.length).toBe(0)
  })

  it('empty list still has struct header', () => {
    const state = forwardListDS.createInitialState([])
    const layout = forwardListDS.computeLayout(state)
    const fields = layout.elements.filter(e => e.kind === 'struct-field')
    expect(fields.length).toBe(2)
  })

  it('single node has s-curve arrow but no straight arrows', () => {
    const state = forwardListDS.createInitialState([42])
    const layout = forwardListDS.computeLayout(state)
    const straightArrows = layout.arrows.filter(a => a.style === 'straight')
    const sCurveArrows = layout.arrows.filter(a => a.style === 's-curve')
    expect(straightArrows.length).toBe(0)
    expect(sCurveArrows.length).toBe(1)
  })

  it('all substeps produce valid layouts', () => {
    const state = forwardListDS.createInitialState([1, 2, 3])
    const ops = [
      { op: 'push_front', args: { val: 0 } },
      { op: 'insert_after', args: { pos: 1, val: 99 } },
      { op: 'erase_after', args: { pos: 0 } },
      { op: 'pop_front', args: {} },
    ]
    let current = state
    for (const { op, args } of ops) {
      const steps = applySteps(current, op, args)
      for (const step of steps) {
        const layout = forwardListDS.computeLayout(step.state)
        expect(layout.elements.length).toBeGreaterThan(0)
        expect(layout.width).toBeGreaterThan(0)
        expect(layout.height).toBeGreaterThan(0)
      }
      current = steps[steps.length - 1].state
    }
  })

  it('layout dimensions are reasonable', () => {
    const state = forwardListDS.createInitialState([1, 2, 3, 4, 5])
    const layout = forwardListDS.computeLayout(state)
    expect(layout.width).toBeGreaterThanOrEqual(300)
    expect(layout.height).toBeGreaterThan(100)
  })
})

import { describe, it, expect } from 'vitest'
import { listDS, type ListState } from '../src/datastructures/list.ts'

/** Apply operation and return the final state (last substep). */
function apply(state: ListState, op: string, args: Record<string, number> = {}): ListState {
  const substeps = listDS.applyOperation(state, op, args)
  expect(substeps.length).toBeGreaterThan(0)
  return substeps[substeps.length - 1].state
}

/** Apply operation and return all substeps. */
function applySteps(state: ListState, op: string, args: Record<string, number> = {}) {
  return listDS.applyOperation(state, op, args)
}

/** Get ordered values from head to tail. */
function values(state: ListState): number[] {
  const result: number[] = []
  let currentId = state.headId
  while (currentId !== null) {
    const node = state.nodes.find(n => n.id === currentId)!
    result.push(node.value)
    currentId = node.nextId
  }
  return result
}

describe('list: initial state', () => {
  it('empty input creates empty list', () => {
    const state = listDS.createInitialState([])
    expect(state.size).toBe(0)
    expect(state.headId).toBeNull()
    expect(state.tailId).toBeNull()
    expect(state.nodes).toEqual([])
  })

  it('single element list', () => {
    const state = listDS.createInitialState([42])
    expect(state.size).toBe(1)
    expect(state.headId).toBe(0)
    expect(state.tailId).toBe(0)
    expect(state.nodes.length).toBe(1)
    expect(state.nodes[0].value).toBe(42)
    expect(state.nodes[0].prevId).toBeNull()
    expect(state.nodes[0].nextId).toBeNull()
  })

  it('multiple elements are linked correctly', () => {
    const state = listDS.createInitialState([10, 20, 30])
    expect(state.size).toBe(3)
    expect(state.headId).toBe(0)
    expect(state.tailId).toBe(2)
    expect(values(state)).toEqual([10, 20, 30])

    // Check backward links
    const tail = state.nodes.find(n => n.id === 2)!
    expect(tail.prevId).toBe(1)
    const mid = state.nodes.find(n => n.id === 1)!
    expect(mid.prevId).toBe(0)
    expect(mid.nextId).toBe(2)
  })
})

describe('list: push_front', () => {
  it('push_front on empty list', () => {
    const state = listDS.createInitialState([])
    const s2 = apply(state, 'push_front', { val: 5 })
    expect(s2.size).toBe(1)
    expect(values(s2)).toEqual([5])
    expect(s2.headId).toBe(s2.tailId)
  })

  it('push_front on non-empty list', () => {
    const state = listDS.createInitialState([2, 3])
    const s2 = apply(state, 'push_front', { val: 1 })
    expect(s2.size).toBe(3)
    expect(values(s2)).toEqual([1, 2, 3])
  })

  it('multiple push_fronts maintain order', () => {
    let s = listDS.createInitialState([])
    s = apply(s, 'push_front', { val: 3 })
    s = apply(s, 'push_front', { val: 2 })
    s = apply(s, 'push_front', { val: 1 })
    expect(values(s)).toEqual([1, 2, 3])
  })
})

describe('list: push_back', () => {
  it('push_back on empty list', () => {
    const state = listDS.createInitialState([])
    const s2 = apply(state, 'push_back', { val: 5 })
    expect(s2.size).toBe(1)
    expect(values(s2)).toEqual([5])
    expect(s2.headId).toBe(s2.tailId)
  })

  it('push_back on non-empty list', () => {
    const state = listDS.createInitialState([1, 2])
    const s2 = apply(state, 'push_back', { val: 3 })
    expect(s2.size).toBe(3)
    expect(values(s2)).toEqual([1, 2, 3])
  })

  it('multiple push_backs maintain order', () => {
    let s = listDS.createInitialState([])
    s = apply(s, 'push_back', { val: 1 })
    s = apply(s, 'push_back', { val: 2 })
    s = apply(s, 'push_back', { val: 3 })
    expect(values(s)).toEqual([1, 2, 3])
  })
})

describe('list: pop_front', () => {
  it('removes first element', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'pop_front')
    expect(s2.size).toBe(2)
    expect(values(s2)).toEqual([2, 3])
  })

  it('pop_front on single element empties the list', () => {
    const state = listDS.createInitialState([42])
    const s2 = apply(state, 'pop_front')
    expect(s2.size).toBe(0)
    expect(s2.headId).toBeNull()
    expect(s2.tailId).toBeNull()
  })

  it('pop_front on empty throws', () => {
    const state = listDS.createInitialState([])
    expect(() => apply(state, 'pop_front')).toThrow()
  })
})

describe('list: pop_back', () => {
  it('removes last element', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'pop_back')
    expect(s2.size).toBe(2)
    expect(values(s2)).toEqual([1, 2])
  })

  it('pop_back on single element empties the list', () => {
    const state = listDS.createInitialState([42])
    const s2 = apply(state, 'pop_back')
    expect(s2.size).toBe(0)
    expect(s2.headId).toBeNull()
    expect(s2.tailId).toBeNull()
  })

  it('pop_back on empty throws', () => {
    const state = listDS.createInitialState([])
    expect(() => apply(state, 'pop_back')).toThrow()
  })
})

describe('list: insert', () => {
  it('insert at beginning (delegates to push_front)', () => {
    const state = listDS.createInitialState([2, 3])
    const s2 = apply(state, 'insert', { pos: 0, val: 1 })
    expect(values(s2)).toEqual([1, 2, 3])
  })

  it('insert at end (delegates to push_back)', () => {
    const state = listDS.createInitialState([1, 2])
    const s2 = apply(state, 'insert', { pos: 2, val: 3 })
    expect(values(s2)).toEqual([1, 2, 3])
  })

  it('insert in middle', () => {
    const state = listDS.createInitialState([1, 3])
    const s2 = apply(state, 'insert', { pos: 1, val: 2 })
    expect(s2.size).toBe(3)
    expect(values(s2)).toEqual([1, 2, 3])
  })

  it('insert at invalid position throws', () => {
    const state = listDS.createInitialState([1, 2])
    expect(() => apply(state, 'insert', { pos: -1, val: 0 })).toThrow()
    expect(() => apply(state, 'insert', { pos: 3, val: 0 })).toThrow()
  })

  it('insert in middle preserves bidirectional links', () => {
    const state = listDS.createInitialState([1, 3, 5])
    const s2 = apply(state, 'insert', { pos: 1, val: 2 })
    // Verify backward traversal
    const backValues: number[] = []
    let currentId = s2.tailId
    while (currentId !== null) {
      const node = s2.nodes.find(n => n.id === currentId)!
      backValues.push(node.value)
      currentId = node.prevId
    }
    expect(backValues).toEqual([5, 3, 2, 1])
  })
})

describe('list: erase', () => {
  it('erase first (delegates to pop_front)', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'erase', { pos: 0 })
    expect(values(s2)).toEqual([2, 3])
  })

  it('erase last (delegates to pop_back)', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'erase', { pos: 2 })
    expect(values(s2)).toEqual([1, 2])
  })

  it('erase from middle', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'erase', { pos: 1 })
    expect(s2.size).toBe(2)
    expect(values(s2)).toEqual([1, 3])
  })

  it('erase at invalid position throws', () => {
    const state = listDS.createInitialState([1, 2])
    expect(() => apply(state, 'erase', { pos: -1 })).toThrow()
    expect(() => apply(state, 'erase', { pos: 2 })).toThrow()
  })

  it('erase on empty throws', () => {
    const state = listDS.createInitialState([])
    expect(() => apply(state, 'erase', { pos: 0 })).toThrow()
  })

  it('erase from middle preserves bidirectional links', () => {
    const state = listDS.createInitialState([1, 2, 3, 4, 5])
    const s2 = apply(state, 'erase', { pos: 2 })
    expect(values(s2)).toEqual([1, 2, 4, 5])
    // Verify backward traversal
    const backValues: number[] = []
    let currentId = s2.tailId
    while (currentId !== null) {
      const node = s2.nodes.find(n => n.id === currentId)!
      backValues.push(node.value)
      currentId = node.prevId
    }
    expect(backValues).toEqual([5, 4, 2, 1])
  })
})

describe('list: substeps', () => {
  it('push_front on non-empty produces 4 substeps', () => {
    const state = listDS.createInitialState([1, 2])
    const steps = applySteps(state, 'push_front', { val: 0 })
    expect(steps.length).toBe(4)
    expect(steps[0].description).toContain('Create new node')
    expect(steps[1].description).toContain('new.next')
    expect(steps[2].description).toContain('old_head.prev')
    expect(steps[3].description).toContain('begin')
  })

  it('push_front on empty produces 3 substeps (no prev update)', () => {
    const state = listDS.createInitialState([])
    const steps = applySteps(state, 'push_front', { val: 1 })
    expect(steps.length).toBe(3)
    expect(steps[0].description).toContain('Create')
    expect(steps[1].description).toContain('new.next')
    expect(steps[2].description).toContain('begin')
  })

  it('push_back on non-empty produces 4 substeps', () => {
    const state = listDS.createInitialState([1, 2])
    const steps = applySteps(state, 'push_back', { val: 3 })
    expect(steps.length).toBe(4)
    expect(steps[0].description).toContain('Create new node')
    expect(steps[1].description).toContain('new.prev')
    expect(steps[2].description).toContain('old_tail.next')
    expect(steps[3].description).toContain('end')
  })

  it('pop_front on multi-element produces 3 substeps', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const steps = applySteps(state, 'pop_front')
    expect(steps.length).toBe(3)
    expect(steps[0].description).toContain('begin')
    expect(steps[1].description).toContain('new_head.prev')
    expect(steps[2].description).toContain('Delete')
  })

  it('pop_front on single-element produces 2 substeps (no prev clear)', () => {
    const state = listDS.createInitialState([42])
    const steps = applySteps(state, 'pop_front')
    expect(steps.length).toBe(2)
    expect(steps[0].description).toContain('begin')
    expect(steps[1].description).toContain('Delete')
  })

  it('pop_back on multi-element produces 3 substeps', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const steps = applySteps(state, 'pop_back')
    expect(steps.length).toBe(3)
    expect(steps[0].description).toContain('end')
    expect(steps[1].description).toContain('new_tail.next')
    expect(steps[2].description).toContain('Delete')
  })

  it('insert in middle produces 5 substeps', () => {
    const state = listDS.createInitialState([1, 3])
    const steps = applySteps(state, 'insert', { pos: 1, val: 2 })
    expect(steps.length).toBe(5)
    expect(steps[0].description).toContain('Create new node')
    expect(steps[1].description).toContain('new.prev')
    expect(steps[2].description).toContain('new.next')
    expect(steps[3].description).toContain('.next → new')
    expect(steps[4].description).toContain('.prev → new')
  })

  it('erase from middle produces 3 substeps', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const steps = applySteps(state, 'erase', { pos: 1 })
    expect(steps.length).toBe(3)
    expect(steps[0].description).toContain('.next')
    expect(steps[1].description).toContain('.prev')
    expect(steps[2].description).toContain('Delete')
  })

  it('all intermediate substeps have valid renderable state', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const ops = [
      { op: 'push_front', args: { val: 0 } },
      { op: 'push_back', args: { val: 4 } },
      { op: 'insert', args: { pos: 2, val: 99 } },
      { op: 'erase', args: { pos: 1 } },
      { op: 'pop_front', args: {} },
      { op: 'pop_back', args: {} },
    ]
    let s = state
    for (const { op, args } of ops) {
      const steps = applySteps(s, op, args)
      for (const step of steps) {
        const layout = listDS.computeLayout(step.state)
        expect(layout.elements.length).toBeGreaterThan(0)
        expect(layout.width).toBeGreaterThan(0)
      }
      s = steps[steps.length - 1].state
    }
  })
})

describe('list: layout', () => {
  it('produces struct header fields (size, begin, end)', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const layout = listDS.computeLayout(state)

    const fields = layout.elements.filter(e => e.kind === 'struct-field')
    expect(fields.length).toBe(3)
    const fieldNames = fields.map(f => (f.data as any).name)
    expect(fieldNames).toContain('size')
    expect(fieldNames).toContain('begin')
    expect(fieldNames).toContain('end')
  })

  it('produces three cells per node (prev, value, next)', () => {
    const state = listDS.createInitialState([10, 20, 30])
    const layout = listDS.computeLayout(state)

    const cells = layout.elements.filter(e => e.kind === 'cell')
    expect(cells.length).toBe(9) // 3 nodes × 3 cells each
  })

  it('pointer cells have displayOverride', () => {
    const state = listDS.createInitialState([10, 20])
    const layout = listDS.computeLayout(state)
    const prevCells = layout.elements.filter(e => e.id.endsWith(':prev'))
    const nextCells = layout.elements.filter(e => e.id.endsWith(':next'))
    expect(prevCells.length).toBe(2)
    expect(nextCells.length).toBe(2)
    // First node's prev should be "∅" (null)
    expect((prevCells[0].data as any).displayOverride).toBe('×')
    // First node's next should be "•"
    expect((nextCells[0].data as any).displayOverride).toBe('•')
    // Last node's next should be "∅"
    expect((nextCells[1].data as any).displayOverride).toBe('×')
  })

  it('empty list shows empty label and struct header', () => {
    const state = listDS.createInitialState([])
    const layout = listDS.computeLayout(state)

    const fields = layout.elements.filter(e => e.kind === 'struct-field')
    expect(fields.length).toBe(3)

    const labels = layout.elements.filter(e => e.kind === 'array-label')
    expect(labels.length).toBe(1)
    expect((labels[0].data as any).text).toBe('∅')

    expect(layout.arrows.length).toBe(0)
  })

  it('single node has 2 s-curve arrows (begin and end) and no straight arrows', () => {
    const state = listDS.createInitialState([42])
    const layout = listDS.computeLayout(state)

    const straightArrows = layout.arrows.filter(a => a.style === 'straight')
    const sCurveArrows = layout.arrows.filter(a => a.style === 's-curve')
    expect(straightArrows.length).toBe(0)
    expect(sCurveArrows.length).toBe(2) // begin→node, end→node
  })

  it('two nodes have 2 straight arrows (next+prev) plus 2 s-curves', () => {
    const state = listDS.createInitialState([1, 2])
    const layout = listDS.computeLayout(state)

    const straightArrows = layout.arrows.filter(a => a.style === 'straight')
    const sCurveArrows = layout.arrows.filter(a => a.style === 's-curve')
    expect(straightArrows.length).toBe(2)
    expect(sCurveArrows.length).toBe(2)
  })

  it('three nodes have 4 straight arrows (2 pairs) plus 2 s-curves', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const layout = listDS.computeLayout(state)

    const straightArrows = layout.arrows.filter(a => a.style === 'straight')
    const sCurveArrows = layout.arrows.filter(a => a.style === 's-curve')
    expect(straightArrows.length).toBe(4)
    expect(sCurveArrows.length).toBe(2)
  })

  it('bidirectional arrows are vertically offset', () => {
    const state = listDS.createInitialState([1, 2])
    const layout = listDS.computeLayout(state)

    const straightArrows = layout.arrows.filter(a => a.style === 'straight')
    expect(straightArrows.length).toBe(2)

    // Forward arrow should have lower Y than backward arrow
    const fwd = straightArrows.find(a => a.fromX < a.toX)!
    const bwd = straightArrows.find(a => a.fromX > a.toX)!
    expect(fwd.fromY).toBeLessThan(bwd.fromY)
  })

  it('floating node in intermediate substep renders to the right', () => {
    const state = listDS.createInitialState([1, 2])
    const steps = applySteps(state, 'push_front', { val: 0 })
    // Step 0: new node is floating
    const layout = listDS.computeLayout(steps[0].state)
    const cells = layout.elements.filter(e => e.kind === 'cell')
    expect(cells.length).toBe(9) // 2 linked + 1 floating, each 3 cells
  })
})

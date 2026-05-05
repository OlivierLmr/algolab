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

/** Traverse the list from head and return values in order. */
function getValues(state: ForwardListState): number[] {
  const values: number[] = []
  let currentId = state.headId
  const visited = new Set<number>()
  while (currentId !== null) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const node = state.nodes.find(n => n.id === currentId)!
    values.push(node.value)
    currentId = node.nextId
  }
  return values
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

  it('produces 3 substeps (create, link, head)', () => {
    const state = forwardListDS.createInitialState([1, 2])
    const steps = applySteps(state, 'push_front', { val: 0 })
    expect(steps.length).toBe(3)
    expect(steps[0].description).toContain('Create new node')
    expect(steps[1].description).toContain('new.next')
    expect(steps[2].description).toContain('head')
  })

  it('first substep has unlinked floating node', () => {
    const state = forwardListDS.createInitialState([1, 2])
    const steps = applySteps(state, 'push_front', { val: 0 })
    // In substep 1, the new node exists but head hasn't changed
    expect(steps[0].state.headId).toBe(state.headId)
    const newNode = steps[0].state.nodes.find(n => n.id === state.nextNodeId)!
    expect(newNode.value).toBe(0)
    expect(newNode.nextId).toBeNull()
  })

  it('second substep links new.next = head but head not yet updated', () => {
    const state = forwardListDS.createInitialState([1, 2])
    const steps = applySteps(state, 'push_front', { val: 0 })
    const newNode = steps[1].state.nodes.find(n => n.id === state.nextNodeId)!
    expect(newNode.nextId).toBe(state.headId)
    expect(steps[1].state.headId).toBe(state.headId) // head not yet changed
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

  it('produces 2 substeps (head, delete)', () => {
    const state = forwardListDS.createInitialState([1, 2, 3])
    const steps = applySteps(state, 'pop_front')
    expect(steps.length).toBe(2)
    expect(steps[0].description).toContain('head')
    expect(steps[1].description).toContain('Delete')
  })

  it('first substep still has old node in nodes array', () => {
    const state = forwardListDS.createInitialState([1, 2])
    const steps = applySteps(state, 'pop_front')
    // Step 1: head updated but old node still present
    expect(steps[0].state.headId).toBe(1)
    expect(steps[0].state.nodes.find(n => n.id === 0)).toBeDefined()
    // Step 2: old node removed
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

  it('produces 3 substeps (create, link new.next, link target.next)', () => {
    const state = forwardListDS.createInitialState([1, 2, 3])
    const steps = applySteps(state, 'insert_after', { pos: 1, val: 99 })
    expect(steps.length).toBe(3)
    expect(steps[0].description).toContain('Create new node')
    expect(steps[1].description).toContain('new.next')
    expect(steps[2].description).toContain('target.next')
  })

  it('first substep has floating node not yet linked', () => {
    const state = forwardListDS.createInitialState([1, 2])
    const steps = applySteps(state, 'insert_after', { pos: 0, val: 99 })
    const newNode = steps[0].state.nodes.find(n => n.id === state.nextNodeId)!
    expect(newNode.nextId).toBeNull() // not linked yet
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

  it('produces 2 substeps (bypass, delete)', () => {
    const state = forwardListDS.createInitialState([1, 2, 3])
    const steps = applySteps(state, 'erase_after', { pos: 0 })
    expect(steps.length).toBe(2)
    expect(steps[0].description).toContain('target.next')
    expect(steps[1].description).toContain('Delete')
  })
})

describe('forward_list: splice_after (C++ range semantics)', () => {
  // C++ splice_after(pos, first, last): moves nodes in open range (first, last)
  // i.e., nodes after `first` up to but not including `last`, inserted after `pos`.
  // `last` = size means "to end of list".

  it('moves a single node (first+2 == last)', () => {
    const state = forwardListDS.createInitialState([10, 20, 30, 40])
    // Move range (1, 3): node after pos 1 (=pos 2, val 30) up to not including pos 3
    // Insert after pos 0. Result: 10 -> 30 -> 20 -> 40
    const s2 = apply(state, 'splice_after', { pos: 0, first: 1, last: 3 })
    expect(getValues(s2)).toEqual([10, 30, 20, 40])
  })

  it('moves multiple nodes', () => {
    const state = forwardListDS.createInitialState([10, 20, 30, 40, 50])
    // Move range (1, 4): nodes at pos 2 (30) and pos 3 (40), insert after pos 0
    // Result: 10 -> 30 -> 40 -> 20 -> 50
    const s2 = apply(state, 'splice_after', { pos: 0, first: 1, last: 4 })
    expect(getValues(s2)).toEqual([10, 30, 40, 20, 50])
  })

  it('moves to end of list (last = size)', () => {
    const state = forwardListDS.createInitialState([10, 20, 30, 40])
    // Move range (0, 4): nodes at pos 1,2,3 (20,30,40) to end — but we move after pos 0
    // Actually let's move tail to front: move range (2, 4) after pos -1? No.
    // Move range (1, 4) [nodes 2,3] after pos 0
    // Move (1, size=4): nodes at pos 2, 3 → after pos 0
    const s2 = apply(state, 'splice_after', { pos: 0, first: 1, last: 4 })
    expect(getValues(s2)).toEqual([10, 30, 40, 20])
  })

  it('splices from head (first = -1 means before_begin)', () => {
    const state = forwardListDS.createInitialState([10, 20, 30, 40])
    // Move range (-1, 2): nodes at pos 0 (10) and pos 1 (20), insert after pos 2
    // Result: 30 -> 10 -> 20 -> 40
    const s2 = apply(state, 'splice_after', { pos: 2, first: -1, last: 2 })
    expect(getValues(s2)).toEqual([30, 10, 20, 40])
  })

  it('has 5 substeps: visual + unlink + tail + head + visual cleanup', () => {
    const state = forwardListDS.createInitialState([1, 2, 3, 4, 5])
    const steps = applySteps(state, 'splice_after', { pos: 0, first: 2, last: 5 })
    expect(steps.length).toBe(5)
    expect(steps[0].description).toContain('Splicing')
    expect(steps[1].description).toMatch(/Set/)
    expect(steps[2].description).toContain('tail')
    expect(steps[3].description).toMatch(/Set/)
    expect(steps[4].description).toContain('complete')
  })

  it('floating nodes persist across intermediate steps and return to row at end', () => {
    const state = forwardListDS.createInitialState([1, 2, 3, 4, 5])
    const steps = applySteps(state, 'splice_after', { pos: 0, first: 1, last: 4 })
    // Steps 0-3: floating nodes below
    for (let i = 0; i < 4; i++) {
      const layout = forwardListDS.computeLayout(steps[i].state)
      const valueCells = layout.elements.filter(e => e.kind === 'cell' && e.id.endsWith(':value'))
      const linkedY = valueCells.find(e => e.id.includes(':0:'))?.y // node 0 is linked
      const floating = valueCells.filter(e => e.y !== linkedY)
      expect(floating.length).toBe(2) // nodes 2,3 below
    }
    // Step 4: all nodes in one row
    const finalLayout = forwardListDS.computeLayout(steps[4].state)
    const finalCells = finalLayout.elements.filter(e => e.kind === 'cell' && e.id.endsWith(':value'))
    const ys = new Set(finalCells.map(c => c.y))
    expect(ys.size).toBe(1)
  })

  it('throws when range is empty (first+1 == last)', () => {
    const state = forwardListDS.createInitialState([1, 2, 3])
    // (1, 2) is empty — no nodes between pos 1 and pos 2
    expect(() => apply(state, 'splice_after', { pos: 0, first: 1, last: 2 })).toThrow()
  })

  it('throws when pos is inside the range being moved', () => {
    const state = forwardListDS.createInitialState([1, 2, 3, 4, 5])
    // Moving (1, 4) = nodes 2,3 — pos=2 is inside
    expect(() => apply(state, 'splice_after', { pos: 2, first: 1, last: 4 })).toThrow()
  })

  it('throws on invalid positions', () => {
    const state = forwardListDS.createInitialState([1, 2, 3])
    expect(() => apply(state, 'splice_after', { pos: -2, first: 0, last: 2 })).toThrow()
    expect(() => apply(state, 'splice_after', { pos: 0, first: 0, last: 5 })).toThrow()
  })
})

describe('forward_list: layout', () => {
  it('produces struct header fields', () => {
    const state = forwardListDS.createInitialState([1, 2, 3])
    const layout = forwardListDS.computeLayout(state)
    const fields = layout.elements.filter(e => e.kind === 'struct-field')
    expect(fields.length).toBe(2) // head, size
  })

  it('produces two cells per node (value + pointer)', () => {
    const state = forwardListDS.createInitialState([10, 20, 30])
    const layout = forwardListDS.computeLayout(state)
    const cells = layout.elements.filter(e => e.kind === 'cell')
    expect(cells.length).toBe(6) // 3 nodes × 2 cells each
  })

  it('pointer cells have displayOverride', () => {
    const state = forwardListDS.createInitialState([10, 20])
    const layout = forwardListDS.computeLayout(state)
    const ptrCells = layout.elements.filter(e => e.id.endsWith(':ptr'))
    expect(ptrCells.length).toBe(2)
    // First node's ptr should be "•" (points to next)
    expect((ptrCells[0].data as any).displayOverride).toBe('•')
    // Last node's ptr should be "∅" (null)
    expect((ptrCells[1].data as any).displayOverride).toBe('×')
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

  it('floating node in intermediate substep renders below', () => {
    const state = forwardListDS.createInitialState([1, 2])
    const steps = applySteps(state, 'push_front', { val: 0 })
    // Step 0: new node is floating (not reachable from head)
    const layout = forwardListDS.computeLayout(steps[0].state)
    const cells = layout.elements.filter(e => e.kind === 'cell')
    expect(cells.length).toBe(6) // 2 linked nodes + 1 floating node, each 2 cells
    // Floating node cells should be below (higher Y value)
    const linkedCells = cells.filter(e => !e.id.includes(`:${state.nextNodeId}:`))
    const floatingCells = cells.filter(e => e.id.includes(`:${state.nextNodeId}:`))
    expect(floatingCells[0].y).toBeGreaterThan(linkedCells[0].y)
  })

  it('floating node with next pointer has an arrow to target', () => {
    const state = forwardListDS.createInitialState([1, 2])
    const steps = applySteps(state, 'push_front', { val: 0 })
    // Step 1: new.next = head (floating node now points to node 0)
    const layout = forwardListDS.computeLayout(steps[1].state)
    // Should have: 1 straight arrow (1→2 linked) + 1 straight arrow (floating→node0) + 1 s-curve (head field→node0)
    const straightArrows = layout.arrows.filter(a => a.style === 'straight')
    expect(straightArrows.length).toBeGreaterThanOrEqual(2) // linked→linked + floating→linked
    const sCurves = layout.arrows.filter(a => a.style === 's-curve')
    expect(sCurves.length).toBe(1) // head field → first node only
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

  it('multiple floating nodes in splice are spread horizontally, not overlapping', () => {
    const state = forwardListDS.createInitialState([1, 2, 3, 4, 5])
    // Splice nodes at positions 2, 3 (range (1, 4)) — two floating nodes
    const steps = applySteps(state, 'splice_after', { pos: 0, first: 1, last: 4 })
    // Step 0 (visual pre-step): nodes 2 and 3 forced below
    const layout = forwardListDS.computeLayout(steps[0].state)
    const linkedCells = layout.elements.filter(e =>
      e.kind === 'cell' && e.id.startsWith('cell:node:') && e.id.endsWith(':value')
    )
    const linkedY = linkedCells.find(e => e.id.includes(':0:'))?.y // node 0 is still linked
    const floatingCells = linkedCells.filter(e => e.y !== linkedY)
    expect(floatingCells.length).toBe(2)
    const xs = floatingCells.map(e => e.x)
    expect(xs[0]).not.toBe(xs[1])
  })
})

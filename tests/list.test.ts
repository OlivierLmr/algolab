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
    // First node's prev should be "•" (sentinel → begin)
    expect((prevCells[0].data as any).displayOverride).toBe('•')
    // First node's next should be "•"
    expect((nextCells[0].data as any).displayOverride).toBe('•')
    // Last node's next should be "•" (sentinel → end)
    expect((nextCells[1].data as any).displayOverride).toBe('•')
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

  it('single node has 4 s-curve arrows (begin→node, end→node, prev→begin, next→end)', () => {
    const state = listDS.createInitialState([42])
    const layout = listDS.computeLayout(state)

    const straightArrows = layout.arrows.filter(a => a.style === 'straight')
    const sCurveArrows = layout.arrows.filter(a => a.style === 's-curve')
    expect(straightArrows.length).toBe(0)
    expect(sCurveArrows.length).toBe(4)
  })

  it('two nodes have 2 straight arrows (next+prev) plus 4 s-curves', () => {
    const state = listDS.createInitialState([1, 2])
    const layout = listDS.computeLayout(state)

    const straightArrows = layout.arrows.filter(a => a.style === 'straight')
    const sCurveArrows = layout.arrows.filter(a => a.style === 's-curve')
    expect(straightArrows.length).toBe(2)
    expect(sCurveArrows.length).toBe(4)
  })

  it('three nodes have 4 straight arrows (2 pairs) plus 4 s-curves', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const layout = listDS.computeLayout(state)

    const straightArrows = layout.arrows.filter(a => a.style === 'straight')
    const sCurveArrows = layout.arrows.filter(a => a.style === 's-curve')
    expect(straightArrows.length).toBe(4)
    expect(sCurveArrows.length).toBe(4)
  })

  it('sentinel arrows go from node row upward to struct header', () => {
    const state = listDS.createInitialState([1, 2])
    const layout = listDS.computeLayout(state)

    // Find arrows going upward (fromY > toY) — these are the sentinel arrows
    const upwardArrows = layout.arrows.filter(a => a.fromY > a.toY && a.style === 's-curve')
    expect(upwardArrows.length).toBe(2) // head.prev→begin, tail.next→end
  })

  it('sentinel arrows target box edge, not center', () => {
    const state = listDS.createInitialState([1])
    const layout = listDS.computeLayout(state)

    const beginField = layout.elements.find(e => e.id === 'field:begin')!
    const endField = layout.elements.find(e => e.id === 'field:end')!
    // Sentinel arrows go upward from nodes to struct fields
    const upwardArrows = layout.arrows.filter(a => a.fromY > a.toY && a.style === 's-curve')
    expect(upwardArrows.length).toBe(2)

    for (const arrow of upwardArrows) {
      // The field's cell box bottom edge Y = field.y + field.height
      // The center Y = field.y + field.height - CELL_SIZE/2
      // Arrow comes from below, so rectEdgeIntersection should hit the bottom edge
      const targetField = [beginField, endField].find(f =>
        arrow.toX >= f.x && arrow.toX <= f.x + f.width
      )!
      // toY should be at the bottom edge of the cell box, not at the center
      expect(arrow.toY).toBe(targetField.y + targetField.height)
    }
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

describe('list: splice', () => {
  // C++ semantics: splice(pos, first, last) moves [first, last) to before pos.
  // pos = insert before this position (pos = size means at end).
  // first = first node to move (included).
  // last = past-end (excluded, last = size means through tail).

  it('moves a single node to front', () => {
    // [1, 2, 3, 4, 5] → splice(pos=0, first=3, last=4) → move [3,4) = node at 3 (val 4) before pos 0
    // Result: [4, 1, 2, 3, 5]
    const state = listDS.createInitialState([1, 2, 3, 4, 5])
    const s2 = apply(state, 'splice', { pos: 0, first: 3, last: 4 })
    expect(values(s2)).toEqual([4, 1, 2, 3, 5])
    expect(s2.size).toBe(5)
  })

  it('moves multiple nodes to front', () => {
    // [1, 2, 3, 4, 5] → splice(pos=0, first=2, last=4) → move [2,4) = nodes 2,3 (val 3,4) before pos 0
    // Result: [3, 4, 1, 2, 5]
    const state = listDS.createInitialState([1, 2, 3, 4, 5])
    const s2 = apply(state, 'splice', { pos: 0, first: 2, last: 4 })
    expect(values(s2)).toEqual([3, 4, 1, 2, 5])
  })

  it('moves range to end', () => {
    // [1, 2, 3, 4, 5] → splice(pos=5, first=1, last=3) → move [1,3) = nodes 1,2 (val 2,3) before pos 5 (end)
    // Result: [1, 4, 5, 2, 3]
    const state = listDS.createInitialState([1, 2, 3, 4, 5])
    const s2 = apply(state, 'splice', { pos: 5, first: 1, last: 3 })
    expect(values(s2)).toEqual([1, 4, 5, 2, 3])
    expect(s2.size).toBe(5)
  })

  it('moves range to middle', () => {
    // [1, 2, 3, 4, 5] → splice(pos=1, first=3, last=5) → move [3,5) = nodes 3,4 (val 4,5) before pos 1
    // Result: [1, 4, 5, 2, 3]
    const state = listDS.createInitialState([1, 2, 3, 4, 5])
    const s2 = apply(state, 'splice', { pos: 1, first: 3, last: 5 })
    expect(values(s2)).toEqual([1, 4, 5, 2, 3])
  })

  it('has 5 substeps: visual + unlink + 2 bidirectional relink + visual cleanup', () => {
    const state = listDS.createInitialState([1, 2, 3, 4, 5])
    const steps = applySteps(state, 'splice', { pos: 0, first: 2, last: 4 })
    // Step 0: visual pre-step
    // Step 1: unlink (close the gap — both forward and backward)
    // Step 2: connect tail side bidirectionally
    // Step 3: connect head side bidirectionally
    // Step 4: visual cleanup (nodes return to single row)
    expect(steps.length).toBe(5)
    expect(steps[0].description).toContain('Splicing')
    for (const step of steps.slice(1, 4)) {
      expect(step.description).toMatch(/Set/)
    }
    expect(steps[4].description).toContain('complete')
  })

  it('floating nodes persist across all intermediate steps', () => {
    const state = listDS.createInitialState([1, 2, 3, 4, 5])
    const steps = applySteps(state, 'splice', { pos: 0, first: 2, last: 4 })

    // Steps 0-3 should have floatingNodeIds set (nodes stay below)
    for (let i = 0; i < 4; i++) {
      const layout = listDS.computeLayout(steps[i].state)
      const valueCells = layout.elements.filter(e => e.kind === 'cell' && e.id.endsWith(':value'))
      const nodeYs = new Map<number, number>()
      for (const cell of valueCells) {
        const parts = cell.id.split(':')
        nodeYs.set(Number(parts[2]), cell.y)
      }
      const topY = nodeYs.get(0)!
      expect(nodeYs.get(2)!).toBeGreaterThan(topY) // node 2 below
      expect(nodeYs.get(3)!).toBeGreaterThan(topY) // node 3 below
    }

    // Final step (4): all nodes back in one row
    const finalLayout = listDS.computeLayout(steps[4].state)
    const finalValueCells = finalLayout.elements.filter(e => e.kind === 'cell' && e.id.endsWith(':value'))
    const finalYs = new Set(finalValueCells.map(c => c.y))
    expect(finalYs.size).toBe(1) // all at same y
  })

  it('floating nodes appear below their original position', () => {
    const state = listDS.createInitialState([1, 2, 3, 4, 5])
    const steps = applySteps(state, 'splice', { pos: 0, first: 2, last: 4 })
    const layout = listDS.computeLayout(steps[0].state)
    const valueCells = layout.elements.filter(e => e.kind === 'cell' && e.id.endsWith(':value'))
    const nodeXs = new Map<number, number>()
    for (const cell of valueCells) {
      const parts = cell.id.split(':')
      nodeXs.set(Number(parts[2]), cell.x)
    }
    // Node 2 (value 3) should be below node 1 (value 2), not below node 4 (value 5)
    expect(nodeXs.get(2)).toBe(nodeXs.get(1)) // same x as value 2
  })

  it('throws on empty range', () => {
    const state = listDS.createInitialState([1, 2, 3])
    expect(() => apply(state, 'splice', { pos: 0, first: 2, last: 2 })).toThrow()
  })

  it('throws when pos is inside the moved range', () => {
    const state = listDS.createInitialState([1, 2, 3, 4])
    // Move [1,3) before pos 2 — pos 2 is inside [1,3)
    expect(() => apply(state, 'splice', { pos: 2, first: 1, last: 3 })).toThrow()
  })

  it('all substeps produce valid layouts', () => {
    const state = listDS.createInitialState([1, 2, 3, 4, 5])
    const steps = applySteps(state, 'splice', { pos: 0, first: 3, last: 5 })
    for (const step of steps) {
      const layout = listDS.computeLayout(step.state)
      expect(layout.elements.length).toBeGreaterThan(0)
      expect(layout.width).toBeGreaterThan(0)
    }
  })

  it('step 0 shows moved nodes below without changing pointers', () => {
    // [1, 2, 3, 4, 5] → splice(pos=0, first=2, last=4) moves [2,4) = nodes 2,3 (vals 3,4)
    const state = listDS.createInitialState([1, 2, 3, 4, 5])
    const steps = applySteps(state, 'splice', { pos: 0, first: 2, last: 4 })
    const step0 = steps[0]

    // Pointers are unchanged from original state
    expect(step0.state.headId).toBe(state.headId)
    expect(step0.state.tailId).toBe(state.tailId)
    const node2 = step0.state.nodes.find((n: any) => n.id === 2)
    expect(node2.nextId).toBe(3) // still linked to node 3
    expect(node2.prevId).toBe(1) // still linked to node 1

    // Layout: nodes 2,3 should be below the main row
    const layout = listDS.computeLayout(step0.state)
    const valueCells = layout.elements.filter(e => e.kind === 'cell' && e.id.endsWith(':value'))
    const nodeYs = new Map<number, number>()
    for (const cell of valueCells) {
      // Extract node ID from cell id like "cell:node:2:value"
      const parts = cell.id.split(':')
      nodeYs.set(Number(parts[2]), cell.y)
    }
    // Nodes 0, 1, 4 should be in the top row; nodes 2, 3 below
    const topY = nodeYs.get(0)!
    expect(nodeYs.get(1)).toBe(topY) // node 1 same row
    expect(nodeYs.get(4)).toBe(topY) // node 4 same row
    expect(nodeYs.get(2)!).toBeGreaterThan(topY) // node 2 below
    expect(nodeYs.get(3)!).toBeGreaterThan(topY) // node 3 below
  })

  it('step 0 arrows are pointer-based, not position-based', () => {
    // In the visual pre-step, nodes 0,1,4 are in the top row but 1 and 4
    // are NOT connected (1.next→2 which is below, not →4). There should
    // be no arrow connecting nodes 1 and 4 directly.
    const state = listDS.createInitialState([1, 2, 3, 4, 5])
    const steps = applySteps(state, 'splice', { pos: 0, first: 2, last: 4 })
    const layout = listDS.computeLayout(steps[0].state)

    // Get positions
    const valueCells = layout.elements.filter(e => e.kind === 'cell' && e.id.endsWith(':value'))
    const nodeXs = new Map<number, number>()
    for (const cell of valueCells) {
      const parts = cell.id.split(':')
      nodeXs.set(Number(parts[2]), cell.x)
    }
    const node1X = nodeXs.get(1)!
    const node4X = nodeXs.get(4)!

    // There should be arrows from node 1's next-ptr cell going DOWN (to node 2 below),
    // not RIGHT to node 4. Check no arrow starts from node 1's next zone and ends at node 4's zone.
    const node1NextDotXApprox = node1X + 100 // rough: past value and next cells
    const suspectArrows = layout.arrows.filter(a =>
      Math.abs(a.fromX - node1NextDotXApprox) < 50 &&
      Math.abs(a.toX - node4X) < 50 &&
      Math.abs(a.fromY - a.toY) < 5 // same-row horizontal arrow
    )
    expect(suspectArrows.length).toBe(0)
  })

  it('step 0 floating nodes are spread horizontally', () => {
    const state = listDS.createInitialState([1, 2, 3, 4, 5])
    const steps = applySteps(state, 'splice', { pos: 0, first: 2, last: 4 })
    const layout = listDS.computeLayout(steps[0].state)
    const valueCells = layout.elements.filter(e => e.kind === 'cell' && e.id.endsWith(':value'))
    // Nodes 2 and 3 should have different X positions
    const node2Cell = valueCells.find(e => e.id === 'cell:node:2:value')!
    const node3Cell = valueCells.find(e => e.id === 'cell:node:3:value')!
    expect(node2Cell.x).not.toBe(node3Cell.x)
  })
})

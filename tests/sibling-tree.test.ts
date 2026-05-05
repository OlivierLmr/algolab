import { describe, it, expect } from 'vitest'
import { siblingTreeDS, parseInlineTree, type SiblingTreeState } from '../src/datastructures/sibling-tree.ts'

/** Get a node by label from a state. */
function nodeByLabel(state: SiblingTreeState, label: string) {
  const node = state.nodes.find(n => n.label === label)
  if (!node) throw new Error(`No node with label ${label}`)
  return node
}

/** Walk siblings from a starting node, return the labels in order. */
function siblingChain(state: SiblingTreeState, startLabel: string): string[] {
  const labels: string[] = []
  let current: number | null = nodeByLabel(state, startLabel).id
  const visited = new Set<number>()
  while (current !== null && !visited.has(current)) {
    visited.add(current)
    const node = state.nodes.find(n => n.id === current)!
    labels.push(node.label)
    current = node.siblingId
  }
  return labels
}

describe('sibling-tree: parser', () => {
  it('empty input produces empty tree', () => {
    const state = parseInlineTree('')
    expect(state.nodes).toEqual([])
    expect(state.rootId).toBeNull()
  })

  it('whitespace-only input produces empty tree', () => {
    const state = parseInlineTree('   ')
    expect(state.nodes).toEqual([])
    expect(state.rootId).toBeNull()
  })

  it('single node', () => {
    const state = parseInlineTree('A')
    expect(state.nodes.length).toBe(1)
    const a = nodeByLabel(state, 'A')
    expect(a.label).toBe('A')
    expect(a.parentId).toBeNull()
    expect(a.firstChildId).toBeNull()
    expect(a.siblingId).toBeNull()
    expect(state.rootId).toBe(a.id)
  })

  it('root with one child', () => {
    const state = parseInlineTree('A(B)')
    expect(state.nodes.length).toBe(2)
    const a = nodeByLabel(state, 'A')
    const b = nodeByLabel(state, 'B')
    expect(a.firstChildId).toBe(b.id)
    expect(b.parentId).toBe(a.id)
    expect(b.siblingId).toBeNull()
  })

  it('root with three siblings', () => {
    const state = parseInlineTree('A(B,C,D)')
    expect(state.nodes.length).toBe(4)
    const a = nodeByLabel(state, 'A')
    const b = nodeByLabel(state, 'B')
    const c = nodeByLabel(state, 'C')
    const d = nodeByLabel(state, 'D')
    expect(a.firstChildId).toBe(b.id)
    expect(b.siblingId).toBe(c.id)
    expect(c.siblingId).toBe(d.id)
    expect(d.siblingId).toBeNull()
    expect(b.parentId).toBe(a.id)
    expect(c.parentId).toBe(a.id)
    expect(d.parentId).toBe(a.id)
    expect(siblingChain(state, 'B')).toEqual(['B', 'C', 'D'])
  })

  it('reference example A(B,C(E),D)', () => {
    const state = parseInlineTree('A(B,C(E),D)')
    expect(state.nodes.length).toBe(5)
    const a = nodeByLabel(state, 'A')
    const b = nodeByLabel(state, 'B')
    const c = nodeByLabel(state, 'C')
    const d = nodeByLabel(state, 'D')
    const e = nodeByLabel(state, 'E')

    // Tree shape
    expect(state.rootId).toBe(a.id)
    expect(a.parentId).toBeNull()
    expect(a.firstChildId).toBe(b.id)
    expect(a.siblingId).toBeNull()

    // Children of A linked as siblings
    expect(siblingChain(state, 'B')).toEqual(['B', 'C', 'D'])
    expect(b.parentId).toBe(a.id)
    expect(c.parentId).toBe(a.id)
    expect(d.parentId).toBe(a.id)

    // E is child of C
    expect(c.firstChildId).toBe(e.id)
    expect(e.parentId).toBe(c.id)
    expect(e.firstChildId).toBeNull()
    expect(e.siblingId).toBeNull()

    // B and D are leaves
    expect(b.firstChildId).toBeNull()
    expect(d.firstChildId).toBeNull()
  })

  it('multi-character labels', () => {
    const state = parseInlineTree('foo(bar,baz)')
    expect(state.nodes.map(n => n.label).sort()).toEqual(['bar', 'baz', 'foo'])
    const foo = nodeByLabel(state, 'foo')
    expect(foo.firstChildId).toBe(nodeByLabel(state, 'bar').id)
  })

  it('tolerates whitespace', () => {
    const state = parseInlineTree('  A ( B , C ( E ) , D )  ')
    expect(state.nodes.length).toBe(5)
    expect(siblingChain(state, 'B')).toEqual(['B', 'C', 'D'])
  })

  it('throws on unclosed paren', () => {
    expect(() => parseInlineTree('A(B,C')).toThrow()
  })

  it('throws on stray closing paren', () => {
    expect(() => parseInlineTree('A)')).toThrow()
  })

  it('throws on multiple roots', () => {
    expect(() => parseInlineTree('A,B')).toThrow()
  })

  it('throws on empty children list', () => {
    expect(() => parseInlineTree('A()')).toThrow()
  })
})

describe('sibling-tree: createInitialState', () => {
  it('accepts inline tree string', () => {
    const state = siblingTreeDS.createInitialState('A(B)')
    expect(state.nodes.length).toBe(2)
  })

  it('default input parses correctly', () => {
    expect(siblingTreeDS.defaultInput).toBeDefined()
    const state = siblingTreeDS.createInitialState(siblingTreeDS.defaultInput!)
    expect(state.nodes.length).toBeGreaterThan(0)
  })
})

describe('sibling-tree: operations', () => {
  it('exposes no operations', () => {
    expect(siblingTreeDS.operations).toEqual([])
  })
})

describe('sibling-tree: layout', () => {
  it('produces tree-circle elements for each node', () => {
    const state = siblingTreeDS.createInitialState('A(B,C(E),D)')
    const layout = siblingTreeDS.computeLayout(state)
    const circles = layout.elements.filter(e => e.kind === 'tree-circle')
    expect(circles.length).toBe(5)
  })

  it('produces 4 in-memory cells per node', () => {
    const state = siblingTreeDS.createInitialState('A(B,C(E),D)')
    const layout = siblingTreeDS.computeLayout(state)
    const cells = layout.elements.filter(e => e.kind === 'cell')
    expect(cells.length).toBe(5 * 4)
  })

  it('tree edges have no arrowhead', () => {
    const state = siblingTreeDS.createInitialState('A(B,C(E),D)')
    const layout = siblingTreeDS.computeLayout(state)
    const treeEdges = layout.arrows.filter(a => a.noArrowhead)
    // 4 tree edges: A-B, A-C, A-D, C-E
    expect(treeEdges.length).toBe(4)
  })

  it('in-memory arrows have arrowheads', () => {
    const state = siblingTreeDS.createInitialState('A(B,C(E),D)')
    const layout = siblingTreeDS.computeLayout(state)
    const ptrArrows = layout.arrows.filter(a => !a.noArrowhead)
    // For A(B,C(E),D): 4 children point parent → A; A points first_child → B;
    // sibling chain B→C→D (2 arrows); C points first_child → E; E points parent → C.
    // Total: 4 (parent-from-children excluding root: B,C,D,E) + 2 (first_child: A,C) + 2 (sibling: B,C)
    // = 4 + 2 + 2 = 8
    expect(ptrArrows.length).toBe(8)
  })

  it('empty tree produces an empty layout', () => {
    const state = siblingTreeDS.createInitialState('')
    const layout = siblingTreeDS.computeLayout(state)
    expect(layout.elements.length).toBe(0)
    expect(layout.arrows.length).toBe(0)
    expect(layout.width).toBeGreaterThan(0)
    expect(layout.height).toBeGreaterThan(0)
  })

  it('single node has no arrows and one circle + 4 cells', () => {
    const state = siblingTreeDS.createInitialState('A')
    const layout = siblingTreeDS.computeLayout(state)
    expect(layout.elements.filter(e => e.kind === 'tree-circle').length).toBe(1)
    expect(layout.elements.filter(e => e.kind === 'cell').length).toBe(4)
    expect(layout.arrows.length).toBe(0)
  })

  it('field labels appear once', () => {
    const state = siblingTreeDS.createInitialState('A(B,C(E),D)')
    const layout = siblingTreeDS.computeLayout(state)
    const labelEls = layout.elements.filter(e => e.kind === 'array-label')
    // 4 field labels: label, parent, first_child, sibling
    expect(labelEls.length).toBe(4)
  })
})

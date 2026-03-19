import { describe, it, expect } from 'vitest'
import { computeSceneLayout } from '../src/layout/scene.ts'
import { layoutArray, arrayGroupHeight, arrayGroupWidth } from '../src/layout/array-layout.ts'
import { layoutVariables, variablesRowHeight } from '../src/layout/variables-layout.ts'
import { callStackHeight } from '../src/layout/callstack-layout.ts'
import { CELL_SIZE, CELL_GAP, CONTENT_X, CONTENT_Y, POINTER_SPACE } from '../src/layout/constants.ts'
import { compilePipeline } from '../src/dsl/index.ts'
import type { Step, TrackedArray, CallFrame } from '../src/types.ts'
import type { CellData, VariableData, FrameData, FlatElement } from '../src/layout/types.ts'

function makeArray(name: string, values: number[]): TrackedArray {
  return { name, values: values.map(n => ({ num: n, arrays: [] })) }
}

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    arrays: [],
    highlights: [],
    varHighlights: [],
    dimRanges: [],
    gaugeArrays: [],
    variables: {},
    callStack: [],
    currentLine: 1,
    description: '',
    ...overrides,
  }
}

describe('arrayGroupHeight / arrayGroupWidth', () => {
  it('returns correct height', () => {
    expect(arrayGroupHeight()).toBeGreaterThan(CELL_SIZE)
  })

  it('returns correct width for given length', () => {
    expect(arrayGroupWidth(5)).toBe(5 * CELL_SIZE + 4 * CELL_GAP)
    expect(arrayGroupWidth(1)).toBe(CELL_SIZE)
    expect(arrayGroupWidth(0)).toBe(0)
  })
})

describe('layoutArray', () => {
  it('creates label + cell children', () => {
    const arr = makeArray('arr', [3, 1, 4])
    const node = layoutArray(arr, 40, 100, [], [], [])

    expect(node.id).toBe('array:arr')
    expect(node.kind).toBe('group')
    expect(node.children).toHaveLength(4) // 1 label + 3 cells

    const label = node.children![0]
    expect(label.kind).toBe('array-label')
    expect((label.data as { text: string }).text).toBe('arr')

    const cells = node.children!.filter(c => c.kind === 'cell')
    expect(cells).toHaveLength(3)
    expect((cells[0].data as CellData).value.num).toBe(3)
    expect((cells[1].data as CellData).value.num).toBe(1)
    expect((cells[2].data as CellData).value.num).toBe(4)
  })

  it('positions cells in a horizontal row', () => {
    const arr = makeArray('arr', [1, 2, 3])
    const node = layoutArray(arr, 40, 100, [], [], [])
    const cells = node.children!.filter(c => c.kind === 'cell')

    for (let i = 0; i < cells.length; i++) {
      expect(cells[i].x).toBe(40 + i * (CELL_SIZE + CELL_GAP))
    }
    // All cells at same y
    expect(new Set(cells.map(c => c.y)).size).toBe(1)
  })

  it('marks highlighted cells', () => {
    const arr = makeArray('arr', [1, 2, 3])
    const highlights = [{ arrayName: 'arr', indices: [1], type: 'compare' as const }]
    const node = layoutArray(arr, 40, 100, highlights, [], [])
    const cells = node.children!.filter(c => c.kind === 'cell')

    expect((cells[0].data as CellData).highlightType).toBeUndefined()
    expect((cells[1].data as CellData).highlightType).toBe('compare')
    expect((cells[2].data as CellData).highlightType).toBeUndefined()
  })

  it('marks dimmed cells', () => {
    const arr = makeArray('arr', [1, 2, 3, 4])
    const dimRanges = [{ arrayName: 'arr', from: 0, to: 1 }]
    const node = layoutArray(arr, 40, 100, [], dimRanges, [])
    const cells = node.children!.filter(c => c.kind === 'cell')

    expect((cells[0].data as CellData).dimmed).toBe(true)
    expect((cells[1].data as CellData).dimmed).toBe(true)
    expect((cells[2].data as CellData).dimmed).toBe(false)
    expect((cells[3].data as CellData).dimmed).toBe(false)
  })

  it('computes gauge ratios', () => {
    const arr = makeArray('arr', [10, 20, 30])
    const node = layoutArray(arr, 40, 100, [], [], ['arr'])
    const cells = node.children!.filter(c => c.kind === 'cell')

    expect((cells[0].data as CellData).gaugeRatio).toBeCloseTo(0)
    expect((cells[1].data as CellData).gaugeRatio).toBeCloseTo(0.5)
    expect((cells[2].data as CellData).gaugeRatio).toBeCloseTo(1)
  })
})

describe('layoutVariables', () => {
  it('lays out non-pointer variables', () => {
    const variables = {
      max: { num: 5, arrays: [] },
      i: { num: 2, arrays: ['arr'] },  // pointer, should be excluded
    }
    const node = layoutVariables(variables, [], new Set(), 40, 200)
    expect(node).not.toBeNull()
    expect(node!.children).toHaveLength(1)
    expect((node!.children![0].data as VariableData).name).toBe('max')
  })

  it('returns null when no displayable variables', () => {
    const variables = { i: { num: 0, arrays: ['arr'] } }
    const node = layoutVariables(variables, [], new Set(), 40, 200)
    expect(node).toBeNull()
  })

  it('excludes pointer names', () => {
    const variables = {
      x: { num: 1, arrays: [] },
      y: { num: 2, arrays: [] },
    }
    const node = layoutVariables(variables, [], new Set(['y']), 40, 200)
    expect(node!.children).toHaveLength(1)
    expect((node!.children![0].data as VariableData).name).toBe('x')
  })
})

describe('variablesRowHeight', () => {
  it('returns positive height for non-zero count', () => {
    expect(variablesRowHeight(3)).toBeGreaterThan(0)
  })

  it('returns 0 for zero count', () => {
    expect(variablesRowHeight(0)).toBe(0)
  })
})

describe('callStackHeight', () => {
  it('returns 0 for empty call stack', () => {
    expect(callStackHeight([], new Set())).toBe(0)
  })

  it('returns positive height for non-empty call stack', () => {
    const frame: CallFrame = {
      label: 'swap(i, j)',
      variables: {},
      arrayRefs: [],
      arrays: [],
      highlights: [],
      varHighlights: [],
      dimRanges: [],
      gaugeArrays: [],
    }
    expect(callStackHeight([frame], new Set())).toBeGreaterThan(0)
  })
})

describe('computeSceneLayout', () => {
  it('produces correct layout for simple step', () => {
    const step = makeStep({
      arrays: [makeArray('arr', [5, 3, 1])],
      variables: { i: { num: 0, arrays: ['arr'] } },
    })
    const colorMap = new Map([['i', '#e74c3c']])
    const layout = computeSceneLayout(step, colorMap)

    // Should have one array group node
    const arrayNodes = layout.nodes.filter(n => n.id.startsWith('array:'))
    expect(arrayNodes).toHaveLength(1)
    expect(arrayNodes[0].id).toBe('array:arr')

    // Should have pointer edge from i to arr[0]
    expect(layout.edges.length).toBeGreaterThan(0)
    const edge = layout.edges.find(e => e.id === 'ptr:i:arr')
    expect(edge).toBeDefined()
    expect(edge!.to).toBe('cell:arr:0')
    expect(edge!.color).toBe('#e74c3c')
    expect(edge!.label).toBe('i=0')
  })

  it('includes variable nodes for non-pointer vars', () => {
    const step = makeStep({
      arrays: [makeArray('arr', [1, 2])],
      variables: {
        i: { num: 0, arrays: ['arr'] },
        max: { num: 5, arrays: [] },
      },
    })
    const colorMap = new Map([['i', '#e74c3c']])
    const layout = computeSceneLayout(step, colorMap)

    const varGroup = layout.nodes.find(n => n.id === 'variables')
    expect(varGroup).toBeDefined()
    expect(varGroup!.children).toHaveLength(1)
    expect((varGroup!.children![0].data as VariableData).name).toBe('max')
  })

  it('has positive dimensions', () => {
    const step = makeStep({
      arrays: [makeArray('arr', [1, 2, 3])],
    })
    const layout = computeSceneLayout(step, new Map())
    expect(layout.width).toBeGreaterThan(0)
    expect(layout.height).toBeGreaterThan(0)
  })

  it('first array starts at expected position', () => {
    const step = makeStep({
      arrays: [makeArray('arr', [1, 2])],
    })
    const layout = computeSceneLayout(step, new Map())
    const arrNode = layout.nodes.find(n => n.id === 'array:arr')
    expect(arrNode).toBeDefined()
    expect(arrNode!.x).toBe(CONTENT_X)
    expect(arrNode!.y).toBe(CONTENT_Y + POINTER_SPACE)
  })
})

describe('computeSceneLayout with call stack', () => {
  it('includes frame nodes', () => {
    const frame: CallFrame = {
      label: 'partition(0, 4)',
      variables: { i: { num: 0, arrays: ['arr'] } },
      arrayRefs: [{ paramName: 'arr', targetName: 'arr' }],
      arrays: [],
      highlights: [],
      varHighlights: [],
      dimRanges: [],
      gaugeArrays: [],
    }
    const step = makeStep({
      arrays: [makeArray('arr', [5, 3, 1])],
      variables: {},
      callStack: [frame],
    })
    const colorMap = new Map([['i', '#e74c3c']])
    const layout = computeSceneLayout(step, colorMap)

    const frameNode = layout.nodes.find(n => n.kind === 'frame')
    expect(frameNode).toBeDefined()
    expect((frameNode!.data as FrameData).label).toBe('partition(0, 4)')
    expect((frameNode!.data as FrameData).isInnermost).toBe(true)
  })
})

describe('computeSceneLayout: pointer visibility scoping', () => {
  it('during function call, only innermost frame vars shown as global pointers', () => {
    const source = `algo QuickSelect(arr[])
  def partition(lo, hi)
    let i = lo - 1
    let j = hi
    let done = 0
    while done == 0
      i = i + 1
      while arr[i] < arr[hi]
        i = i + 1
      j = j - 1
      while j > lo and arr[hi] < arr[j]
        j = j - 1
      if i >= j
        done = 1
      else
        swap arr[i], arr[j]
    swap arr[i], arr[hi]
    return i

  let k = 2
  #: pointer k on arr at k
  let lo = 0
  let hi = len(arr) - 1
  let found = 0
  while hi > lo and found == 0
    let p = lo + (hi - lo) / 2
    swap arr[hi], arr[p]
    let pivotIdx = partition(lo, hi)
    if pivotIdx < k
      lo = pivotIdx + 1
    else
      if pivotIdx > k
        hi = pivotIdx - 1
      else
        found = 1`

    const { steps, colorMap } = compilePipeline(source, 'arr', [5, 3, 4, 1, 2])

    // Find step during partition call where pivotIdx exists as global
    const stepInPartition = steps.find(s =>
      s.callStack.length > 0 &&
      'pivotIdx' in s.variables &&
      s.variables['pivotIdx'].arrays.length > 0
    )
    if (stepInPartition) {
      const layout = computeSceneLayout(stepInPartition, colorMap)
      const pivotEdge = layout.edges.find(e => e.id.startsWith('ptr:pivotIdx'))
      expect(pivotEdge).toBeUndefined()
    }
  })
})

describe('flatElements', () => {
  it('contains all leaf elements with unique ids', () => {
    const step = makeStep({
      arrays: [makeArray('arr', [5, 3, 1])],
      variables: { max: { num: 5, arrays: [] } },
    })
    const layout = computeSceneLayout(step, new Map())
    const ids = layout.flatElements.map(e => e.id)

    // All ids unique
    expect(new Set(ids).size).toBe(ids.length)

    // Contains expected elements
    expect(ids).toContain('label:arr')
    expect(ids).toContain('cell:arr:0')
    expect(ids).toContain('cell:arr:1')
    expect(ids).toContain('cell:arr:2')
    expect(ids).toContain('var:max')
  })

  it('does not contain group nodes (only leaves)', () => {
    const step = makeStep({
      arrays: [makeArray('arr', [1, 2])],
    })
    const layout = computeSceneLayout(step, new Map())
    const kinds = new Set(layout.flatElements.map(e => e.kind))
    expect(kinds).not.toContain('group')
  })

  it('all leaf elements have opacity 1.0 when no call stack', () => {
    const step = makeStep({
      arrays: [makeArray('arr', [1])],
      variables: { x: { num: 0, arrays: [] } },
    })
    const layout = computeSceneLayout(step, new Map())
    for (const el of layout.flatElements) {
      expect(el.opacity).toBe(1.0)
    }
  })

  it('frame contents have dimmed opacity for non-innermost frames', () => {
    const outerFrame: CallFrame = {
      label: 'qsort(0, 4)',
      variables: { lo: { num: 0, arrays: [] } },
      arrayRefs: [],
      arrays: [],
      highlights: [],
      varHighlights: [],
      dimRanges: [],
      gaugeArrays: [],
    }
    const innerFrame: CallFrame = {
      label: 'partition(0, 4)',
      variables: { i: { num: 0, arrays: [] } },
      arrayRefs: [],
      arrays: [],
      highlights: [],
      varHighlights: [],
      dimRanges: [],
      gaugeArrays: [],
    }
    const step = makeStep({
      arrays: [makeArray('arr', [1, 2])],
      callStack: [outerFrame, innerFrame],
    })
    const layout = computeSceneLayout(step, new Map())

    // Outer frame box itself has opacity 1.0
    const outerFrameEl = layout.flatElements.find(e => e.id === 'frame:0')
    expect(outerFrameEl).toBeDefined()
    expect(outerFrameEl!.opacity).toBe(1.0)

    // Outer frame's variables have dimmed opacity (0.35)
    const outerVar = layout.flatElements.find(e => e.id === 'frame:0:var:lo')
    expect(outerVar).toBeDefined()
    expect(outerVar!.opacity).toBe(0.35)

    // Inner frame's variables have full opacity (1.0)
    const innerVar = layout.flatElements.find(e => e.id === 'frame:1:var:i')
    expect(innerVar).toBeDefined()
    expect(innerVar!.opacity).toBe(1.0)
  })

  it('ids are stable across steps with same arrays', () => {
    const step1 = makeStep({
      arrays: [makeArray('arr', [5, 3, 1])],
      variables: { i: { num: 0, arrays: ['arr'] } },
    })
    const step2 = makeStep({
      arrays: [makeArray('arr', [5, 1, 3])],
      variables: { i: { num: 1, arrays: ['arr'] } },
    })
    const colorMap = new Map([['i', '#e74c3c']])
    const layout1 = computeSceneLayout(step1, colorMap)
    const layout2 = computeSceneLayout(step2, colorMap)

    const ids1 = new Set(layout1.flatElements.map(e => e.id))
    const ids2 = new Set(layout2.flatElements.map(e => e.id))

    // Same structural elements present in both
    expect(ids1).toEqual(ids2)
  })
})

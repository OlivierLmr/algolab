import { describe, it, expect } from 'vitest'
import { runAlgorithm } from '../src/dsl/index.ts'

describe('ref() built-in function', () => {
  it('returns a value with ref field set to the array name', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc map 2
  alloc target 3
  map[0] = ref(target)`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    const map = lastStep.arrays.find(a => a.name === 'map')!
    expect(map.values[0].ref).toBe('target')
  })

  it('ref value has num 0 and empty arrays', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc map 2
  alloc target 3
  map[0] = ref(target)`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    const map = lastStep.arrays.find(a => a.name === 'map')!
    expect(map.values[0].num).toBe(0)
    expect(map.values[0].arrays).toEqual([])
  })

  it('arithmetic on ref value strips the ref field', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc map 2
  alloc target 3
  map[0] = ref(target)
  let x = map[0] + 1`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    expect(lastStep.variables['x'].ref).toBeUndefined()
    expect(lastStep.variables['x'].num).toBe(1)
  })

  it('ref works with input array', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc map 2
  map[0] = ref(arr)`, 'arr', [5, 3])
    const lastStep = steps[steps.length - 1]
    const map = lastStep.arrays.find(a => a.name === 'map')!
    expect(map.values[0].ref).toBe('arr')
  })

  it('ref resolves array parameter aliases', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc map 2
  alloc target 3
  def setRef(m[], t[])
    m[0] = ref(t)
  setRef(map, target)`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    const map = lastStep.arrays.find(a => a.name === 'map')!
    expect(map.values[0].ref).toBe('target')
  })
})

describe('ref indirection (pointer dereference)', () => {
  it('read through ref: variable holding ref can be indexed', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc target 3
  target[0] = 10
  target[1] = 20
  target[2] = 30
  let ptr = ref(target)
  let val = ptr[1]`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    expect(lastStep.variables['val'].num).toBe(20)
  })

  it('write through ref: variable holding ref can be used for assignment', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc target 3
  let ptr = ref(target)
  ptr[0] = 42`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    const target = lastStep.arrays.find(a => a.name === 'target')!
    expect(target.values[0].num).toBe(42)
  })

  it('ref stored in variable then passed to function via ref variable', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc a 2
  alloc b 2
  let ptrA = ref(a)
  let ptrB = ref(b)
  ptrA[0] = 10
  ptrB[1] = 20`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    const a = lastStep.arrays.find(a => a.name === 'a')!
    const b = lastStep.arrays.find(a => a.name === 'b')!
    expect(a.values[0].num).toBe(10)
    expect(b.values[1].num).toBe(20)
  })

  it('ref read from array cell and used for indirection', () => {
    // Pattern: map stores refs, read ref into variable, index through it
    const steps = runAlgorithm(`algo Test(arr[])
  alloc map 2
  alloc c0 3
  alloc c1 3
  map[0] = ref(c0)
  map[1] = ref(c1)
  let ptr = ref(c0)
  ptr[1] = 99`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    const c0 = lastStep.arrays.find(a => a.name === 'c0')!
    expect(c0.values[1].num).toBe(99)
  })

  it('len() works through ref indirection', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc target 5
  let ptr = ref(target)
  let n = len(ptr)`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    expect(lastStep.variables['n'].num).toBe(5)
  })
})

describe('ref indirection: edge cases', () => {
  it('chained indexing through ref: map[i][j] write', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc map 2
  alloc c0 3
  alloc c1 3
  map[0] = ref(c0)
  map[1] = ref(c1)
  map[0][1] = 99
  map[1][2] = 77`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    const c0 = lastStep.arrays.find(a => a.name === 'c0')!
    const c1 = lastStep.arrays.find(a => a.name === 'c1')!
    expect(c0.values[1].num).toBe(99)
    expect(c1.values[2].num).toBe(77)
  })

  it('chained indexing through ref: map[i][j] read', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc map 2
  alloc c0 3
  map[0] = ref(c0)
  c0[2] = 55
  let val = map[0][2]`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    expect(lastStep.variables['val'].num).toBe(55)
  })

  it('multiple refs to different arrays coexist', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc a 2
  alloc b 2
  let ra = ref(a)
  let rb = ref(b)
  ra[0] = 10
  rb[0] = 20
  ra[1] = 11
  rb[1] = 21`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    const a = lastStep.arrays.find(a => a.name === 'a')!
    const b = lastStep.arrays.find(a => a.name === 'b')!
    expect(a.values.map(v => v.num)).toEqual([10, 11])
    expect(b.values.map(v => v.num)).toEqual([20, 21])
  })

  it('ref to input array works for indexing', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  let ptr = ref(arr)
  let val = ptr[0]`, 'arr', [42, 7])
    const lastStep = steps[steps.length - 1]
    expect(lastStep.variables['val'].num).toBe(42)
  })

  it('ref reassignment updates indirection target', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc a 2
  alloc b 2
  a[0] = 10
  b[0] = 20
  let ptr = ref(a)
  let v1 = ptr[0]
  ptr = ref(b)
  let v2 = ptr[0]`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    expect(lastStep.variables['v1'].num).toBe(10)
    expect(lastStep.variables['v2'].num).toBe(20)
  })

  it('swap through ref indirection', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc data 3
  data[0] = 5
  data[1] = 9
  let ptr = ref(data)
  swap ptr[0], ptr[1]`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    const data = lastStep.arrays.find(a => a.name === 'data')!
    expect(data.values[0].num).toBe(9)
    expect(data.values[1].num).toBe(5)
  })
})

describe('free keyword', () => {
  it('removes array from subsequent snapshots', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc tmp 3
  tmp[0] = 42
  free tmp
  let x = 1`, 'arr', [1])
    // After free, tmp should not appear in later steps
    const lastStep = steps[steps.length - 1]
    const tmp = lastStep.arrays.find(a => a.name === 'tmp')
    expect(tmp).toBeUndefined()
  })

  it('array exists in steps before free', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc tmp 3
  tmp[0] = 42
  free tmp
  let x = 1`, 'arr', [1])
    // Before free, tmp should exist
    const stepBeforeFree = steps.find(s =>
      s.arrays.some(a => a.name === 'tmp' && a.values[0].num === 42)
    )
    expect(stepBeforeFree).toBeDefined()
  })

  it('removes dim ranges for freed array', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc tmp 4
  dim tmp from 2 to 3
  free tmp
  let x = 1`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    expect(lastStep.arrays.find(a => a.name === 'tmp')).toBeUndefined()
  })

  it('removes gauge for freed array', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc tmp 4
  gauge tmp
  free tmp
  let x = 1`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    expect(lastStep.arrays.find(a => a.name === 'tmp')).toBeUndefined()
    expect(lastStep.gaugeArrays).not.toContain('tmp')
  })

  it('free followed by alloc of same name works', () => {
    const steps = runAlgorithm(`algo Test(arr[])
  alloc buf 2
  buf[0] = 10
  free buf
  alloc buf 4
  buf[0] = 20`, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    const buf = lastStep.arrays.find(a => a.name === 'buf')!
    expect(buf).toBeDefined()
    expect(buf.values.length).toBe(4)
    expect(buf.values[0].num).toBe(20)
  })
})

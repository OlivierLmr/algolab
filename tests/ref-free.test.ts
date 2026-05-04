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

import { describe, it, expect } from 'vitest'
import { runAlgorithm } from '../src/dsl/index.ts'

describe('alloc: persistent (heap) allocation', () => {
  it('arrays allocated with alloc inside a function survive after return', () => {
    const source = `algo Test(arr[])
  def setup()
    alloc data 3
    data[0] = 10
    data[1] = 20
    data[2] = 30

  setup()
  let x = data[1]`

    const steps = runAlgorithm(source, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    const dataArr = lastStep.arrays.find(a => a.name === 'data')
    expect(dataArr).toBeDefined()
    expect(dataArr!.values.map(v => v.num)).toEqual([10, 20, 30])
    expect(lastStep.variables['x'].num).toBe(20)
  })

  it('alloc at top level works as before', () => {
    const source = `algo Test(arr[])
  alloc buf 4
  buf[0] = 42
  buf[3] = 99`

    const steps = runAlgorithm(source, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    const buf = lastStep.arrays.find(a => a.name === 'buf')
    expect(buf).toBeDefined()
    expect(buf!.values[0].num).toBe(42)
    expect(buf!.values[3].num).toBe(99)
  })
})

describe('local: stack-scoped allocation', () => {
  it('arrays allocated with local inside a function are deleted after return', () => {
    const source = `algo Test(arr[])
  def work()
    local tmp 3
    tmp[0] = 10
    tmp[1] = 20
    tmp[2] = 30
    arr[0] = tmp[0] + tmp[1] + tmp[2]

  work()`

    const steps = runAlgorithm(source, 'arr', [0])
    const lastStep = steps[steps.length - 1]
    const tmp = lastStep.arrays.find(a => a.name === 'tmp')
    expect(tmp).toBeUndefined()
    expect(lastStep.arrays.find(a => a.name === 'arr')!.values[0].num).toBe(60)
  })

  it('local at top level works the same as alloc (no frame to scope to)', () => {
    const source = `algo Test(arr[])
  local buf 2
  buf[0] = 7
  buf[1] = 8`

    const steps = runAlgorithm(source, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    const buf = lastStep.arrays.find(a => a.name === 'buf')
    expect(buf).toBeDefined()
    expect(buf!.values[0].num).toBe(7)
  })
})

describe('alloc vs local: mixed usage in same function', () => {
  it('only local arrays are cleaned up, alloc arrays persist', () => {
    const source = `algo Test(arr[])
  def helper()
    alloc result 3
    local scratch 3
    scratch[0] = arr[0] * 2
    scratch[1] = arr[1] * 2
    scratch[2] = arr[2] * 2
    result[0] = scratch[0]
    result[1] = scratch[1]
    result[2] = scratch[2]

  helper()`

    const steps = runAlgorithm(source, 'arr', [1, 2, 3])
    const lastStep = steps[steps.length - 1]
    const result = lastStep.arrays.find(a => a.name === 'result')
    expect(result).toBeDefined()
    expect(result!.values.map(v => v.num)).toEqual([2, 4, 6])
    const scratch = lastStep.arrays.find(a => a.name === 'scratch')
    expect(scratch).toBeUndefined()
  })
})

describe('global variable access from functions', () => {
  it('functions can read and write top-level variables', () => {
    const source = `algo Test(arr[])
  let counter = 0

  def increment()
    counter = counter + 1

  increment()
  increment()
  increment()`

    const steps = runAlgorithm(source, 'arr', [1])
    const lastStep = steps[steps.length - 1]
    expect(lastStep.variables['counter'].num).toBe(3)
  })
})

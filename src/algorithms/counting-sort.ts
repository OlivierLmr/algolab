import type { AlgorithmDefinition } from '../types.ts'

export const countingSort: AlgorithmDefinition = {
  name: 'Counting Sort',
  source: `algo CountingSort(arr[])
  #: gauge arr

  #: tooltip "largest value in arr, determines count array size"
  let max = arr[0]
  for i from 1 to len(arr) - 1
    if arr[i] > max
      max = arr[i]

  #: tooltip "count[{index}] = number of elements with value {index}"
  alloc count max + 1
  #: tooltip "sorted result being built"
  alloc output len(arr)
  #: gauge output

  #: describe "Phase 1: Counting occurrences of each value"
  for i from 0 to len(arr) - 1
    #: comment "Incrementing count[{arr[i]}]"
    count[arr[i]] = count[arr[i]] + 1

  #: tooltip "running total of elements placed so far"
  let sum = 0
  #: describe "Phase 2: Converting counts to starting positions"
  for i from 0 to max
    #: tooltip "saved count before overwriting with prefix sum"
    let c = count[i]
    count[i] = sum
    sum = sum + c

  #: describe "Phase 3: Placing each element at its sorted position"
  for i from 0 to len(arr) - 1
    #: comment "Placing arr[{i}]={arr[i]} at position {count[arr[i]]}"
    output[count[arr[i]]] = arr[i]
    count[arr[i]] = count[arr[i]] + 1

  #: describe "Phase 4: Copying sorted result back to arr"
  for i from 0 to len(arr) - 1
    arr[i] = output[i]`,
  defaultInput: [4, 2, 2, 8, 3, 3, 1],
}

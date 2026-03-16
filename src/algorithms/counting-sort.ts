import type { AlgorithmDefinition } from '../types.ts'

export const countingSort: AlgorithmDefinition = {
  name: 'Counting Sort',
  source: `algo CountingSort(arr: int[])
  #: gauge arr

  let max = arr[0]
  for i from 1 to len(arr) - 1
    if arr[i] > max
      max = arr[i]

  alloc count max + 1
  alloc output len(arr)

  #: comment "Phase 1: Count occurrences"
  for i from 0 to len(arr) - 1
    #: comment "Incrementing count[{arr[i]}]"
    count[arr[i]] = count[arr[i]] + 1

  #: comment "Phase 2: Compute prefix sums (starting positions)"
  let sum = 0
  for i from 0 to max
    let c = count[i]
    count[i] = sum
    sum = sum + c

  #: comment "Phase 3: Build output array"
  for i from 0 to len(arr) - 1
    #: comment "Placing arr[{i}]={arr[i]} at position {count[arr[i]]}"
    output[count[arr[i]]] = arr[i]
    count[arr[i]] = count[arr[i]] + 1

  #: comment "Phase 4: Copy output back to arr"
  for i from 0 to len(arr) - 1
    arr[i] = output[i]`,
  defaultInput: [4, 2, 2, 8, 3, 3, 1],
}

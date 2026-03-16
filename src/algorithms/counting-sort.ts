import type { AlgorithmDefinition } from '../types.ts'

export const countingSort: AlgorithmDefinition = {
  name: 'Counting Sort',
  source: `algo CountingSort(arr: int[])

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

  #: comment "Phase 2: Compute prefix sums"
  for i from 1 to max
    count[i] = count[i] + count[i - 1]

  #: comment "Phase 3: Build output array (right to left for stability)"
  let i = len(arr) - 1
  while i >= 0
    #: comment "Placing arr[{i}]={arr[i]} at position {count[arr[i]] - 1}"
    output[count[arr[i]] - 1] = arr[i]
    count[arr[i]] = count[arr[i]] - 1
    i = i - 1

  #: comment "Phase 4: Copy output back to arr"
  for i from 0 to len(arr) - 1
    arr[i] = output[i]`,
  defaultInput: [4, 2, 2, 8, 3, 3, 1],
}

import type { AlgorithmDefinition } from '../types.ts'

export const countingSort: AlgorithmDefinition = {
  name: 'Counting Sort',
  source: `algo CountingSort(arr[])
  #: gauge arr

  #: tooltip "largest value in arr, determines count array size"
  let max = arr[0]
  #: describe "Finding the maximum value in arr"
  for i from 1 to len(arr) - 1
    #: comment "arr[{$*i}] = {$*arr[i]} {arr[i] > max ? '> ' : '<= '}{$=max}{arr[i] > max ? ', new maximum' : ', unchanged'}"
    if arr[i] > max
      max = arr[i]

  #: comment "Maximum value is {$=max}; allocating count array of size {max + 1}"
  #: tooltip "count[v] = number of elements with value v"
  alloc count max + 1
  #: tooltip "sorted result being built"
  alloc output len(arr)
  #: gauge output

  #: describe "Phase 1: Counting occurrences of each value"
  for i from 0 to len(arr) - 1
    #: comment "arr[{$*i}] = {$*arr[i]}: incrementing count[{$*arr[i]}]"
    count[arr[i]] = count[arr[i]] + 1

  #: tooltip "running total of elements placed so far"
  let sum = 0
  #: describe "Phase 2: Converting counts to starting positions (prefix sums)"
  for i from 0 to max
    #: tooltip "saved count before overwriting with prefix sum"
    let c = count[i]
    #: comment "count[{$*i}] had {$=c} occurrence(s); prefix sum {$=sum} becomes its starting position"
    count[i] = sum
    sum = sum + c

  #: describe "Phase 3: Placing each element at its sorted position"
  for i from 0 to len(arr) - 1
    #: comment "Placing {$*arr[i]} at output[{$*count[arr[i]]}]"
    output[count[arr[i]]] = arr[i]
    count[arr[i]] = count[arr[i]] + 1

  #: describe "Phase 4: Copying sorted result back to arr"
  for i from 0 to len(arr) - 1
    #: comment "arr[{$*i}] = {$*output[i]}"
    arr[i] = output[i]`,
  defaultInput: [4, 2, 2, 8, 3, 3, 1],
}

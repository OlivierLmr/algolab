import type { AlgorithmDefinition } from '../types.ts'

export const selectionSort: AlgorithmDefinition = {
  name: 'Selection Sort',
  source: `algo SelectionSort(arr[])
  #: gauge arr
  #: tooltip "index where the next minimum will be placed"
  #: describe "Finding minimum in arr[{i}..{len(arr) - 1}]"
  for i from 0 to len(arr) - 2
    #: tooltip "index of the smallest element found so far"
    let min = i
    #: tooltip "scanning position"
    #: describe "Scanning for a smaller element"
    for j from i + 1 to len(arr) - 1
      #: comment "{arr[j]} < {arr[min]}? {arr[j] < arr[min] ? 'Yes, new minimum' : 'No'}"
      if arr[j] < arr[min]
        min = j
    #: comment "Minimum is {arr[min]} at index {min}: {min != i ? 'swapping into position' : 'already in place'}"
    if min != i
      swap arr[i], arr[min]
    #: dim arr from 0 to i`,
  defaultInput: [5, 3, 8, 1, 2],
}

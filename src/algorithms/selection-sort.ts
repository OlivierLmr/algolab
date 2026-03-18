import type { AlgorithmDefinition } from '../types.ts'

export const selectionSort: AlgorithmDefinition = {
  name: 'Selection Sort',
  source: `algo SelectionSort(arr[])
  #: gauge arr
  for i from 0 to len(arr) - 2
    #: comment "Looking for minimum in arr[{i}..{len(arr) - 1}]"
    let min = i
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

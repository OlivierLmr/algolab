import type { AlgorithmDefinition } from '../types.ts'

export const bubbleSort: AlgorithmDefinition = {
  name: 'Bubble Sort',
  source: `algo BubbleSort(arr: int[])
  for i from 0 to len(arr) - 2
    #: pointer "n-2-i" on arr at len(arr) - 1 - i
    for j from 0 to len(arr) - 2 - i
      #: comment "Comparing {arr[j]} and {arr[j + 1]}: {arr[j] > arr[j + 1] ? 'need to swap' : 'already in order'}"
      if arr[j] > arr[j + 1]
        #: comment "Swapping {arr[j]} and {arr[j + 1]}"
        swap arr[j], arr[j + 1]
    #: dim arr from len(arr) - 1 - i to len(arr) - 1`,
  defaultInput: [5, 3, 8, 1, 2],
}

import type { AlgorithmDefinition } from '../types.ts'

export const bubbleSort: AlgorithmDefinition = {
  name: 'Bubble Sort',
  source: `algo BubbleSort(arr: int[])
  #: gauge arr
  for i from 0 to len(arr) - 2
    #: comment "Pass {i + 1}: bubbling through arr[0..{len(arr) - 2 - i}]"
    #: pointer "n-2-i" on arr at len(arr) - 1 - i
    for j from 0 to len(arr) - 2 - i
      #: comment "{arr[j]} > {arr[j + 1]}? {arr[j] > arr[j + 1] ? 'Yes, swapping' : 'No, moving on'}"
      if arr[j] > arr[j + 1]
        swap arr[j], arr[j + 1]
    #: dim arr from len(arr) - 1 - i to len(arr) - 1`,
  defaultInput: [5, 3, 8, 1, 2],
}

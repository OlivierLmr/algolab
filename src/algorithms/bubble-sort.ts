import type { AlgorithmDefinition } from '../types.ts'

export const bubbleSort: AlgorithmDefinition = {
  name: 'Bubble Sort',
  source: `algo BubbleSort(arr[])
  #: gauge arr
  #: tooltip "pass number (0-based)"
  for i from 0 to len(arr) - 2
    #: describe "Pass {i + 1}: bubbling largest to the end"
    #: pointer "n-2-i" on arr at len(arr) - 1 - i
    #: tooltip "position being compared"
    for j from 0 to len(arr) - 2 - i
      #: describe "Comparing adjacent elements"
      #: comment "{arr[j]} > {arr[j + 1]}? {arr[j] > arr[j + 1] ? 'Yes, swapping' : 'No, moving on'}"
      if arr[j] > arr[j + 1]
        swap arr[j], arr[j + 1]
    #: dim arr from len(arr) - 1 - i to len(arr) - 1`,
  defaultInput: [5, 3, 8, 1, 2],
}

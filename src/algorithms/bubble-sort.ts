import type { AlgorithmDefinition } from '../types.ts'

export const bubbleSort: AlgorithmDefinition = {
  name: 'Bubble Sort',
  source: `algo BubbleSort(arr: int[])
  for i from 0 to len(arr) - 2
    for j from 0 to len(arr) - 2 - i
      if arr[j] > arr[j + 1]
        swap arr[j], arr[j + 1]`,
  defaultInput: [5, 3, 8, 1, 2],
}

import type { AlgorithmDefinition } from '../types.ts'

export const insertionSort: AlgorithmDefinition = {
  name: 'Insertion Sort',
  source: `algo InsertionSort(arr: int[])
  for i from 1 to len(arr) - 1
    let key = arr[i]
    let j = i - 1
    while j >= 0 and arr[j] > key
      arr[j + 1] = arr[j]
      j = j - 1
    arr[j + 1] = key`,
  defaultInput: [5, 3, 8, 1, 2],
}

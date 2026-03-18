import type { AlgorithmDefinition } from '../types.ts'

export const insertionSort: AlgorithmDefinition = {
  name: 'Insertion Sort',
  source: `algo InsertionSort(arr[])
  #: gauge arr
  for i from 1 to len(arr) - 1
    #: comment "Picking arr[{i}] = {arr[i]} as key to insert"
    let key = arr[i]
    let j = i - 1
    while j >= 0 and arr[j] > key
      #: comment "Shifting {arr[j]} right to make room for {key}"
      arr[j + 1] = arr[j]
      j = j - 1
    #: comment "Inserting {key} at position {j + 1}"
    arr[j + 1] = key`,
  defaultInput: [5, 3, 8, 1, 2],
}

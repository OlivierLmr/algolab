import type { AlgorithmDefinition } from '../types.ts'

export const insertionSort: AlgorithmDefinition = {
  name: 'Insertion Sort',
  source: `algo InsertionSort(arr[])
  #: gauge arr
  #: tooltip "index of the element being inserted"
  for i from 1 to len(arr) - 1
    #: describe "Inserting arr[{i}] = {arr[i]} into sorted prefix"
    #: tooltip "value being inserted into the sorted portion"
    let key = arr[i]
    #: tooltip "position being checked for insertion"
    let j = i - 1
    while j >= 0 and arr[j] > key
      #: describe "Shifting elements right to make room"
      #: comment "Shifting {arr[j]} right to make room for {key}"
      arr[j + 1] = arr[j]
      j = j - 1
    #: comment "Inserting {key} at position {j + 1}"
    arr[j + 1] = key`,
  defaultInput: [5, 3, 8, 1, 2],
}

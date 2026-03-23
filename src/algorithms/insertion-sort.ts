import type { AlgorithmDefinition } from '../types.ts'

export const insertionSort: AlgorithmDefinition = {
  name: 'Insertion Sort',
  source: `algo InsertionSort(arr[])
  #: gauge arr
  #: tooltip "index of the element being inserted"
  #: describe "Inserting arr[{$i}] = {$arr[i]} into sorted prefix"
  for i from 1 to len(arr) - 1
    #: tooltip "value being inserted into the sorted portion"
    let key = arr[i]
    #: tooltip "position being checked for insertion"
    let j = i - 1
    #: comment "{$j} >= 0 and {$arr[j]} > {$key}: {j >= 0 and arr[j] > key ? 'shift right and continue' : 'stop, insertion point found'}"
    #: describe "Shifting elements right to make room"
    while j >= 0 and arr[j] > key
      #: comment "Shifting {$arr[j]} one position right to make room for {$key}"
      arr[j + 1] = arr[j]
      j = j - 1
    #: comment "Inserting {$key} at position {j + 1}"
    arr[j + 1] = key`,
  defaultInput: [5, 3, 8, 1, 2],
}

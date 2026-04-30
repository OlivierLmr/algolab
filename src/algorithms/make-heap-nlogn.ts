import type { AlgorithmDefinition } from '../types.ts'

export const makeHeapNlogn: AlgorithmDefinition = {
  name: 'Make Heap O(n log n)',
  source: `algo MakeHeapNlogn(arr[])
  #: stepover
  def parent(i)
    return (i - 1) / 2

  def sift_up(i)
    #: describe "Sifting up element {$*arr[i]} at position {$=i}"
    while i > 0 and arr[parent(i)] < arr[i]
      let p = parent(i)
      #: comment "arr[{$*i}] = {$*arr[i]} > arr[{$*p}] = {$*arr[p]}, swapping"
      swap arr[i], arr[p]
      i = p

  #: describe "Inserting element {$*arr[i]} at position {$=i} into the heap"
  for i from 1 to len(arr) - 1
    sift_up(i)`,
  defaultInput: [4, 10, 3, 5, 1, 8, 7, 2, 9, 6],
}

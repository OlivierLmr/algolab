import type { AlgorithmDefinition } from '../types.ts'

export const makeHeapNlogn: AlgorithmDefinition = {
  name: 'Make Heap O(n log n)',
  source: `algo MakeHeapNlogn(arr[])
  #: stepover
  def parent(i)
    return (i - 1) / 2

  #: describe "Sifting up element {$*arr[i]} = {$*arr[i]} at position {$=i}"
  def sift_up(i)
    #: comment "Parent of {$=i} is {$=parent(i)}. arr[{$*parent(i)}] = {$*arr[parent(i)]} {arr[parent(i)] < arr[i] ? '< ' : '>= '} arr[{$*i}] = {$*arr[i]}: {i > 0 and arr[parent(i)] < arr[i] ? 'heap violated, must sift up' : 'heap property satisfied, done'}"
    #: describe "Comparing with parent"
    while i > 0 and arr[parent(i)] < arr[i]
      let p = parent(i)
      #: comment "Swapping arr[{$*i}] = {$*arr[i]} with its parent arr[{$*p}] = {$*arr[p]}"
      swap arr[i], arr[p]
      i = p

  #: heap max arr
  #: comment "Element arr[0] = {$*arr[0]} is already a valid heap of size 1"
  #: describe "Inserting element arr[{$*i}] = {$*arr[i]} into the heap"
  for i from 1 to len(arr) - 1
    #: comment "Calling sift_up({$=i}) to restore heap property for newly inserted element {$*arr[i]}"
    sift_up(i)`,
  defaultInput: [4, 10, 3, 5, 1, 8, 7, 2, 9, 6],
}

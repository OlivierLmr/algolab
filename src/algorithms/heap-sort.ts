import type { AlgorithmDefinition } from '../types.ts'

export const heapSort: AlgorithmDefinition = {
  name: 'Heap Sort',
  source: `algo HeapSort(arr[])
  #: stepover
  def left(i)
    return 2 * i + 1

  #: stepover
  def right(i)
    return 2 * i + 2

  #: stepover
  def sift_down(i, size)
    let largest = i
    let l = left(i)
    let r = right(i)
    if l < size and arr[l] > arr[largest]
      largest = l
    if r < size and arr[r] > arr[largest]
      largest = r
    if largest != i
      swap arr[i], arr[largest]
      sift_down(largest, size)

  #: stepover
  def parent(i)
    return (i - 1) / 2

  #: describe "Phase 1: Building max-heap by sifting down node at position {$=i}"
  def make_heap()
    let p = parent(len(arr) - 1)
    #: pointer p on arr at p
    for i from p downto 0
      #: pointer i on arr at i
      #: comment "Sifting down arr[{$*i}] = {$*arr[i]} to fix subtree"
      sift_down(i, len(arr))

  #: heap max arr
  #: comment "Building the max-heap from the unsorted array"
  make_heap()

  #: describe "Phase 2: Extracting max element to position {$=i}"
  for i from len(arr) - 1 downto 1
    #: comment "Max element is arr[0] = {$*arr[0]}. Swapping with arr[{$*i}] = {$*arr[i]} to place it in its final sorted position"
    swap arr[0], arr[i]
    #: dim arr from i to len(arr) - 1
    #: comment "Restoring heap property on the reduced heap of size {$=i}"
    sift_down(0, i)`,
  defaultInput: [4, 10, 3, 5, 1, 8, 7, 2, 9, 6],
}

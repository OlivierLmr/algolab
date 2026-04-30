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

  #: stepover
  def make_heap()
    let p = parent(len(arr) - 1)
    for i from p downto 0
      sift_down(i, len(arr))

  #: heap max arr
  make_heap()

  #: describe "Extracting max element to position {$=i}"
  for i from len(arr) - 1 downto 1
    #: comment "Swapping max {$*arr[0]} with arr[{$*i}] = {$*arr[i]}"
    swap arr[0], arr[i]
    #: dim arr from i to len(arr) - 1
    sift_down(0, i)`,
  defaultInput: [4, 10, 3, 5, 1, 8, 7, 2, 9, 6],
}

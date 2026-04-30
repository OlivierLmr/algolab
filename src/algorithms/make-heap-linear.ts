import type { AlgorithmDefinition } from '../types.ts'

export const makeHeapLinear: AlgorithmDefinition = {
  name: 'Make Heap O(n)',
  source: `algo MakeHeapLinear(arr[])
  #: stepover
  def left(i)
    return 2 * i + 1

  #: stepover
  def right(i)
    return 2 * i + 2

  #: describe "Sifting down element arr[{$*i}] = {$*arr[i]} at position {$=i}"
  def sift_down(i, size)
    let largest = i
    let l = left(i)
    let r = right(i)
    if l < size and arr[l] > arr[largest]
      #: comment "Left child arr[{$*l}] = {$*arr[l]} > arr[{$*largest}] = {$*arr[largest]}: new largest"
      largest = l
    if r < size and arr[r] > arr[largest]
      #: comment "Right child arr[{$*r}] = {$*arr[r]} > arr[{$*largest}] = {$*arr[largest]}: new largest"
      largest = r
    #: comment "{largest != i ? 'Largest child is at position ' : 'Node '}{largest != i ? largest : i}{largest != i ? ', swapping with current node' : ' is already the largest: heap property satisfied'}"
    if largest != i
      swap arr[i], arr[largest]
      sift_down(largest, size)

  #: stepover
  def parent(i)
    return (i - 1) / 2

  #: heap max arr
  #: comment "Last non-leaf node is at index {$=parent(len(arr) - 1)}"
  let p = parent(len(arr) - 1)
  #: pointer p on arr at p
  #: describe "Sifting down node at position {$=i} (value {$*arr[i]})"
  for i from p downto 0
    #: comment "Calling sift_down({$=i}) to fix subtree rooted at arr[{$*i}] = {$*arr[i]}"
    sift_down(i, len(arr))`,
  defaultInput: [4, 10, 3, 5, 1, 8, 7, 2, 9, 6],
}

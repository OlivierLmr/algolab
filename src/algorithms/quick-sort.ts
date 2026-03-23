import type { AlgorithmDefinition } from '../types.ts'

export const quickSort: AlgorithmDefinition = {
  name: 'Quick Sort',
  source: `algo QuickSort(arr[])
  #: gauge arr

  def partition(lo, hi)
    #: describe "Partitioning arr[{lo}..{hi}] with pivot {arr[hi]}"
    #: dim arr from hi to hi
    let i = lo - 1
    let j = hi
    let done = 0
    while done == 0
      #: describe "Scanning for elements to swap"
      i = i + 1
      while arr[i] < arr[hi]
        i = i + 1
      j = j - 1
      while j > lo and arr[hi] < arr[j]
        j = j - 1
      if i >= j
        done = 1
      else
        #: comment "arr[{i}]={arr[i]} >= pivot and arr[{j}]={arr[j]} <= pivot: swapping"
        swap arr[i], arr[j]
    #: undim arr from hi to hi
    #: comment "Placing pivot {arr[hi]} at position {i}"
    swap arr[i], arr[hi]
    return i

  def qsort(lo, hi)
    #: describe "Sorting arr[{lo}..{hi}]"
    #: dim arr from 0 to lo - 1
    #: dim arr from hi + 1 to len(arr) - 1
    if lo < hi
      let p = lo + (hi - lo) / 2
      #: comment "Choosing pivot at index {p}, value {arr[p]}"
      swap arr[hi], arr[p]
      let pivotIdx = partition(lo, hi)
      #: comment "Pivot {arr[pivotIdx]} placed at index {pivotIdx}"
      qsort(lo, pivotIdx - 1)
      qsort(pivotIdx + 1, hi)

  qsort(0, len(arr) - 1)`,
  defaultInput: [5, 3, 4, 1, 2],
}

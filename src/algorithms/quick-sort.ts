import type { AlgorithmDefinition } from '../types.ts'

export const quickSort: AlgorithmDefinition = {
  name: 'Quick Sort',
  source: `algo QuickSort(arr[])
  #: gauge arr

  #: describe "Partitioning arr[{$lo}..{$hi}] around pivot {$arr[hi]}"
  def partition(lo, hi)
    #: dim arr from hi to hi
    #: comment "Scanner {$i} starts to the left of the first element"
    #: tooltip "Scanner of value larger than pivot"
    let i = lo - 1
    #: comment "Scanner {$j} starts to the right of the last element"
    #: tooltip "Scanner of value smaller than pivot"
    let j = hi
    #: comment "{$i} and {$j} have {i < j ? 'not crossed, keep scanning' : 'crossed, stop scanning'}"
    #: describe "Scanning for elements to swap"
    while i < j
      #: comment "Incrementing {$i}, looking for element larger than pivot"
      i = i + 1
      #: comment "arr[{$i}] = {$arr[i]} is {arr[i] < arr[hi] ? 'smaller than pivot, keep going' : 'larger than pivot, stop'}"
      while arr[i] < arr[hi]
        i = i + 1
      #: comment "Decrementing {$j}, looking for element smaller than pivot"
      j = j - 1
      #: comment "arr[{$j}] = {$arr[j]} is {arr[hi] < arr[j] ? 'larger than pivot, keep going' : 'smaller than pivot, stop'}"
      while j > lo and arr[hi] < arr[j]
        j = j - 1
      #: comment "{$i} and {$j} {i < j ? 'have not crossed, swap them' : 'have crossed, partitioning done'}"
      if i < j
        #: comment "Swapping arr[{$i}]={$arr[i]} and arr[{$j}]={$arr[j]}"
        swap arr[i], arr[j]
    #: undim arr from hi to hi
    #: comment "Placing pivot {$arr[hi]} at position {$i}"
    swap arr[i], arr[hi]
    #: comment "Pivot is now at index {$i}"
    return i

  #: describe "Sorting arr[{$lo}..{$hi}]"
  def qsort(lo, hi)
    #: dim arr from 0 to lo - 1
    #: dim arr from hi + 1 to len(arr) - 1
    #: comment "Subarray has {hi - lo + 1} element(s). {lo < hi + 1 ? 'Handle recursively.' : 'Already sorted.'}"
    if lo < hi + 1
      #: comment "Choose pivot at middle index {$p}"
      #: tooltip "Index of the pivot"
      let p = lo + (hi - lo) / 2
      #: comment "Move pivot {$arr[p]} to last position for partitioning"
      swap arr[hi], arr[p]
      #: comment "Partition arr[{$lo}..{$hi}] around pivot {$arr[hi]}"
      #: tooltip "final position of the pivot"
      let pivotIdx = partition(lo, hi)
      #: comment "Pivot placed at {$pivotIdx}, recurse on left [{$lo}..{pivotIdx - 1}]"
      qsort(lo, pivotIdx - 1)
      #: comment "Recurse on right [{pivotIdx + 1}..{$hi}]"
      qsort(pivotIdx + 1, hi)

  #: comment "Sort the entire array"
  qsort(0, len(arr) - 1)`,
  defaultInput: [5, 3, 4, 1, 2],
}

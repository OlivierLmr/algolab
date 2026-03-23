import type { AlgorithmDefinition } from '../types.ts'

export const quickSort: AlgorithmDefinition = {
  name: 'Quick Sort',
  source: `algo QuickSort(arr[])
  #: gauge arr

  #: describe "Partitioning arr[{lo}..{hi}] with pivot {arr[hi]} (in the last position, {hi})"
  def partition(lo, hi)
    #: dim arr from hi to hi
    #: comment "Scanner i starts to the left of the first element"
    #: tooltip "Scanner of value larger than pivot"
    let i = lo - 1
    #: comment "Scanner j starts to the right of the last element"
    #: tooltip "Scanner of value smaller than pivot"
    let j = hi
    #: comment "i ({i}) and j ({j}) have {i < j ? 'not crossed, keep scanning' : 'crossed, stop scanning' }"
    #: describe "Scanning for elements to swap"
    while i < j
      #: comment "Incrementing i; looking for next element to swap"
      i = i + 1
      #: comment "arr[i] ({arr[i]}) is {arr[i] < arr[hi] ? 'smaller' : 'larger' } than the pivot ({arr[hi]}). {arr[i] < arr[hi] ? 'It is on the correct side; keep going' : 'It is on the wrong side; stop to swap it' }"
      while arr[i] < arr[hi]
        i = i + 1
      #: comment "Decrementing j; looking for next element to swap"
      j = j - 1
      #: comment "arr[j] ({arr[j]}) is {j > lo and arr[hi] < arr[j] ? 'larger' : 'smaller' } than the pivot ({arr[hi]}). {arr[hi] < arr[j] ? 'It is on the correct side; keep going' : 'It is on the wrong side; stop to swap it' }"
      while j > lo and arr[hi] < arr[j]
        j = j - 1
      #: comment "i and j {i < j ? 'have not yet crossed; they can swap' : 'have crossed; do not swap, loop will end'}"
      if i < j
        #: comment "Swapping {arr[i]} and {arr[j]} since they are both on the wrong side."
        swap arr[i], arr[j]
    #: undim arr from hi to hi
    #: comment "Placing pivot {arr[hi]} at position {i}. It now has smaller values to the left, and larger values to the right."
    swap arr[i], arr[hi]
    #: comment "Returning the index at which the pivot now is ({i})"
    return i

  #: describe "Sorting arr[{lo}..{hi}]"
  def qsort(lo, hi)
    #: dim arr from 0 to lo - 1
    #: dim arr from hi + 1 to len(arr) - 1
    #: comment "Array has {hi - lo} elements. {lo < hi + 1 ? 'That is more than 1, handle recursively.' : 'It is necessarily already sorted, no need to handle it.'}"
    if lo < hi + 1
      #: comment "Choose pivot as element in the middle of the array"
      #: tooltip "Index of the pivot"
      let p = lo + (hi - lo) / 2
      #: comment "Putting the pivot in the last position, since partition expects it there."
      swap arr[hi], arr[p]
      #: comment "Partitionning between {lo} and {hi}, with pivot ({arr[hi]}) in the last position"
      #: tooltip "final position of the pivot"
      let pivotIdx = partition(lo, hi)
      #: comment "Recursively sorting left part (between {lo} and {pivotIdx-1})"
      qsort(lo, pivotIdx - 1)
      #: comment "Recursively sorting right part (between {pivotIdx+1} and {hi})"
      qsort(pivotIdx + 1, hi)

  #: comment "Calling qsort on the entire array"
  qsort(0, len(arr) - 1)`,
  defaultInput: [5, 3, 4, 1, 2],
}

import type { AlgorithmDefinition } from '../types.ts'

export const quickSortSemi: AlgorithmDefinition = {
  name: 'Quick Sort (Semi-Recursive)',
  source: `algo QuickSortSemi(arr[])
  #: gauge arr

  def partition(lo, hi)
    #: describe "Partitioning arr[{lo}..{hi}] with pivot {arr[hi]}"
    #: dim arr from hi to hi
    #: tooltip "left scan pointer"
    let i = lo - 1
    #: tooltip "right scan pointer"
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
    #: tooltip "left boundary of current subarray (iteratively narrowed)"
    let curLo = lo
    #: tooltip "right boundary of current subarray (iteratively narrowed)"
    let curHi = hi
    while curLo < curHi
      #: describe "Processing subarray arr[{curLo}..{curHi}]"
      #: dim arr from 0 to curLo - 1
      #: dim arr from curHi + 1 to len(arr) - 1
      #: tooltip "median-of-range pivot index"
      let p = curLo + (curHi - curLo) / 2
      #: comment "Choosing pivot at index {p}, value {arr[p]}"
      swap arr[curHi], arr[p]
      #: tooltip "final position of the pivot"
      let pivotIdx = partition(curLo, curHi)
      #: comment "Pivot {arr[pivotIdx]} placed at index {pivotIdx}"
      #: undim arr from 0 to curLo - 1
      #: undim arr from curHi + 1 to len(arr) - 1
      if pivotIdx - curLo < curHi - pivotIdx
        #: comment "Left side smaller: recurse left [{curLo}..{pivotIdx - 1}], iterate right"
        qsort(curLo, pivotIdx - 1)
        curLo = pivotIdx + 1
      else
        #: comment "Right side smaller: recurse right [{pivotIdx + 1}..{curHi}], iterate left"
        qsort(pivotIdx + 1, curHi)
        curHi = pivotIdx - 1

  qsort(0, len(arr) - 1)`,
  defaultInput: [5, 3, 4, 1, 2],
}

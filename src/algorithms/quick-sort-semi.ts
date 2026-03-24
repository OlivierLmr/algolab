import type { AlgorithmDefinition } from '../types.ts'

export const quickSortSemi: AlgorithmDefinition = {
  name: 'Quick Sort (Semi-Recursive)',
  source: `algo QuickSortSemi(arr[])
  #: gauge arr

  #: describe "Partitioning arr[{$=lo}..{$=hi}] with pivot {$=arr[hi]} (in the last position, {$=hi})"
  def partition(lo, hi)
    #: dim arr from hi to hi
    #: comment "Scanner {$i} starts to the left of the first element"
    #: tooltip "scanner of values larger than pivot"
    let i = lo - 1
    #: comment "Scanner {$i} starts to the right of the last element"
    #: tooltip "scanner of values smaller than pivot"
    let j = hi
    let done = 0
    #: describe "Scanning for elements to swap"
    while done == 0
      #: comment "Incrementing {$i}; looking for next element to swap"
      i = i + 1
      while arr[i] < arr[hi]
        i = i + 1
      #: comment "Decrementing {$j}; looking for next element to swap"
      j = j - 1
      while j > lo and arr[hi] < arr[j]
        j = j - 1
      #: comment "{$=i} and {$=j} {i >= j ? 'have crossed; stop scanning' : 'have not crossed; they can swap'}"
      if i >= j
        done = 1
      else
        #: comment "Swapping {$*arr[i]} and {$*arr[j]} since they are both on the wrong side"
        swap arr[i], arr[j]
    #: undim arr from hi to hi
    #: comment "Placing pivot {$*arr[hi]} at position {$=i}. It now has smaller values to the left, and larger values to the right."
    swap arr[i], arr[hi]
    #: comment "Pivot is now at index {$=i}"
    return i

  #: describe "Sorting arr[{$=lo}..{$=hi}]"
  def qsort(lo, hi)
    #: tooltip "left boundary of current subarray (iteratively narrowed)"
    let curLo = lo
    #: tooltip "right boundary of current subarray (iteratively narrowed)"
    let curHi = hi
    #: comment "Subarray arr[{$=curLo}..{$=curHi}] has {curHi - curLo + 1} element(s). {curLo < curHi ? 'Needs partitioning.' : 'Already sorted.'}"
    #: describe "Processing subarray arr[{$=curLo}..{$=curHi}]"
    while curLo < curHi
      #: dim arr from 0 to curLo - 1
      #: dim arr from curHi + 1 to len(arr) - 1
      #: tooltip "median-of-range pivot index"
      let p = curLo + (curHi - curLo) / 2
      #: comment "Choosing pivot at index {$=p}, value {$*arr[p]}"
      swap arr[curHi], arr[p]
      #: tooltip "final position of the pivot"
      let pivotIdx = partition(curLo, curHi)
      #: comment "Pivot {$*arr[pivotIdx]} placed at index {$=pivotIdx}"
      #: undim arr from 0 to curLo - 1
      #: undim arr from curHi + 1 to len(arr) - 1
      if pivotIdx - curLo < curHi - pivotIdx
        #: comment "Left side smaller ({pivotIdx - curLo} vs {curHi - pivotIdx}): recurse left, iterate right"
        qsort(curLo, pivotIdx - 1)
        curLo = pivotIdx + 1
      else
        #: comment "Right side smaller ({curHi - pivotIdx} vs {pivotIdx - curLo}): recurse right, iterate left"
        qsort(pivotIdx + 1, curHi)
        curHi = pivotIdx - 1

  #: comment "Calling qsort on the entire array"
  qsort(0, len(arr) - 1)`,
  defaultInput: [5, 3, 4, 1, 2],
}

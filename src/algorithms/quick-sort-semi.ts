import type { AlgorithmDefinition } from '../types.ts'

export const quickSortSemi: AlgorithmDefinition = {
  name: 'Quick Sort (Semi-Recursive)',
  source: `algo QuickSortSemi(arr: int[])

  def partition(lo, hi)
    #: dim arr from hi to hi
    let i = lo - 1
    let j = hi
    let done = 0
    #: comment "Partitioning arr[{lo}..{hi - 1}] with pivot {arr[hi]}"
    while done == 0
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
    let curLo = lo
    while curLo < hi
      #: dim arr from 0 to curLo - 1
      #: dim arr from hi + 1 to len(arr) - 1
      #: comment "Subarray [{curLo}..{hi}]: needs partitioning"
      let p = curLo + (hi - curLo) / 2
      #: comment "Choosing pivot at index {p}, value {arr[p]}"
      swap arr[hi], arr[p]
      let pivotIdx = partition(curLo, hi)
      #: comment "Pivot {arr[pivotIdx]} placed at index {pivotIdx}"
      qsort(curLo, pivotIdx - 1)
      #: undim arr from 0 to curLo - 1
      #: undim arr from hi + 1 to len(arr) - 1
      curLo = pivotIdx + 1
    #: comment "Subarray [{curLo}..{hi}]: {curLo == hi ? 'single element' : 'empty'}"

  qsort(0, len(arr) - 1)`,
  defaultInput: [5, 3, 4, 1, 2],
}

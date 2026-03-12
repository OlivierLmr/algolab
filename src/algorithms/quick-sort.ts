import type { AlgorithmDefinition } from '../types.ts'

export const quickSort: AlgorithmDefinition = {
  name: 'Quick Sort',
  source: `algo QuickSort(arr: int[])
  alloc piv 1

  def partition(lo, hi, piv: int[])
    let i = lo - 1
    let j = hi
    let done = 0
    #: comment "Partitioning arr[{lo}..{hi}] with pivot {arr[hi]}"
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
    #: comment "Placing pivot {arr[hi]} at position {i}"
    swap arr[i], arr[hi]
    piv[0] = i

  def qsort(lo, hi, piv: int[])
    #: dim arr from 0 to lo - 1
    #: dim arr from hi + 1 to len(arr) - 1
    #: comment "Subarray [{lo}..{hi}]: {lo < hi ? 'needs partitioning' : 'base case'}"
    if lo < hi
      let p = lo + (hi - lo) / 2
      #: comment "Choosing pivot at index {p}, value {arr[p]}"
      swap arr[hi], arr[p]
      partition(lo, hi, piv)
      let pivotIdx = piv[0]
      #: comment "Pivot {arr[pivotIdx]} placed at index {pivotIdx}"
      qsort(lo, pivotIdx - 1, piv)
      qsort(pivotIdx + 1, hi, piv)

  qsort(0, len(arr) - 1, piv)`,
  defaultInput: [5, 3, 8, 1, 2],
}

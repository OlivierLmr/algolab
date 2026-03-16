import type { AlgorithmDefinition } from '../types.ts'

export const mergeSortLR: AlgorithmDefinition = {
  name: 'Merge Sort (L+R copies)',
  source: `algo MergeSortLR(arr: int[])
  #: gauge arr
  #: skip copy

  def copy(lo, mid, hi)
    let leftLen = mid - lo + 1
    let rightLen = hi - mid
    for i from 0 to leftLen - 1
      L[i] = arr[lo + i]
    for j from 0 to rightLen - 1
      R[j] = arr[mid + 1 + j]
    L[leftLen] = inf
    R[rightLen] = inf

  def merge(lo, mid, hi)
    alloc L mid - lo + 2
    alloc R hi - mid + 1
    #: gauge L
    #: gauge R
    #: comment "Copying arr[{lo}..{mid}] to L and arr[{mid + 1}..{hi}] to R"
    copy(lo, mid, hi)
    let i = 0
    let j = 0
    #: comment "Merging L and R back into arr[{lo}..{hi}]"
    for k from lo to hi
      #: comment "L[{i}]={L[i]} vs R[{j}]={R[j]}: {L[i] <= R[j] ? 'taking from L' : 'taking from R'}"
      if L[i] <= R[j]
        arr[k] = L[i]
        i = i + 1
      else
        arr[k] = R[j]
        j = j + 1

  def msort(lo, hi)
    #: dim arr from 0 to lo - 1
    #: dim arr from hi + 1 to len(arr) - 1
    #: comment "The subarray has {hi - lo + 1} elements, {lo < hi ? 'it needs to be sorted recursively.' : 'it is already sorted.'}"
    #: pointer lo on arr at lo
    #: pointer hi on arr at hi
    if lo < hi
      let mid = lo + (hi - lo) / 2
      #: pointer mid on arr at mid
      #: comment "Sorting left half from {lo} to {mid}"
      msort(lo, mid)
      #: comment "Sorting right half from {mid + 1} to {hi}"
      msort(mid + 1, hi)
      #: comment "Both halves sorted, merging arr[{lo}..{hi}]"
      merge(lo, mid, hi)

  msort(0, len(arr) - 1)`,
  defaultInput: [5, 3, 8, 1, 2],
}

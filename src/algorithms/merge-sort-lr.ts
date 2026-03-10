import type { AlgorithmDefinition } from '../types.ts'

export const mergeSortLR: AlgorithmDefinition = {
  name: 'Merge Sort (L+R copies)',
  source: `algo MergeSortLR(arr: int[])

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
    #: comment "Copying arr[{lo}..{mid}] to L and arr[{mid + 1}..{hi}] to R"
    copy(lo, mid, hi)
    let i = 0
    let j = 0
    #: comment "Merging L and R back into arr[{lo}..{hi}]"
    for k from lo to hi
      if L[i] <= R[j]
        arr[k] = L[i]
        i = i + 1
      else
        arr[k] = R[j]
        j = j + 1

  def msort(lo, hi)
    #: dim arr from 0 to lo - 1
    #: dim arr from hi + 1 to len(arr) - 1
    #: comment "The table has {hi-lo} elements, {hi - lo > 1 ? 'it needs to be sorted recursively.' : 'it is already sorted.'}"
    if hi - lo > 1
      let mid = lo + (hi - lo) / 2
      msort(lo, mid)
      msort(mid + 1, hi)
      merge(lo, mid, hi)

  msort(0, len(arr) - 1)`,
  defaultInput: [5, 3, 8, 1, 2],
}

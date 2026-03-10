import type { AlgorithmDefinition } from '../types.ts'

export const mergeSortLR: AlgorithmDefinition = {
  name: 'Merge Sort (L+R copies)',
  source: `algo MergeSortLR(arr: int[])
  alloc L len(arr)
  alloc R len(arr)

  def merge(lo, mid, hi)
    let leftLen = mid - lo + 1
    let rightLen = hi - mid
    let li = 0
    #: comment "Copying arr[{lo}..{mid}] to L"
    while li < leftLen
      L[li] = arr[lo + li]
      li = li + 1
    let ri = 0
    #: comment "Copying arr[{mid + 1}..{hi}] to R"
    while ri < rightLen
      R[ri] = arr[mid + 1 + ri]
      ri = ri + 1
    let li = 0
    let ri = 0
    let k = lo
    #: comment "Merging L and R back into arr[{lo}..{hi}]"
    while li < leftLen and ri < rightLen
      if L[li] <= R[ri]
        arr[k] = L[li]
        li = li + 1
      else
        arr[k] = R[ri]
        ri = ri + 1
      k = k + 1
    while li < leftLen
      arr[k] = L[li]
      li = li + 1
      k = k + 1
    while ri < rightLen
      arr[k] = R[ri]
      ri = ri + 1
      k = k + 1

  def msort(lo, hi)
    if lo < hi
      let mid = (lo + hi) / 2
      #: comment "Sorting left half arr[{lo}..{mid}]"
      msort(lo, mid)
      #: comment "Sorting right half arr[{mid + 1}..{hi}]"
      msort(mid + 1, hi)
      merge(lo, mid, hi)

  msort(0, len(arr) - 1)`,
  defaultInput: [5, 3, 8, 1, 2],
}

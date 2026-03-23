import type { AlgorithmDefinition } from '../types.ts'

export const mergeSortLR: AlgorithmDefinition = {
  name: 'Merge Sort (L+R copies)',
  source: `algo MergeSortLR(arr[])
  #: gauge arr
  #: stepover
  def copy(lo, mid, hi)
    let leftLen = mid - lo + 1
    let rightLen = hi - mid
    for i from 0 to leftLen - 1
      L[i] = arr[lo + i]
    for j from 0 to rightLen - 1
      R[j] = arr[mid + 1 + j]
    L[leftLen] = inf
    R[rightLen] = inf

  #: describe "Merging arr[{$lo}..{$mid}] and arr[{mid + 1}..{$hi}]"
  def merge(lo, mid, hi)
    alloc L mid - lo + 2
    alloc R hi - mid + 1
    #: gauge L
    #: gauge R
    #: comment "Copying arr[{$lo}..{$mid}] to L and arr[{mid + 1}..{$hi}] to R"
    copy(lo, mid, hi)
    #: tooltip "read position in L"
    let i = 0
    #: tooltip "read position in R"
    let j = 0
    #: comment "Merging L and R back into arr[{$lo}..{$hi}]"
    #: tooltip "write position in arr"
    #: describe "Picking the smaller of L[{$i}] and R[{$j}]"
    for k from lo to hi
      #: comment "{$L[i]} <= {$R[j]}? {L[i] <= R[j] ? 'Yes, taking from L' : 'No, taking from R'}"
      if L[i] <= R[j]
        arr[k] = L[i]
        i = i + 1
      else
        arr[k] = R[j]
        j = j + 1

  #: describe "Sorting arr[{$lo}..{$hi}]"
  def msort(lo, hi)
    #: dim arr from 0 to lo - 1
    #: dim arr from hi + 1 to len(arr) - 1
    #: comment "Subarray has {hi - lo + 1} element(s). {lo < hi ? 'Handle recursively.' : 'Already sorted.'}"
    if lo < hi
      #: tooltip "midpoint splitting the subarray"
      let mid = lo + (hi - lo) / 2
      #: comment "Recursively sorting left half arr[{$lo}..{$mid}]"
      msort(lo, mid)
      #: comment "Recursively sorting right half arr[{mid + 1}..{$hi}]"
      msort(mid + 1, hi)
      #: comment "Both halves sorted, merging arr[{$lo}..{$hi}]"
      merge(lo, mid, hi)

  #: comment "Calling msort on the entire array"
  msort(0, len(arr) - 1)`,
  defaultInput: [5, 3, 8, 1, 2],
}

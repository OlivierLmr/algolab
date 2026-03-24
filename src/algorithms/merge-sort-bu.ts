import type { AlgorithmDefinition } from '../types.ts'

export const mergeSortBU: AlgorithmDefinition = {
  name: 'Merge Sort (two arrays)',
  source: `algo MergeSortAux(arr[])
  #: gauge arr
  alloc aux len(arr)
  #: gauge aux

  #: describe "Merging src[{$=lo}..{$=mid}] and src[{mid + 1}..{$=hi}] into dst"
  def merge(src[], dst[], lo, mid, hi)
    #: tooltip "read position in left half"
    let i = lo
    #: tooltip "read position in right half"
    let j = mid + 1
    #: tooltip "write position in dst"
    #: describe "Picking the smaller of the two front elements"
    for k from lo to hi
      #: comment "{i <= mid and (j > hi or src[i] <= src[j]) ? 'Taking from left half' : 'Taking from right half'}"
      if i <= mid and (j > hi or src[i] <= src[j])
        dst[k] = src[i]
        i = i + 1
      else
        dst[k] = src[j]
        j = j + 1

  #: describe "Sorting [{$=lo}..{$=hi}] from src into dst"
  def msort(src[], dst[], lo, hi)
    #: dim src from 0 to lo - 1
    #: dim src from hi + 1 to len(src) - 1
    #: dim dst from 0 to lo - 1
    #: dim dst from hi + 1 to len(dst) - 1
    #: comment "Subarray [{$=lo}..{$=hi}] has {hi - lo + 1} element(s). {lo < hi ? 'Handle recursively.' : 'Already sorted.'}"
    if lo < hi
      #: tooltip "midpoint splitting the subarray"
      let mid = lo + (hi - lo) / 2
      #: comment "Recursively sorting left half [{$=lo}..{$=mid}]"
      msort(dst, src, lo, mid)
      #: comment "Recursively sorting right half [{mid + 1}..{$=hi}]"
      msort(dst, src, mid + 1, hi)
      #: comment "Both halves sorted, merging into dst[{$=lo}..{$=hi}]"
      merge(src, dst, lo, mid, hi)
    else
      #: comment "Single element: copying src[{$*lo}] = {$*src[lo]} to dst"
      dst[lo] = src[lo]

  #: comment "Copying arr into aux before sorting"
  for i from 0 to len(arr) - 1
    aux[i] = arr[i]
  #: comment "Starting recursive sort from aux into arr"
  msort(aux, arr, 0, len(arr) - 1)`,
  defaultInput: [5, 3, 8, 1, 2],
}

import type { AlgorithmDefinition } from '../types.ts'

export const mergeSortBU: AlgorithmDefinition = {
  name: 'Merge Sort (two arrays)',
  source: `algo MergeSortAux(arr: int[])
  alloc aux len(arr)

  def merge(lo, mid, hi)
    #: comment "Copying arr[{lo}..{hi}] to aux"
    for i from lo to hi
      aux[i] = arr[i]
    let i = lo
    let j = mid + 1
    #: comment "Merging aux[{lo}..{mid}] and aux[{mid + 1}..{hi}] into arr"
    for k from lo to hi
      if i <= mid and (j > hi or aux[i] <= aux[j])
        arr[k] = aux[i]
        i = i + 1
      else
        arr[k] = aux[j]
        j = j + 1

  def msort(lo, hi)
    if lo < hi
      let mid = lo + (hi - lo) / 2
      msort(lo, mid)
      msort(mid + 1, hi)
      merge(lo, mid, hi)

  msort(0, len(arr) - 1)`,
  defaultInput: [5, 3, 8, 1, 2],
}

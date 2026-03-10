import type { AlgorithmDefinition } from '../types.ts'

export const mergeSortBU: AlgorithmDefinition = {
  name: 'Merge Sort (two arrays)',
  source: `algo MergeSortAux(arr: int[])
  alloc aux len(arr)

  def merge(lo, mid, hi)
    let i = lo
    #: comment "Copying arr[{lo}..{hi}] to aux"
    while i <= hi
      aux[i] = arr[i]
      i = i + 1
    let i = lo
    let j = mid + 1
    let k = lo
    #: comment "Merging aux[{lo}..{mid}] and aux[{mid + 1}..{hi}] into arr"
    while i <= mid and j <= hi
      if aux[i] <= aux[j]
        arr[k] = aux[i]
        i = i + 1
      else
        arr[k] = aux[j]
        j = j + 1
      k = k + 1
    while i <= mid
      arr[k] = aux[i]
      i = i + 1
      k = k + 1
    while j <= hi
      arr[k] = aux[j]
      j = j + 1
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

import type { AlgorithmDefinition } from '../types.ts'

export const mergeSortBU: AlgorithmDefinition = {
  name: 'Merge Sort (two arrays)',
  source: `algo MergeSortAux(arr: int[])
  alloc aux len(arr)

  def merge(src: int[], dst: int[], lo, mid, hi)
    let i = lo
    let j = mid + 1
    for k from lo to hi
      if i <= mid and (j > hi or src[i] <= src[j])
        dst[k] = src[i]
        i = i + 1
      else
        dst[k] = src[j]
        j = j + 1

  def msort(src: int[], dst: int[], lo, hi)
    #: dim src from 0 to lo - 1
    #: dim src from hi + 1 to len(src) - 1
    #: dim dst from 0 to lo - 1
    #: dim dst from hi + 1 to len(dst) - 1
    if lo < hi
      let mid = lo + (hi - lo) / 2
      msort(dst, src, lo, mid)
      msort(dst, src, mid + 1, hi)
      merge(src, dst, lo, mid, hi)
    else
      dst[lo] = src[lo]

  for i from 0 to len(arr) - 1
    aux[i] = arr[i]
  msort(aux, arr, 0, len(arr) - 1)`,
  defaultInput: [5, 3, 8, 1, 2],
}

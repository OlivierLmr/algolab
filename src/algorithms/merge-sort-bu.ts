import type { AlgorithmDefinition } from '../types.ts'

export const mergeSortBU: AlgorithmDefinition = {
  name: 'Merge Sort (two arrays)',
  source: `algo MergeSortBU(arr: int[])
  alloc aux len(arr)
  let size = 1
  while size < len(arr)
    #: comment "Copying arr to aux before merging runs of size {size}"
    let ci = 0
    while ci < len(arr)
      aux[ci] = arr[ci]
      ci = ci + 1
    let start = 0
    while start < len(arr)
      let mid = start + size
      if mid < len(arr)
        let end = mid + size
        if end > len(arr)
          end = len(arr)
        let i = start
        let j = mid
        let k = start
        #: comment "Merging aux[{start}..{mid - 1}] and aux[{mid}..{end - 1}] into arr"
        while i < mid and j < end
          #: comment "{aux[i]} <= {aux[j]}? {aux[i] <= aux[j] ? 'Take from left' : 'Take from right'}"
          if aux[i] <= aux[j]
            arr[k] = aux[i]
            i = i + 1
          else
            arr[k] = aux[j]
            j = j + 1
          k = k + 1
        while i < mid
          arr[k] = aux[i]
          i = i + 1
          k = k + 1
        while j < end
          arr[k] = aux[j]
          j = j + 1
          k = k + 1
      start = start + size + size
    size = size * 2`,
  defaultInput: [5, 3, 8, 1, 2],
}

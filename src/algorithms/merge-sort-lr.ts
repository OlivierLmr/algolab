import type { AlgorithmDefinition } from '../types.ts'

export const mergeSortLR: AlgorithmDefinition = {
  name: 'Merge Sort (L+R copies)',
  source: `algo MergeSortLR(arr: int[])
  alloc L len(arr)
  alloc R len(arr)
  let size = 1
  while size < len(arr)
    let start = 0
    while start < len(arr)
      let mid = start + size
      if mid < len(arr)
        let end = mid + size
        if end > len(arr)
          end = len(arr)
        let leftLen = mid - start
        let rightLen = end - mid
        #: comment "Copying left run arr[{start}..{mid - 1}] to L"
        let li = 0
        while li < leftLen
          L[li] = arr[start + li]
          li = li + 1
        #: comment "Copying right run arr[{mid}..{end - 1}] to R"
        let ri = 0
        while ri < rightLen
          R[ri] = arr[mid + ri]
          ri = ri + 1
        let li = 0
        let ri = 0
        let k = start
        #: comment "Merging L and R back into arr[{start}..{end - 1}]"
        while li < leftLen and ri < rightLen
          #: comment "{L[li]} <= {R[ri]}? {L[li] <= R[ri] ? 'Take from L' : 'Take from R'}"
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
      start = start + size + size
    size = size * 2`,
  defaultInput: [5, 3, 8, 1, 2],
}

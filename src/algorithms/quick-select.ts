import type { AlgorithmDefinition } from '../types.ts'

export const quickSelect: AlgorithmDefinition = {
  name: 'Quick Select',
  source: `algo QuickSelect(arr: int[])
  #: gauge arr

  def partition(lo, hi)
    #: dim arr from hi to hi
    let i = lo - 1
    let j = hi
    let done = 0
    #: comment "Partitioning arr[{lo}..{hi - 1}] with pivot {arr[hi]}"
    while done == 0
      i = i + 1
      while arr[i] < arr[hi]
        i = i + 1
      j = j - 1
      while j > lo and arr[hi] < arr[j]
        j = j - 1
      if i >= j
        done = 1
      else
        #: comment "arr[{i}]={arr[i]} >= pivot and arr[{j}]={arr[j]} <= pivot: swapping"
        swap arr[i], arr[j]
    #: undim arr from hi to hi
    #: comment "Placing pivot {arr[hi]} at position {i}"
    swap arr[i], arr[hi]
    return i

  let k = 2
  #: pointer k on arr at k
  let lo = 0
  let hi = len(arr) - 1
  let found = 0
  while hi > lo and found == 0
    #: dim arr from 0 to lo - 1
    #: dim arr from hi + 1 to len(arr) - 1
    let p = lo + (hi - lo) / 2
    #: comment "Choosing pivot at index {p}, value {arr[p]}"
    swap arr[hi], arr[p]
    let pivotIdx = partition(lo, hi)
    #: pointer pivotIdx on arr at pivotIdx
    #: undim arr from 0 to lo - 1
    #: undim arr from hi + 1 to len(arr) - 1
    #: comment "Pivot at index {pivotIdx}, looking for k={k}"
    if pivotIdx < k
      #: comment "pivotIdx={pivotIdx} < k={k}: search right half"
      lo = pivotIdx + 1
    else
      if pivotIdx > k
        #: comment "pivotIdx={pivotIdx} > k={k}: search left half"
        hi = pivotIdx - 1
      else
        #: comment "Found: arr[{k}] = {arr[k]}"
        found = 1
  #: comment "Result: the {k + 1}-th smallest element is {arr[k]}"`,
  defaultInput: [5, 3, 4, 1, 2],
}

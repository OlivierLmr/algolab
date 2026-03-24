import type { AlgorithmDefinition } from '../types.ts'

export const quickSelect: AlgorithmDefinition = {
  name: 'Quick Select',
  source: `algo QuickSelect(arr[])
  #: gauge arr

  #: describe "Partitioning arr[{$=lo}..{$=hi}] with pivot {$=arr[hi]} (in the last position, {$=hi})"
  def partition(lo, hi)
    #: dim arr from hi to hi
    #: comment "Scanner {$i} starts to the left of the first element"
    #: tooltip "scanner of values larger than pivot"
    let i = lo - 1
    #: comment "Scanner {$i} starts to the right of the last element"
    #: tooltip "scanner of values smaller than pivot"
    let j = hi
    let done = 0
    #: describe "Scanning for elements to swap"
    while done == 0
      #: comment "Incrementing {$i}; looking for next element to swap"
      i = i + 1
      while arr[i] < arr[hi]
        i = i + 1
      #: comment "Decrementing {$j}; looking for next element to swap"
      j = j - 1
      while j > lo and arr[hi] < arr[j]
        j = j - 1
      #: comment "{$=i} and {$=j} {i >= j ? 'have crossed; stop scanning' : 'have not crossed; they can swap'}"
      if i >= j
        done = 1
      else
        #: comment "Swapping {$*arr[i]} and {$*arr[j]} since they are both on the wrong side"
        swap arr[i], arr[j]
    #: undim arr from hi to hi
    #: comment "Placing pivot {$*arr[hi]} at position {$=i}"
    swap arr[i], arr[hi]
    #: comment "Pivot is now at index {$=i}"
    return i

  #: tooltip "target rank (0-based): looking for the (k+1)-th smallest"
  let k = 2
  #: pointer k on arr at k
  #: tooltip "left boundary of search range"
  let lo = 0
  #: tooltip "right boundary of search range"
  let hi = len(arr) - 1
  let found = 0
  #: comment "Searching for element of rank {$=k} in arr[{$=lo}..{$=hi}]"
  #: describe "Searching for rank {$=k} in arr[{$=lo}..{$=hi}]"
  while hi > lo and found == 0
    #: dim arr from 0 to lo - 1
    #: dim arr from hi + 1 to len(arr) - 1
    #: tooltip "median-of-range pivot index"
    let p = lo + (hi - lo) / 2
    #: comment "Choosing pivot at index {$=p}, value {$*arr[p]}"
    swap arr[hi], arr[p]
    #: tooltip "final position of the pivot"
    let pivotIdx = partition(lo, hi)
    #: undim arr from 0 to lo - 1
    #: undim arr from hi + 1 to len(arr) - 1
    #: comment "Pivot landed at index {$=pivotIdx}, looking for rank {$=k}"
    if pivotIdx < k
      #: comment "{$=pivotIdx} < {$=k}: element is in the right half, narrowing search"
      lo = pivotIdx + 1
    else
      if pivotIdx > k
        #: comment "{$=pivotIdx} > {$=k}: element is in the left half, narrowing search"
        hi = pivotIdx - 1
      else
        #: comment "Found: arr[{$*k}] = {$*arr[k]} is the {k + 1}-th smallest element"
        found = 1
  #: comment "Result: the {k + 1}-th smallest element is {$*arr[k]}"`,
  defaultInput: [5, 3, 4, 1, 2],
}

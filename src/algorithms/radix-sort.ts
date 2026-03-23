import type { AlgorithmDefinition } from '../types.ts'

export const radixSort: AlgorithmDefinition = {
  name: 'Radix Sort (LSD)',
  source: `algo RadixSort(arr[])

  #: describe "Stable sort by digit at place value {$exp}"
  def countingSortByDigit(exp)
    #: tooltip "sorted result being built"
    alloc output len(arr)
    #: tooltip "count[d] = occurrences of digit d"
    alloc count 10

    #: describe "Counting occurrences of each digit"
    for i from 0 to len(arr) - 1
      #: tooltip "extracted digit of arr[i] at current place value"
      let digit = (arr[i] / exp) % 10
      #: comment "arr[{$i}] = {$arr[i]}, digit = {$digit}: incrementing count[{$digit}]"
      count[digit] = count[digit] + 1

    #: tooltip "running total of elements placed so far"
    let sum = 0
    #: describe "Converting counts to starting positions (prefix sums)"
    for i from 0 to 9
      #: tooltip "saved count before overwriting with prefix sum"
      let c = count[i]
      #: comment "Digit {$i} had {$c} occurrence(s); prefix sum {$sum} becomes its starting position"
      count[i] = sum
      sum = sum + c

    #: describe "Placing each element at its stable sorted position"
    for i from 0 to len(arr) - 1
      #: tooltip "extracted digit of arr[i] at current place value"
      let digit = (arr[i] / exp) % 10
      #: comment "Placing {$arr[i]} (digit {$digit}) at output[{$count[digit]}]"
      output[count[digit]] = arr[i]
      count[digit] = count[digit] + 1

    #: describe "Copying sorted result back to arr"
    for i from 0 to len(arr) - 1
      arr[i] = output[i]

  #: tooltip "largest value in arr, determines number of digit passes"
  let max = arr[0]
  #: describe "Finding the maximum value in arr"
  for i from 1 to len(arr) - 1
    if arr[i] > max
      max = arr[i]

  #: comment "Maximum value is {$max}, determining number of passes needed"
  #: tooltip "current place value being sorted (1=ones, 10=tens, ...)"
  let exp = 1
  #: comment "Processing digit at place value {$exp} (of max {$max})"
  #: describe "Sorting by digit at place value {$exp}"
  while exp <= max
    #: comment "Sorting all elements by their digit at place value {$exp}"
    countingSortByDigit(exp)
    exp = exp * 10`,
  defaultInput: [170, 45, 75, 90, 802, 24, 2, 66],
}

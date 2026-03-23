import type { AlgorithmDefinition } from '../types.ts'

export const radixSort: AlgorithmDefinition = {
  name: 'Radix Sort (LSD)',
  source: `algo RadixSort(arr[])

  #: describe "Stable sort by digit at place value {exp}"
  def countingSortByDigit(exp)
    #: tooltip "sorted result being built"
    alloc output len(arr)
    #: tooltip "count[{index}] = occurrences of digit {index}"
    alloc count 10

    #: describe "Counting occurrences of each digit"
    for i from 0 to len(arr) - 1
      #: tooltip "extracted digit of arr[{value}] at place value exp"
      let digit = (arr[i] / exp) % 10
      count[digit] = count[digit] + 1

    #: tooltip "running total of elements placed so far"
    let sum = 0
    #: describe "Converting counts to starting positions"
    for i from 0 to 9
      #: tooltip "saved count before overwriting with prefix sum"
      let c = count[i]
      count[i] = sum
      sum = sum + c

    #: describe "Placing each element at its stable sorted position"
    for i from 0 to len(arr) - 1
      #: tooltip "extracted digit of arr[{value}] at place value exp"
      let digit = (arr[i] / exp) % 10
      #: comment "Placing arr[{i}]={arr[i]} (digit={digit}) at position {count[digit]}"
      output[count[digit]] = arr[i]
      count[digit] = count[digit] + 1

    #: describe "Copying sorted result back to arr"
    for i from 0 to len(arr) - 1
      arr[i] = output[i]

  #: tooltip "largest value in arr, determines number of digit passes"
  let max = arr[0]
  for i from 1 to len(arr) - 1
    if arr[i] > max
      max = arr[i]

  #: comment "Max value is {max}"
  #: tooltip "current place value being sorted (1=ones, 10=tens, ...)"
  let exp = 1
  #: describe "Sorting by digit at place value {exp}"
  while exp <= max
    #: comment "Sorting by digit at position exp={exp}"
    countingSortByDigit(exp)
    exp = exp * 10`,
  defaultInput: [170, 45, 75, 90, 802, 24, 2, 66],
}

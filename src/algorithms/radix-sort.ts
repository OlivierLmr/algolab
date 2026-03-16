import type { AlgorithmDefinition } from '../types.ts'

export const radixSort: AlgorithmDefinition = {
  name: 'Radix Sort (LSD)',
  source: `algo RadixSort(arr: int[])
  #: gauge arr

  def countingSortByDigit(exp)
    alloc output len(arr)
    alloc count 10

    #: comment "Counting occurrences of digit (exp={exp})"
    for i from 0 to len(arr) - 1
      let digit = (arr[i] / exp) % 10
      count[digit] = count[digit] + 1

    #: comment "Computing prefix sums (starting positions)"
    let sum = 0
    for i from 0 to 9
      let c = count[i]
      count[i] = sum
      sum = sum + c

    #: comment "Building output array"
    for i from 0 to len(arr) - 1
      let digit = (arr[i] / exp) % 10
      #: comment "Placing arr[{i}]={arr[i]} (digit={digit}) at position {count[digit]}"
      output[count[digit]] = arr[i]
      count[digit] = count[digit] + 1

    #: comment "Copying output back to arr"
    for i from 0 to len(arr) - 1
      arr[i] = output[i]

  let max = arr[0]
  for i from 1 to len(arr) - 1
    if arr[i] > max
      max = arr[i]

  #: comment "Max value is {max}"
  let exp = 1
  while exp <= max
    #: comment "Sorting by digit at position exp={exp}"
    countingSortByDigit(exp)
    exp = exp * 10`,
  defaultInput: [170, 45, 75, 90, 802, 24, 2, 66],
}

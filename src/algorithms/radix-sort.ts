import type { AlgorithmDefinition } from '../types.ts'

export const radixSort: AlgorithmDefinition = {
  name: 'Radix Sort (LSD)',
  source: `algo RadixSort(arr: int[])

  def countingSortByDigit(exp)
    alloc output len(arr)
    alloc count 10

    #: comment "Counting occurrences of digit (exp={exp})"
    for i from 0 to len(arr) - 1
      let digit = (arr[i] / exp) % 10
      count[digit] = count[digit] + 1

    #: comment "Computing prefix sums"
    for i from 1 to 9
      count[i] = count[i] + count[i - 1]

    #: comment "Building output array (right to left for stability)"
    let i = len(arr) - 1
    while i >= 0
      let digit = (arr[i] / exp) % 10
      #: comment "Placing arr[{i}]={arr[i]} (digit={digit}) at position {count[digit] - 1}"
      output[count[digit] - 1] = arr[i]
      count[digit] = count[digit] - 1
      i = i - 1

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

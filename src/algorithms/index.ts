import type { AlgorithmDefinition } from '../types.ts'
import { bubbleSort } from './bubble-sort.ts'
import { selectionSort } from './selection-sort.ts'
import { insertionSort } from './insertion-sort.ts'
import { mergeSortLR } from './merge-sort-lr.ts'
import { mergeSortBU } from './merge-sort-bu.ts'
import { quickSort } from './quick-sort.ts'
import { quickSortSemi } from './quick-sort-semi.ts'
import { quickSelect } from './quick-select.ts'
import { countingSort } from './counting-sort.ts'
import { radixSort } from './radix-sort.ts'
import { makeHeapNlogn } from './make-heap-nlogn.ts'
import { makeHeapLinear } from './make-heap-linear.ts'
import { heapSort } from './heap-sort.ts'
import { dequeDemo } from './deque-demo.ts'

export const algorithms: AlgorithmDefinition[] = [
  bubbleSort,
  selectionSort,
  insertionSort,
  mergeSortLR,
  mergeSortBU,
  quickSort,
  quickSortSemi,
  quickSelect,
  countingSort,
  radixSort,
  makeHeapNlogn,
  makeHeapLinear,
  heapSort,
  dequeDemo,
]

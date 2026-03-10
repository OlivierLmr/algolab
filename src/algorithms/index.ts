import type { AlgorithmDefinition } from '../types.ts'
import { bubbleSort } from './bubble-sort.ts'
import { selectionSort } from './selection-sort.ts'
import { insertionSort } from './insertion-sort.ts'
import { mergeSortLR } from './merge-sort-lr.ts'
import { mergeSortBU } from './merge-sort-bu.ts'

export const algorithms: AlgorithmDefinition[] = [
  bubbleSort,
  selectionSort,
  insertionSort,
  mergeSortLR,
  mergeSortBU,
]

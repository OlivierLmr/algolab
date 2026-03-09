import type { AlgorithmDefinition } from '../types.ts'
import { bubbleSort } from './bubble-sort.ts'
import { insertionSort } from './insertion-sort.ts'

export const algorithms: AlgorithmDefinition[] = [
  bubbleSort,
  insertionSort,
]

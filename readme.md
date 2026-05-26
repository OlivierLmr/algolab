# AlgoLab

A web app for visualizing classic algorithms and data structures, step by step.

Live: https://olivierlmr.github.io/algolab/

## What it does

- **Algorithms.** Write algorithms in a small built-in DSL (loops, functions, array indexing, swaps). The app runs them step by step, drawing arrays, variables, iterators, pointers, gauges, and the call stack on a canvas. Includes built-in implementations for sorts (bubble, selection, insertion, merge, quick, semi-recursive quick, heap), selection (quickselect), counting sort, radix sort (LSD), and heap operations (make-heap O(n log n) and O(n), heap sort).
- **Data structures.** Operate on `vector`, `singly-linked list`, `doubly-linked list`, `deque`, and a `tree (sibling-node)` representation. Each operation is broken into theoretical substeps (allocate, copy, switch pointer, shift, ...) and animated.
- **Editor.** Write your own algorithms, set breakpoints, step over and out (forward and backward), import/export `.algolab` files.

## Running locally

```sh
pnpm install
pnpm dev      # dev server
pnpm test     # unit tests (vitest)
pnpm build    # type-check + production build
```

## Stack

Preact + Signals, TypeScript, Vite, Vitest, Playwright. No runtime dependencies beyond Preact.

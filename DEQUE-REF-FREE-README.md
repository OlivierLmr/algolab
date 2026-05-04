# Feature Branch: `ref()`, `free`, Dynamic Alloc, and Deque Demo

## What was done

### New DSL features

1. **`ref(arr)` built-in** — Returns a reference value `{num: 0, arrays: [], ref: arrayName}` that identifies an array. Stored in cells, enables display of array names and persistent purple arrows to the referenced array.

2. **`free name`** — Deallocates a heap-allocated array. Removes it from all future snapshots. Resolves through ref indirection (can free via a variable holding a ref).

3. **`let p = alloc size`** (dynamic alloc expression) — Allocates an auto-named array (`#0`, `#1`, ...) and returns a ref to it. Eliminates the need for pre-named allocations and dispatch logic.

4. **Ref indirection** — Variables holding ref values can be indexed (`ptr[i]`), resolved via `resolveArrayName`. Enables chained indexing like `map[i][j]` where `map[i]` returns a ref.

5. **`local name size`** — Stack-scoped array allocation (cleaned up on function return). Added but not heavily used.

### Visualization changes

- Ref cells display the array name and a blue border
- Purple dashed arrows always visible from ref cells to referenced arrays
- Hover arrows still work for iterator metadata

### Deque demo rewrite

Fully rewritten to use dynamic alloc, ref(), free, chained indexing, and readable variable names (`begin_map`, `map_size`, `begin_chunk`, `size` instead of `ms`, `me`, `fo`, `bo`).

### Tests

- `tests/ref-free.test.ts` — comprehensive tests for ref(), free, dynamic alloc, ref indirection, chained indexing
- `tests/algorithms.test.ts` — updated deque test verifying map freed and chunk contents via refs
- All 268 tests pass

## What remains / known issues

### Visual verification needed

The deque demo has **not been visually tested** in the browser. Specifically:
- Do persistent ref arrows render correctly between map cells and auto-named chunks?
- Does `free map` cause the old map to visually disappear at the right step?
- Do dim/undim directives work correctly with the new variable names and map slots?
- Is the overall layout readable with auto-generated chunk names (`#0`, `#1`, ...)?

### Potential issues

1. **Auto-generated names (`#0`, `#1`, ...)** — These show as array labels in the visualization. They're not human-readable. Consider adding a display-name mechanism (e.g., tooltip on the array label, or a directive like `#: label #0 "chunk0"`).

2. **ArrowOverlay with many refs** — The deque demo creates 6+ chunks. With persistent arrows from every map cell to its chunk, the arrow overlay could become visually cluttered. May need layout tuning or arrow bundling.

3. **Chained indexing type inference** — `map[i][j]` is partially handled in type inference (`typeinfer.ts`) but the inner expression evaluation may not propagate all type constraints correctly. This could affect pointer synthesis for chained accesses.

4. **`local` keyword** — Added in an early commit but the deque demo was rewritten to not use it (switched to `alloc`/`free` instead). The feature works but is lightly tested and not used by any built-in algorithm.

5. **Cross-array swap through refs** — `swap map[0][0], map[1][0]` doesn't work because `execSwap` assumes both sides are in the same array. This is a pre-existing limitation, not needed for the deque demo, but worth noting.

## Commits (oldest to newest)

1. `a0194ff` — Add `local` keyword for stack-scoped allocation
2. `edf4b9b` — Rewrite deque demo with global variables and persistent alloc
3. `cf56fac` — Add `ref()` built-in and `free` keyword
4. `3acb85c` — Update UI for ref values, add DSL docs
5. `915958f` — Add ref indirection (index through ref values)
6. `2e40342` — Draw ref arrows permanently
7. `d3fe233` — Add edge case tests for ref indirection
8. `e14661d` — Add dynamic alloc expression returning ref
9. `352f61e` — Update deque demo to use all new features

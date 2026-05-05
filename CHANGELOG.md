# Changelog

## 2026-05-05 — Data Structure Visualizer

### Added

- **DS mode**: interactive visualizer for C++ standard data structures, accessible via sidebar tab or URL hash (`#ds=vector`)
- **vector\<T\>**: push_back, pop_back, insert, erase, reserve, clear, shrink_to_fit
  - Substep animations showing reallocation (allocate → copy → switch pointer → delete old)
  - Insert at capacity uses copy-with-gap (no redundant shift step)
  - Gap cell stays dimmed until the value is written
- **forward_list\<T\>**: push_front, pop_front, insert_after, erase_after, splice_after
  - Floating-node visualization during intermediate steps
  - splice_after uses C++ open-range semantics `(first, last)`
- **list\<T\>**: push_front, push_back, pop_front, pop_back, insert, erase, splice
  - Bidirectional arrows with vertical offset to avoid overlap
  - Sentinel arrows (head.prev → begin field, tail.next → end field) targeting box edges
  - splice uses C++ half-open range semantics `[first, last)`
  - Subchain shown in floating row during splice substeps
- **deque\<T\>**: push_front, push_back, pop_front, pop_back, insert, erase
  - Map-of-chunks layout with circular buffer addressing
  - Map growth visualization (old + new map shown simultaneously)
  - Insert shifts the smaller side (left or right)
- **Substep animation system**: operations produce intermediate states, auto-animated at 500ms intervals
- **Two-level navigation**: Arrow keys for operations, Shift+arrows for substeps
- **History bar**: operation pills + substep dot indicators
- **Struct-field rendering**: vertical labels, touching cells, pointer dots with S-curve arrows

### Architecture

- `DataStructure<S>` interface: `createInitialState`, `applyOperation` (returns `DSSubstep<S>[]`), `computeLayout`
- Pure functional operation model: each substep is an independently renderable state
- Shared `rectEdgeIntersection` utility for arrow termination at box edges
- Deque uses `logicalToPhysical` helper and `ensureRoomAtFront`/`ensureRoomAtBack` to keep operation code concise

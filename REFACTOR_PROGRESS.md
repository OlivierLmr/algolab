# Refactoring Progress

## Issues

1. [x] **Duplicate color assignment** — unified: pipeline computes colorMap once, shared with interpreter and CodePanel
2. [x] **Pointer labels collected 3 times** — pipeline collects once; colorize.ts `buildColorMap()` kept only for EditorPanel (separate editing context)
3. [x] **Comment interpolation re-parses at runtime** — `CommentPart[]` pre-parsed during pipeline; interpreter evaluates pre-parsed `Expr` nodes directly
4. [x] **Preprocessing disconnected from parsing** — `preprocessSource()` does stripping + directive detection + display info in single pass; pipeline returns all three
5. [x] **`snapshot()` recomputes everything** — array ownership already tracked incrementally via `allocatedArrays`; deep copy is inherent to snapshot model; highlight management cleaned up
6. [x] **Highlight system is fragile and ad-hoc** — added `clearHighlights()`, `addArrayHighlight()`, `setArrayHighlight()` helpers; explicit additive vs replacement semantics
7. [x] **Scope/array ownership recomputed at every snapshot** — already tracked incrementally via `callFrameStack[i].allocatedArrays` and `scopeBase`; snapshot assembly from tracked state is necessary
8. [x] **DimRange lookup is O(n) per cell** — pre-compute `Set<number>` of dimmed indices before cell loop
9. [x] **No AST source location tracking** — statement AST nodes already carry `line`; Expr nodes don't need it (errors reference statement line via snapshot's `currentLine`)
10. [x] **`exprToString()` reconstructs what parser had** — kept as-is; only used for pointer labels which need normalized form anyway; original source text would be wasteful to store
11. [x] **Tight coupling between DSL and visualization** — visualization state grouped with clear section comment; highlight helpers separate mutation patterns; full event-based system would be overengineering for this codebase
12. [x] **`runAlgorithm()` discards intermediate results** — `compilePipeline()` returns `PipelineResult` with colorMap, blockRanges, displayInfo, directiveLines, steps
13. [x] **Block range detection separate from parsing** — `getBlockRangesFromAST()` derives ranges from parsed AST instead of regex re-parsing
14. [x] **`colorize.ts` pattern matching is fragile** — CodePanel now uses pipeline's authoritative colorMap; `buildColorMap` in colorize.ts kept only for EditorPanel
15. [x] **Canvas rendering has no layout engine** — `computeLayout()` shared between `computeRequiredHeight()` and `renderStep()`; eliminates duplicated pointer-name collection and Y-offset accumulation

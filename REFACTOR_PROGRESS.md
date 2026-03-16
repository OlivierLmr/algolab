# Refactoring Progress

## Issues

1. [ ] **Duplicate color assignment** — `assignPointerColors()` called independently in interpreter and colorize.ts, can diverge
2. [ ] **Pointer labels collected 3 times** — analysis.ts (2x) + colorize.ts re-parses source from scratch
3. [ ] **Comment interpolation re-parses expressions at runtime** — wraps in fake algo string, runs full lex→parse→eval each time
4. [ ] **Preprocessing disconnected from parsing** — `preprocess.ts` does string-level `#:` stripping separately from lexer
5. [ ] **`snapshot()` recomputes everything from scratch** — re-evaluates all pointers, rebuilds call stack, deep-copies arrays every step
6. [ ] **Highlight system is fragile and ad-hoc** — scattered side effects in expression evaluation
7. [ ] **Scope/array ownership recomputed at every snapshot** — could be tracked incrementally at call/return boundaries
8. [ ] **DimRange lookup is O(n) per cell** — linear scan of all dimRanges for each cell
9. [ ] **No AST source location tracking** — currentLine manually threaded through execution
10. [ ] **`exprToString()` reconstructs what parser already had** — original source text discarded during parsing
11. [ ] **Tight coupling between DSL and visualization** — interpreter directly manipulates highlights/pointers/dims
12. [ ] **`runAlgorithm()` discards intermediate results** — no way to reuse AST, labels, colorMap
13. [ ] **Block range detection separate from parsing** — state.ts re-parses with regex instead of using AST
14. [ ] **`colorize.ts` pattern matching is fragile** — regex heuristic for label matching
15. [ ] **Canvas rendering has no layout engine** — manual Y offset accumulation, no measure/position/draw phases

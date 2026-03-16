import { currentAlgo, currentStep, isCustomMode, isRunMode, toggleRunMode, editBuiltIn, availableFunctions, skippedFunctions, toggleSkipFunction, functionLineRanges } from '../state.ts'
import { getDisplayInfo } from '../dsl/preprocess.ts'
import { buildColorMap, colorizeTokens, isDirectiveLine } from './colorize.ts'
import { useMemo } from 'preact/hooks'

export function CodePanel() {
  const algo = currentAlgo.value
  const step = currentStep.value
  const custom = isCustomMode.value

  const { lines, lineMap, colorMap } = useMemo(() => {
    if (custom) {
      // Custom run mode: show all lines, direct line index mapping
      return {
        lines: algo.source.split('\n'),
        lineMap: null,
        colorMap: buildColorMap(algo.source),
      }
    }
    // Built-in: hide directive lines, use lineMap for active line
    const info = getDisplayInfo(algo.source)
    return {
      lines: info.lines,
      lineMap: info.lineMap,
      colorMap: buildColorMap(algo.source),
    }
  }, [algo.source, custom])

  const activeLine = step
    ? (lineMap ? lineMap.get(step.currentLine) : step.currentLine)
    : undefined

  // Build set of display line indices belonging to skipped functions
  const skipped = skippedFunctions.value
  const skippedLineSet = useMemo(() => {
    const set = new Set<number>()
    if (skipped.size === 0) return set
    const ranges = functionLineRanges.value
    // Build reverse map: display line → source line (for built-in algos with lineMap)
    let reverseMap: Map<number, number> | null = null
    if (lineMap) {
      reverseMap = new Map()
      lineMap.forEach((displayLine, sourceLine) => {
        reverseMap!.set(displayLine, sourceLine)
      })
    }
    for (const range of ranges) {
      if (!skipped.has(range.name)) continue
      // Mark body lines (startLine+1 to endLine) — keep the def line visible
      for (let srcLine = range.startLine + 1; srcLine <= range.endLine; srcLine++) {
        if (lineMap) {
          const displayLine = lineMap.get(srcLine)
          if (displayLine !== undefined) set.add(displayLine)
        } else {
          set.add(srcLine)
        }
      }
    }
    return set
  }, [algo.source, custom, skipped])

  const funcs = availableFunctions.value

  // Show variables from global scope + innermost call frame
  const allVars: Record<string, number> = { ...(step?.variables ?? {}) }
  if (step && step.callStack.length > 0) {
    const innermost = step.callStack[step.callStack.length - 1]
    Object.assign(allVars, innermost.variables)
  }
  const varEntries = Object.entries(allVars)

  return (
    <div class="code-panel">
      <div class="code-panel-toolbar">
        {custom && isRunMode.value ? (
          <>
            <span class="code-panel-toolbar-title">Running</span>
            <button class="editor-btn" onClick={toggleRunMode}>Edit</button>
          </>
        ) : !custom ? (
          <>
            <span class="code-panel-toolbar-title">Code</span>
            <button class="editor-btn" onClick={editBuiltIn}>Edit</button>
          </>
        ) : null}
      </div>
      <pre>
        {lines.map((line, i) => {
          const directive = custom && isDirectiveLine(line)
          return (
            <div
              key={i}
              class={`code-line ${i === activeLine ? 'code-line-active' : ''} ${directive ? 'code-line-directive' : ''} ${skippedLineSet.has(i) ? 'code-line-skipped' : ''}`}
            >
              <span class="line-number">{i + 1}</span>
              {colorizeTokens(line, colorMap)}
            </div>
          )
        })}
      </pre>
      {funcs.length > 0 && (
        <div class="functions-section">
          <div class="functions-title">Functions</div>
          {funcs.map((name) => (
            <label key={name} class="function-toggle">
              <input
                type="checkbox"
                checked={skipped.has(name)}
                onChange={() => toggleSkipFunction(name)}
              />
              Skip {name}
            </label>
          ))}
        </div>
      )}
      {varEntries.length > 0 && (
        <div class="variables-section">
          <div class="variables-title">Variables</div>
          {varEntries.map(([name, value]) => (
            <div key={name} class="variable-entry">
              <span style={colorMap.has(name) ? { color: colorMap.get(name), fontWeight: 'bold' } : undefined}>
                {name}
              </span>
              {' = '}
              {value}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { currentAlgo, currentStep, isCustomMode, isRunMode, toggleRunMode, editBuiltIn, disabledLines, toggleBreakpoint, pipelineColorMap, pipelineDisplayInfo } from '../state.ts'
import { colorizeTokens, isDirectiveLine } from './colorize.ts'
import { useMemo } from 'preact/hooks'

export function CodePanel() {
  const algo = currentAlgo.value
  const step = currentStep.value
  const custom = isCustomMode.value
  const colorMap = pipelineColorMap.value
  const displayInfo = pipelineDisplayInfo.value

  const { lines, lineMap } = useMemo(() => {
    if (custom || !displayInfo) {
      return { lines: algo.source.split('\n'), lineMap: null }
    }
    return { lines: displayInfo.lines, lineMap: displayInfo.lineMap }
  }, [algo.source, custom, displayInfo])

  const activeLine = step
    ? (lineMap ? lineMap.get(step.currentLine) : step.currentLine)
    : undefined

  const disabled = disabledLines.value

  // Build reverse map: display index → source index (for built-in algos with lineMap)
  const reverseLineMap = useMemo(() => {
    if (!lineMap) return null
    const rev = new Map<number, number>()
    lineMap.forEach((displayLine, sourceLine) => {
      rev.set(displayLine, sourceLine)
    })
    return rev
  }, [lineMap])

  // Build set of display line indices that are disabled
  const disabledDisplayLines = useMemo(() => {
    const set = new Set<number>()
    if (disabled.size === 0) return set
    if (lineMap) {
      disabled.forEach((srcLine) => {
        const displayLine = lineMap.get(srcLine)
        if (displayLine !== undefined) set.add(displayLine)
      })
    } else {
      disabled.forEach((srcLine) => set.add(srcLine))
    }
    return set
  }, [algo.source, custom, disabled])

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
          const sourceLine = reverseLineMap ? (reverseLineMap.get(i) ?? i) : i
          const isDisabled = disabledDisplayLines.has(i)
          const isEmpty = line.trim() === ''
          return (
            <div
              key={i}
              class={`code-line ${i === activeLine ? 'code-line-active' : ''} ${directive ? 'code-line-directive' : ''} ${isDisabled ? 'code-line-skipped' : ''}`}
            >
              <span class={`breakpoint-gutter ${isEmpty ? 'breakpoint-gutter-empty' : ''}`} onClick={isEmpty ? undefined : () => toggleBreakpoint(sourceLine)}>
                {!isEmpty && <span class={`breakpoint-dot ${isDisabled ? 'breakpoint-dot-disabled' : ''}`} />}
              </span>
              <span class="line-number">{i + 1}</span>
              {colorizeTokens(line, colorMap)}
            </div>
          )
        })}
      </pre>
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

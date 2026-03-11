import { currentAlgo, currentStep, isCustomMode, isRunMode, toggleRunMode } from '../state.ts'
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
  const variables = step?.variables ?? {}
  const varEntries = Object.entries(variables)

  return (
    <div class="code-panel">
      {custom && isRunMode.value && (
        <div class="code-panel-toolbar">
          <span class="code-panel-toolbar-title">Running</span>
          <button class="editor-btn" onClick={toggleRunMode}>Edit</button>
        </div>
      )}
      <pre>
        {lines.map((line, i) => {
          const directive = custom && isDirectiveLine(line)
          return (
            <div
              key={i}
              class={`code-line ${i === activeLine ? 'code-line-active' : ''} ${directive ? 'code-line-directive' : ''}`}
            >
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

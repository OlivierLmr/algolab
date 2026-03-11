import { currentAlgo, currentStep, isCustomMode, isRunMode, toggleRunMode } from '../state.ts'
import { buildColorMap, colorizeTokens, isDirectiveLine } from './colorize.ts'
import { useMemo } from 'preact/hooks'

export function CodePanel() {
  const algo = currentAlgo.value
  const step = currentStep.value

  const { allLines, colorMap } = useMemo(() => {
    return {
      allLines: algo.source.split('\n'),
      colorMap: buildColorMap(algo.source),
    }
  }, [algo.source])

  // step.currentLine is the raw source line index (0-based)
  const activeLine = step?.currentLine
  const variables = step?.variables ?? {}
  const varEntries = Object.entries(variables)

  return (
    <div class="code-panel">
      {isCustomMode.value && isRunMode.value && (
        <div class="code-panel-toolbar">
          <span class="code-panel-toolbar-title">Running</span>
          <button class="editor-btn" onClick={toggleRunMode}>Edit</button>
        </div>
      )}
      <pre>
        {allLines.map((line, i) => {
          const directive = isDirectiveLine(line)
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

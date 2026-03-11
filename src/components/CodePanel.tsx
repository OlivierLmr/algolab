import { currentAlgo, currentStep, isCustomMode, isRunMode, toggleRunMode } from '../state.ts'
import { getDisplayInfo } from '../dsl/preprocess.ts'
import { buildColorMap, colorizeTokens } from './colorize.ts'
import { useMemo } from 'preact/hooks'

export function CodePanel() {
  const algo = currentAlgo.value
  const step = currentStep.value

  const { displayLines, lineMap, colorMap } = useMemo(() => {
    const info = getDisplayInfo(algo.source)
    return {
      displayLines: info.lines,
      lineMap: info.lineMap,
      colorMap: buildColorMap(algo.source),
    }
  }, [algo.source])

  const displayLine = step ? lineMap.get(step.currentLine) : undefined
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
        {displayLines.map((line, i) => (
          <div
            key={i}
            class={`code-line ${i === displayLine ? 'code-line-active' : ''}`}
          >
            <span class="line-number">{i + 1}</span>
            {colorizeTokens(line, colorMap)}
          </div>
        ))}
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

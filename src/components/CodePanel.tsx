import { currentAlgo, currentStep } from '../state.ts'
import { assignPointerColors } from '../renderer/colors.ts'
import { lex } from '../dsl/lexer.ts'
import { parse } from '../dsl/parser.ts'
import { stripDirectivePrefix, getDisplayInfo } from '../dsl/preprocess.ts'
import { getPointerVarNames } from '../dsl/analysis.ts'
import { useMemo } from 'preact/hooks'

/** Extract pointer variable names from the algorithm source. */
function extractPointerVarNames(source: string): string[] {
  try {
    const tokens = lex(stripDirectivePrefix(source))
    const ast = parse(tokens)
    return getPointerVarNames(ast.body)
  } catch {
    return []
  }
}

/** Render a line of code with colored variable names. */
function colorizeTokens(line: string, colorMap: Map<string, string>): preact.JSX.Element {
  if (colorMap.size === 0) return <>{line}</>

  // Build a regex that matches any of the pointer variable names as whole words
  const varNames = [...colorMap.keys()].sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`\\b(${varNames.map(escapeRegex).join('|')})\\b`, 'g')

  const parts: preact.JSX.Element[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span>{line.slice(lastIndex, match.index)}</span>)
    }
    const varName = match[1]
    parts.push(
      <span style={{ color: colorMap.get(varName), fontWeight: 'bold' }}>{varName}</span>
    )
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < line.length) {
    parts.push(<span>{line.slice(lastIndex)}</span>)
  }

  return <>{parts}</>
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function CodePanel() {
  const algo = currentAlgo.value
  const step = currentStep.value

  const { displayLines, lineMap, colorMap } = useMemo(() => {
    const info = getDisplayInfo(algo.source)
    const varNames = extractPointerVarNames(algo.source)
    return {
      displayLines: info.lines,
      lineMap: info.lineMap,
      colorMap: assignPointerColors(varNames),
    }
  }, [algo.source])

  const displayLine = step ? lineMap.get(step.currentLine) : undefined
  const variables = step?.variables ?? {}
  const varEntries = Object.entries(variables)

  return (
    <div class="code-panel">
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

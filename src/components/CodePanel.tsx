import { currentAlgo, currentStep, isCustomMode, isRunMode, toggleRunMode, editBuiltIn, disabledLines, toggleBreakpoint, pipelineColorMap, pipelineDisplayInfo, hoveredDescriptionLine } from '../state.ts'
import { colorizeTokens, isDirectiveLine } from './colorize.ts'
import { useMemo, useRef, useCallback } from 'preact/hooks'
import { useSignal } from '@preact/signals'
import { evaluateTooltip } from '../tooltip.ts'

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

  const hoveredLine = hoveredDescriptionLine.value
  const hoveredDisplayLine = hoveredLine !== null
    ? (lineMap ? lineMap.get(hoveredLine) : hoveredLine)
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

  // Show variables from global scope + innermost call frame (non-iterator only)
  const allVars: Record<string, number> = {}
  if (step) {
    for (const [name, val] of Object.entries(step.variables)) {
      if (val.arrays.length === 0) allVars[name] = val.num
    }
    if (step.callStack.length > 0) {
      const innermost = step.callStack[step.callStack.length - 1]
      for (const [name, val] of Object.entries(innermost.variables)) {
        if (val.arrays.length === 0) allVars[name] = val.num
      }
    }
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
              class={`code-line ${i === activeLine ? 'code-line-active' : ''} ${i === hoveredDisplayLine && i !== activeLine ? 'code-line-hovered' : ''} ${directive ? 'code-line-directive' : ''} ${isDisabled ? 'code-line-skipped' : ''}`}
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
        <VariablesSection varEntries={varEntries} colorMap={colorMap} step={step!} />
      )}
    </div>
  )
}

import type { Step } from '../types.ts'

function VariablesSection({ varEntries, colorMap, step }: {
  varEntries: [string, number][]
  colorMap: Map<string, string>
  step: Step
}) {
  const tooltipInfo = useSignal<{ text: string; x: number; y: number } | null>(null)
  const sectionRef = useRef<HTMLDivElement>(null)

  const onMouseEnter = useCallback((name: string, value: number, e: MouseEvent) => {
    const template = step.tooltips[name]
    if (!template) return
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const sectionRect = sectionRef.current?.getBoundingClientRect()
    if (!sectionRect) return
    const text = evaluateTooltip(template, step, { value })
    tooltipInfo.value = {
      text,
      x: rect.left + rect.width / 2 - sectionRect.left,
      y: rect.top - sectionRect.top,
    }
  }, [step])

  const onMouseLeave = useCallback(() => {
    tooltipInfo.value = null
  }, [])

  return (
    <div class="variables-section" ref={sectionRef} style={{ position: 'relative' }}>
      <div class="variables-title">Variables</div>
      {varEntries.map(([name, value]) => (
        <div
          key={name}
          class="variable-entry"
          onMouseEnter={(e: MouseEvent) => onMouseEnter(name, value, e)}
          onMouseLeave={onMouseLeave}
        >
          <span style={colorMap.has(name) ? { color: colorMap.get(name), fontWeight: 'bold' } : undefined}>
            {name}
          </span>
          {' = '}
          {value}
        </div>
      ))}
      {tooltipInfo.value && (
        <div
          class="viz-tooltip"
          style={{
            left: tooltipInfo.value.x,
            top: tooltipInfo.value.y,
          }}
        >
          {tooltipInfo.value.text}
        </div>
      )}
    </div>
  )
}

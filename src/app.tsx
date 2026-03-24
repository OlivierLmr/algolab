import './styles.css'
import './styles/visualizer.css'
import { useEffect } from 'preact/hooks'
import { Header } from './components/Header.tsx'
import { ChangelogBanner } from './components/ChangelogBanner.tsx'
import { CodePanel } from './components/CodePanel.tsx'
import { EditorPanel } from './components/EditorPanel.tsx'
import { ResizeHandle } from './components/ResizeHandle.tsx'
import { StepVisualizer } from './components/visualizer/StepVisualizer.tsx'
import { Controls } from './components/Controls.tsx'
import { DslDocs } from './components/DslDocs.tsx'
import type { DescriptionSegment } from './types.ts'
import { evaluateTooltip } from './tooltip.ts'
import { currentStep, recentDescriptions, hoveredDescriptionLine, nextStep, prevStep, stepOver, stepOut, stepOverBack, stepOutBack, isCustomMode, isRunMode, codePanelWidth } from './state.ts'

function renderSegments(segments: DescriptionSegment[], tooltips?: Record<string, string>, step?: import('./types.ts').Step | null) {
  return segments.map((seg, i) => {
    if (seg.type === 'text') return <span key={i}>{seg.text}</span>
    let title: string | undefined
    if (tooltips && step && seg.name in tooltips) {
      title = evaluateTooltip(tooltips[seg.name], step, { value: seg.value })
    }
    return (
      <span
        key={i}
        class={`var-pill${title ? ' var-pill-has-tooltip' : ''}`}
        style={{ borderColor: seg.color, color: seg.color }}
        data-tooltip={title}
        tabIndex={title ? 0 : undefined}
      >
        {seg.display !== 'value' && <span class={seg.display === 'name' ? 'var-pill-name-only' : 'var-pill-name'}>{seg.name}</span>}
        {seg.display !== 'name' && <span class="var-pill-value">{seg.value}</span>}
      </span>
    )
  })
}

/** Isolated component that subscribes to step-related signals,
 *  preventing App from re-rendering the entire tree on each step change. */
function DescriptionPanel() {
  const step = currentStep.value
  const descriptions = recentDescriptions.value
  const maxBlockDepth = step?.blockDescriptions.length
    ? Math.max(...step.blockDescriptions.map(bd => bd.depth)) + 1
    : 0
  const oneShotIndent = maxBlockDepth * 16
  return (
    <>
      {step?.blockDescriptions.map((bd, i) => (
        <div
          key={i}
          class="description-block"
          style={{ paddingLeft: bd.depth * 16 }}
          onMouseEnter={() => { hoveredDescriptionLine.value = bd.line }}
          onMouseLeave={() => { hoveredDescriptionLine.value = null }}
        >
          {renderSegments(bd.parts, step?.tooltips, step)}
        </div>
      ))}
      {descriptions.map((d, i) => (
        <div
          key={i}
          class="description-previous"
          style={{ paddingLeft: oneShotIndent }}
          onMouseEnter={() => { hoveredDescriptionLine.value = d.line }}
          onMouseLeave={() => { hoveredDescriptionLine.value = null }}
        >
          {renderSegments(d.parts, step?.tooltips, step)}
        </div>
      ))}
      {step?.description ? (
        <div
          class="description-current"
          style={{ paddingLeft: oneShotIndent }}
          onMouseEnter={() => { if (step) hoveredDescriptionLine.value = step.currentLine }}
          onMouseLeave={() => { hoveredDescriptionLine.value = null }}
        >
          {renderSegments(step.descriptionParts, step?.tooltips, step)}
        </div>
      ) : null}
    </>
  )
}

export function App() {
  const editMode = isCustomMode.value && !isRunMode.value

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.shiftKey && e.key === 'ArrowRight') { e.preventDefault(); stepOver() }
      else if (e.shiftKey && e.key === 'ArrowLeft') { e.preventDefault(); stepOverBack() }
      else if (e.shiftKey && e.key === 'ArrowUp') { e.preventDefault(); stepOut() }
      else if (e.shiftKey && e.key === 'ArrowDown') { e.preventDefault(); stepOutBack() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nextStep() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prevStep() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const gridColumns = `${codePanelWidth.value}px 0px 1fr`

  return (
    <>
      <Header />
      <ChangelogBanner />
      <div class="main-layout" style={{ gridTemplateColumns: gridColumns }}>
        {isCustomMode.value && !isRunMode.value ? <EditorPanel /> : <CodePanel />}
        <ResizeHandle />
        <div class={`right-column ${editMode ? 'dimmed' : ''}`}>
          <div class="canvas-wrapper">
            <StepVisualizer />
          </div>
          <div class="description">
            <DescriptionPanel />
          </div>
        </div>
      </div>
      <Controls />
      {editMode && <DslDocs />}
    </>
  )
}

import './styles.css'
import { useEffect } from 'preact/hooks'
import { Header } from './components/Header.tsx'
import { ChangelogBanner } from './components/ChangelogBanner.tsx'
import { CodePanel } from './components/CodePanel.tsx'
import { EditorPanel } from './components/EditorPanel.tsx'
import { ResizeHandle } from './components/ResizeHandle.tsx'
import { CanvasVisualizer } from './components/CanvasVisualizer.tsx'
import { Controls } from './components/Controls.tsx'
import { DslDocs } from './components/DslDocs.tsx'
import { currentStep, recentDescriptions, nextStep, prevStep, stepOver, stepOut, isCustomMode, isRunMode, codePanelWidth } from './state.ts'

export function App() {
  const step = currentStep.value
  const editMode = isCustomMode.value && !isRunMode.value

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.shiftKey && e.key === 'ArrowRight') { e.preventDefault(); stepOver() }
      else if (e.shiftKey && e.key === 'ArrowUp') { e.preventDefault(); stepOut() }
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
        <div class={`canvas-wrapper ${editMode ? 'dimmed' : ''}`}>
          <CanvasVisualizer />
        </div>
        <div class={`description ${editMode ? 'dimmed' : ''}`}>
          {recentDescriptions.value.map((d) => (
            <div class="description-previous">{d}</div>
          ))}
          <div class="description-current">{step?.description || ''}</div>
        </div>
      </div>
      <Controls />
      {editMode && <DslDocs />}
    </>
  )
}

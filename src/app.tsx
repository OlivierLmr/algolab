import './styles.css'
import { useEffect } from 'preact/hooks'
import { Header } from './components/Header.tsx'
import { CodePanel } from './components/CodePanel.tsx'
import { CanvasVisualizer } from './components/CanvasVisualizer.tsx'
import { Controls } from './components/Controls.tsx'
import { currentStep, recentDescriptions, nextStep, prevStep } from './state.ts'

export function App() {
  const step = currentStep.value

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') { e.preventDefault(); nextStep() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prevStep() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <Header />
      <div class="main-layout">
        <CodePanel />
        <CanvasVisualizer />
        <div class="description">
          {recentDescriptions.value.map((d) => (
            <div class="description-previous">{d}</div>
          ))}
          <div class="description-current">{step?.description || ''}</div>
        </div>
      </div>
      <Controls />
    </>
  )
}

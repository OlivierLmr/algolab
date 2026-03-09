import './styles.css'
import { useEffect } from 'preact/hooks'
import { Header } from './components/Header.tsx'
import { CodePanel } from './components/CodePanel.tsx'
import { CanvasVisualizer } from './components/CanvasVisualizer.tsx'
import { Controls } from './components/Controls.tsx'
import { currentStep, nextStep, prevStep } from './state.ts'

export function App() {
  const step = currentStep.value

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') nextStep()
      else if (e.key === 'ArrowLeft') prevStep()
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
      </div>
      <Controls />
      <div class="description">
        {step?.description || ''}
      </div>
    </>
  )
}

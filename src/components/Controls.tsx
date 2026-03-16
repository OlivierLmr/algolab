import { currentStepIndex, totalSteps, nextStep, prevStep, stepOver, stepOut, stepOverBack, stepOutBack, goToStep, steps, isCustomMode, isRunMode } from '../state.ts'

export function Controls() {
  const step = currentStepIndex.value
  const total = totalSteps.value
  const editMode = isCustomMode.value && !isRunMode.value

  if (total === 0) {
    return (
      <div class={`controls ${editMode ? 'dimmed' : ''}`}>
        <span class="step-counter">No steps</span>
      </div>
    )
  }

  return (
    <div class={`controls ${editMode ? 'dimmed' : ''}`}>
      <button onClick={stepOutBack} disabled={step === 0 || (steps.value[step]?.callStack.length ?? 0) === 0} title="Step out backward — jump back to before the current function was called">
        <span class="shortcut-label">Shift+↓</span> Out
      </button>
      <button onClick={stepOverBack} disabled={step === 0} title="Step over backward — skip back over function calls">
        <span class="shortcut-label">Shift+←</span> Over
      </button>
      <button onClick={prevStep} disabled={step === 0} title="Previous step">
        Previous
      </button>
      <input
        type="range"
        min={0}
        max={total - 1}
        value={step}
        onInput={(e) => goToStep(Number((e.target as HTMLInputElement).value))}
      />
      <button onClick={nextStep} disabled={step >= total - 1} title="Next step">
        Next
      </button>
      <button onClick={stepOver} disabled={step >= total - 1} title="Step over — skip over function calls">
        Over <span class="shortcut-label">Shift+→</span>
      </button>
      <button onClick={stepOut} disabled={step >= total - 1 || (steps.value[step]?.callStack.length ?? 0) === 0} title="Step out — jump to after the current function returns">
        Out <span class="shortcut-label">Shift+↑</span>
      </button>
      <span class="step-counter">
        Step {step + 1} / {total}
      </span>
    </div>
  )
}

import { currentStepIndex, totalSteps, nextStep, prevStep, goToStep } from '../state.ts'

export function Controls() {
  const step = currentStepIndex.value
  const total = totalSteps.value

  if (total === 0) {
    return (
      <div class="controls">
        <span class="step-counter">No steps</span>
      </div>
    )
  }

  return (
    <div class="controls">
      <button onClick={prevStep} disabled={step === 0}>
        Previous
      </button>
      <input
        type="range"
        min={0}
        max={total - 1}
        value={step}
        onInput={(e) => goToStep(Number((e.target as HTMLInputElement).value))}
      />
      <button onClick={nextStep} disabled={step >= total - 1}>
        Next
      </button>
      <span class="step-counter">
        Step {step + 1} / {total}
      </span>
    </div>
  )
}

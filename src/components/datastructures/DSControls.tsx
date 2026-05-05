import { useSignal } from '@preact/signals'
import type { OperationDef } from '../../datastructures/types.ts'
import {
  currentDS, currentDSSnapshot,
  applyDSOp, initDS,
} from '../../datastructures/state.ts'

export function DSControls() {
  const ds = currentDS.value
  const snapshot = currentDSSnapshot.value
  const inputText = useSignal('1, 2, 3, 4, 5')

  if (!snapshot) return null

  return (
    <div class="ds-controls">
      <div class="ds-controls-header">
        <span class="ds-controls-title">{ds.name}</span>
        <div class="ds-controls-init">
          <input
            class="ds-controls-input"
            type="text"
            value={inputText.value}
            onInput={(e) => { inputText.value = (e.target as HTMLInputElement).value }}
            placeholder="Initial values"
          />
          <button
            class="ds-controls-btn"
            onClick={() => {
              const nums = inputText.value.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n))
              initDS(nums)
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div class="ds-controls-ops">
        {ds.operations.map(op => (
          <OperationButton key={op.name} op={op} />
        ))}
      </div>
    </div>
  )
}

function OperationButton({ op }: { op: OperationDef }) {
  const argValues = op.args.map(a => useSignal(String(a.defaultValue ?? 0)))

  const execute = () => {
    try {
      const args: Record<string, number> = {}
      for (let i = 0; i < op.args.length; i++) {
        args[op.args[i].name] = Number(argValues[i].value)
      }
      applyDSOp(op.name, args)
    } catch (e) {
      console.warn(`Operation failed: ${e instanceof Error ? e.message : e}`)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') execute()
  }

  return (
    <div class="ds-op">
      <span class="ds-op-name">{op.name}</span>
      <span class="ds-op-paren">(</span>
      {op.args.map((arg, i) => (
        <>
          {i > 0 && <span class="ds-op-comma">,</span>}
          <div key={arg.name} class="ds-op-arg-group">
            <label class="ds-op-arg-label">{arg.label}</label>
            <input
              class="ds-op-arg-input"
              type="number"
              value={argValues[i].value}
              onInput={(e) => { argValues[i].value = (e.target as HTMLInputElement).value }}
              onKeyDown={handleKeyDown}
            />
          </div>
        </>
      ))}
      <span class="ds-op-paren">)</span>
      <button class="ds-op-submit" onClick={execute} title="Execute">
        <svg viewBox="0 0 20 20" width="18" height="18">
          <polyline points="4,10 9,15 16,5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  )
}

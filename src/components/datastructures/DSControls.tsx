import { useSignal } from '@preact/signals'
import type { OperationDef } from '../../datastructures/types.ts'
import {
  currentDS, currentDSSnapshot, dsHistory, dsHistoryIndex,
  applyDSOp, dsUndo, dsRedo, initDS,
} from '../../datastructures/state.ts'

export function DSControls() {
  const ds = currentDS.value
  const snapshot = currentDSSnapshot.value
  const historyLen = dsHistory.value.length
  const histIdx = dsHistoryIndex.value
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

      <div class="ds-controls-history">
        <button
          class="ds-controls-btn"
          disabled={histIdx <= 0}
          onClick={dsUndo}
          title="Undo"
        >
          &#8592; Undo
        </button>
        <span class="ds-controls-history-pos">
          {histIdx + 1} / {historyLen}
        </span>
        <button
          class="ds-controls-btn"
          disabled={histIdx >= historyLen - 1}
          onClick={dsRedo}
          title="Redo"
        >
          Redo &#8594;
        </button>
      </div>

      <div class="ds-controls-log">
        {dsHistory.value.map((snap, i) => (
          <span
            key={i}
            class={`ds-controls-log-entry${i === histIdx ? ' ds-controls-log-current' : ''}`}
          >
            {snap.label}
          </span>
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
      // Show error briefly — for now just log
      console.warn(`Operation failed: ${e instanceof Error ? e.message : e}`)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') execute()
  }

  return (
    <div class="ds-op">
      <button class="ds-op-btn" onClick={execute}>{op.label}</button>
      {op.args.map((arg, i) => (
        <input
          key={arg.name}
          class="ds-op-arg"
          type="number"
          value={argValues[i].value}
          onInput={(e) => { argValues[i].value = (e.target as HTMLInputElement).value }}
          onKeyDown={handleKeyDown}
          placeholder={arg.label}
          title={arg.label}
        />
      ))}
    </div>
  )
}

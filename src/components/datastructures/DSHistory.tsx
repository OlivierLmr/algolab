import {
  dsHistory, dsHistoryIndex,
  dsUndo, dsRedo,
} from '../../datastructures/state.ts'

export function DSHistory() {
  const history = dsHistory.value
  const histIdx = dsHistoryIndex.value

  if (history.length === 0) return null

  return (
    <div class="ds-history">
      <button
        class="ds-history-btn"
        disabled={histIdx <= 0}
        onClick={dsUndo}
        title="Undo (step back)"
      >
        &#8592;
      </button>
      <div class="ds-history-log">
        {history.map((snap, i) => (
          <span
            key={i}
            class={`ds-history-entry${i === histIdx ? ' ds-history-current' : ''}${i > histIdx ? ' ds-history-future' : ''}`}
          >
            {snap.label}
          </span>
        ))}
      </div>
      <button
        class="ds-history-btn"
        disabled={histIdx >= history.length - 1}
        onClick={dsRedo}
        title="Redo (step forward)"
      >
        &#8594;
      </button>
    </div>
  )
}

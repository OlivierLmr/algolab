import {
  dsHistory, dsOpIndex, dsSubstepIndex,
  dsGoToOp, dsGoToSubstep,
  dsPrev, dsNext,
} from '../../datastructures/state.ts'

export function DSHistory() {
  const history = dsHistory.value
  const opIdx = dsOpIndex.value
  const substepIdx = dsSubstepIndex.value

  if (history.length === 0) return null

  const currentOp = history[opIdx]

  return (
    <div class="ds-history">
      <button
        class="ds-history-btn"
        disabled={opIdx <= 0}
        onClick={dsPrev}
        title="Previous operation (←)"
      >
        &#8592;
      </button>
      <div class="ds-history-content">
        <div class="ds-history-ops">
          {history.map((op, i) => (
            <span
              key={i}
              class={`ds-history-entry${i === opIdx ? ' ds-history-current' : ''}${i > opIdx ? ' ds-history-future' : ''}`}
              onClick={() => dsGoToOp(i)}
            >
              {op.label}
            </span>
          ))}
        </div>
        {currentOp && currentOp.substeps.length > 1 && (
          <div class="ds-history-substeps">
            {currentOp.substeps.map((_, i) => (
              <span
                key={i}
                class={`ds-substep-dot${i === substepIdx ? ' ds-substep-current' : ''}${i < substepIdx ? ' ds-substep-visited' : ''}`}
                onClick={() => dsGoToSubstep(i)}
                title={currentOp.substeps[i].description}
              />
            ))}
          </div>
        )}
      </div>
      <button
        class="ds-history-btn"
        disabled={opIdx >= history.length - 1}
        onClick={dsNext}
        title="Next operation (→)"
      >
        &#8594;
      </button>
    </div>
  )
}

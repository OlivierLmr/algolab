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
      <div class="ds-history-ops">
        {history.map((op, i) => {
          const isCurrent = i === opIdx
          const isFuture = i > opIdx
          return (
            <div key={i} class="ds-history-op-col">
              <span
                class={`ds-history-entry${isCurrent ? ' ds-history-current' : ''}${isFuture ? ' ds-history-future' : ''}`}
                onClick={() => dsGoToOp(i)}
              >
                {op.label}
              </span>
              {op.substeps.length > 1 && (
                <div class="ds-history-substeps">
                  {op.substeps.map((_, si) => {
                    const isActive = isCurrent && si === substepIdx
                    const isVisited = isCurrent ? si < substepIdx : !isFuture
                    return (
                      <span
                        key={si}
                        class={`ds-substep-rect${isActive ? ' ds-substep-active' : ''}${isVisited ? ' ds-substep-visited' : ''}${isFuture ? ' ds-substep-future' : ''}`}
                        onClick={() => {
                          if (i !== opIdx) dsGoToOp(i)
                          // After navigating to the op, go to this substep
                          dsGoToSubstep(si)
                        }}
                        title={op.substeps[si].description}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
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

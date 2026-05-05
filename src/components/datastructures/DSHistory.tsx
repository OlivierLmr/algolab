import {
  dsHistory, dsOpIndex, dsSubstepIndex,
  dsGoToOp, dsGoToSubstep,
  dsPrev, dsNext, dsPrevSubstep, dsNextSubstep,
} from '../../datastructures/state.ts'

export function DSHistory() {
  const history = dsHistory.value
  const opIdx = dsOpIndex.value
  const substepIdx = dsSubstepIndex.value

  if (history.length === 0) return null

  const currentOp = history[opIdx]
  const canPrevSubstep = substepIdx > 0 || opIdx > 0
  const canNextSubstep = (currentOp && substepIdx < currentOp.substeps.length - 1) || opIdx < history.length - 1

  return (
    <div class="ds-history">
      <div class="ds-history-nav">
        <button
          class="ds-history-btn"
          disabled={opIdx <= 0}
          onClick={dsPrev}
          title="Previous operation"
        >
          <span class="ds-btn-icon">&#8592;</span>
          <span class="ds-btn-shortcut">&#8592;</span>
        </button>
        <button
          class="ds-history-btn ds-history-btn-sub"
          disabled={!canPrevSubstep}
          onClick={dsPrevSubstep}
          title="Previous substep"
        >
          <span class="ds-btn-icon">&#8676;</span>
          <span class="ds-btn-shortcut">&#8679;&#8592;</span>
        </button>
      </div>
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
      <div class="ds-history-nav">
        <button
          class="ds-history-btn ds-history-btn-sub"
          disabled={!canNextSubstep}
          onClick={dsNextSubstep}
          title="Next substep"
        >
          <span class="ds-btn-icon">&#8677;</span>
          <span class="ds-btn-shortcut">&#8679;&#8594;</span>
        </button>
        <button
          class="ds-history-btn"
          disabled={opIdx >= history.length - 1}
          onClick={dsNext}
          title="Next operation"
        >
          <span class="ds-btn-icon">&#8594;</span>
          <span class="ds-btn-shortcut">&#8594;</span>
        </button>
      </div>
    </div>
  )
}

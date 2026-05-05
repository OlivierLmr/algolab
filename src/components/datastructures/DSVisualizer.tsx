import { currentDSLayout, currentDSOp, currentDSDescription, isIntermediateSubstep, dsSubstepIndex } from '../../datastructures/state.ts'
import type { FlatElement, CellData, LabelData, StructFieldData, TreeCircleData } from '../../layout/types.ts'
import { CELL_SIZE, DIMMED_OPACITY } from '../../layout/constants.ts'
import { DSArrowOverlay } from './DSArrowOverlay.tsx'

export function DSVisualizer() {
  const layout = currentDSLayout.value
  const op = currentDSOp.value
  const description = currentDSDescription.value
  const isIntermediate = isIntermediateSubstep.value
  const substepIdx = dsSubstepIndex.value

  if (!layout) {
    return <div class="viz-container" />
  }

  return (
    <div class="viz-container">
      <div class="ds-viz-column">
        <div
          class="viz-scene"
          style={{
            position: 'relative',
            width: layout.width,
            height: layout.height,
          }}
        >
          {layout.elements.map(el => (
            <DSElement key={el.id} el={el} />
          ))}

          <DSArrowOverlay
            arrows={layout.arrows}
            width={layout.width}
            height={layout.height}
          />
        </div>
        {isIntermediate && op && (
          <div class="ds-executing-banner">
            <span class="ds-executing-label">Executing {op.label}...</span>
            <span class="ds-executing-step">
              step {substepIdx + 1}/{op.substeps.length}: {description}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function DSElement({ el }: { el: FlatElement }) {
  switch (el.kind) {
    case 'struct-field':
      return <StructFieldElement el={el} />
    case 'cell':
      return <DSCellElement el={el} />
    case 'array-label':
      return <DSArrayLabelElement el={el} />
    case 'tree-circle':
      return <TreeCircleElement el={el} />
    default:
      return null
  }
}

function TreeCircleElement({ el }: { el: FlatElement }) {
  const data = el.data as TreeCircleData
  return (
    <div
      class="ds-tree-circle"
      style={{
        position: 'absolute',
        transform: `translate(${el.x}px, ${el.y}px)`,
        width: el.width,
        height: el.height,
        opacity: el.opacity,
      }}
    >
      <span class="ds-tree-circle-label">{data.label}</span>
    </div>
  )
}

function StructFieldElement({ el }: { el: FlatElement }) {
  const data = el.data as StructFieldData
  const labelHeight = el.height - CELL_SIZE
  return (
    <div
      class="ds-field-wrapper"
      style={{
        transform: `translate(${el.x}px, ${el.y}px)`,
        width: CELL_SIZE,
        height: el.height,
        opacity: el.opacity,
      }}
    >
      <div
        class="ds-field-label"
        style={{ height: labelHeight }}
      >
        <span class="ds-field-label-text">{data.name}</span>
      </div>
      <div
        class={`viz-cell${data.isPointer ? ' ds-field-pointer' : ''}`}
        style={{
          width: CELL_SIZE,
          height: CELL_SIZE,
          borderColor: '#999',
          borderWidth: 1.5,
        }}
      >
        <span class="viz-cell-value">{data.displayValue}</span>
      </div>
    </div>
  )
}

function DSCellElement({ el }: { el: FlatElement }) {
  const data = el.data as CellData

  return (
    <div
      class={`viz-cell-wrapper${data.hoverLabel ? ' ds-cell-with-hover' : ''}`}
      style={{
        transform: `translate(${el.x}px, ${el.y}px)`,
        width: CELL_SIZE,
        opacity: data.dimmed ? DIMMED_OPACITY : el.opacity,
      }}
    >
      {data.hoverLabel && (
        <div class="ds-cell-hover-wrapper">
          <span class="ds-cell-hover-label">{data.hoverLabel}</span>
        </div>
      )}
      <div
        class="viz-cell"
        style={{
          width: CELL_SIZE,
          height: CELL_SIZE,
          borderColor: '#999',
          borderWidth: 1.5,
        }}
      >
        <span class="viz-cell-value">
          {data.dimmed ? '' : (data.displayOverride ?? String(data.value.num))}
        </span>
      </div>
      {data.index >= 0 && <div class="viz-cell-index">{data.index}</div>}
    </div>
  )
}

function DSArrayLabelElement({ el }: { el: FlatElement }) {
  const data = el.data as LabelData
  if (!data.text) return null
  if (data.vertical) {
    return (
      <div
        class="ds-vertical-label"
        style={{
          position: 'absolute',
          transform: `translate(${el.x}px, ${el.y}px)`,
          width: el.width,
          height: el.height,
          opacity: el.opacity,
        }}
      >
        <span class="ds-vertical-label-text">{data.text}</span>
      </div>
    )
  }
  return (
    <div
      class="viz-array-label"
      style={{
        transform: `translate(${el.x}px, ${el.y}px)`,
        opacity: el.opacity,
      }}
    >
      {data.text}
    </div>
  )
}

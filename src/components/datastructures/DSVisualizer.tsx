import { useMemo } from 'preact/hooks'
import { currentDSLayout } from '../../datastructures/state.ts'
import type { FlatElement, CellData, LabelData, StructFieldData } from '../../layout/types.ts'
import { CELL_SIZE, DIMMED_OPACITY } from '../../layout/constants.ts'
import { DSArrowOverlay } from './DSArrowOverlay.tsx'

export function DSVisualizer() {
  const layout = currentDSLayout.value

  if (!layout) {
    return <div class="viz-container" />
  }

  return (
    <div class="viz-container">
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
    default:
      return null
  }
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
      class="viz-cell-wrapper"
      style={{
        transform: `translate(${el.x}px, ${el.y}px)`,
        width: CELL_SIZE,
        opacity: data.dimmed ? DIMMED_OPACITY : el.opacity,
      }}
    >
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
          {data.dimmed ? '' : String(data.value.num)}
        </span>
      </div>
      <div class="viz-cell-index">{data.index}</div>
    </div>
  )
}

function DSArrayLabelElement({ el }: { el: FlatElement }) {
  const data = el.data as LabelData
  if (!data.text) return null
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

import { useCallback } from 'preact/hooks'
import type { LayoutNode, CellData } from '../../layout/types.ts'
import { CELL_SIZE } from '../../layout/constants.ts'
import { getHighlightColor } from '../../renderer/colors.ts'
import { useRefRegistry } from './RefRegistry.tsx'

interface CellProps {
  node: LayoutNode
  onHoverCell?: (arrayName: string, cellIndex: number) => void
  onLeaveCell?: () => void
}

export function Cell({ node, onHoverCell, onLeaveCell }: CellProps) {
  const data = node.data as CellData
  const { registerRef } = useRefRegistry()

  const hasIteratorMeta = data.value.arrays.length > 0
  const displayVal = data.value.num === Infinity ? '\u221E' : String(data.value.num)

  const borderColor = data.highlightType
    ? getHighlightColor(data.highlightType)
    : hasIteratorMeta ? '#6ab0de' : '#999'
  const borderWidth = data.highlightType ? 3 : hasIteratorMeta ? 2 : 1.5

  // Gauge fill
  let gaugeFillHeight = 0
  if (data.gaugeRatio !== undefined) {
    const clamped = 0.15 + Math.max(0, Math.min(1, data.gaugeRatio)) * 0.7
    gaugeFillHeight = clamped * CELL_SIZE
  }

  const refCallback = useCallback((el: HTMLElement | null) => {
    registerRef(node.id, el)
  }, [node.id])

  const onMouseEnter = useCallback(() => {
    if (hasIteratorMeta && onHoverCell) {
      onHoverCell(data.arrayName, data.index)
    }
  }, [hasIteratorMeta, data.arrayName, data.index, onHoverCell])

  return (
    <div
      class="viz-cell-wrapper"
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: CELL_SIZE,
      }}
    >
      <div
        ref={refCallback}
        class="viz-cell"
        style={{
          width: CELL_SIZE,
          height: CELL_SIZE,
          borderColor,
          borderWidth,
          opacity: data.dimmed ? 0.3 : 1,
          cursor: hasIteratorMeta ? 'pointer' : undefined,
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onLeaveCell}
      >
        {data.gaugeRatio !== undefined && (
          <div
            class="viz-cell-gauge"
            style={{ height: gaugeFillHeight }}
          />
        )}
        {hasIteratorMeta && !data.highlightType && (
          <div class="viz-cell-dot" />
        )}
        <span class="viz-cell-value">{displayVal}</span>
      </div>
      <div class="viz-cell-index">{data.index}</div>
    </div>
  )
}

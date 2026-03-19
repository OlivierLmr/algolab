import { useCallback } from 'preact/hooks'
import type { LayoutNode, VariableData } from '../../layout/types.ts'
import { CELL_SIZE, VARIABLE_LABEL_HEIGHT } from '../../layout/constants.ts'
import { getHighlightColor } from '../../renderer/colors.ts'
import { useRefRegistry } from './RefRegistry.tsx'

interface VariableCellProps {
  node: LayoutNode
}

export function VariableCell({ node }: VariableCellProps) {
  const data = node.data as VariableData
  const { registerRef } = useRefRegistry()

  const borderColor = data.highlightType ? getHighlightColor(data.highlightType) : '#999'
  const borderWidth = data.highlightType ? 3 : 1.5

  const refCallback = useCallback((el: HTMLElement | null) => {
    registerRef(node.id, el)
  }, [node.id])

  return (
    <div
      class="viz-variable-wrapper"
      style={{
        position: 'absolute',
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: CELL_SIZE,
      }}
    >
      <div class="viz-variable-label">{data.name}</div>
      <div
        ref={refCallback}
        class="viz-cell"
        style={{
          width: CELL_SIZE,
          height: CELL_SIZE,
          borderColor,
          borderWidth,
          marginTop: VARIABLE_LABEL_HEIGHT,
        }}
      >
        <span class="viz-cell-value">{String(data.value.num)}</span>
      </div>
    </div>
  )
}

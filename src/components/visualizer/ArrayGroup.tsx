import type { LayoutNode, LabelData } from '../../layout/types.ts'
import { Cell } from './Cell.tsx'

interface ArrayGroupProps {
  node: LayoutNode
  onHoverCell?: (arrayName: string, cellIndex: number) => void
  onLeaveCell?: () => void
}

export function ArrayGroup({ node, onHoverCell, onLeaveCell }: ArrayGroupProps) {
  const children = node.children ?? []
  const label = children.find(c => c.kind === 'array-label')
  const cells = children.filter(c => c.kind === 'cell')

  return (
    <>
      {label && (
        <div
          class="viz-array-label"
          style={{
            position: 'absolute',
            transform: `translate(${label.x}px, ${label.y}px)`,
          }}
        >
          {(label.data as LabelData).text}
        </div>
      )}
      {cells.map(cell => (
        <Cell
          key={cell.id}
          node={cell}
          onHoverCell={onHoverCell}
          onLeaveCell={onLeaveCell}
        />
      ))}
    </>
  )
}

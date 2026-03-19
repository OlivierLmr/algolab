import type { LayoutNode, FrameData, GroupData } from '../../layout/types.ts'
import { FRAME_BORDER_RADIUS } from '../../layout/constants.ts'
import { ArrayGroup } from './ArrayGroup.tsx'
import { VariableGroup } from './VariableGroup.tsx'

interface CallFrameGroupProps {
  node: LayoutNode
  onHoverCell?: (arrayName: string, cellIndex: number) => void
  onLeaveCell?: () => void
}

export function CallFrameGroup({ node, onHoverCell, onLeaveCell }: CallFrameGroupProps) {
  const data = node.data as FrameData
  const children = node.children ?? []
  const contentAlpha = data.isInnermost ? 1.0 : 0.35

  const bgAlpha = 0.4 + data.nestingIndex * 0.1
  const refText = data.arrayRefs.length > 0
    ? data.arrayRefs.map(r => `${r.paramName} \u2192 ${r.targetName}`).join('   ')
    : null

  // Find child sub-nodes by type
  const arrayGroups = children.filter(c => c.kind === 'group' && (c.data as GroupData).role === 'array-row')
  const varGroups = children.filter(c => c.kind === 'group' && (c.data as GroupData).role === 'variables-row')
  const childFrames = children.filter(c => c.kind === 'frame')

  return (
    <>
      {/* Frame box background + border */}
      <div
        class="viz-frame"
        style={{
          position: 'absolute',
          transform: `translate(${node.x}px, ${node.y}px)`,
          width: node.width,
          height: node.height,
          borderRadius: FRAME_BORDER_RADIUS,
          background: `rgba(245, 245, 250, ${bgAlpha})`,
        }}
      />

      {/* Frame content with alpha */}
      <div style={{ opacity: contentAlpha }}>
        {/* Frame label */}
        <div
          class="viz-frame-label"
          style={{
            position: 'absolute',
            transform: `translate(${node.x + 10}px, ${node.y + 14}px)`,
          }}
        >
          {data.label}
        </div>

        {/* Array ref labels */}
        {refText && (
          <div
            class="viz-frame-refs"
            style={{
              position: 'absolute',
              transform: `translate(${node.x + 10}px, ${node.y + 42}px)`,
            }}
          >
            {refText}
          </div>
        )}

        {/* Arrays within frame */}
        {arrayGroups.map(ag => (
          <ArrayGroup
            key={ag.id}
            node={ag}
            onHoverCell={onHoverCell}
            onLeaveCell={onLeaveCell}
          />
        ))}

        {/* Variables within frame */}
        {varGroups.map(vg => (
          <VariableGroup key={vg.id} node={vg} />
        ))}
      </div>

      {/* Child frames (rendered at full alpha, outside parent's opacity) */}
      {childFrames.map(cf => (
        <CallFrameGroup
          key={cf.id}
          node={cf}
          onHoverCell={onHoverCell}
          onLeaveCell={onLeaveCell}
        />
      ))}
    </>
  )
}

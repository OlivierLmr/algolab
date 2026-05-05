import type { DSArrow } from '../../datastructures/types.ts'

interface Props {
  arrows: DSArrow[]
  width: number
  height: number
}

export function DSArrowOverlay({ arrows, width, height }: Props) {
  if (arrows.length === 0) return null

  return (
    <svg
      class="ds-arrow-overlay"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        pointerEvents: 'none',
      }}
    >
      <defs>
        <marker
          id="ds-arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0,0 8,3 0,6" fill="#666" />
        </marker>
      </defs>
      {arrows.map((arrow, i) => {
        const color = arrow.color ?? '#666'
        // Compute a path with a slight curve
        const dx = arrow.toX - arrow.fromX
        const dy = arrow.toY - arrow.fromY
        const midX = arrow.fromX + dx * 0.5
        const midY = arrow.fromY + dy * 0.7

        return (
          <path
            key={i}
            d={`M${arrow.fromX},${arrow.fromY} Q${midX},${midY} ${arrow.toX},${arrow.toY}`}
            fill="none"
            stroke={color}
            stroke-width="1.5"
            marker-end="url(#ds-arrowhead)"
          />
        )
      })}
    </svg>
  )
}

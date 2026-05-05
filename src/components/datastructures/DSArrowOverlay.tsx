import type { DSArrow } from '../../datastructures/types.ts'

interface Props {
  arrows: DSArrow[]
  width: number
  height: number
}

function arrowPath(arrow: DSArrow): string {
  const style = arrow.style ?? 's-curve'
  if (style === 'straight') {
    return `M${arrow.fromX},${arrow.fromY} L${arrow.toX},${arrow.toY}`
  }
  // S-curve: both endpoints are vertical.
  const dy = arrow.toY - arrow.fromY
  const drop = dy * 0.35
  const cp1X = arrow.fromX
  const cp1Y = arrow.fromY + drop
  const cp2X = arrow.toX
  const cp2Y = arrow.toY - drop
  return `M${arrow.fromX},${arrow.fromY} C${cp1X},${cp1Y} ${cp2X},${cp2Y} ${arrow.toX},${arrow.toY}`
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
        const opacity = arrow.opacity ?? 1.0
        return (
          <path
            key={i}
            d={arrowPath(arrow)}
            fill="none"
            stroke={color}
            stroke-width="1.5"
            opacity={opacity}
            marker-end={arrow.noArrowhead ? undefined : 'url(#ds-arrowhead)'}
          />
        )
      })}
    </svg>
  )
}

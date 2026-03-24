import { useMemo } from 'preact/hooks'
import type { SceneLayout, CellData } from '../../layout/types.ts'
import type { Step } from '../../types.ts'
import {
  CELL_SIZE, CELL_GAP, CONTENT_X,
  INDEX_LABEL_HEIGHT,
} from '../../layout/constants.ts'

interface ArrowOverlayProps {
  layout: SceneLayout
  step: Step
  hoveredCell: { arrayName: string; cellIndex: number } | null
}

export function ArrowOverlay({ layout, step, hoveredCell }: ArrowOverlayProps) {
  // Collect array cell Y positions from layout
  const arrayCellYMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const node of layout.nodes) {
      if (node.id.startsWith('array:') && node.children) {
        const firstCell = node.children.find(c => c.kind === 'cell')
        if (firstCell) {
          map.set((firstCell.data as CellData).arrayName, firstCell.y)
        }
      }
    }
    return map
  }, [layout])

  // Hover arrows
  const hoverArrows = useMemo(() => {
    if (!hoveredCell) return null
    const sourceArr = step.arrays.find(a => a.name === hoveredCell.arrayName)
    if (!sourceArr || hoveredCell.cellIndex >= sourceArr.values.length) return null
    const cellValue = sourceArr.values[hoveredCell.cellIndex]
    if (cellValue.arrays.length === 0) return null

    const sourceY = arrayCellYMap.get(hoveredCell.arrayName)
    if (sourceY === undefined) return null

    const sourceCenterX = CONTENT_X + hoveredCell.cellIndex * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2
    const sourceCenterY = sourceY + CELL_SIZE / 2

    return cellValue.arrays.map(targetArrayName => {
      const targetArr = step.arrays.find(a => a.name === targetArrayName)
      if (!targetArr) return null
      const targetY = arrayCellYMap.get(targetArrayName)
      if (targetY === undefined) return null

      const targetIdx = Math.max(0, Math.min(cellValue.num, targetArr.values.length - 1))
      const targetCenterX = CONTENT_X + targetIdx * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2
      const targetIndexY = targetY + CELL_SIZE + INDEX_LABEL_HEIGHT / 2

      const sameArray = hoveredCell.arrayName === targetArrayName
      const label = `\u2192 ${targetArrayName}[${cellValue.num}]`

      return {
        sourceCenterX, sourceCenterY,
        targetCenterX, targetIndexY,
        sourceX: CONTENT_X + hoveredCell.cellIndex * (CELL_SIZE + CELL_GAP),
        sourceY,
        targetX: CONTENT_X + targetIdx * (CELL_SIZE + CELL_GAP),
        targetY,
        sameArray,
        label,
      }
    }).filter(Boolean)
  }, [hoveredCell, step, arrayCellYMap])

  return (
    <svg
      class="viz-arrow-overlay"
      width={layout.width}
      height={layout.height}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        pointerEvents: 'none',
      }}
    >
      <defs>
        <marker
          id="arrowhead-hover"
          markerWidth="10"
          markerHeight="8"
          refX="10"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L10,4 L0,8 Z" fill="#3498db" />
        </marker>
      </defs>

      {/* Hover arrows */}
      {hoverArrows?.map((ha, i) => {
        if (!ha) return null
        const { sourceCenterX, sourceCenterY, targetCenterX, targetIndexY, sameArray, label } = ha

        let path: string
        let labelX: number
        let labelY: number

        if (sameArray) {
          const midX = (sourceCenterX + targetCenterX) / 2
          // Quadratic bezier arc below the array for same-array arrows.
          // arcDrop scales linearly with horizontal distance (0.3x slope),
          // with a 15px minimum and 35px cap to keep short arrows visible
          // without tall arrows dominating the layout.
          const arcDrop = Math.min(35, Math.abs(targetCenterX - sourceCenterX) * 0.3 + 15)
          const controlY = ha.sourceY + CELL_SIZE + arcDrop
          path = `M${sourceCenterX},${sourceCenterY} Q${midX},${controlY} ${targetCenterX},${targetIndexY}`
          labelX = midX
          labelY = controlY + 14
        } else {
          path = `M${sourceCenterX},${sourceCenterY} L${targetCenterX},${targetIndexY}`
          labelX = (sourceCenterX + targetCenterX) / 2
          labelY = (sourceCenterY + targetIndexY) / 2 - 6
        }

        return (
          <g key={`hover-${i}`}>
            {/* Highlight source cell */}
            <rect
              x={ha.sourceX - 1} y={ha.sourceY - 1}
              width={CELL_SIZE + 2} height={CELL_SIZE + 2}
              fill="none" stroke="#3498db" stroke-width="3"
            />
            {/* Highlight target cell */}
            <rect
              x={ha.targetX - 1} y={ha.targetY - 1}
              width={CELL_SIZE + 2} height={CELL_SIZE + 2}
              fill="none" stroke="#3498db" stroke-width="3"
            />
            {/* Arrow path */}
            <path
              d={path}
              fill="none"
              stroke="#3498db"
              stroke-width="2"
              stroke-dasharray="6,3"
              marker-end="url(#arrowhead-hover)"
            />
            {/* Label */}
            <text
              x={labelX} y={labelY}
              text-anchor="middle"
              fill="#3498db"
              font-size="11"
              font-weight="bold"
              font-family="monospace"
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

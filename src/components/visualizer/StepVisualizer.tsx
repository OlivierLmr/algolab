import { useMemo, useCallback, useRef, useLayoutEffect } from 'preact/hooks'
import { useSignal } from '@preact/signals'
import { currentStep, pipelineColorMap } from '../../state.ts'
import { computeSceneLayout } from '../../layout/scene.ts'
import type { FlatElement, CellData, LabelData, VariableData, FrameData, PointerData } from '../../layout/types.ts'
import { CELL_SIZE, VARIABLE_LABEL_HEIGHT, FRAME_BORDER_RADIUS, ARROW_Y_GAP } from '../../layout/constants.ts'
import { getHighlightColor } from '../../renderer/colors.ts'
import { ArrowOverlay } from './ArrowOverlay.tsx'

export function StepVisualizer() {
  const step = currentStep.value
  const colorMap = pipelineColorMap.value
  const hoveredCell = useSignal<{ arrayName: string; cellIndex: number } | null>(null)

  const layout = useMemo(() => {
    if (!step) return null
    return computeSceneLayout(step, colorMap)
  }, [step, colorMap])

  const onHoverCell = useCallback((arrayName: string, cellIndex: number) => {
    const prev = hoveredCell.value
    if (!prev || prev.arrayName !== arrayName || prev.cellIndex !== cellIndex) {
      hoveredCell.value = { arrayName, cellIndex }
    }
  }, [])

  const onLeaveCell = useCallback(() => {
    if (hoveredCell.value !== null) {
      hoveredCell.value = null
    }
  }, [])

  if (!step || !layout) {
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
        onMouseLeave={onLeaveCell}
      >
        {layout.flatElements.map(el => (
          <SceneElement
            key={el.id}
            el={el}
            onHoverCell={onHoverCell}
            onLeaveCell={onLeaveCell}
          />
        ))}

        <ArrowOverlay
          layout={layout}
          step={step}
          hoveredCell={hoveredCell.value}
        />
      </div>
    </div>
  )
}

interface SceneElementProps {
  el: FlatElement
  onHoverCell: (arrayName: string, cellIndex: number) => void
  onLeaveCell: () => void
}

function SceneElement({ el, onHoverCell, onLeaveCell }: SceneElementProps) {
  switch (el.kind) {
    case 'cell':
      return <CellElement el={el} onHoverCell={onHoverCell} onLeaveCell={onLeaveCell} />
    case 'array-label':
      return <ArrayLabelElement el={el} />
    case 'variable':
      return <VariableElement el={el} />
    case 'frame':
      return <FrameElement el={el} />
    case 'pointer':
      return <PointerElement el={el} />
    default:
      return null
  }
}

function CellElement({ el, onHoverCell, onLeaveCell }: SceneElementProps) {
  const data = el.data as CellData
  const hasIteratorMeta = data.value.arrays.length > 0
  const displayVal = data.value.num === Infinity ? '\u221E' : String(data.value.num)

  const borderColor = data.highlightType
    ? getHighlightColor(data.highlightType)
    : hasIteratorMeta ? '#6ab0de' : '#999'
  const borderWidth = data.highlightType ? 3 : hasIteratorMeta ? 2 : 1.5

  let gaugeFillHeight = 0
  if (data.gaugeRatio !== undefined) {
    const clamped = 0.15 + Math.max(0, Math.min(1, data.gaugeRatio)) * 0.7
    gaugeFillHeight = clamped * CELL_SIZE
  }

  const onMouseEnter = useCallback(() => {
    if (hasIteratorMeta) {
      onHoverCell(data.arrayName, data.index)
    }
  }, [hasIteratorMeta, data.arrayName, data.index, onHoverCell])

  return (
    <div
      class="viz-cell-wrapper"
      style={{
        transform: `translate(${el.x}px, ${el.y}px)`,
        width: CELL_SIZE,
        opacity: data.dimmed ? 0.3 * el.opacity : el.opacity,
      }}
    >
      <div
        class="viz-cell"
        style={{
          width: CELL_SIZE,
          height: CELL_SIZE,
          borderColor,
          borderWidth,
          cursor: hasIteratorMeta ? 'pointer' : undefined,
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onLeaveCell}
      >
        {data.gaugeRatio !== undefined && (
          <div class="viz-cell-gauge" style={{ height: gaugeFillHeight }} />
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

function ArrayLabelElement({ el }: { el: FlatElement }) {
  const data = el.data as LabelData
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

function VariableElement({ el }: { el: FlatElement }) {
  const data = el.data as VariableData
  const borderColor = data.highlightType ? getHighlightColor(data.highlightType) : '#999'
  const borderWidth = data.highlightType ? 3 : 1.5

  return (
    <div
      class="viz-variable-wrapper"
      style={{
        transform: `translate(${el.x}px, ${el.y}px)`,
        width: CELL_SIZE,
        opacity: el.opacity,
      }}
    >
      <div class="viz-variable-label">{data.name}</div>
      <div
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

function FrameElement({ el }: { el: FlatElement }) {
  const data = el.data as FrameData
  const bgAlpha = 0.4 + data.nestingIndex * 0.1
  const refText = data.arrayRefs.length > 0
    ? data.arrayRefs.map(r => `${r.paramName} \u2192 ${r.targetName}`).join('   ')
    : null

  return (
    <div
      class="viz-frame"
      style={{
        transform: `translate(${el.x}px, ${el.y}px)`,
        width: el.width,
        height: el.height,
        borderRadius: FRAME_BORDER_RADIUS,
        background: `rgba(245, 245, 250, ${bgAlpha})`,
        opacity: el.opacity,
      }}
    >
      <div class="viz-frame-label">{data.label}</div>
      {refText && <div class="viz-frame-refs">{refText}</div>}
    </div>
  )
}

const ANIMATION_DURATION = 200

function PointerElement({ el }: { el: FlatElement }) {
  const data = el.data as PointerData
  const ref = useRef<HTMLDivElement>(null)
  const prevX = useRef<number | null>(null)

  const arrowTop = data.arrayCellY - 4
  const lineHeight = ARROW_Y_GAP * (data.stackIndex + 1)
  const arrowBottom = arrowTop - lineHeight
  const labelText = `${data.name}=${data.index}`

  const highlightColor = data.highlightType
    ? getHighlightColor(data.highlightType)
    : undefined

  // Animate horizontal movement using Web Animations API.
  // CSS transitions are unreliable when Preact re-renders via signals
  // because the DOM element may be replaced or its transition state reset.
  useLayoutEffect(() => {
    const div = ref.current
    if (!div || prevX.current === null || prevX.current === el.x) {
      prevX.current = el.x
      return
    }
    const delta = prevX.current - el.x
    prevX.current = el.x
    div.animate(
      [
        { transform: `translate(${el.x + delta}px, 0px)` },
        { transform: `translate(${el.x}px, 0px)` },
      ],
      { duration: ANIMATION_DURATION, easing: 'ease' },
    )
  }, [el.x])

  return (
    <div
      ref={ref}
      class="viz-pointer-arrow"
      style={{
        transform: `translate(${el.x}px, 0px)`,
      }}
    >
      {/* Arrow line */}
      <svg
        style={{
          position: 'absolute',
          left: -1,
          top: arrowBottom,
          width: 2,
          height: arrowTop - arrowBottom,
          overflow: 'visible',
        }}
      >
        <line
          x1={1} y1={0}
          x2={1} y2={arrowTop - arrowBottom}
          stroke={data.color}
          stroke-width="2"
        />
        {/* Arrow head */}
        <polygon
          points={`1,${arrowTop - arrowBottom} -4,${arrowTop - arrowBottom - 8} 6,${arrowTop - arrowBottom - 8}`}
          fill={data.color}
        />
      </svg>
      {/* Highlight box */}
      {highlightColor && (
        <div
          class="viz-pointer-highlight"
          style={{
            position: 'absolute',
            left: -30,
            top: arrowBottom - 14,
            width: 60,
            height: 16,
            borderRadius: 2,
            border: `2px solid ${highlightColor}`,
          }}
        />
      )}
      {/* Label */}
      <div
        class="viz-pointer-label"
        style={{
          position: 'absolute',
          left: 0,
          top: arrowBottom - 18 + (data.highlightType ? 1 : 0),
          transform: 'translateX(-50%)',
          color: data.color,
          font: 'bold 12px monospace',
          whiteSpace: 'nowrap',
        }}
      >
        {labelText}
      </div>
    </div>
  )
}

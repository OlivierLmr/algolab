import { useMemo, useCallback } from 'preact/hooks'
import { useSignal } from '@preact/signals'
import { currentStep, pipelineColorMap } from '../../state.ts'
import { computeSceneLayout } from '../../layout/scene.ts'
import type { LayoutNode, GroupData } from '../../layout/types.ts'
import { RefRegistryProvider } from './RefRegistry.tsx'
import { ArrayGroup } from './ArrayGroup.tsx'
import { VariableGroup } from './VariableGroup.tsx'
import { CallFrameGroup } from './CallFrameGroup.tsx'
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

  // Categorize top-level nodes
  const arrayGroups: LayoutNode[] = []
  const varGroups: LayoutNode[] = []
  const frameNodes: LayoutNode[] = []

  for (const node of layout.nodes) {
    if (node.kind === 'group') {
      const groupData = node.data as GroupData
      if (groupData.role === 'array-row') arrayGroups.push(node)
      else if (groupData.role === 'variables-row') varGroups.push(node)
    } else if (node.kind === 'frame') {
      frameNodes.push(node)
    }
  }

  return (
    <div class="viz-container">
      <RefRegistryProvider>
        <div
          class="viz-scene"
          style={{
            position: 'relative',
            width: layout.width,
            height: layout.height,
          }}
          onMouseLeave={onLeaveCell}
        >
          {/* Global arrays */}
          {arrayGroups.map(node => (
            <ArrayGroup
              key={node.id}
              node={node}
              onHoverCell={onHoverCell}
              onLeaveCell={onLeaveCell}
            />
          ))}

          {/* Call stack frames */}
          {frameNodes.map(node => (
            <CallFrameGroup
              key={node.id}
              node={node}
              onHoverCell={onHoverCell}
              onLeaveCell={onLeaveCell}
            />
          ))}

          {/* Global variables */}
          {varGroups.map(node => (
            <VariableGroup key={node.id} node={node} />
          ))}

          {/* Arrow overlay (pointer arrows + hover arrows) */}
          <ArrowOverlay
            layout={layout}
            step={step}
            hoveredCell={hoveredCell.value}
          />
        </div>
      </RefRegistryProvider>
    </div>
  )
}

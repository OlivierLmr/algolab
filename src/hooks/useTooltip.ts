import { useCallback, useRef, useEffect } from 'preact/hooks'
import { useSignal } from '@preact/signals'
import type { Step } from '../types.ts'
import { evaluateTooltip } from '../tooltip.ts'

export interface TooltipState {
  text: string
  x: number
  y: number
}

/**
 * Shared tooltip hook for JS-positioned tooltips.
 * Used by both StepVisualizer (scene tooltips) and CodePanel (variable tooltips).
 *
 * Positions the tooltip relative to a container ref, evaluating
 * the tooltip template from the step's tooltip map.
 *
 * @param step - Current step (provides tooltip templates and evaluation context)
 * @param options.clamp - If true, clamp tooltip horizontally within the container
 */
export function useTooltip(step: Step | undefined, options?: { clamp?: boolean }) {
  const tooltip = useSignal<TooltipState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const show = useCallback((name: string, rect: DOMRect, context: { index?: number; value?: number }) => {
    if (!step) return
    const template = step.tooltips[name]
    if (!template) { tooltip.value = null; return }
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return
    const text = evaluateTooltip(template, step, context)
    tooltip.value = {
      text,
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top - containerRect.top,
    }
  }, [step])

  const hide = useCallback(() => {
    tooltip.value = null
  }, [])

  // Clamp tooltip position so it stays within the container bounds
  useEffect(() => {
    if (!options?.clamp) return
    const el = tooltipRef.current
    const container = containerRef.current
    if (!el || !container || !tooltip.value) return
    const tooltipWidth = el.offsetWidth
    const containerWidth = container.offsetWidth
    const halfWidth = tooltipWidth / 2
    const x = tooltip.value.x
    if (x - halfWidth < 0) {
      el.style.left = `${halfWidth}px`
    } else if (x + halfWidth > containerWidth) {
      el.style.left = `${containerWidth - halfWidth}px`
    }
  })

  return { tooltip, containerRef, tooltipRef, show, hide }
}

import { useCallback, useRef } from 'preact/hooks'
import { codePanelWidth } from '../state.ts'

/** Minimum width of the code panel (pixels). */
const MIN_CODE_PANEL_WIDTH = 250

/** Minimum width reserved for the visualizer panel (pixels). */
const MIN_VISUALIZER_WIDTH = 200

export function ResizeHandle() {
  const dragging = useRef(false)

  const onMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const container = document.querySelector('.main-layout') as HTMLElement
      if (!container) return
      const rect = container.getBoundingClientRect()
      const newWidth = Math.max(MIN_CODE_PANEL_WIDTH, Math.min(e.clientX - rect.left, rect.width - MIN_VISUALIZER_WIDTH))
      codePanelWidth.value = newWidth
    }

    const onMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [])

  return <div class="resize-handle" onMouseDown={onMouseDown} />
}

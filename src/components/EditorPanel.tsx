import { useRef, useCallback, useEffect } from 'preact/hooks'
import { customSource, customInput, isRunMode, currentStepIndex, tryParseCustom } from '../state.ts'
import { buildColorMap, colorizeToHtml } from './colorize.ts'
import { signal, computed } from '@preact/signals'

const editorError = signal<string | null>(null)
const colorMap = computed(() => buildColorMap(customSource.value))
const overlayHtml = computed(() => colorizeToHtml(customSource.value, colorMap.value))

export function EditorPanel() {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)

  const handleSourceChange = useCallback(() => {
    if (textareaRef.current) {
      customSource.value = textareaRef.current.value
      editorError.value = null
    }
  }, [])

  // Sync textarea when customSource changes externally (e.g. editBuiltIn, import)
  useEffect(() => {
    const ta = textareaRef.current
    if (ta && ta.value !== customSource.value) {
      ta.value = customSource.value
    }
  }, [customSource.value])

  // Sync scroll between textarea and overlay
  const handleScroll = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop
      preRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  const handleTab = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.target as HTMLTextAreaElement
      const start = ta.selectionStart
      const end = ta.selectionEnd
      ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end)
      ta.selectionStart = ta.selectionEnd = start + 2
      handleSourceChange()
    }
  }, [handleSourceChange])

  const handleRun = useCallback(() => {
    const err = tryParseCustom()
    if (err) {
      editorError.value = err
      return
    }
    editorError.value = null
    isRunMode.value = true
    currentStepIndex.value = 0
  }, [])

  const handleExport = useCallback(() => {
    const data = JSON.stringify({
      name: 'Custom Algorithm',
      source: customSource.value,
      defaultInput: customInput.value,
    }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'algorithm.algolab'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.algolab'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string)
          if (typeof data.source === 'string') {
            customSource.value = data.source
            if (textareaRef.current) textareaRef.current.value = data.source
          }
          if (typeof data.defaultInput === 'string') {
            customInput.value = data.defaultInput
          }
        } catch {
          // ignore invalid files
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [])

  const error = editorError.value

  return (
    <div class="editor-panel">
      <div class="editor-toolbar">
        <span class="editor-toolbar-title">Editor</span>
        <button class="run-btn" onClick={handleRun}>Run</button>
        <button class="editor-btn" onClick={handleImport}>Import</button>
        <button class="editor-btn" onClick={handleExport}>Export</button>
      </div>
      <div class="editor-overlay-container">
        <pre
          ref={preRef}
          class="editor-overlay-pre"
          dangerouslySetInnerHTML={{ __html: overlayHtml.value }}
        />
        <textarea
          ref={textareaRef}
          class="editor-textarea"
          defaultValue={customSource.value}
          onInput={handleSourceChange}
          onKeyDown={handleTab}
          onScroll={handleScroll}
          spellcheck={false}
          wrap="off"
        />
      </div>
      <div class="editor-input-row">
        <span class="editor-input-label">Input:</span>
        <input
          class="editor-input"
          type="text"
          value={customInput.value}
          onInput={(e) => {
            customInput.value = (e.target as HTMLInputElement).value
          }}
        />
      </div>
      {error && <div class="editor-error">{error}</div>}
    </div>
  )
}

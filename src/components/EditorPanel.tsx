import { useRef, useCallback, useEffect } from 'preact/hooks'
import { customSource, customInput, parseError, currentStepIndex } from '../state.ts'

export function EditorPanel() {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(0)

  const handleSourceChange = useCallback(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (textareaRef.current) {
        customSource.value = textareaRef.current.value
        currentStepIndex.value = 0
      }
    }, 500)
  }, [])

  // Sync textarea when customSource changes externally (e.g. editBuiltIn, import)
  useEffect(() => {
    const ta = textareaRef.current
    if (ta && ta.value !== customSource.value) {
      ta.value = customSource.value
    }
  }, [customSource.value])

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
            currentStepIndex.value = 0
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

  const error = parseError.value

  return (
    <div class="editor-panel">
      <div class="editor-toolbar">
        <span class="editor-toolbar-title">Editor</span>
        <button class="editor-btn" onClick={handleImport}>Import</button>
        <button class="editor-btn" onClick={handleExport}>Export</button>
      </div>
      <textarea
        ref={textareaRef}
        class="editor-textarea"
        defaultValue={customSource.value}
        onInput={handleSourceChange}
        onKeyDown={handleTab}
        spellcheck={false}
      />
      <div class="editor-input-row">
        <span class="editor-input-label">Input:</span>
        <input
          class="editor-input"
          type="text"
          value={customInput.value}
          onInput={(e) => {
            customInput.value = (e.target as HTMLInputElement).value
            currentStepIndex.value = 0
          }}
        />
      </div>
      {error && <div class="editor-error">{error}</div>}
    </div>
  )
}

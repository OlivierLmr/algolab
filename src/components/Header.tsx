import { algorithmList, currentAlgoIndex, selectAlgorithm, inputText } from '../state.ts'

export function Header() {
  return (
    <header class="header">
      <h1>Algorithm Visualizer</h1>
      <div class="header-controls">
        <input
          type="text"
          value={inputText.value}
          onInput={(e) => { inputText.value = (e.target as HTMLInputElement).value }}
        />
        <select
          value={currentAlgoIndex.value}
          onChange={(e) => selectAlgorithm(Number((e.target as HTMLSelectElement).value))}
        >
          {algorithmList.map((algo, i) => (
            <option key={i} value={i}>{algo.name}</option>
          ))}
        </select>
      </div>
    </header>
  )
}

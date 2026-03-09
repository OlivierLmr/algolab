import { algorithmList, currentAlgoIndex, selectAlgorithm } from '../state.ts'

export function Header() {
  return (
    <header class="header">
      <h1>Algorithm Visualizer</h1>
      <select
        value={currentAlgoIndex.value}
        onChange={(e) => selectAlgorithm(Number((e.target as HTMLSelectElement).value))}
      >
        {algorithmList.map((algo, i) => (
          <option key={i} value={i}>{algo.name}</option>
        ))}
      </select>
    </header>
  )
}

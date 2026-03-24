import {
  algorithmList,
  currentAlgoIndex,
  selectAlgorithm,
  isCustomMode,
  selectCustom,
} from '../state.ts'

export function Header() {
  const custom = isCustomMode.value

  const handleSelectChange = (e: Event) => {
    const val = (e.target as HTMLSelectElement).value
    if (val === 'custom') {
      selectCustom()
    } else {
      selectAlgorithm(Number(val))
    }
  }

  return (
    <header class="header">
      <h1>AlgoLab</h1>
      <div class="header-controls">
        <select
          value={custom ? 'custom' : currentAlgoIndex.value}
          onChange={handleSelectChange}
        >
          {algorithmList.map((algo, i) => (
            <option key={i} value={i}>{algo.name}</option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </div>
    </header>
  )
}

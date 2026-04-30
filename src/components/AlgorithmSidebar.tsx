import { useSignal } from '@preact/signals'
import {
  algorithmList,
  currentAlgoIndex,
  selectAlgorithm,
  isCustomMode,
  selectCustom,
  sidebarOpen,
} from '../state.ts'

interface AlgorithmGroup {
  label: string
  indices: number[]
}

function buildGroups(): AlgorithmGroup[] {
  const nameToIndex = new Map<string, number>()
  algorithmList.forEach((a, i) => nameToIndex.set(a.name, i))

  const groupDefs: { label: string; names: string[] }[] = [
    {
      label: 'Basic',
      names: ['Bubble Sort', 'Selection Sort', 'Insertion Sort'],
    },
    {
      label: 'Merge Sort',
      names: ['Merge Sort (L+R copies)', 'Merge Sort (two arrays)'],
    },
    {
      label: 'Quick Sort',
      names: ['Quick Sort', 'Quick Sort (Semi-Recursive)', 'Quick Select'],
    },
    {
      label: 'Non-Comparison',
      names: ['Counting Sort', 'Radix Sort (LSD)'],
    },
    {
      label: 'Heaps',
      names: ['Make Heap O(n log n)', 'Make Heap O(n)', 'Heap Sort'],
    },
  ]

  const groups: AlgorithmGroup[] = []
  const used = new Set<number>()

  for (const def of groupDefs) {
    const indices = def.names
      .map(n => nameToIndex.get(n))
      .filter((i): i is number => i !== undefined)
    indices.forEach(i => used.add(i))
    if (indices.length > 0) {
      groups.push({ label: def.label, indices })
    }
  }

  const ungrouped = algorithmList
    .map((_, i) => i)
    .filter(i => !used.has(i))
  if (ungrouped.length > 0) {
    groups.push({ label: 'Other', indices: ungrouped })
  }

  return groups
}

const groups = buildGroups()

export function AlgorithmSidebar() {
  const open = sidebarOpen.value
  const custom = isCustomMode.value
  const selectedIndex = currentAlgoIndex.value

  return (
    <nav class={`algo-sidebar${open ? '' : ' algo-sidebar-collapsed'}`}>
      <button
        class="algo-sidebar-toggle"
        onClick={() => { sidebarOpen.value = !sidebarOpen.value }}
        title={open ? 'Collapse sidebar' : 'Show algorithms'}
      >
        {open ? '\u2039' : '\u203A'}
      </button>
      {open && (
        <div class="algo-sidebar-content">
          {groups.map(group => (
            <SidebarGroup
              key={group.label}
              group={group}
              selectedIndex={custom ? -1 : selectedIndex}
            />
          ))}
          <div class="algo-sidebar-custom">
            <button
              class={`algo-sidebar-item${custom ? ' algo-sidebar-item-active' : ''}`}
              onClick={selectCustom}
            >
              Custom
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}

function SidebarGroup({ group, selectedIndex }: { group: AlgorithmGroup; selectedIndex: number }) {
  const containsSelected = group.indices.includes(selectedIndex)
  const collapsed = useSignal(!containsSelected)

  const toggle = () => { collapsed.value = !collapsed.value }

  return (
    <div class="algo-sidebar-group">
      <button class="algo-sidebar-group-header" onClick={toggle}>
        <span class={`algo-sidebar-chevron${collapsed.value ? '' : ' algo-sidebar-chevron-open'}`}>&#9656;</span>
        {group.label}
      </button>
      {!collapsed.value && (
        <div class="algo-sidebar-group-items">
          {group.indices.map(i => (
            <button
              key={i}
              class={`algo-sidebar-item${i === selectedIndex ? ' algo-sidebar-item-active' : ''}`}
              onClick={() => selectAlgorithm(i)}
            >
              {algorithmList[i].name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

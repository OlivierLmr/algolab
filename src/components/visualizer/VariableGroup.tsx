import type { LayoutNode } from '../../layout/types.ts'
import { VariableCell } from './VariableCell.tsx'

interface VariableGroupProps {
  node: LayoutNode
}

export function VariableGroup({ node }: VariableGroupProps) {
  const children = node.children ?? []

  return (
    <>
      {children.map(child => (
        <VariableCell key={child.id} node={child} />
      ))}
    </>
  )
}

import { createContext } from 'preact'
import { useContext, useRef } from 'preact/hooks'
import type { NodeId } from '../../layout/types.ts'

export type RefMap = Map<NodeId, HTMLElement>

const RefRegistryContext = createContext<{ current: RefMap }>({ current: new Map() })

export function RefRegistryProvider({ children }: { children: preact.ComponentChildren }) {
  const mapRef = useRef<RefMap>(new Map())
  return (
    <RefRegistryContext.Provider value={mapRef}>
      {children}
    </RefRegistryContext.Provider>
  )
}

/**
 * Returns a stable ref object whose `.current` is the shared RefMap.
 * Components call `registerRef(id, element)` to register their DOM nodes.
 * ArrowOverlay reads positions via `getRef(id)`.
 */
export function useRefRegistry() {
  const mapRef = useContext(RefRegistryContext)
  return {
    registerRef: (id: NodeId, el: HTMLElement | null) => {
      if (el) {
        mapRef.current.set(id, el)
      } else {
        mapRef.current.delete(id)
      }
    },
    getRef: (id: NodeId): HTMLElement | undefined => mapRef.current.get(id),
    getMap: (): RefMap => mapRef.current,
  }
}

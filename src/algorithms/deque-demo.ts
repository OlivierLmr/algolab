import type { AlgorithmDefinition } from '../types.ts'

export const dequeDemo: AlgorithmDefinition = {
  name: 'Deque (demo)',
  source: `algo DequeDemo(arr[])
  # ============================================================
  # Setup: allocate initial map and two chunks
  # ============================================================
  #: tooltip "chunk pointer map — each cell stores a ref to a chunk"
  alloc map 4
  #: tooltip "chunk 0 — initial front chunk"
  let c0 = alloc 4
  #: tooltip "chunk 1 — initial back chunk"
  let c1 = alloc 4

  #: tooltip "index of first used map slot"
  let begin_map = 1
  #: tooltip "number of used map slots"
  let map_size = 2
  #: tooltip "front offset within the front chunk"
  let begin_chunk = 1
  #: tooltip "total number of elements stored"
  let size = 0

  # ============================================================
  # Helpers (stepover'd — hidden from stepping)
  # ============================================================

  # Allocate a new chunk and store its ref in m[slot]
  #: stepover
  def alloc_chunk(m[], slot)
    let ptr = alloc 4
    m[slot] = ptr

  # ============================================================
  # Deque operations (stepover'd)
  # ============================================================

  #: stepover
  def push_front(val)
    if begin_chunk > 0
      begin_chunk = begin_chunk - 1
      map[begin_map][begin_chunk] = val
    else
      if begin_map > 0
        # Front chunk full — allocate a new one
        begin_map = begin_map - 1
        map_size = map_size + 1
        alloc_chunk(map, begin_map)
        begin_chunk = 3
        map[begin_map][3] = val
      else
        # Map also full — reallocate to double size
        alloc map2 8
        let off = 2
        for i from 0 to 3
          map2[i + off] = map[i]
        free map
        begin_map = off - 1
        map_size = map_size + 1
        alloc_chunk(map2, begin_map)
        begin_chunk = 3
        map2[begin_map][3] = val
    size = size + 1

  #: stepover
  def push_back(val)
    let end_map = begin_map + map_size - 1
    let end_chunk = (begin_chunk + size) % 4
    if end_chunk > 0
      map[end_map][end_chunk] = val
    else
      # Back chunk full — allocate a new one
      end_map = end_map + 1
      map_size = map_size + 1
      alloc_chunk(map, end_map)
      map[end_map][0] = val
    size = size + 1

  #: stepover
  def pop_front()
    map[begin_map][begin_chunk] = 0
    begin_chunk = begin_chunk + 1
    size = size - 1

  #: stepover
  def pop_back()
    let end_map = begin_map + map_size - 1
    let end_chunk = (begin_chunk + size - 1) % 4
    map[end_map][end_chunk] = 0
    size = size - 1

  # ============================================================
  # Initialization (stepover'd)
  # ============================================================

  #: stepover
  def init()
    map[1] = c0
    map[2] = c1
    c0[1] = arr[0]
    c0[2] = arr[1]
    c0[3] = arr[2]
    c1[0] = arr[3]
    size = 4

  # ============================================================
  # Demo sequence
  # ============================================================

  #: comment "Initializing deque with [10, 20, 30, 40] across two chunks"
  init()
  #: dim map from 0 to 0
  #: dim map from 3 to 3

  #: comment "push_front(5): Decrement front offset, write 5"
  push_front(5)

  #: comment "push_back(50): Increment back offset, write 50"
  push_back(50)

  #: comment "push_back(60): Increment back offset, write 60"
  push_back(60)

  #: comment "pop_front(): Remove front element 5"
  pop_front()

  #: comment "pop_back(): Remove back element 60"
  pop_back()

  #: comment "pop_front(): Remove front element 10"
  pop_front()

  #: comment "push_front(15): Front chunk still has room"
  push_front(15)

  #: comment "push_front(12): Front chunk is now full"
  push_front(12)

  #: comment "push_front(9): Front chunk full! Allocating new chunk"
  push_front(9)
  #: undim map from 0 to 0

  #: comment "push_back(55): Back chunk still has room"
  push_back(55)

  #: comment "push_back(60): Back chunk is now full"
  push_back(60)

  #: comment "push_back(65): Back chunk full! Allocating new chunk"
  push_back(65)
  #: undim map from 3 to 3

  #: comment "push_front(6): New front chunk has room"
  push_front(6)

  #: comment "push_front(4): New front chunk has room"
  push_front(4)

  #: comment "push_front(2): Front chunk full, all map slots used!"
  push_front(2)

  #: comment "push_front(1): Map full! Reallocating to double-size map2"
  push_front(1)`,
  defaultInput: [10, 20, 30, 40],
}

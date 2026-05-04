import type { AlgorithmDefinition } from '../types.ts'

export const dequeDemo: AlgorithmDefinition = {
  name: 'Deque (demo)',
  source: `algo DequeDemo(arr[])
  # ============================================================
  # Setup: allocate initial map and two chunks
  # ============================================================
  #: tooltip "chunk pointer map — each cell stores a chunk index"
  alloc map 4
  #: tooltip "chunk 0 — initial front chunk"
  alloc c0 4
  #: tooltip "chunk 1 — initial back chunk"
  alloc c1 4

  #: tooltip "index of first used map slot"
  let ms = 1
  #: tooltip "index of last used map slot"
  let me = 2
  #: tooltip "front offset within the front chunk"
  let fo = 1
  #: tooltip "back offset within the back chunk"
  let bo = 0
  #: tooltip "next chunk ID to allocate"
  let nc = 2

  # ============================================================
  # Dispatch helpers (stepover'd — hidden from stepping)
  # ============================================================

  # Write value v into chunk ci at offset off
  #: stepover
  def sc(ci, off, v)
    if ci == 0
      c0[off] = v
    if ci == 1
      c1[off] = v
    if ci == 2
      c2[off] = v
    if ci == 3
      c3[off] = v
    if ci == 4
      c4[off] = v

  # Allocate the next chunk (persistent — survives function return)
  #: stepover
  def alloc_chunk()
    if nc == 2
      alloc c2 4
    if nc == 3
      alloc c3 4
    if nc == 4
      alloc c4 4
    let ci = nc
    nc = nc + 1
    return ci

  # ============================================================
  # Deque operations (stepover'd)
  # ============================================================

  #: stepover
  def push_front(val)
    if fo > 0
      fo = fo - 1
      sc(map[ms], fo, val)
    else
      if ms > 0
        # Front chunk full — allocate a new one
        let ci = alloc_chunk()
        ms = ms - 1
        map[ms] = ci
        fo = 3
        sc(ci, 3, val)
      else
        # Map also full — reallocate to double size
        alloc map2 8
        let off = 2
        for i from 0 to 3
          map2[i + off] = map[i]
        let ci = alloc_chunk()
        me = me + off
        ms = off - 1
        map2[ms] = ci
        fo = 3
        sc(ci, 3, val)

  #: stepover
  def push_back(val)
    if bo < 3
      bo = bo + 1
      sc(map[me], bo, val)
    else
      # Back chunk full — allocate a new one
      let ci = alloc_chunk()
      me = me + 1
      map[me] = ci
      bo = 0
      sc(ci, 0, val)

  #: stepover
  def pop_front()
    sc(map[ms], fo, 0)
    fo = fo + 1

  #: stepover
  def pop_back()
    sc(map[me], bo, 0)
    bo = bo - 1

  # ============================================================
  # Initialization (stepover'd)
  # ============================================================

  #: stepover
  def init()
    map[1] = 0
    map[2] = 1
    c0[1] = arr[0]
    c0[2] = arr[1]
    c0[3] = arr[2]
    c1[0] = arr[3]

  # ============================================================
  # Demo sequence
  # ============================================================

  #: comment "Initializing deque with [10, 20, 30, 40] across chunks c0 (front) and c1 (back)"
  init()
  #: dim map from 0 to 0
  #: dim map from 3 to 3
  #: dim c0 from 0 to 0
  #: dim c1 from 1 to 3

  #: comment "push_front(5): Decrement front offset, write 5 into c0[0]"
  push_front(5)
  #: undim c0 from 0 to 0

  #: comment "push_back(50): Increment back offset, write 50 into c1[1]"
  push_back(50)
  #: undim c1 from 1 to 1

  #: comment "push_back(60): Increment back offset, write 60 into c1[2]"
  push_back(60)
  #: undim c1 from 2 to 2

  #: comment "pop_front(): Remove front element 5. Advance front offset to c0[1]."
  pop_front()
  #: dim c0 from 0 to 0

  #: comment "pop_back(): Remove back element 60. Retreat back offset to c1[1]."
  pop_back()
  #: dim c1 from 2 to 2

  #: comment "pop_front(): Remove front element 10. Advance front offset to c0[2]."
  pop_front()
  #: dim c0 from 1 to 1

  #: comment "push_front(15): Write 15 into c0[1]. Front chunk still has room."
  push_front(15)
  #: undim c0 from 1 to 1

  #: comment "push_front(12): Write 12 into c0[0]. Front chunk is now full."
  push_front(12)
  #: undim c0 from 0 to 0

  #: comment "push_front(9): Front chunk c0 is full! Allocating chunk c2, writing 9 into c2[3]."
  push_front(9)
  #: undim map from 0 to 0
  #: dim c2 from 0 to 2

  #: comment "push_back(55): Write 55 into c1[2]. Back chunk still has room."
  push_back(55)
  #: undim c1 from 2 to 2

  #: comment "push_back(60): Write 60 into c1[3]. Back chunk is now full."
  push_back(60)
  #: undim c1 from 3 to 3

  #: comment "push_back(65): Back chunk c1 is full! Allocating chunk c3, writing 65 into c3[0]."
  push_back(65)
  #: undim map from 3 to 3
  #: dim c3 from 1 to 3

  #: comment "push_front(6): Write 6 into c2[2]. Chunk c2 has room."
  push_front(6)
  #: undim c2 from 2 to 2

  #: comment "push_front(4): Write 4 into c2[1]. Chunk c2 has room."
  push_front(4)
  #: undim c2 from 1 to 1

  #: comment "push_front(2): Write 2 into c2[0]. Chunk c2 is now full, and all 4 map slots are used!"
  push_front(2)
  #: undim c2 from 0 to 0

  #: comment "push_front(1): Map is full! Reallocating to double-size map2, allocating chunk c4, writing 1 into c4[3]."
  push_front(1)
  #: dim map from 0 to 3
  #: dim map2 from 0 to 0
  #: dim map2 from 6 to 7
  #: dim c4 from 0 to 2`,
  defaultInput: [10, 20, 30, 40],
}

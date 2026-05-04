import type { AlgorithmDefinition } from '../types.ts'

export const dequeDemo: AlgorithmDefinition = {
  name: 'Deque (demo)',
  source: `algo DequeDemo(arr[])
  #: tooltip "chunk pointer map — each cell stores a chunk index"
  alloc map 4
  #: tooltip "chunk 0 — initial front chunk"
  alloc c0 4
  #: tooltip "chunk 1 — initial back chunk"
  alloc c1 4
  #: tooltip "chunk 2 — allocated on demand for front growth"
  alloc c2 4
  #: tooltip "chunk 3 — allocated on demand for back growth"
  alloc c3 4
  #: tooltip "internal state: [map_start, map_end, front_offset, back_offset]"
  alloc st 4
  #: tooltip "doubled map used after reallocation"
  alloc map2 8
  #: tooltip "chunk 4 — allocated during map reallocation"
  alloc c4 4

  # --- Cell dispatch: set cell in chunk ci at offset ---
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

  # --- Dim helpers: left dim (0..e), undim left, right dim (s..3), undim right, full ---
  #: stepover
  def dl(ci, e)
    if ci == 0
      #: dim c0 from 0 to e
    if ci == 1
      #: dim c1 from 0 to e
    if ci == 2
      #: dim c2 from 0 to e
    if ci == 3
      #: dim c3 from 0 to e
    if ci == 4
      #: dim c4 from 0 to e

  #: stepover
  def ul(ci, e)
    if ci == 0
      #: undim c0 from 0 to e
    if ci == 1
      #: undim c1 from 0 to e
    if ci == 2
      #: undim c2 from 0 to e
    if ci == 3
      #: undim c3 from 0 to e
    if ci == 4
      #: undim c4 from 0 to e

  #: stepover
  def dr(ci, s)
    if ci == 0
      #: dim c0 from s to 3
    if ci == 1
      #: dim c1 from s to 3
    if ci == 2
      #: dim c2 from s to 3
    if ci == 3
      #: dim c3 from s to 3
    if ci == 4
      #: dim c4 from s to 3

  #: stepover
  def ur(ci, s)
    if ci == 0
      #: undim c0 from s to 3
    if ci == 1
      #: undim c1 from s to 3
    if ci == 2
      #: undim c2 from s to 3
    if ci == 3
      #: undim c3 from s to 3
    if ci == 4
      #: undim c4 from s to 3

  #: stepover
  def uf(ci)
    if ci == 0
      #: undim c0 from 0 to 3
    if ci == 1
      #: undim c1 from 0 to 3
    if ci == 2
      #: undim c2 from 0 to 3
    if ci == 3
      #: undim c3 from 0 to 3
    if ci == 4
      #: undim c4 from 0 to 3

  # --- Initialization ---
  #: stepover
  def init()
    st[0] = 1
    st[1] = 2
    st[2] = 1
    st[3] = 0
    map[1] = 0
    map[2] = 1
    c0[1] = arr[0]
    c0[2] = arr[1]
    c0[3] = arr[2]
    c1[0] = arr[3]
    #: dim st from 0 to 3
    #: dim c2 from 0 to 3
    #: dim c3 from 0 to 3
    #: dim c4 from 0 to 3
    #: dim map2 from 0 to 7
    #: dim map from 0 to 0
    #: dim map from 3 to 3
    #: dim c0 from 0 to 0
    #: dim c1 from 1 to 3

  # --- Operations ---
  #: stepover
  def push_front(val)
    let fo = st[2]
    let ms = st[0]
    let fci = map[ms]
    let nfo = fo - 1
    sc(fci, nfo, val)
    ul(fci, fo - 1)
    dl(fci, nfo - 1)
    st[2] = nfo

  #: stepover
  def push_back(val)
    let bo = st[3]
    let me = st[1]
    let bci = map[me]
    let nbo = bo + 1
    sc(bci, nbo, val)
    ur(bci, bo + 1)
    dr(bci, nbo + 1)
    st[3] = nbo

  #: stepover
  def pop_front()
    let fo = st[2]
    let ms = st[0]
    let fci = map[ms]
    sc(fci, fo, 0)
    let nfo = fo + 1
    ul(fci, fo - 1)
    dl(fci, nfo - 1)
    st[2] = nfo

  #: stepover
  def pop_back()
    let bo = st[3]
    let me = st[1]
    let bci = map[me]
    sc(bci, bo, 0)
    let nbo = bo - 1
    ur(bci, bo + 1)
    dr(bci, nbo + 1)
    st[3] = nbo

  #: stepover
  def insert_25()
    let bo = st[3]
    c1[bo + 1] = c1[bo]
    c1[bo] = c1[bo - 1]
    c1[bo - 1] = c0[3]
    c0[3] = 25
    let nbo = bo + 1
    ur(1, bo + 1)
    dr(1, nbo + 1)
    st[3] = nbo

  #: stepover
  def alloc_front_push(val, nci)
    let ms = st[0]
    let nms = ms - 1
    map[nms] = nci
    #: undim map from 0 to ms - 1
    #: dim map from 0 to nms - 1
    uf(nci)
    sc(nci, 3, val)
    dl(nci, 2)
    st[0] = nms
    st[2] = 3

  #: stepover
  def alloc_back_push(val, nci)
    let me = st[1]
    let nme = me + 1
    map[nme] = nci
    #: undim map from me + 1 to 3
    #: dim map from nme + 1 to 3
    uf(nci)
    sc(nci, 0, val)
    dr(nci, 1)
    st[1] = nme
    st[3] = 0

  #: stepover
  def realloc_push_front(val)
    let ms = st[0]
    let me = st[1]
    for i from ms to me
      map2[i + 2] = map[i]
    #: dim map from 0 to 3
    #: undim map2 from 0 to 7
    let nms = ms + 2 - 1
    let nme = me + 2
    map2[nms] = 4
    uf(4)
    c4[3] = val
    dl(4, 2)
    st[0] = nms
    st[1] = nme
    st[2] = 3
    #: dim map2 from 0 to nms - 1
    #: dim map2 from nme + 1 to 7

  # ============================================================
  # Main demo sequence
  # ============================================================

  #: comment "Initializing deque with [10, 20, 30, 40] across chunks c0 (front) and c1 (back)"
  init()

  #: comment "push_front(5): Decrement front offset, write 5 into c0[0]. No new chunk needed."
  push_front(5)

  #: comment "push_back(50): Increment back offset, write 50 into c1[1]. No new chunk needed."
  push_back(50)

  #: comment "insert(3, 25): Shift elements [30, 40, 50] right by one across chunks, then write 25 into c0[3]."
  insert_25()

  #: comment "pop_front(): Remove front element 5. Advance front offset to c0[1]."
  pop_front()

  #: comment "pop_back(): Remove back element 50. Retreat back offset to c1[1]."
  pop_back()

  #: comment "pop_front(): Remove front element 10. Advance front offset to c0[2]."
  pop_front()

  #: comment "push_front(15): Write 15 into c0[1]. Front chunk still has room."
  push_front(15)

  #: comment "push_front(12): Write 12 into c0[0]. Front chunk is now full."
  push_front(12)

  #: comment "push_front(9): Front chunk c0 is full! Allocating chunk c2, writing 9 into c2[3]."
  alloc_front_push(9, 2)

  #: comment "push_back(55): Write 55 into c1[2]. Back chunk still has room."
  push_back(55)

  #: comment "push_back(60): Write 60 into c1[3]. Back chunk is now full."
  push_back(60)

  #: comment "push_back(65): Back chunk c1 is full! Allocating chunk c3, writing 65 into c3[0]."
  alloc_back_push(65, 3)

  #: comment "push_front(6): Write 6 into c2[2]. Chunk c2 has room."
  push_front(6)

  #: comment "push_front(4): Write 4 into c2[1]. Chunk c2 has room."
  push_front(4)

  #: comment "push_front(2): Write 2 into c2[0]. Chunk c2 is now full, and all 4 map slots are used!"
  push_front(2)

  #: comment "push_front(1): Map is full! Reallocating to double-size map2, allocating chunk c4, writing 1 into c4[3]."
  realloc_push_front(1)`,
  defaultInput: [10, 20, 30, 40],
}

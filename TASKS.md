This file lists tasks that are to be done, so that they remain accessible from one session to another, or across compactions, which often loose a *lot* of context.

Once Claude is done on a task, it should mark it with `[?]` to indicate that it requires review, and pause to get a validation. If it does, it can tick it off completely (`[x]`), and move on to another task, chosen by the user.

- [x] on the deque, the chunks aren't copied, so they should not appear twice which they currently do: currently, they appear below the old *AND* the new map, after copy from old to new. Only the pointers are copied, not the chunks themselves. I think what should happen is, after the copy, the chunks should show below the new map, and the arrows starting from the old map should point to these chunks that are now below the new map.
  - [x] There seems to be a problem on the arrows from the old map to the chunks after the copy to the new map. They point to weird positions. Investigate why and fix.
- [x] The splices' arguments semantics seem wrong. Make them match the pos, first and last arguments in cpp's splice_after and splice.
- [ ] doubly-linked lists should be such that the first node's "prev" should point on the "begin", and the last node's "next" should point on the "end".
- [?] The splice on the doubly-linked list looks a bit off. The first step should be drawing the part of the list that will be moved *below*, but without any changes to the pointers, just to make things clear visually. Note that therefore nodes in the first row should not all be connected to each other. For example if the list is 1,2,3,4,5 and I'm splicing off 3,4. Then I want 3,4 to be drawn *below* 1,2,5, but 2 should point to 3, and 5 to 4. 2 and 5 should not yet be linked in any way.
  - [ ] For singly-linked lists, make sure things work in a similar way.
- [?] I want the url to change when we select structures, so that if we reload the page, we remain on the same structure visualization.

This project aims to be a webapp which

- lets you write simple algorithms in a simple language, which can handle limited types of objects. For now, tables of integers or characters.
- visualizes the execution of that algorithm step by step, on a canvas where
  - the tables are shown visually,
  - iterators on the tables are shown as well
  - the user can go through the algorithm step by step, forward and backward.

How the algorithms are written is unclear for now. Maybe simple typescript code that is then validated to only use objects that the tool knows how to visualize. Maybe also have special comments or tags or something that indicate to the tool "breakpoints" delimitting one step, or "hide" to not show some iterators or values in the visualisation.


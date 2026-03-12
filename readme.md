This project aims to be a webapp which

- lets you write simple algorithms in a simple language, which can handle limited types of objects. For now, tables of integers or characters.
- visualizes the execution of that algorithm step by step, on a canvas where
  - the tables are shown visually,
  - iterators on the tables are shown as well
  - the user can go through the algorithm step by step, forward and backward.

How the algorithms are written is unclear for now. Maybe simple typescript code that is then validated to only use objects that the tool knows how to visualize. Maybe also have special comments or tags or something that indicate to the tool "breakpoints" delimitting one step, or "hide" to not show some iterators or values in the visualisation.

## Todo

- [x] Online code editor
  - Enter that mode, so that it shows also the hidden lines. Have something telling you if there is a syntax error (inline or simply in some card somewhere)
  - Have the ability to export and import pieces of code in a ".algolab" format.
- [x] Store current state (algo, step, input) in the url for easy sharing.
- [x] Show previous 3 steps in the lower "description" div.
- [ ] Animations
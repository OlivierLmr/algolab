---
name: changelog
description: Create a new changelog entry based on recent changes
argument-hint: ""
model: haiku
---

# Create Changelog Entry

Create a new entry in `public/changelog.json` summarizing recent changes, then commit it.

## Process

1. **Read the current changelog** from `public/changelog.json` to find the date of the most recent entry.

2. **Find all changes since the last entry** by running:
   ```
   git log --oneline --after="<date of last entry>"
   ```
   If there are uncommitted changes, note those too (check `git status` and `git diff --stat`).

3. **Summarize the changes** into a proposed changelog entry:
   - Write a short, descriptive `title` (not a version number — describe the theme).
   - Write `items` as user-facing descriptions: what changed and why it matters. Not commit messages.
   - Group related commits into single items. Skip purely internal refactors unless they have user-visible impact.
   - Use present tense ("Add", "Fix", "Improve").

4. **Present the proposed entry to the user** in a numbered list so they can select which items to include or ask for edits. Wait for their response.

5. **Write the entry** to `public/changelog.json`:
   - Prepend the new entry at the beginning of the JSON array.
   - Use today's date in ISO 8601 format with `T12:00:00Z` as the time.
   - Keep the existing entries unchanged.

6. **Commit** the changelog update with message: `Add changelog entry: <title>`

## Changelog format

The file `public/changelog.json` is a JSON array of objects:

```json
[
  {
    "date": "2026-03-23T12:00:00Z",
    "title": "Short Descriptive Title",
    "items": [
      "First change description.",
      "Second change description."
    ]
  }
]
```

## Important

- Always ask the user to confirm/select items before writing.
- Do not include items that are purely internal with no user-visible effect.
- Each item should be a single sentence, clear to an end user who uses the visualizer.

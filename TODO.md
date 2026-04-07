# TODO

## Habit frequency/scheduling
Frontmatter like `frequency: weekdays` or `frequency: [mon, wed, fri]`.
- Today view hides off-schedule habits
- Streaks skip non-scheduled days (so a weekday habit doesn't break on Saturday)

## Notes on completions
Extend the format to `- [x] 2026-04-07 Ran 5km through the park`.
- `applyCompletion` preserves trailing text
- `parseCompletions` strips it for display
- Adds a lightweight journal dimension without breaking existing files

## `week` command
A 7-day rolling window (Mon–today or today±3), denser than `month` with more info per cell.

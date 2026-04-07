# Plan: Negative Habits

`type: negative` — habits you want to avoid (e.g. "No Alcohol", "No Junk Food").

## Core inversion

For negative habits, **absence of an entry = success**. An entry = a slip. The streak counts consecutive days *without* an entry, going back from today until the last slip.

## File format

```markdown
---
name: No Alcohol
type: negative
---
- [x] 2026-03-15
- [x] 2026-04-01
```

Entries are slips. Empty days are clean days. The existing `applyCompletion` / `removeCompletion` / `parseCompletions` logic is reused as-is.

## Streak calculation

Add `calcNegativeStreak(completions, today)` to `lib.ts`:
- Start from today, walk backwards
- Count consecutive days with NO entry
- Stop at the first slip (entry found)
- Return `{ days: number, lastSlip: string | null }`
- If `lastSlip` is null, the user has never slipped

No `started` date needed — streak is simply "days since last slip".

## Changes by file

### `lib.ts`
- Add `calcNegativeStreak(completions: Map<string, string>, today: Date): { days: number; lastSlip: string | null }`
- Add `isNegative` to `TodayEntry`
- Update `loadTodayHabits` to detect `type: negative` and compute negative streak

### `commands/show.ts`
- Detect `type: negative`
- Invert cell colors: entry = red, no entry = green
- Replace streak display with negative streak output:
  - `Current  12 days clean` (or `Never slipped`)
  - No "longest streak" (not meaningful without a start date)

### `commands/today.ts`
- Pass `isNegative` through from `TodayEntry`
- Invert `coloredCell`: no marker = green, marker = red
- `extraText`: show "X days clean" instead of "streak: X"
- Key hint: `d` records a slip (same as current delete-marker behavior but reversed framing)
- Enter/`x` on a negative habit records a slip; `d` clears it (marks clean again)

### `commands/month.ts`
- Add `isNegative` to `HabitRow`
- In `buildHabitCells`: for negative habits, invert colors — empty cell = green, filled cell = red

### `commands/do.ts`
- Detect `type: negative`
- Output: `✓ "No Alcohol" — slip recorded on 2026-04-07.` instead of "marked as done"

### `commands/create.ts`
- Add a type prompt: `Type: boolean / numerical / negative` (default: boolean)
- Write `type: negative` to frontmatter if selected

### `lib.test.ts`
- Tests for `calcNegativeStreak`: no slips, one slip, multiple slips, slip today

## What stays the same
- File format (entries are still `- [x] YYYY-MM-DD`)
- `applyCompletion`, `removeCompletion`, `parseCompletions` — no changes needed
- `archive`, `edit`, `list`, `completions` commands — no changes needed

# Changelog

All notable changes to this project are documented in this file.

## [1.3.0] — 2026-04-08

### Added

- **`habitxt year`:** calendar-year **aggregate heatmap** for **all** open habits (same visibility as `month` / `today`). Each day is colored by how many habits are on track that day (boolean/numerical: streak-qualifying completions; negative: clean days). **Five** heat levels use the **`github`** RGB ramp from [heatmapper](https://github.com/masukomi/heatmapper) (`ratioToHeatmapStep`, `HEATMAP_RGB`); cells render as foreground-colored **`██`** blocks (no day digits). Months appear in **three columns** per row (quarters); layout is **smooshed** (no `cli-table3` borders).
- **Week start:** config key **`weekStart`** in `habitxt.toml` / `~/.habitxt.toml` — **`sun`** (default) or **`mon`** — sets the first column of each week (`weekStartColumnIndex`). Documented in the README.
- **`--category` / `-c`:** limit the heatmap to one frontmatter **`category`** (case-insensitive); use **`uncategorized`** or **`none`** for habits with no category (`normalizeHabitCategory`, `habitMatchesCategoryFilter`).

## [1.2.1] — 2026-04-08

### Fixed

- **`bin` field:** use the single-string form (`"bin": "./dist/index.js"`) so npm keeps the executable link for **`habitxt`** on global install. Some npm versions treated the object form as invalid and dropped `bin` during publish. Added **`prepublishOnly`** so `dist/` is built before publish even if `prepare` is skipped.

## [1.2.0] — 2026-04-08

### Added

- **`habitxt streak`:** prints a leaderboard of **open** habits (not archived or hidden) with **habit**, **category**, **current**, and **longest** columns (Unicode table via **`cli-table3`**). Default sort is **current** descending; **`--sort longest`** ranks by longest streak. Uses the same streak rules as `show` / `today` (`loadTodayHabits`); **`TodayEntry.longestStreak`** is `calcLongestStreak` for boolean/numerical and **`calcLongestNegativeCleanStreak`** for negative (max clean run between slips and after the last slip; **`null`** / **—** when never slipped). **Negative** habits with no slips rank above any finite value when sorting by current or longest. Tie-breaker: habit name (A–Z).

## [1.1.4] — 2026-04-08

### Fixed

- **`habitxt --version`** now reads **`version` from `package.json`** at runtime (no duplicated string in source). This matches what npm shows and avoids a mismatch when the published bundle was built from stale sources.

## [1.1.3] — 2026-04-08

### Added

- **`habitxt today`:** **n** opens inline note entry (Enter saves, Esc cancels). If today is already completed, sets or updates the note; if not, completes (done / slip) and adds the note. Numerical habits: only after today’s value is set. Empty note with an existing completion clears the note.

- **Completion notes:** optional text after the ISO date on a completion line (`- [x] 2026-04-08 my note`). `habitxt do` accepts `-n` / `--note`. `show` prints a **Notes** section for the last-10-day window; `today` shows a truncated note in the row and preserves notes when toggling the same day. Parsing uses `parseCompletionLine` / `CompletionEntry` (`marker` + optional `note`); `applyCompletion` can update note-only entries.

- **Numerical chart axis:** optional frontmatter **`min`** and **`max`** anchor the y-axis for the ASCII value chart in `show` (merged with data extrema by `asciichart`). `habit create` asks optional chart min/max after thresholds. Library helper `parseNumericChartAxis`.

- **`habitxt month`:** every habit row appends an inline last-**7**-day Unicode block sparkline after the calendar grid: **numerical** habits use a scaled line (`numericValuesForDays`; optional **`min`** / **`max`** like `show`); **boolean** habits use three heights for none / partial / full (`markerLevelsForDays`, `discreteSparkline`); **negative** habits use low = clean and high = slip (`negativeSparklineForDays`). Library helper `lastNDaysFromToday` defines the window.

## [1.1.2] — 2026-04-08

### Added

- **Hidden habits** (`status: hidden`): omitted from `month` and `today` like archived habits, but still completable via `do` and visible in `show`. Completing a hidden habit does **not** clear `hidden` (unlike `archived`, which `do` removes when you log a completion).
- `habitxt hide <habit>` and `habitxt unhide <habit>` to set or clear hidden status.
- Library helper `habitShownInMonthAndToday` for the month/today visibility rule.

## [1.1.1] — 2026-04-07

### Added

- **`habitxt show` for numerical habits:** ASCII line chart of logged values for the same last-10-day window as the table (y = amount, x = day order), plus a dim line listing the calendar day of month for each column (via the `asciichart` dependency). Library helper `numericValuesForDays` maps completion markers to numbers (missing or non-numeric → 0 for plotting).
- **`habitxt do` natural-language dates:** optional date can be ISO (`YYYY-MM-DD`) or English phrases parsed by [chrono-node](https://github.com/wanasit/chrono) (e.g. `yesterday`, `last Tuesday`). Multi-word phrases work without quotes because the command now accepts `do <habit> [rest...]`; numerical habits use `habitxt do <habit> <value> [date...]`.
- Library helper `resolveDoDate` to turn a phrase or ISO string into a local `YYYY-MM-DD`.
- Default “today” for `do` when no date is given uses local calendar formatting (`isoLocal`) instead of UTC from `toISOString()`.

## [1.1.0] — 2026-04-07

### Added

- **Negative habits** (`type: negative` in frontmatter): track habits to avoid by logging slips; clean days extend a “days since last slip” streak. Same completion list format as boolean habits; entries mean slips, empty days mean clean.
- `calcNegativeStreak` in the library for consecutive clean days since the latest slip on or before today.
- `habitxt create`: habit type prompt (boolean / numerical / negative); numerical flow asks for partial and full thresholds.
- `show`, `month`, and `today`: inverted colors and copy for negative habits (e.g. green = clean, red = slip; “Never slipped” / “N days clean” instead of longest streak where applicable).
- `do`: slip-oriented messages for negative habits.

## [1.0.1]

### Fixed

- Minor bugfixes (details not recorded).

## [1.0.0]

- Initial release.

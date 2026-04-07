# Changelog

All notable changes to this project are documented in this file.

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

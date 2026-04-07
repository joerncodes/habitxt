# Changelog

All notable changes to this project are documented in this file.

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

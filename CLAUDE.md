# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm test              # run all tests (vitest)
pnpm test --reporter=verbose  # with per-test output
pnpm test src/lib.test.ts     # run a single test file

node run.js <command>  # run the CLI locally (tsx shim, no build step needed)
```

## Architecture

`run.js` is a thin ESM shim that spawns `tsx` to execute `src/index.ts` directly — there is no build step.

**Entry point:** `src/index.ts` — creates the Commander program and registers commands.

**Commands** live in `src/commands/`:
- `do.ts` — marks a habit complete or partial; delegates logic to `applyCompletion`
- `show.ts` — displays the last 10 days, current streak, and longest streak; delegates logic to `parseCompletions`, `calcCurrentStreak`, `calcLongestStreak`
- `today.ts` — interactive TUI; **n** opens note entry (Enter save, Esc cancel)

**Pure logic** lives in `src/lib.ts` — all functions here are side-effect-free and fully tested in `src/lib.test.ts`. Commands handle only I/O (file read/write, console output).

## Habit file format

Habit files live in `./habits/<Name>.md`. Frontmatter holds metadata; completions are a running list in the body:

```markdown
---
name: Meditate
description: 10 minutes of mindfulness meditation
---
- [x] 2026-04-05
- [/] 2026-04-06
- [x] 2026-04-07
```

`[x]` = fully completed, `[/]` = partial. Both count toward streaks. Entries are kept sorted by date. A missing date is an uncompleted day. Optional **completion notes** may follow the date: `- [x] 2026-04-08 optional text` (see `parseCompletionLine` / `CompletionEntry` in `lib.ts`).

## Key implementation notes

- Date math uses `Date.UTC` (not local `new Date()`) to avoid DST bugs when computing day differences across streak boundaries.
- `isoLocal` formats dates from local time components (not `toISOString()`) to avoid UTC offset shifting the date.
- `applyCompletion` returns a discriminated union (`added | upgraded | already_done | downgrade_ignored`) — commands switch on the type to produce output and decide whether to write the file.

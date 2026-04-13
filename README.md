# HabiTXT

HabiTXT is a CLI tool for creating and tracking habits with minimal friction.
Habits are plain Markdown files — no database, no sync, no account required.

## Installation

  npm install -g habitxt
  # or
  pnpm add -g habitxt

By default, habits are stored in ./habits/ relative to your working directory.
To use a fixed location, create a config file (see Configuration below).

## Commands

### create

Create a new habit interactively:

  habitxt create Meditate

Prompts for an optional icon, description, **habit type**, category, and
aliases. Type choices are shown as **bold** labels with a short explanation
each: **boolean** (done/partial days), **numerical** (numeric log + thresholds),
or **negative** (avoid-habit; slips vs. clean days). Numerical habits then
ask for partial and full thresholds. Creates `habits/<Name>.md` with the
appropriate frontmatter.

### do

Mark a habit complete for today (or a specific date):

  habitxt do Meditate
  habitxt do Meditate 2026-04-01
  habitxt do Meditate --partial           # mark as partial (/)
  habitxt do Steps                        # numerical: add step (frontmatter `step`, default 1)
  habitxt do Steps 8500                   # numerical: set absolute value
  habitxt do Steps +500                   # numerical: add 500 to that day’s logged value
  habitxt do Steps yesterday              # numerical: add step for that date (chrono / ISO)
  habitxt do Steps 8500 2026-04-01        # numerical + specific date
  habitxt do Meditate --note "felt good"  # optional note (stored on the line after the date)
  habitxt do "No Alcohol"                 # negative habit: records a slip

Running `do` on an **archived** habit automatically unarchives it. **`do` does
not** clear **hidden** status — hidden habits stay out of `month` and the **day** view (`habitxt day`, `today`, `yesterday`)
until you run `unhide` or edit frontmatter. For **negative** habits, `do`
records a slip (same file format as a completion); messaging refers to slips
instead of “done”.

### fail

Mark today as failed early (same effect as **`f`** in the **day** view, e.g. **`habitxt day`**):

  habitxt fail IF

For **boolean** and **numerical** habits, clears today’s completion line if present. For **negative** habits, records a slip for today. Sets frontmatter **`prefailed`** to today’s local date (**`YYYY-MM-DD`**). In the **day** view, that row shows a red **`[f]`** and dimmed text; it does not count as on track until **`prefailed`** is cleared (e.g. **`d`** to clear the day’s mark, or logging a completion again for that day).

### show

Show the last 10 days and streak info for one habit:

  habitxt show Meditate
  habitxt show med            # aliases work too

Output includes a color-coded 10-day grid: for boolean habits, green = full,
yellow = partial; for **negative** habits, green = clean day, red = slip.
If any day in the window has a **completion note**, a **Notes** section lists
those lines (date + text). Streak lines are **current** and **longest** for
boolean/numerical habits; for negative habits you get **current** clean streak
only (**Never slipped** or `N days clean`), with no longest streak.

### month

Show a full monthly calendar grid for all habits that are **open** (not
archived or hidden):

  habitxt month               # current month
  habitxt month -m 2026-03    # specific month

Each habit is one row; each day is one column. Color coding:
  green  = fully completed (x, or numerical >= full threshold)
  yellow = partially completed (/, or numerical >= partial threshold)
  red    = slip logged (**negative** habits only)
  blank  = not done, no/below-threshold entry, or a future day

For **negative** habits, days without a slip are **green**; days with a slip are **red**.

Each row ends with a dim `7d` prefix and a last-seven-day Unicode block
sparkline (▁…█): **numerical** habits scale logged values (optional **`min`** /
**`max`** like `show`); **boolean** habits use three heights (none / partial /
full); **negative** habits use low for clean days and high for slips.

### streak

List all **open** habits in a table with **habit**, **category** (or **—** if uncategorized),
**current** streak, and **longest** streak.
Default order is by current streak (highest first). Use **`--sort longest`** to
rank by longest streak instead. Negative habits with no slips yet show **Never
slipped** / **—** and sort above any finite value; otherwise streaks are **N
days clean** (longest is the best run between slips and after the last slip, on
recorded history).

  habitxt streak
  habitxt streak --sort longest

### day (interactive day view)

Open a full-screen view for one **calendar day** (default: local today). Browse
with the keyboard, edit completions for that day, and jump to other days.

  habitxt day                    # today
  habitxt day yesterday
  habitxt day 2026-04-01
  habitxt day last Monday        # chrono phrases, same rules as `do`
  habitxt today                  # alias for `habitxt day`
  habitxt yesterday              # same as `habitxt day yesterday`
  habitxt 2026-04-01             # bare ISO → same as `habitxt day 2026-04-01`

The CLI rejects **future** dates. Inside the TUI you cannot move past the real
local “today” with **l** / **→** (midnight rollover updates the cap while the
UI is open).

Displays all habits that are **open** (not archived or hidden), grouped by
category, with a progress bar for how many habits are **on track** for the
**viewed day**. Key bindings:

  ↑ / k         move selection up
  ↓ / j         move selection down
  h / ←         previous day
  l / →         next day (stops at today)
  g             go to date: type ISO or a phrase (Enter jump, Esc cancel)
  Enter         toggle full completion (done ↔ undone), or slip ↔ clean for negative habits
  n             note: set or edit the day’s note (Enter save, Esc cancel); if the day is empty, marks done and adds the note
  x             mark fully done, or record a slip (negative)
  /             toggle partial completion (partial ↔ undone); skipped for negative habits
  f             fail early for the viewed day (sets `prefailed`; red [f] + dimmed row)
  d             clear the day’s mark (or clear that day’s slip for negative habits); clears `prefailed` when it matches that day
  q / Escape    quit

When the viewed day **is** today, the title reads **Today — …** and the tally
suffix is **on track today**; for past days the header is the full date and the
suffix is **on track this day**. A habit with **`prefailed`** set to the
**viewed** calendar day is **not** on track; the UI shows **`[f]`** in red with
a dimmed habit name and extra text.

For numerical habits, pressing Enter prompts for a value inline and shows the
partial and full thresholds as a hint. Backspace edits the input; Escape
cancels without writing. Press **Enter** again with an empty input to add your
habit’s **`step`** (frontmatter, default **1**) for **that day** — same as
`habitxt do <habit>` with no number. **n** opens the note prompt only after a
value is logged for that day (same as `do --note`).

On boolean or negative habits, **n** can add a note even when that day is
still empty: saving applies done (or a slip for negative) with your note. An
empty note with a completion already saved clears the note.

### edit

Open a habit's Markdown file directly in your editor:

  habitxt edit Meditate

Uses $EDITOR, falling back to $VISUAL, then vi.

### archive

Archive a habit so it no longer appears in `month` or the day view:

  habitxt archive Meditate

Archived habits are skipped in those views. Completing an archived habit with
`do` automatically unarchives it.

### hide / unhide

Hide a habit from `month` and the day view without deleting it — it remains in your
habits folder and you can still log completions:

  habitxt hide Meditate
  habitxt unhide Meditate

Hidden habits are skipped in `month` and the day view. Unlike archived habits,
completing a hidden habit with **`do` does not** bring it back into those
views; use `unhide` (or edit `status` in frontmatter) when you want it listed
again.

### completions

Print a shell completion script to stdout:

  habitxt completions              # zsh (default)
  habitxt completions --shell bash
  habitxt completions --shell fish

See the output header for one-time install instructions per shell.
After setup, pressing Tab completes habit names for `do`, `fail`, `show`, `archive`,
`hide`, and `unhide` in the generated scripts (see the script for your shell).

## Configuration

habitxt looks for a TOML config file in the following order:

  1. HABITXT_DIR env var (highest priority, overrides everything)
  2. ./habitxt.toml  — project-local config
  3. ~/.habitxt.toml  — user-global config
  4. ./habits/  — default fallback

A minimal config file:

  # ~/.habitxt.toml
  habitsDir = "/Users/you/notes/habits"

The path can be absolute or relative (relative paths in a local
habitxt.toml are resolved from the working directory).

### Symbols

The characters written for full and partial completions can be changed:

  # ~/.habitxt.toml
  doneSymbol    = "•"
  partialSymbol = "-"

Defaults are `x` (done) and `/` (partial).

### Calendar week (`habitxt year`)

Set which weekday appears in the first column of the yearly heatmap:

  # ~/.habitxt.toml
  weekStart = "mon"

Allowed values are `"sun"` (default) or `"mon"`. Local `habitxt.toml` overrides
`~/.habitxt.toml` when both set `weekStart`.

### Year heatmap category

`habitxt year` can include only habits in one category:

```bash
habitxt year --category Health
habitxt year -c uncategorized   # habits with no category
```

Matching is case-insensitive. Use `uncategorized` or `none` for habits whose frontmatter has no `category` (or an empty value).

## Habits

### Choosing a Folder

Point `habitsDir` in `~/.habitxt.toml` to keep habits in a fixed location
regardless of where you invoke the CLI. A project-local `habitxt.toml` in
the current directory takes priority over the global one, useful if you
maintain separate habit sets per project or context.

### Full and Partial Completion

Boolean habits support two completion levels:

  [x]  fully completed      (counts toward streaks)
  [/]  partially completed  (counts toward streaks)

Use `habitxt do <habit> --partial` or the `/` key in **`habitxt day`**
to record a partial completion. Both completion levels count toward streaks.

Optional **completion notes** are free text after the date on a line:

  - [x] 2026-04-08 morning session, felt focused

Add them with `habitxt do <habit> --note "..."` (or `--note` on numerical /
negative habits). The day view keeps an existing note when you change
the marker for the same day.

### Frontmatter Fields

  name         Display name (defaults to filename stem)
  description  One-line description shown by `show`
  icon         Emoji shown next to the name in `month` and `show`
  category     Groups habits under a heading in `month`
  aliases      List of short names accepted by all commands
  status       "archived" (via `archive`) or "hidden" (via `hide`); omit or remove for open
  type         "numerical" for numeric habits, "negative" for avoid-habits (slips)
  partial      Numerical threshold for partial credit (yellow)
  full         Numerical threshold for full credit (green)
  step         Optional positive integer: default increment when logging without a value (`do`, day view, API)
  min          Optional chart y-axis floor for numerical habits (`habitxt show` ASCII chart)
  max          Optional chart y-axis ceiling for numerical habits
  prefailed    Optional ISO date (`YYYY-MM-DD`): when it matches the calendar day shown in the row, the day view shows [f] (red) and a dimmed row; set by `fail` / `f` (cleared when you clear that day or log a completion for that day)

Example:

  ---
  name: Meditate
  icon: 🧘
  description: 10 minutes of mindfulness
  category: Mindfulness
  aliases: [med, m]
  ---

### Numerical Habits

Numerical habits record a measured value instead of x//.

**Ways to log:**

- **Absolute:** `habitxt do Steps 9500` — sets the value for the day (integers; leading `-` allowed, e.g. `-1`).
- **Relative:** `habitxt do Steps +500` — adds **500** to whatever is already logged that day (missing or non-numeric prior value counts as **0**). The file stores the **sum**, not the `+500` token.
- **Default increment:** `habitxt do Steps` — adds **`step`** from frontmatter, or **1** if `step` is omitted or invalid. Same idea if the only argument is a **date** (e.g. `habitxt do Steps yesterday`): that date gets the increment.

Declare thresholds in frontmatter to get color coding in `month` and `show`:

  ---
  name: Steps
  type: numerical
  partial: 5000
  full: 10000
  step: 500
  min: 0
  max: 15000
  ---

Values are displayed in the month grid — single digits centered, two-digit
values right-aligned, values >= 100 shown as "99+".

Optional **`min`** and **`max`** in frontmatter anchor the y-axis of the
last-10-day value chart in `show` (the chart library still expands the range
to include your logged values, so outliers remain visible). Omit both for an
axis derived only from the data.

### Negative habits

**Negative** habits track something you want to avoid (e.g. no alcohol). Each
`- [x] YYYY-MM-DD` line is a **slip**; days with no line are **clean**. The
**current** streak is consecutive clean days since the most recent slip on or
before today (**Never slipped** if there is none). The file uses the same
completion list as boolean habits; commands treat lines as slips and empty
days as clean (`show`, `month`, `day`, `do`).

Example:

  ---
  name: No Alcohol
  type: negative
  ---

## REST API

habitxt includes a REST API server for remote or programmatic access.

### Starting the server

  HABITXT_API_KEY=your-secret node server.js

Set `HABITXT_PORT` to change the port (default `3000`). The server reads habit
files from the same location as the CLI (config file, `HABITXT_DIR` env var, etc.).

`HABITXT_API_KEY` is required — the server refuses to start without it.

### Authentication

All requests require a Bearer token:

  Authorization: Bearer your-secret

### Endpoints

  GET    /habits                   List all open habits
  GET    /habits/:name             Habit detail, completions, and streaks
  POST   /habits/:name/do          Record a completion
  DELETE /habits/:name/do/:date    Remove a completion for a date
  GET    /today                    All open habits with today's status (`prefailedToday`, `completion`, etc.)

**`GET /today`** returns an array of objects with **`name`**, **`icon`**, **`category`**, **`type`**
(`boolean` | `numerical` | `negative`), **`todayMarker`**, **`todayNote`**, **`prefailedToday`**
(boolean — frontmatter **`prefailed`** matches today), **`completion`** (`done` | `partial` | `undone`),
**`currentStreak`**, and **`longestStreak`**. When **`prefailedToday`** is true, **`completion`** is **`undone`**.

### Request body for POST /habits/:name/do

  {
    "date":   "2026-04-09",  // optional, defaults to today
    "marker": "x",           // optional for boolean habits (defaults to done symbol)
                             // numerical: optional — omit to add `step` (default 1); or absolute
                             // integer, or string "+N" to add N to that day’s value
    "note":   "felt good"    // optional
  }

### Example

  curl -H "Authorization: Bearer your-secret" http://localhost:3000/habits
  curl -X POST \
    -H "Authorization: Bearer your-secret" \
    -H "Content-Type: application/json" \
    -d '{"marker": "8000"}' \
    http://localhost:3000/habits/Steps/do

For **numerical** habits you can omit **`marker`** in the JSON body to apply the default increment (**`step`** or **1**), or set **`marker`** to a string like **`"+100"`** to add to the value already logged for that date.

## Contributing

Bug reports and pull requests welcome.

import { Command } from "commander";
import * as fs from "fs";
import matter from "gray-matter";
import chalk from "chalk";
import {
  HABITS_DIR,
  CONFIG,
  isoLocal,
  loadTodayHabits,
  applyCompletion,
  removeCompletion,
  habitLabel,
  markerLevel,
  parseCompletions,
  filterCompletionsForStreak,
  calcCurrentStreak,
  calcNegativeStreak,
  completionMarkersOnly,
  TodayEntry,
  habitOnTrackForTodayView,
} from "../lib.js";

/** Colored marker cell for non-selected rows. */
function coloredCell(entry: TodayEntry): string {
  const m = entry.todayMarker;
  const cell = `[${m ?? " "}]`;
  if (entry.isNegative) {
    if (m === undefined) return chalk.green(cell);
    return chalk.red(cell);
  }
  switch (markerLevel(m, entry.thresholds, CONFIG.symbols)) {
    case "full":    return chalk.green(cell);
    case "partial": return chalk.yellow(cell);
    default:        return cell;
  }
}

/** Plain (no ANSI) marker cell for selected rows (inverse provides the highlight). */
function plainCell(entry: TodayEntry): string {
  return `[${entry.todayMarker ?? " "}]`;
}

function extraText(entry: TodayEntry): string {
  const noteSuffix = entry.todayNote
    ? chalk.dim(` · ${entry.todayNote.length > 36 ? `${entry.todayNote.slice(0, 33)}…` : entry.todayNote}`)
    : "";

  if (entry.isNumerical && entry.todayMarker) return `${entry.todayMarker} recorded${noteSuffix}`;
  if (entry.isNegative) {
    if (entry.negativeLastSlip === null) return `Never slipped${noteSuffix}`;
    if (entry.currentStreak > 0) return `${entry.currentStreak} days clean${noteSuffix}`;
    return entry.todayNote ? chalk.dim(entry.todayNote.length > 40 ? `${entry.todayNote.slice(0, 37)}…` : entry.todayNote) : "";
  }
  if (!entry.isNumerical && entry.currentStreak > 0) return `streak: ${entry.currentStreak}${noteSuffix}`;
  if (entry.todayNote) return String(noteSuffix).trimStart();
  return "";
}

/** Visual bar for how many listed habits are on track today (same filter as the tally). */
function todayProgressBar(onTrack: number, total: number, width: number): string {
  if (total <= 0 || width <= 0) return "";
  const filled = onTrack >= total ? width : Math.floor((onTrack / total) * width);
  const empty = width - filled;
  if (onTrack === total) return chalk.green("█".repeat(width));
  return chalk.green("█".repeat(filled)) + chalk.dim("░".repeat(empty));
}

export function todayCommand(program: Command) {
  program
    .command("today")
    .description("Interactive today view — mark habits with keyboard")
    .action(() => {
      const todayStr = isoLocal(new Date());
      const dayLabel = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month:   "long",
        day:     "numeric",
      });

      const entries = loadTodayHabits(HABITS_DIR, todayStr);
      if (entries.length === 0) {
        console.log("No habits found.");
        return;
      }

      const labelColWidth = Math.max(...entries.map((e) => habitLabel(e.name, e.icon).width), 16);
      let selected = 0;

      /** `numeric` = entering a value; `note` = `n` opens note entry for today. */
      let inputMode: false | "numeric" | "note" = false;
      let inputBuffer = "";

      // -----------------------------------------------------------------
      // Render
      // -----------------------------------------------------------------
      const render = () => {
        // Always hide cursor first; re-show at end if in input mode.
        process.stdout.write("\x1b[2J\x1b[H\x1b[?25l");
        process.stdout.write(chalk.bold(`Today — ${dayLabel}\n\n`));

        const onTrack = entries.filter((e) => habitOnTrackForTodayView(e, CONFIG.symbols)).length;
        const total = entries.length;
        const cols = process.stdout.columns ?? 80;
        const inner = Math.max(1, cols - 4);
        const barWidth = Math.min(inner, 100);
        process.stdout.write(todayProgressBar(onTrack, total, barWidth) + "\n");
        const tally = onTrack === total ? chalk.green(`${onTrack}/${total}`) : `${onTrack}/${total}`;
        process.stdout.write(`${tally}${chalk.dim(" on track today")}\n\n`);

        let lastCategory: string | null | undefined = undefined;
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];

          // Group header
          if (entry.category !== lastCategory) {
            if (lastCategory !== undefined) process.stdout.write("\n");
            if (entry.category) process.stdout.write(chalk.bold(entry.category) + "\n");
            lastCategory = entry.category;
          }

          const { label, width } = habitLabel(entry.name, entry.icon);
          const padding = " ".repeat(labelColWidth - width + 2);
          const extra   = extraText(entry);

          if (i === selected) {
            const line = `  ${plainCell(entry)} ${label}${padding}${extra}`;
            process.stdout.write(chalk.inverse(line) + "\n");
          } else {
            const dim = extra ? chalk.dim(extra) : "";
            process.stdout.write(`  ${coloredCell(entry)} ${label}${padding}${dim}\n`);
          }
        }

        process.stdout.write("\n");

        if (inputMode === "numeric") {
          const entry = entries[selected];
          const hints: string[] = [];
          if (entry.thresholds.partial !== null) hints.push(`partial: ${entry.thresholds.partial}`);
          if (entry.thresholds.full    !== null) hints.push(`full: ${entry.thresholds.full}`);
          const hintStr = hints.length > 0 ? chalk.dim(`  (${hints.join(", ")})`) : "";
          process.stdout.write(`  ${entry.name}${hintStr}: ${inputBuffer}`);
          process.stdout.write("\x1b[?25h"); // show cursor at input position
        } else if (inputMode === "note") {
          process.stdout.write(chalk.dim("  Note (Enter save · Esc cancel): ") + inputBuffer);
          process.stdout.write("\x1b[?25h");
        } else {
          process.stdout.write(
            chalk.dim(
              "↑↓/jk navigate · Enter toggle · n note · / partial · d clear today · q quit",
            ) + "\n",
          );
        }
      };

      // -----------------------------------------------------------------
      // Actions
      // -----------------------------------------------------------------
      const today = new Date(todayStr + "T00:00:00");

      /** Recompute streak and update the selected entry in-place. */
      const updateEntry = (newBodyContent: string) => {
        const entry       = entries[selected];
        const completions = parseCompletions(newBodyContent);
        const todayData   = completions.get(todayStr);
        if (entry.isNegative) {
          const neg = calcNegativeStreak(completionMarkersOnly(completions), today);
          entries[selected] = {
            ...entry,
            todayMarker:      todayData?.marker,
            todayNote:        todayData?.note,
            currentStreak:    neg.days,
            negativeLastSlip: neg.lastSlip,
          };
          return;
        }
        const streakCompletions = filterCompletionsForStreak(completions, entry.thresholds.partial);
        entries[selected] = {
          ...entry,
          todayMarker:   todayData?.marker,
          todayNote:     todayData?.note,
          currentStreak: calcCurrentStreak(streakCompletions, today),
        };
      };

      /**
       * Write `marker` for today. Strips any existing entry first so that
       * downgrades (x → /) are allowed — applyCompletion sees a clean slate.
       */
      const setMarker = (marker: string) => {
        const entry = entries[selected];
        const raw    = fs.readFileSync(entry.filePath, "utf8");
        const parsed = matter(raw);
        const stripped = entry.todayMarker !== undefined
          ? removeCompletion(parsed.content, todayStr)
          : parsed.content;

        const preservedNote = entry.todayNote;
        const result = applyCompletion(stripped, todayStr, marker, CONFIG.symbols, preservedNote);
        if (result.type === "added" || result.type === "upgraded") {
          fs.writeFileSync(entry.filePath, matter.stringify(result.content, parsed.data));
          updateEntry(result.content);
        }
      };

      /**
       * Set or update today's note. With no completion yet, records done (boolean) or a slip (negative).
       * Empty text with an existing completion clears the note; empty with no completion is a no-op.
       */
      const applyTodayNote = (noteText: string) => {
        const entry = entries[selected];
        const trimmed = noteText.trim();
        if (entry.todayMarker === undefined && trimmed === "") return;

        const raw    = fs.readFileSync(entry.filePath, "utf8");
        const parsed = matter(raw);
        const stripped = entry.todayMarker !== undefined
          ? removeCompletion(parsed.content, todayStr)
          : parsed.content;

        const marker = entry.todayMarker ?? CONFIG.symbols.done;
        const noteArg: string | undefined =
          entry.todayMarker !== undefined && trimmed === "" ? "" : trimmed !== "" ? trimmed : undefined;

        const result = applyCompletion(stripped, todayStr, marker, CONFIG.symbols, noteArg);
        if (result.type === "added" || result.type === "upgraded") {
          fs.writeFileSync(entry.filePath, matter.stringify(result.content, parsed.data));
          updateEntry(result.content);
        }
      };

      /** Remove today's completion (if any). */
      const clearMarker = () => {
        const entry = entries[selected];
        if (entry.todayMarker === undefined) return;

        const raw     = fs.readFileSync(entry.filePath, "utf8");
        const parsed  = matter(raw);
        const newBody = removeCompletion(parsed.content, todayStr);
        fs.writeFileSync(entry.filePath, matter.stringify(newBody, parsed.data));
        updateEntry(newBody);
      };

      /** Enter on boolean: none/partial → full; full → remove. */
      const toggleFull = () => {
        if (entries[selected].todayMarker === CONFIG.symbols.done) clearMarker();
        else setMarker(CONFIG.symbols.done);
      };

      /** "/" on boolean: none/full → partial; partial → remove. */
      const togglePartial = () => {
        if (entries[selected].todayMarker === CONFIG.symbols.partial) clearMarker();
        else setMarker(CONFIG.symbols.partial);
      };

      // -----------------------------------------------------------------
      // Terminal setup / teardown
      // -----------------------------------------------------------------
      const cleanup = () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write("\x1b[?25h\n"); // restore cursor
      };

      process.stdout.write("\x1b[?25l"); // hide cursor
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      render();

      // -----------------------------------------------------------------
      // Key handling
      // -----------------------------------------------------------------
      process.stdin.on("data", (key: string) => {
        // ---- Note input mode (n) ---------------------------------------
        if (inputMode === "note") {
          if (key === "\u0003") { cleanup(); process.exit(0); }

          if (key === "\u001b") {
            inputMode = false;
            inputBuffer = "";
          } else if (key === "\r") {
            const text = inputBuffer;
            inputMode = false;
            inputBuffer = "";
            applyTodayNote(text);
          } else if (key === "\u007f" || key === "\b") {
            inputBuffer = inputBuffer.slice(0, -1);
          } else if (key === "\n") {
            inputBuffer += " ";
          } else if (!key.startsWith("\u001b")) {
            inputBuffer += key.replace(/\r/g, "").replace(/\n/g, " ");
          }

          render();
          return;
        }

        // ---- Number input mode ----------------------------------------
        if (inputMode === "numeric") {
          if (key === "\u0003") { cleanup(); process.exit(0); }

          if (key === "\u001b") {
            // Escape cancels input
            inputMode = false;
            inputBuffer = "";
          } else if (key === "\r") {
            // Submit
            const value = inputBuffer.trim();
            inputMode = false;
            inputBuffer = "";
            if (/^\d+$/.test(value)) setMarker(value);
          } else if (key === "\u007f" || key === "\b") {
            inputBuffer = inputBuffer.slice(0, -1);
          } else if (/^\d$/.test(key)) {
            inputBuffer += key;
          }

          render();
          return;
        }

        // ---- Normal mode -----------------------------------------------
        if (key === "\u0003" || key === "q" || key === "\u001b") {
          cleanup();
          process.exit(0);
        }

        if (key === "\u001b[A" || key === "k") {
          selected = Math.max(0, selected - 1);
        } else if (key === "\u001b[B" || key === "j") {
          selected = Math.min(entries.length - 1, selected + 1);
        } else if (key === "n") {
          const e = entries[selected];
          if (!e.isNumerical || e.todayMarker !== undefined) {
            inputMode = "note";
            inputBuffer = e.todayNote ?? "";
          }
        } else if (key === "\r") {
          if (entries[selected].isNumerical) {
            inputMode = "numeric";
            inputBuffer = "";
          } else {
            toggleFull();
          }
        } else if (key === "x") {
          if (!entries[selected].isNumerical) setMarker(CONFIG.symbols.done);
        } else if (key === "/") {
          if (!entries[selected].isNumerical && !entries[selected].isNegative) togglePartial();
        } else if (key === "d") {
          clearMarker();
        }

        render();
      });
    });
}

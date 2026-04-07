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
  TodayEntry,
} from "../lib.js";

/** Colored marker cell for non-selected rows. */
function coloredCell(entry: TodayEntry): string {
  const m = entry.todayMarker;
  const cell = `[${m ?? " "}]`;
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
  if (entry.isNumerical && entry.todayMarker) return `${entry.todayMarker} recorded`;
  if (!entry.isNumerical && entry.currentStreak > 0) return `streak: ${entry.currentStreak}`;
  return "";
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

      // Input mode state — only active when entering a number for a numerical habit.
      let inputMode = false;
      let inputBuffer = "";

      // -----------------------------------------------------------------
      // Render
      // -----------------------------------------------------------------
      const render = () => {
        // Always hide cursor first; re-show at end if in input mode.
        process.stdout.write("\x1b[2J\x1b[H\x1b[?25l");
        process.stdout.write(chalk.bold(`Today — ${dayLabel}\n`));

        const done  = entries.filter((e) => e.todayMarker !== undefined).length;
        const total = entries.length;
        const tally = done === total ? chalk.green(`${done}/${total}`) : `${done}/${total}`;
        process.stdout.write(`${tally}${chalk.dim(" done · partials count")}\n\n`);

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

        if (inputMode) {
          const entry = entries[selected];
          const hints: string[] = [];
          if (entry.thresholds.partial !== null) hints.push(`partial: ${entry.thresholds.partial}`);
          if (entry.thresholds.full    !== null) hints.push(`full: ${entry.thresholds.full}`);
          const hintStr = hints.length > 0 ? chalk.dim(`  (${hints.join(", ")})`) : "";
          process.stdout.write(`  ${entry.name}${hintStr}: ${inputBuffer}`);
          process.stdout.write("\x1b[?25h"); // show cursor at input position
        } else {
          process.stdout.write(chalk.dim("↑↓/jk navigate · Enter toggle · / partial · d delete · q quit") + "\n");
        }
      };

      // -----------------------------------------------------------------
      // Actions
      // -----------------------------------------------------------------
      const today = new Date(todayStr + "T00:00:00");

      /** Recompute streak and update the selected entry in-place. */
      const updateEntry = (newBodyContent: string, newMarker: string | undefined) => {
        const entry             = entries[selected];
        const completions       = parseCompletions(newBodyContent);
        const streakCompletions = filterCompletionsForStreak(completions, entry.thresholds.partial);
        entries[selected] = {
          ...entry,
          todayMarker:   newMarker,
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

        const result = applyCompletion(stripped, todayStr, marker);
        if (result.type === "added" || result.type === "upgraded") {
          fs.writeFileSync(entry.filePath, matter.stringify(result.content, parsed.data));
          updateEntry(result.content, marker);
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
        updateEntry(newBody, undefined);
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
        // ---- Number input mode ----------------------------------------
        if (inputMode) {
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
        } else if (key === "\r") {
          if (entries[selected].isNumerical) {
            inputMode = true;
            inputBuffer = "";
          } else {
            toggleFull();
          }
        } else if (key === "x") {
          if (!entries[selected].isNumerical) setMarker(CONFIG.symbols.done);
        } else if (key === "/") {
          if (!entries[selected].isNumerical) togglePartial();
        } else if (key === "d") {
          clearMarker();
        }

        render();
      });
    });
}

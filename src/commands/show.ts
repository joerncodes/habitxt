import { Command } from "commander";
import * as fs from "fs";
import matter from "gray-matter";
import chalk from "chalk";
import {
  findHabitFile,
  isoLocal,
  parseCompletions,
  calcCurrentStreak,
  calcLongestStreak,
  calcNegativeStreak,
  center,
  habitLabel,
  filterCompletionsForStreak,
  markerLevel,
  Thresholds,
  CONFIG,
} from "../lib.js";

export function showCommand(program: Command) {
  program
    .command("show <habit>")
    .description("Show habit details, last 10 days, and streaks")
    .action((habit: string) => {
      const filePath = findHabitFile(habit);
      if (!filePath) {
        console.error(`Habit not found: "${habit}"`);
        process.exit(1);
      }

      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = matter(raw);
      const completions = parseCompletions(parsed.content);

      const isNegative = parsed.data.type === "negative";
      const isNumerical = !isNegative && parsed.data.type === "numerical";
      const thresholds: Thresholds = {
        partial: isNumerical ? (parsed.data.partial as number ?? null) : null,
        full:    isNumerical ? (parsed.data.full    as number ?? null) : null,
      };

      // Last 10 days ending today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const days: Date[] = [];
      for (let i = 9; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        days.push(d);
      }

      const MONTH_LABELS = days.map((d) =>
        d.toLocaleDateString("en-US", { month: "short", day: "2-digit" })
      );
      const MARKERS = days.map((d) => completions.get(isoLocal(d)) ?? " ");

      const streakCompletions = filterCompletionsForStreak(completions, thresholds.partial);
      const negInfo = isNegative ? calcNegativeStreak(completions, today) : null;
      const currentStreak = isNegative ? negInfo!.days : calcCurrentStreak(streakCompletions, today);
      const longestStreak = calcLongestStreak(streakCompletions);

      // Display
      const COL = 8;
      const header = MONTH_LABELS.map((l) => l.padEnd(COL)).join("");
      const row = MARKERS.map((m) => {
        const cell = center(m, COL);
        const trimmed = m.trim();
        if (isNegative) {
          if (!trimmed) return chalk.bgGreen.black(cell);
          return chalk.bgRed.black(cell);
        }
        switch (markerLevel(trimmed || undefined, thresholds, CONFIG.symbols)) {
          case "full":    return chalk.bgGreen.black(cell);
          case "partial": return thresholds.partial !== null
            ? chalk.bgYellow.black(cell)
            : chalk.bgGreen.black(cell);
          default:        return cell;
        }
      }).join("");

      const { label } = habitLabel(parsed.data.name ?? habit, parsed.data.icon as string | undefined);
      console.log(`\n${label}`);
      if (parsed.data.description) console.log(parsed.data.description);
      console.log();
      console.log(header);
      console.log(row);
      console.log();
      if (isNegative) {
        console.log(chalk.bold("Streaks"));
        const line =
          negInfo!.lastSlip === null
            ? "Never slipped"
            : `${currentStreak} day${currentStreak !== 1 ? "s" : ""} clean`;
        console.log(`${chalk.bold("Current")}  ${line}`);
      } else {
        console.log(chalk.bold("Streaks"));
        console.log(`${chalk.bold("Current")}  ${currentStreak} day${currentStreak !== 1 ? "s" : ""}`);
        console.log(`${chalk.bold("Longest")}  ${longestStreak} day${longestStreak !== 1 ? "s" : ""}`);
      }
      console.log();
    });
}

import { Command } from "commander";
import * as fs from "fs";
import matter from "gray-matter";
import chalk from "chalk";
import { findHabitFile, isoLocal, parseCompletions, calcCurrentStreak, calcLongestStreak, center, habitLabel, filterCompletionsForStreak, markerLevel, Thresholds, CONFIG } from "../lib.js";

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

      const thresholds: Thresholds = {
        partial: parsed.data.type === "numerical" ? (parsed.data.partial as number ?? null) : null,
        full:    parsed.data.type === "numerical" ? (parsed.data.full    as number ?? null) : null,
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
      const currentStreak = calcCurrentStreak(streakCompletions, today);
      const longestStreak = calcLongestStreak(streakCompletions);

      // Display
      const COL = 8;
      const header = MONTH_LABELS.map((l) => l.padEnd(COL)).join("");
      const row = MARKERS.map((m) => {
        const cell = center(m, COL);
        switch (markerLevel(m.trim() || undefined, thresholds, CONFIG.symbols)) {
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
      console.log(chalk.bold("Streaks"));
      console.log(`${chalk.bold("Current")}  ${currentStreak} day${currentStreak !== 1 ? "s" : ""}`);
      console.log(`${chalk.bold("Longest")}  ${longestStreak} day${longestStreak !== 1 ? "s" : ""}`);
      console.log();
    });
}

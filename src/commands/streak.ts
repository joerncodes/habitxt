import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { HABITS_DIR, isoLocal, loadTodayHabits, habitLabel, type TodayEntry } from "../lib.js";

export type StreakSortBy = "current" | "longest";

/** Sort key for leaderboard: higher = better. Never-slipped negative habits rank first for current. */
export function streakLeaderboardCompare(
  a: TodayEntry,
  b: TodayEntry,
  sortBy: StreakSortBy = "current",
): number {
  const key = (e: TodayEntry): number => {
    if (sortBy === "longest") {
      return e.longestStreak === null ? Number.MAX_SAFE_INTEGER : e.longestStreak;
    }
    return e.isNegative && e.negativeLastSlip === null ? Number.MAX_SAFE_INTEGER : e.currentStreak;
  };
  const dk = key(b) - key(a);
  if (dk !== 0) return dk;
  return a.name.localeCompare(b.name);
}

function formatCurrentCell(entry: TodayEntry): string {
  if (entry.isNegative) {
    if (entry.negativeLastSlip === null) return "Never slipped";
    return `${entry.currentStreak} day${entry.currentStreak !== 1 ? "s" : ""} clean`;
  }
  return `${entry.currentStreak} day${entry.currentStreak !== 1 ? "s" : ""}`;
}

function formatLongestCell(entry: TodayEntry): string {
  if (entry.isNegative && entry.longestStreak === null) return "—";
  const n = entry.longestStreak!;
  if (entry.isNegative) {
    return `${n} day${n !== 1 ? "s" : ""} clean`;
  }
  return `${n} day${n !== 1 ? "s" : ""}`;
}

function formatCategoryCell(entry: TodayEntry): string {
  return entry.category ?? "—";
}

export function streakCommand(program: Command) {
  program
    .command("streak")
    .description("Rank open habits by current or longest streak (highest first)")
    .option("-s, --sort <by>", "Sort by: current or longest", "current")
    .action((opts: { sort: string }) => {
      const sortRaw = opts.sort.trim().toLowerCase();
      if (sortRaw !== "current" && sortRaw !== "longest") {
        console.error(`Invalid --sort: "${opts.sort}". Use current or longest.`);
        process.exit(1);
      }
      const sortBy = sortRaw as StreakSortBy;

      const todayStr = isoLocal(new Date());
      const entries = loadTodayHabits(HABITS_DIR, todayStr);
      if (entries.length === 0) {
        console.log("No habits found.");
        return;
      }

      const sorted = [...entries].sort((a, b) => streakLeaderboardCompare(a, b, sortBy));

      const sortLabel = sortBy === "longest" ? "longest streak" : "current streak";
      const table = new Table({
        head: [
          chalk.bold("#"),
          chalk.bold("Habit"),
          chalk.bold("Category"),
          chalk.bold("Current streak"),
          chalk.bold("Longest streak"),
        ],
        colAligns: ["right", "left", "left", "right", "right"],
      });

      for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i]!;
        const { label } = habitLabel(entry.name, entry.icon);
        table.push([
          String(i + 1),
          label,
          formatCategoryCell(entry),
          formatCurrentCell(entry),
          formatLongestCell(entry),
        ]);
      }

      console.log();
      console.log(chalk.bold(`Streak leaderboard (sorted by ${sortLabel})`));
      console.log();
      console.log(table.toString());
      console.log();
    });
}

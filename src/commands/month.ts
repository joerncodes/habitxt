import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import chalk from "chalk";
import {
  HABITS_DIR,
  CONFIG,
  parseCompletions,
  center,
  habitLabel,
  stringWidth,
  markerLevel,
  Thresholds,
  Symbols,
  DEFAULT_SYMBOLS,
  habitShownInMonthAndToday,
} from "../lib.js";

export const DOW = ["S", "M", "T", "W", "T", "F", "S"];
export const MONTH_COL = 3;

export interface HabitRow {
  name: string;
  icon: string | undefined;
  category: string | null;
  completions: Map<string, string>;
  thresholds: Thresholds;
  isNegative: boolean;
}

export interface HabitGroup {
  category: string | null;
  habits: HabitRow[];
}

export function groupHabits(habits: HabitRow[]): HabitGroup[] {
  const groups = new Map<string | null, HabitRow[]>();
  for (const habit of habits) {
    const key = habit.category;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(habit);
  }

  // Categorized groups sorted alphabetically, uncategorized last
  const categorized = [...groups.entries()]
    .filter(([k]) => k !== null)
    .sort(([a], [b]) => a!.localeCompare(b!))
    .map(([category, hs]) => ({ category, habits: hs }));

  const uncategorized = groups.get(null);
  if (uncategorized) categorized.push({ category: null, habits: uncategorized });

  return categorized;
}

export function buildDowRow(year: number, month: number, daysInMonth: number, todayDay: number | null): string[] {
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const cell = center(DOW[new Date(year, month, d).getDay()], MONTH_COL);
    return d === todayDay ? chalk.bold.underline(cell) : cell;
  });
}

export function buildNumRow(daysInMonth: number, todayDay: number | null): string[] {
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const cell = center(String(d).padStart(2, "0"), MONTH_COL);
    return d === todayDay ? chalk.bold.underline(cell) : cell;
  });
}

function formatCell(marker: string | undefined): string {
  if (!marker) return "   ";
  if (/^\d+$/.test(marker)) {
    const n = parseInt(marker, 10);
    if (n >= 100) return "99+";
    if (n >= 10)  return String(n) + " ";
    return " " + String(n) + " ";
  }
  return ` ${marker} `;
}

export function buildHabitCells(
  completions: Map<string, string>,
  year: number,
  month: number,
  daysInMonth: number,
  todayStr: string,
  thresholds: Thresholds = { partial: null, full: null },
  symbols: Symbols = DEFAULT_SYMBOLS,
  isNegative = false,
): string[] {
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (dateStr > todayStr) return " ".repeat(MONTH_COL);
    const marker = completions.get(dateStr);
    const cell = formatCell(marker);
    if (isNegative) {
      if (!marker) return chalk.bgGreen.black(cell);
      return chalk.bgRed.black(cell);
    }
    switch (markerLevel(marker, thresholds, symbols)) {
      case "full":    return chalk.bgGreen.black(cell);
      case "partial": return thresholds.partial !== null
        ? chalk.bgYellow.black(cell)
        : chalk.bgGreen.black(cell);
      default:        return cell;
    }
  });
}

export function monthCommand(program: Command) {
  program
    .command("month")
    .description("Show a monthly dashboard for all habits")
    .option("-m, --month <YYYY-MM>", "Month to display (default: current month)")
    .action((opts: { month?: string }) => {
      const today = new Date();

      let year: number;
      let month: number; // 0-indexed

      if (opts.month) {
        if (!/^\d{4}-\d{2}$/.test(opts.month)) {
          console.error(`Invalid month format: "${opts.month}". Use YYYY-MM.`);
          process.exit(1);
        }
        const [y, m] = opts.month.split("-").map(Number);
        year = y;
        month = m - 1;
      } else {
        year = today.getFullYear();
        month = today.getMonth();
      }

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : null;

      // Load all habits
      const files = fs.readdirSync(HABITS_DIR).filter((f) => f.endsWith(".md")).sort();
      if (files.length === 0) {
        console.log("No habits found.");
        return;
      }

      const habits: HabitRow[] = files.flatMap((file) => {
        const raw = fs.readFileSync(path.join(HABITS_DIR, file), "utf8");
        const parsed = matter(raw);
        if (!habitShownInMonthAndToday(parsed.data.status)) return [];
        const isNegative = parsed.data.type === "negative";
        const isNumerical = !isNegative && parsed.data.type === "numerical";
        return [{
          name: (parsed.data.name as string | undefined) ?? path.basename(file, ".md"),
          icon: parsed.data.icon as string | undefined,
          category: (parsed.data.category as string | undefined) ?? null,
          completions: parseCompletions(parsed.content),
          thresholds: {
            partial: isNumerical ? (parsed.data.partial as number ?? null) : null,
            full:    isNumerical ? (parsed.data.full    as number ?? null) : null,
          },
          isNegative,
        }];
      });

      const labelWidth = Math.max(...habits.map((h) => habitLabel(h.name, h.icon).width));
      const indent = " ".repeat(labelWidth + 2);

      const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      console.log(`\n${monthLabel}\n`);
      console.log(indent + buildDowRow(year, month, daysInMonth, todayDay).join(""));
      console.log(indent + buildNumRow(daysInMonth, todayDay).join(""));

      const groups = groupHabits(habits);
      for (const group of groups) {
        console.log();
        if (group.category) console.log(chalk.bold(group.category));
        for (const habit of group.habits) {
          const cells = buildHabitCells(
            habit.completions,
            year,
            month,
            daysInMonth,
            todayStr,
            habit.thresholds,
            CONFIG.symbols,
            habit.isNegative,
          );
          const { label, width } = habitLabel(habit.name, habit.icon);
          const padding = " ".repeat(labelWidth - width + 2);
          console.log(label + padding + cells.join(""));
        }
      }

      console.log();
    });
}

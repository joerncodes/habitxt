import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import chalk from "chalk";
import {
  HABITS_DIR,
  parseCompletions,
  habitShownInMonthAndToday,
  buildYearDayCompletionCounts,
  mondayFirstColumnIndex,
  ratioToHeatmapStep,
  HEATMAP_RGB,
  type HabitHeatInput,
  type Thresholds,
} from "../lib.js";

const HEAT_PAD = "    ";
/** Seven weekday columns × 2-character day cells */
const MONTH_WIDTH = 14;
const BETWEEN_MONTHS = "  ";
const DOW_HEADER = ["M", "T", "W", "T", "F", "S", "S"].map((c) => c.padStart(2, " ")).join("");

/**
 * We render a real calendar (month grid, Monday-first) in-process. [heatmapper](https://github.com/masukomi/heatmapper)
 * fills a fixed-width column grid from piped data; it doesn’t lay out months, and would require a separate Chicken Scheme binary.
 */

function paintHeatStep(step: number, twoChars: string): string {
  const [r, g, b] = HEATMAP_RGB[step]!;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const fg = lum > 145 ? chalk.black : chalk.white;
  return chalk.bgRgb(r, g, b)(fg(twoChars));
}

function paintDay(completed: number, total: number, isFuture: boolean, twoChars: string): string {
  if (isFuture) return chalk.dim(twoChars);
  if (total === 0) return twoChars;
  const step = ratioToHeatmapStep(completed, total);
  if (step === null) return chalk.dim(twoChars);
  return paintHeatStep(step, twoChars);
}

function buildMonthWeeks(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const pad = mondayFirstColumnIndex(first);
  const cells: (number | null)[] = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let r = 0; r < cells.length / 7; r++) {
    weeks.push(cells.slice(r * 7, r * 7 + 7));
  }
  return weeks;
}

function renderWeekLine(
  week: (number | null)[],
  year: number,
  month: number,
  counts: Map<string, number>,
  totalHabits: number,
  todayStr: string,
  todayYear: number,
): string {
  let line = "";
  for (let col = 0; col < 7; col++) {
    const day = week[col];
    if (day === null) {
      line += chalk.dim("  ");
      continue;
    }
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const completed = counts.get(iso) ?? 0;
    const isFuture = year > todayYear || (year === todayYear && iso > todayStr);
      const cell = String(day).padStart(2, "0");
    line += paintDay(completed, totalHabits, isFuture, cell);
  }
  return line;
}

function renderMonthTriple(
  year: number,
  months: [number, number, number],
  counts: Map<string, number>,
  totalHabits: number,
  todayStr: string,
  todayYear: number,
): void {
  const titles = months.map((m) =>
    new Date(year, m, 1).toLocaleDateString("en-US", { month: "short" }),
  );
  const weekGrids = months.map((m) => buildMonthWeeks(year, m));
  const maxWeeks = Math.max(...weekGrids.map((w) => w.length));

  console.log(
    HEAT_PAD +
      titles
        .map((t) => chalk.bold(t.padEnd(MONTH_WIDTH)))
        .join(BETWEEN_MONTHS),
  );
  console.log(
    HEAT_PAD +
      months.map(() => chalk.dim(DOW_HEADER.padEnd(MONTH_WIDTH))).join(BETWEEN_MONTHS),
  );

  for (let w = 0; w < maxWeeks; w++) {
    const parts = months.map((month, i) => {
      const grid = weekGrids[i]!;
      if (w < grid.length) {
        return renderWeekLine(grid[w]!, year, month, counts, totalHabits, todayStr, todayYear);
      }
      return chalk.dim(" ".repeat(MONTH_WIDTH));
    });
    console.log(HEAT_PAD + parts.join(BETWEEN_MONTHS));
  }
}

export function yearCommand(program: Command) {
  program
    .command("year")
    .description("Calendar year heatmap: each day colored by how many open habits were on track")
    .option("-y, --year <YYYY>", "Calendar year (default: current year)")
    .action((opts: { year?: string }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const todayYear = today.getFullYear();

      let year: number;
      if (opts.year) {
        if (!/^\d{4}$/.test(opts.year)) {
          console.error(`Invalid year: "${opts.year}". Use YYYY.`);
          process.exit(1);
        }
        year = parseInt(opts.year, 10);
      } else {
        year = todayYear;
      }

      const files = fs.readdirSync(HABITS_DIR).filter((f) => f.endsWith(".md")).sort();
      if (files.length === 0) {
        console.log("No habits found.");
        return;
      }

      const habits: HabitHeatInput[] = [];
      for (const file of files) {
        const raw = fs.readFileSync(path.join(HABITS_DIR, file), "utf8");
        const parsed = matter(raw);
        if (!habitShownInMonthAndToday(parsed.data.status)) continue;
        const isNegative = parsed.data.type === "negative";
        const isNumerical = !isNegative && parsed.data.type === "numerical";
        const thresholds: Thresholds = {
          partial: isNumerical ? (parsed.data.partial as number ?? null) : null,
          full:    isNumerical ? (parsed.data.full    as number ?? null) : null,
        };
        habits.push({
          completions: parseCompletions(parsed.content),
          thresholds,
          isNegative,
        });
      }

      if (habits.length === 0) {
        console.log("No habits found.");
        return;
      }

      const counts = buildYearDayCompletionCounts(habits, year);
      const total = habits.length;

      console.log();
      console.log(chalk.bold(`${year} — ${total} habit${total === 1 ? "" : "s"}`));
      console.log(
        chalk.dim(
          "10 heat levels by share of habits on track (dark red → green); dim = none on track or future",
        ),
      );
      console.log();

      const quarters: [number, number, number][] = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [9, 10, 11],
      ];
      for (const trio of quarters) {
        renderMonthTriple(year, trio, counts, total, todayStr, todayYear);
        console.log();
      }
    });
}

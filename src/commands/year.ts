import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import chalk from "chalk";
import stringWidth from "string-width";
import Table from "cli-table3";
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
const BETWEEN_MONTHS = "  ";

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

function formatDayCell(
  day: number | null,
  year: number,
  month: number,
  counts: Map<string, number>,
  totalHabits: number,
  todayStr: string,
  todayYear: number,
): string {
  if (day === null) return chalk.dim("  ");
  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const completed = counts.get(iso) ?? 0;
  const isFuture = year > todayYear || (year === todayYear && iso > todayStr);
  const cell = String(day).padStart(2, "0");
  return paintDay(completed, totalHabits, isFuture, cell);
}

function padVisualEnd(s: string, width: number): string {
  const w = stringWidth(s);
  if (w >= width) return s;
  return s + " ".repeat(width - w);
}

function monthTableLines(
  year: number,
  month: number,
  counts: Map<string, number>,
  totalHabits: number,
  todayStr: string,
  todayYear: number,
  padWeeks: number,
): string[] {
  const weeks = buildMonthWeeks(year, month);
  while (weeks.length < padWeeks) {
    weeks.push([null, null, null, null, null, null, null]);
  }

  const table = new Table({
    head: ["M", "T", "W", "T", "F", "S", "S"],
    style: {
      border: ["dim", "dim", "dim", "dim"],
      head: ["dim"],
    },
  });

  for (const week of weeks) {
    table.push(
      week.map((day) => formatDayCell(day, year, month, counts, totalHabits, todayStr, todayYear)),
    );
  }

  return table.toString().split("\n");
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
  const padWeeks = Math.max(...weekGrids.map((w) => w.length));

  const lineSets = months.map((m) =>
    monthTableLines(year, m, counts, totalHabits, todayStr, todayYear, padWeeks),
  );
  const maxLines = Math.max(...lineSets.map((l) => l.length));

  const colWidths = lineSets.map((lines) => Math.max(...lines.map((ln) => stringWidth(ln)), 0));

  const titleLine =
    HEAT_PAD +
    titles
      .map((t, i) => chalk.bold(padVisualEnd(t, colWidths[i] ?? 0)))
      .join(BETWEEN_MONTHS);
  console.log(titleLine);

  for (let row = 0; row < maxLines; row++) {
    const parts = lineSets.map((lines, i) => padVisualEnd(lines[row] ?? "", colWidths[i] ?? 0));
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

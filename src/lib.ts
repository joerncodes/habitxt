import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import stringWidth from "string-width";
import { HABITS_DIR, CONFIG } from "./config.js";
export { HABITS_DIR, CONFIG };
export type { Symbols, ResolvedConfig } from "./config.js";

export const DEFAULT_SYMBOLS = { done: "x", partial: "/" };

export const COMPLETION_RE = /^- \[(\S+)\] (\d{4}-\d{2}-\d{2})$/;

export const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export { stringWidth };

/** Returns the icon+name label and its visual terminal width. */
export function habitLabel(name: string, icon?: string): { label: string; width: number } {
  const label = icon ? `${icon} ${name}` : name;
  return { label, width: stringWidth(label) };
}

export const center = (s: string, width: number) => {
  const pad = width - s.length;
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + s + " ".repeat(pad - left);
};

export const utcDays = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

export type ApplyResult =
  | { type: "added"; content: string }
  | { type: "upgraded"; content: string }
  | { type: "already_done"; marker: string }
  | { type: "downgrade_ignored" };

const isNumericMarker = (m: string) => /^\d+$/.test(m);

export function applyCompletion(content: string, date: string, marker: string, symbols = DEFAULT_SYMBOLS): ApplyResult {
  const entryLine = `- [${marker}] ${date}`;
  const lines = content.split("\n");

  const existing = lines.find((l) => COMPLETION_RE.test(l.trim()) && l.includes(date));

  if (existing) {
    const existingMarker = existing.trim().match(COMPLETION_RE)![1];
    if (existingMarker === marker) return { type: "already_done", marker };
    if (isNumericMarker(existingMarker) || isNumericMarker(marker)) {
      const upgraded = lines.map((l) =>
        COMPLETION_RE.test(l.trim()) && l.includes(date) ? entryLine : l
      );
      return { type: "upgraded", content: upgraded.join("\n") };
    }
    if (existingMarker === symbols.partial && marker === symbols.done) {
      const upgraded = lines.map((l) =>
        COMPLETION_RE.test(l.trim()) && l.includes(date) ? entryLine : l
      );
      return { type: "upgraded", content: upgraded.join("\n") };
    }
    return { type: "downgrade_ignored" };
  }

  const completionLines = lines.filter((l) => COMPLETION_RE.test(l.trim()));
  const otherLines = lines.filter((l) => !COMPLETION_RE.test(l.trim()));

  completionLines.push(entryLine);
  completionLines.sort((a, b) => {
    const dateA = a.trim().match(COMPLETION_RE)![2];
    const dateB = b.trim().match(COMPLETION_RE)![2];
    return dateA.localeCompare(dateB);
  });

  const trailingNewline = otherLines.at(-1) === "" ? otherLines.pop() : undefined;
  const newContent = [
    ...otherLines,
    ...completionLines,
    ...(trailingNewline !== undefined ? [""] : []),
  ].join("\n");

  return { type: "added", content: newContent };
}

/** Removes the completion entry for `date` from the body content, if present. */
export function removeCompletion(content: string, date: string): string {
  const lines = content.split("\n");
  return lines.filter((l) => !(COMPLETION_RE.test(l.trim()) && l.includes(date))).join("\n");
}

export function parseCompletions(content: string): Map<string, string> {
  const completions = new Map<string, string>();
  for (const line of content.split("\n")) {
    const m = line.trim().match(COMPLETION_RE);
    if (m) completions.set(m[2], m[1]);
  }
  return completions;
}

export function calcLongestStreak(completions: Map<string, string>): number {
  const allDates = [...completions.keys()].sort();
  let longest = 0;
  let current = 0;
  let prevDay: string | null = null;
  for (const dateStr of allDates) {
    if (prevDay) {
      const diff = utcDays(dateStr) - utcDays(prevDay);
      current = diff === 1 ? current + 1 : 1;
    } else {
      current = 1;
    }
    longest = Math.max(longest, current);
    prevDay = dateStr;
  }
  return longest;
}

export function calcCurrentStreak(completions: Map<string, string>, today: Date): number {
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    if (completions.has(isoLocal(d))) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/** Consecutive clean days since the most recent slip on or before `today`. Entries are slips. */
export function calcNegativeStreak(
  completions: Map<string, string>,
  today: Date,
): { days: number; lastSlip: string | null } {
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);
  const todayStr = isoLocal(base);
  let lastSlip: string | null = null;
  let bestUd = -Infinity;
  for (const dateStr of completions.keys()) {
    if (dateStr <= todayStr) {
      const ud = utcDays(dateStr);
      if (ud > bestUd) {
        bestUd = ud;
        lastSlip = dateStr;
      }
    }
  }
  if (lastSlip === null) {
    return { days: 0, lastSlip: null };
  }
  const days = utcDays(todayStr) - utcDays(lastSlip);
  return { days, lastSlip };
}

export interface Thresholds {
  partial: number | null;
  full: number | null;
}

/** Filters out completions that don't meet the partial threshold (for streak calculation). */
export function filterCompletionsForStreak(
  completions: Map<string, string>,
  partialThreshold: number | null
): Map<string, string> {
  if (partialThreshold === null) return completions;
  return new Map(
    [...completions.entries()].filter(([, m]) => parseInt(m, 10) >= partialThreshold)
  );
}

/** Returns the display level of a marker given numerical thresholds. Pure — no chalk. */
export function markerLevel(
  marker: string | undefined,
  thresholds: Thresholds,
  symbols = DEFAULT_SYMBOLS,
): "full" | "partial" | "low" | "none" {
  if (!marker || marker.trim() === "") return "none";
  if (marker === symbols.done) return "full";
  if (marker === symbols.partial) return "partial";
  const v = parseInt(marker, 10);
  if (thresholds.full !== null && v >= thresholds.full) return "full";
  if (thresholds.partial !== null && v >= thresholds.partial) return "partial";
  return "low";
}

export interface TodayEntry {
  name: string;
  filePath: string;
  icon?: string;
  category: string | null;
  isNumerical: boolean;
  isNegative: boolean;
  /** Set when `isNegative`: most recent slip on/before today, or `null` if never slipped. */
  negativeLastSlip: string | null | undefined;
  thresholds: Thresholds;
  todayMarker: string | undefined;
  currentStreak: number;
}

/**
 * Loads all non-archived habits and returns them as TodayEntry[], sorted by
 * category (alphabetically, uncategorized last), preserving file order within
 * each category.
 */
export function loadTodayHabits(habitsDir: string, todayStr: string): TodayEntry[] {
  if (!fs.existsSync(habitsDir)) return [];
  const files = fs.readdirSync(habitsDir).filter((f) => f.endsWith(".md")).sort();
  const today = new Date(todayStr + "T00:00:00");
  const entries: TodayEntry[] = [];

  for (const file of files) {
    const filePath = path.join(habitsDir, file);
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = matter(raw);
    if (parsed.data.status === "archived") continue;

    const isNegative = parsed.data.type === "negative";
    const isNumerical = !isNegative && parsed.data.type === "numerical";
    const thresholds: Thresholds = {
      partial: isNumerical ? (parsed.data.partial as number ?? null) : null,
      full:    isNumerical ? (parsed.data.full    as number ?? null) : null,
    };
    const completions = parseCompletions(parsed.content);
    const streakCompletions = filterCompletionsForStreak(completions, thresholds.partial);
    const neg = isNegative ? calcNegativeStreak(completions, today) : null;

    entries.push({
      name:          (parsed.data.name as string | undefined) ?? path.basename(file, ".md"),
      filePath,
      icon:          parsed.data.icon as string | undefined,
      category:      (parsed.data.category as string | undefined) ?? null,
      isNumerical,
      isNegative,
      negativeLastSlip: isNegative ? neg!.lastSlip : undefined,
      thresholds,
      todayMarker:   completions.get(todayStr),
      currentStreak: isNegative ? neg!.days : calcCurrentStreak(streakCompletions, today),
    });
  }

  // Sort: categorized entries alphabetically by category, uncategorized last,
  // preserving original (file-name) order within each category.
  const categorized   = entries.filter((e) => e.category !== null);
  const uncategorized = entries.filter((e) => e.category === null);
  categorized.sort((a, b) => a.category!.localeCompare(b.category!));
  return [...categorized, ...uncategorized];
}

/** Resolves a habit name or alias to its file path. Returns null if not found. */
export function findHabitFile(name: string, habitsDir: string = HABITS_DIR): string | null {
  const direct = path.join(habitsDir, `${name}.md`);
  if (fs.existsSync(direct)) return direct;

  const files = fs.readdirSync(habitsDir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(habitsDir, file), "utf8");
    const aliases: string[] = matter(raw).data.aliases ?? [];
    if (aliases.some((a) => a.toLowerCase() === name.toLowerCase())) {
      return path.join(habitsDir, file);
    }
  }
  return null;
}

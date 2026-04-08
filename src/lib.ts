import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { parseDate } from "chrono-node";
import stringWidth from "string-width";
import { HABITS_DIR, CONFIG } from "./config.js";
import type { Symbols } from "./config.js";
export { HABITS_DIR, CONFIG };
export type { Symbols, ResolvedConfig } from "./config.js";

export const DEFAULT_SYMBOLS = { done: "x", partial: "/" };

/** @deprecated Use `parseCompletionLine` — lines may include an optional note after the date. */
export const COMPLETION_RE = /^- \[(\S+)\] (\d{4}-\d{2}-\d{2})(?:\s+(.*))?$/;

export interface CompletionEntry {
  marker: string;
  /** Text after the ISO date on the line, if any. */
  note?: string;
}

/** Parse a single markdown completion line: `- [marker] YYYY-MM-DD` with optional note after the date. */
export function parseCompletionLine(trimmed: string): CompletionEntry & { date: string } | null {
  const m = trimmed.match(/^-\s*\[(\S+)\]\s+(\d{4}-\d{2}-\d{2})(?:\s+(.*))?$/);
  if (!m) return null;
  const noteRaw = m[3];
  const note = noteRaw !== undefined && noteRaw.trim() !== "" ? noteRaw.trim() : undefined;
  return { marker: m[1], date: m[2], note };
}

function isCompletionLine(trimmed: string): boolean {
  return parseCompletionLine(trimmed) !== null;
}

/** Serialize a completion line (note is optional). */
export function formatCompletionLine(marker: string, date: string, note?: string): string {
  const t = note?.trim();
  if (t) return `- [${marker}] ${date} ${t}`;
  return `- [${marker}] ${date}`;
}

function completionDateFromLine(trimmed: string): string | null {
  return parseCompletionLine(trimmed)?.date ?? null;
}

function resolveNoteForLine(existingNote: string | undefined, incoming: string | undefined): string | undefined {
  if (incoming !== undefined) {
    const t = incoming.trim();
    return t === "" ? undefined : t;
  }
  return existingNote;
}

export const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Resolve an ISO date (YYYY-MM-DD) or English casual phrase to a calendar date in local time. */
export function resolveDoDate(phrase: string, ref: Date = new Date()): string | null {
  const trimmed = phrase.trim();
  if (!trimmed) return null;
  if (ISO_DATE_RE.test(trimmed)) return trimmed;
  const d = parseDate(trimmed, ref);
  if (!d || Number.isNaN(d.getTime())) return null;
  return isoLocal(d);
}

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

/**
 * Record a completion for `date`. Optional `note` appends text after the date; `undefined` preserves an existing note on that line.
 */
export function applyCompletion(
  content: string,
  date: string,
  marker: string,
  symbols = DEFAULT_SYMBOLS,
  note?: string,
): ApplyResult {
  const lines = content.split("\n");

  const existing = lines.find((l) => completionDateFromLine(l.trim()) === date);

  if (existing) {
    const parsed = parseCompletionLine(existing.trim());
    if (!parsed) return { type: "downgrade_ignored" };
    const existingMarker = parsed.marker;
    const resolvedNote = resolveNoteForLine(parsed.note, note);
    const entryLine = formatCompletionLine(marker, date, resolvedNote);

    if (existingMarker === marker) {
      const prevN = parsed.note?.trim() ?? "";
      const nextN = resolvedNote?.trim() ?? "";
      if (prevN === nextN) return { type: "already_done", marker };
      const upgraded = lines.map((l) => (completionDateFromLine(l.trim()) === date ? entryLine : l));
      return { type: "upgraded", content: upgraded.join("\n") };
    }
    if (isNumericMarker(existingMarker) || isNumericMarker(marker)) {
      const upgraded = lines.map((l) =>
        completionDateFromLine(l.trim()) === date ? entryLine : l
      );
      return { type: "upgraded", content: upgraded.join("\n") };
    }
    if (existingMarker === symbols.partial && marker === symbols.done) {
      const upgraded = lines.map((l) =>
        completionDateFromLine(l.trim()) === date ? entryLine : l
      );
      return { type: "upgraded", content: upgraded.join("\n") };
    }
    return { type: "downgrade_ignored" };
  }

  const entryLine = formatCompletionLine(marker, date, resolveNoteForLine(undefined, note));
  const completionLines = lines.filter((l) => isCompletionLine(l.trim()));
  const otherLines = lines.filter((l) => !isCompletionLine(l.trim()));

  completionLines.push(entryLine);
  completionLines.sort((a, b) => {
    const dateA = parseCompletionLine(a.trim())!.date;
    const dateB = parseCompletionLine(b.trim())!.date;
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
  return lines.filter((l) => completionDateFromLine(l.trim()) !== date).join("\n");
}

export function parseCompletions(content: string): Map<string, CompletionEntry> {
  const completions = new Map<string, CompletionEntry>();
  for (const line of content.split("\n")) {
    const p = parseCompletionLine(line.trim());
    if (p) completions.set(p.date, { marker: p.marker, note: p.note });
  }
  return completions;
}

/** Map of date → marker string for streak helpers that only care about markers. */
export function completionMarkersOnly(completions: Map<string, CompletionEntry>): Map<string, string> {
  return new Map([...completions.entries()].map(([d, e]) => [d, e.marker]));
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

/**
 * Longest run of consecutive clean days (no slip) on or before `today`, from recorded slips.
 * Returns `null` when there are no slips (never slipped — unbounded clean history).
 */
export function calcLongestNegativeCleanStreak(slips: Map<string, string>, today: Date): number | null {
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);
  const todayStr = isoLocal(base);
  const sorted = [...slips.keys()].filter((d) => d <= todayStr).sort();
  if (sorted.length === 0) return null;

  let longest = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = utcDays(sorted[i + 1]!) - utcDays(sorted[i]!) - 1;
    longest = Math.max(longest, gap);
  }
  const afterLast = utcDays(todayStr) - utcDays(sorted[sorted.length - 1]!);
  return Math.max(longest, afterLast);
}

export interface Thresholds {
  partial: number | null;
  full: number | null;
}

/** Optional `min` / `max` in frontmatter for numerical habits — anchors the ASCII chart y-axis (asciichart merges with data extrema). */
export interface NumericChartAxis {
  min?: number;
  max?: number;
}

/**
 * Reads optional `min` / `max` for `type: numerical` habits. Returns `undefined` if absent, invalid, or non-numerical type.
 */
export function parseNumericChartAxis(data: Record<string, unknown>): NumericChartAxis | undefined {
  if (data.type !== "numerical") return undefined;
  const rawMin = data.min;
  const rawMax = data.max;
  const hasMin = rawMin !== undefined && rawMin !== null;
  const hasMax = rawMax !== undefined && rawMax !== null;
  if (!hasMin && !hasMax) return undefined;

  const min = hasMin ? Number(rawMin) : undefined;
  const max = hasMax ? Number(rawMax) : undefined;

  if (hasMin && !Number.isFinite(min!)) return undefined;
  if (hasMax && !Number.isFinite(max!)) return undefined;
  if (min !== undefined && max !== undefined && min >= max) return undefined;

  const out: NumericChartAxis = {};
  if (min !== undefined) out.min = min;
  if (max !== undefined) out.max = max;
  return out;
}

/** Filters out completions that don't meet the partial threshold (for streak calculation). */
export function filterCompletionsForStreak(
  completions: Map<string, CompletionEntry>,
  partialThreshold: number | null
): Map<string, string> {
  if (partialThreshold === null) return completionMarkersOnly(completions);
  const t = partialThreshold;
  return new Map(
    [...completions.entries()]
      .filter(([, e]) => parseInt(e.marker, 10) >= t)
      .map(([d, e]) => [d, e.marker])
  );
}

/** Returns the display level of a marker given numerical thresholds. Pure — no chalk. */
/** Per-day numeric markers for charting; missing or non-numeric markers become 0. */
export function numericValuesForDays(completions: Map<string, CompletionEntry>, days: Date[]): number[] {
  return days.map((d) => {
    const m = completions.get(isoLocal(d))?.marker.trim() ?? "";
    return /^\d+$/.test(m) ? parseInt(m, 10) : 0;
  });
}

/** Last `n` calendar days ending on `today` (local midnight), oldest first — same window shape as `show`. */
export function lastNDaysFromToday(today: Date, n: number): Date[] {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const days: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(t);
    d.setDate(t.getDate() - i);
    days.push(d);
  }
  return days;
}

const SPARK_BLOCKS = ["\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"] as const;

/**
 * Unicode block sparkline (8 levels). Empty input yields an empty string.
 * Optional `axis` merges `min`/`max` with data extrema like `show`’s chart.
 */
export function numericSparkline(values: number[], axis?: NumericChartAxis): string {
  if (values.length === 0) return "";
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (axis?.min !== undefined) lo = Math.min(lo, axis.min);
  if (axis?.max !== undefined) hi = Math.max(hi, axis.max);
  if (hi <= lo) {
    const v = values[0]!;
    const b = v === 0 ? 0 : 4;
    return values.map(() => SPARK_BLOCKS[b]).join("");
  }
  const span = hi - lo;
  return values.map((v) => {
    const t = (v - lo) / span;
    const blockIdx = Math.min(7, Math.max(0, Math.round(t * 7)));
    return SPARK_BLOCKS[blockIdx];
  }).join("");
}

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

/** Per-day `markerLevel` for a day list (oldest first). */
export function markerLevelsForDays(
  completions: Map<string, CompletionEntry>,
  days: Date[],
  thresholds: Thresholds,
  symbols: Symbols = DEFAULT_SYMBOLS,
): ("full" | "partial" | "low" | "none")[] {
  return days.map((d) => {
    const m = completions.get(isoLocal(d))?.marker;
    return markerLevel(m, thresholds, symbols);
  });
}

/**
 * Tri-state Unicode sparkline for boolean-style levels: none/low → bottom,
 * partial → mid, full → top.
 */
export function discreteSparkline(levels: ("full" | "partial" | "low" | "none")[]): string {
  return levels
    .map((l) => SPARK_BLOCKS[l === "full" ? 7 : l === "partial" ? 4 : 0])
    .join("");
}

/** Negative habit: clean day → bottom block, slip → top. */
export function negativeSparklineForDays(completions: Map<string, CompletionEntry>, days: Date[]): string {
  return days
    .map((d) => {
      const m = completions.get(isoLocal(d))?.marker.trim() ?? "";
      return SPARK_BLOCKS[m ? 7 : 0];
    })
    .join("");
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
  /** Note for today’s completion line, if any. */
  todayNote: string | undefined;
  currentStreak: number;
  /** Longest streak of qualifying days (boolean/numerical) or longest clean run (negative). `null` only when negative and never slipped. */
  longestStreak: number | null;
}

/** Habits with status `archived` or `hidden` are omitted from `month` and `today`. */
export function habitShownInMonthAndToday(status: unknown): boolean {
  return status !== "archived" && status !== "hidden";
}

/**
 * Loads habits that appear in `today` (open habits only — not archived or hidden)
 * and returns them as TodayEntry[], sorted by category (alphabetically,
 * uncategorized last), preserving file order within each category.
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
    if (!habitShownInMonthAndToday(parsed.data.status)) continue;

    const isNegative = parsed.data.type === "negative";
    const isNumerical = !isNegative && parsed.data.type === "numerical";
    const thresholds: Thresholds = {
      partial: isNumerical ? (parsed.data.partial as number ?? null) : null,
      full:    isNumerical ? (parsed.data.full    as number ?? null) : null,
    };
    const completions = parseCompletions(parsed.content);
    const streakCompletions = filterCompletionsForStreak(completions, thresholds.partial);
    const neg = isNegative ? calcNegativeStreak(streakCompletions, today) : null;
    const longestStreak = isNegative
      ? calcLongestNegativeCleanStreak(streakCompletions, today)
      : calcLongestStreak(streakCompletions);

    const todayEntry = completions.get(todayStr);
    entries.push({
      name:          (parsed.data.name as string | undefined) ?? path.basename(file, ".md"),
      filePath,
      icon:          parsed.data.icon as string | undefined,
      category:      (parsed.data.category as string | undefined) ?? null,
      isNumerical,
      isNegative,
      negativeLastSlip: isNegative ? neg!.lastSlip : undefined,
      thresholds,
      todayMarker:   todayEntry?.marker,
      todayNote:     todayEntry?.note,
      currentStreak: isNegative ? neg!.days : calcCurrentStreak(streakCompletions, today),
      longestStreak,
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

import { describe, it, expect } from "vitest";
import {
  applyCompletion,
  removeCompletion,
  parseCompletions,
  parseCompletionLine,
  formatCompletionLine,
  DEFAULT_SYMBOLS,
  calcCurrentStreak,
  calcLongestStreak,
  calcNegativeStreak,
  calcLongestNegativeCleanStreak,
  habitLabel,
  filterCompletionsForStreak,
  markerLevel,
  countCompletionLevelTotals,
  numericValuesForDays,
  lastNDaysFromToday,
  numericSparkline,
  discreteSparkline,
  markerLevelsForDays,
  negativeSparklineForDays,
  isoLocal,
  resolveDoDate,
  resolveNumericalDoMarker,
  parseNumericalStep,
  parseNumericalDoCommandArgs,
  habitShownInMonthAndToday,
  normalizeHabitCategory,
  habitMatchesCategoryFilter,
  completionMarkersOnly,
  parseNumericChartAxis,
  mondayFirstColumnIndex,
  weekStartColumnIndex,
  habitOnTrackForHeatmap,
  habitOnTrackForTodayView,
  buildYearDayCompletionCounts,
  ratioToHeatmapStep,
  HEATMAP_STEP_COUNT,
  HEATMAP_RGB,
  type TodayEntry,
} from "./lib.js";

// ---------------------------------------------------------------------------
// habitOnTrackForTodayView
// ---------------------------------------------------------------------------

describe("habitOnTrackForTodayView", () => {
  it("counts boolean habit when today has a completion", () => {
    const e: TodayEntry = {
      name: "a",
      filePath: "/a",
      category: null,
      isNumerical: false,
      numericalStep: 1,
      isNegative: false,
      negativeLastSlip: undefined,
      thresholds: { partial: null, full: null },
      todayMarker: "x",
      todayNote: undefined,
      currentStreak: 1,
      longestStreak: 1,
      completionCounts: { done: 0, partial: 0, undone: 0 },
    };
    expect(habitOnTrackForTodayView(e)).toBe(true);
  });

  it("does not count numerical habit until full threshold is reached", () => {
    const e: TodayEntry = {
      name: "Steps",
      filePath: "/s",
      category: null,
      isNumerical: true,
      numericalStep: 1,
      isNegative: false,
      negativeLastSlip: undefined,
      thresholds: { partial: 10_000, full: 20_000 },
      todayMarker: "5000",
      todayNote: undefined,
      currentStreak: 0,
      longestStreak: 1,
      completionCounts: { done: 0, partial: 0, undone: 0 },
    };
    expect(habitOnTrackForTodayView(e)).toBe(false);
  });

  it("counts numerical habit when logged value meets full threshold", () => {
    const e: TodayEntry = {
      name: "Steps",
      filePath: "/s",
      category: null,
      isNumerical: true,
      numericalStep: 1,
      isNegative: false,
      negativeLastSlip: undefined,
      thresholds: { partial: 10_000, full: 20_000 },
      todayMarker: "20000",
      todayNote: undefined,
      currentStreak: 0,
      longestStreak: 1,
      completionCounts: { done: 0, partial: 0, undone: 0 },
    };
    expect(habitOnTrackForTodayView(e)).toBe(true);
  });

  it("does not count numerical habit without a numeric marker today", () => {
    const e: TodayEntry = {
      name: "Steps",
      filePath: "/s",
      category: null,
      isNumerical: true,
      numericalStep: 1,
      isNegative: false,
      negativeLastSlip: undefined,
      thresholds: { partial: 10_000, full: 20_000 },
      todayMarker: undefined,
      todayNote: undefined,
      currentStreak: 0,
      longestStreak: 1,
      completionCounts: { done: 0, partial: 0, undone: 0 },
    };
    expect(habitOnTrackForTodayView(e)).toBe(false);
  });

  it("counts negative habit when today has no slip", () => {
    const e: TodayEntry = {
      name: "n",
      filePath: "/n",
      category: null,
      isNumerical: false,
      numericalStep: 1,
      isNegative: true,
      negativeLastSlip: null,
      thresholds: { partial: null, full: null },
      todayMarker: undefined,
      todayNote: undefined,
      currentStreak: 0,
      longestStreak: null,
      completionCounts: { done: 0, partial: 0, undone: 0 },
    };
    expect(habitOnTrackForTodayView(e)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// habitShownInMonthAndToday
// ---------------------------------------------------------------------------

describe("habitShownInMonthAndToday", () => {
  it("is true for open / missing status", () => {
    expect(habitShownInMonthAndToday(undefined)).toBe(true);
    expect(habitShownInMonthAndToday("open")).toBe(true);
  });

  it("is false for archived and hidden", () => {
    expect(habitShownInMonthAndToday("archived")).toBe(false);
    expect(habitShownInMonthAndToday("hidden")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeHabitCategory / habitMatchesCategoryFilter
// ---------------------------------------------------------------------------

describe("normalizeHabitCategory", () => {
  it("returns null when missing or blank", () => {
    expect(normalizeHabitCategory({})).toBe(null);
    expect(normalizeHabitCategory({ category: "" })).toBe(null);
    expect(normalizeHabitCategory({ category: "  " })).toBe(null);
  });

  it("trims non-empty category", () => {
    expect(normalizeHabitCategory({ category: " Health " })).toBe("Health");
  });
});

describe("habitMatchesCategoryFilter", () => {
  it("matches uncategorized aliases only to null category", () => {
    expect(habitMatchesCategoryFilter(null, "uncategorized")).toBe(true);
    expect(habitMatchesCategoryFilter(null, "none")).toBe(true);
    expect(habitMatchesCategoryFilter("Health", "uncategorized")).toBe(false);
  });

  it("matches named categories case-insensitively", () => {
    expect(habitMatchesCategoryFilter("Health", "health")).toBe(true);
    expect(habitMatchesCategoryFilter("Health", "Work")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// weekStartColumnIndex / mondayFirstColumnIndex
// ---------------------------------------------------------------------------

describe("weekStartColumnIndex", () => {
  const thuJan2026 = new Date(2026, 0, 1);

  it("uses Sunday as column 0 when week starts on Sun", () => {
    expect(weekStartColumnIndex(thuJan2026, "sun")).toBe(4);
  });

  it("uses Monday as column 0 when week starts on Mon", () => {
    expect(weekStartColumnIndex(thuJan2026, "mon")).toBe(3);
  });
});

describe("mondayFirstColumnIndex", () => {
  it("matches weekStartColumnIndex(..., mon)", () => {
    const d = new Date(2026, 0, 1);
    expect(mondayFirstColumnIndex(d)).toBe(weekStartColumnIndex(d, "mon"));
  });

  it("maps Jan 1 2026 (Thursday) to column 3", () => {
    expect(mondayFirstColumnIndex(new Date(2026, 0, 1))).toBe(3);
  });

  it("maps Monday to 0 and Sunday to 6", () => {
    expect(mondayFirstColumnIndex(new Date(2026, 3, 6))).toBe(0); // Mon Apr 6 2026
    expect(mondayFirstColumnIndex(new Date(2026, 3, 12))).toBe(6); // Sun Apr 12 2026
  });
});

// ---------------------------------------------------------------------------
// habitOnTrackForHeatmap / buildYearDayCompletionCounts
// ---------------------------------------------------------------------------

describe("habitOnTrackForHeatmap", () => {
  it("is true for a negative habit with no slip on that day", () => {
    const completions = new Map();
    expect(habitOnTrackForHeatmap(completions, "2026-04-05", { partial: null, full: null }, true)).toBe(true);
  });

  it("is false for a negative habit with a slip on that day", () => {
    const completions = new Map([["2026-04-05", { marker: "x" }]]);
    expect(habitOnTrackForHeatmap(completions, "2026-04-05", { partial: null, full: null }, true)).toBe(false);
  });

  it("uses streak qualifying days for boolean habits", () => {
    const completions = new Map([["2026-04-05", { marker: "x" }]]);
    expect(habitOnTrackForHeatmap(completions, "2026-04-05", { partial: null, full: null }, false)).toBe(true);
    expect(habitOnTrackForHeatmap(completions, "2026-04-06", { partial: null, full: null }, false)).toBe(false);
  });
});

describe("buildYearDayCompletionCounts", () => {
  it("sums counts per day across habits", () => {
    const habits = [
      {
        completions: new Map([["2026-06-01", { marker: "x" }]]),
        thresholds: { partial: null, full: null },
        isNegative: false,
      },
      {
        completions: new Map(),
        thresholds: { partial: null, full: null },
        isNegative: false,
      },
    ];
    const counts = buildYearDayCompletionCounts(habits, 2026);
    expect(counts.get("2026-06-01")).toBe(1);
    expect(counts.get("2026-06-02")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ratioToHeatmapStep / HEATMAP_RGB
// ---------------------------------------------------------------------------

describe("ratioToHeatmapStep", () => {
  it("returns null for zero completed or no habits", () => {
    expect(ratioToHeatmapStep(0, 5)).toBe(null);
    expect(ratioToHeatmapStep(3, 0)).toBe(null);
  });

  it("uses 5 percentile buckets like heatmapper (20% bands; 100% → top)", () => {
    expect(ratioToHeatmapStep(1, 10)).toBe(0); // 10%
    expect(ratioToHeatmapStep(2, 10)).toBe(1); // 20%
    expect(ratioToHeatmapStep(5, 10)).toBe(2); // 50%
    expect(ratioToHeatmapStep(8, 10)).toBe(4); // 80%
    expect(ratioToHeatmapStep(9, 10)).toBe(4); // 90%
    expect(ratioToHeatmapStep(10, 10)).toBe(4); // 100%
  });

  it("matches HEATMAP_RGB length", () => {
    expect(HEATMAP_RGB.length).toBe(HEATMAP_STEP_COUNT);
  });
});

// ---------------------------------------------------------------------------
// parseNumericChartAxis
// ---------------------------------------------------------------------------

describe("parseNumericChartAxis", () => {
  it("returns undefined for non-numerical type", () => {
    expect(parseNumericChartAxis({ type: "negative" })).toBeUndefined();
  });

  it("returns undefined when no min/max", () => {
    expect(parseNumericChartAxis({ type: "numerical", partial: 0, full: 100 })).toBeUndefined();
  });

  it("parses min only", () => {
    expect(parseNumericChartAxis({ type: "numerical", min: 0 })).toEqual({ min: 0 });
  });

  it("parses max only", () => {
    expect(parseNumericChartAxis({ type: "numerical", max: 10000 })).toEqual({ max: 10000 });
  });

  it("parses both", () => {
    expect(parseNumericChartAxis({ type: "numerical", min: 0, max: 10000 })).toEqual({ min: 0, max: 10000 });
  });

  it("returns undefined when min >= max", () => {
    expect(parseNumericChartAxis({ type: "numerical", min: 10, max: 10 })).toBeUndefined();
    expect(parseNumericChartAxis({ type: "numerical", min: 10, max: 5 })).toBeUndefined();
  });

  it("returns undefined for non-finite numbers", () => {
    expect(parseNumericChartAxis({ type: "numerical", min: NaN })).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveDoDate
// ---------------------------------------------------------------------------

describe("resolveDoDate", () => {
  /** Tue 2026-04-07 12:00 local — chrono weekday phrases are relative to this. */
  const ref = new Date(2026, 3, 7, 12, 0, 0);

  it("passes through ISO dates", () => {
    expect(resolveDoDate("2026-04-05", ref)).toBe("2026-04-05");
  });

  it("parses yesterday in local calendar", () => {
    expect(resolveDoDate("yesterday", ref)).toBe("2026-04-06");
  });

  it("parses multi-word weekday phrases", () => {
    expect(resolveDoDate("last Tuesday", ref)).toBe("2026-03-31");
  });

  it("returns null for empty or unparseable input", () => {
    expect(resolveDoDate("", ref)).toBeNull();
    expect(resolveDoDate("   ", ref)).toBeNull();
    expect(resolveDoDate("not a date whatsoever", ref)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveNumericalDoMarker
// ---------------------------------------------------------------------------

describe("resolveNumericalDoMarker", () => {
  const date = "2026-04-08";

  it("treats +N as add to existing value for that date", () => {
    const content = "\n- [1] 2026-04-08\n";
    expect(resolveNumericalDoMarker(content, date, "+1")).toBe("2");
    expect(resolveNumericalDoMarker(content, date, "+9")).toBe("10");
  });

  it("treats +N as add to zero when there is no completion for that date", () => {
    expect(resolveNumericalDoMarker("\n", date, "+1")).toBe("1");
    expect(resolveNumericalDoMarker("\n- [5] 2026-04-07\n", date, "+3")).toBe("3");
  });

  it("ignores non-numeric existing marker as base 0 for +N", () => {
    expect(resolveNumericalDoMarker("\n- [x] 2026-04-08\n", date, "+2")).toBe("2");
  });

  it("passes through absolute integers", () => {
    expect(resolveNumericalDoMarker("\n", date, "7")).toBe("7");
    expect(resolveNumericalDoMarker("\n", date, "-1")).toBe("-1");
    expect(resolveNumericalDoMarker("\n", date, "0")).toBe("0");
  });

  it("returns null for invalid tokens", () => {
    expect(resolveNumericalDoMarker("\n", date, "")).toBeNull();
    expect(resolveNumericalDoMarker("\n", date, "  ")).toBeNull();
    expect(resolveNumericalDoMarker("\n", date, "+")).toBeNull();
    expect(resolveNumericalDoMarker("\n", date, "++1")).toBeNull();
    expect(resolveNumericalDoMarker("\n", date, "+1a")).toBeNull();
    expect(resolveNumericalDoMarker("\n", date, "1.5")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseNumericalStep
// ---------------------------------------------------------------------------

describe("parseNumericalStep", () => {
  it("defaults to 1 when absent or invalid", () => {
    expect(parseNumericalStep({})).toBe(1);
    expect(parseNumericalStep({ step: 0 })).toBe(1);
    expect(parseNumericalStep({ step: -2 })).toBe(1);
    expect(parseNumericalStep({ step: 2.5 })).toBe(1);
    expect(parseNumericalStep({ step: "x" })).toBe(1);
    expect(parseNumericalStep({ step: "" })).toBe(1);
  });

  it("reads positive integer from frontmatter", () => {
    expect(parseNumericalStep({ step: 5 })).toBe(5);
    expect(parseNumericalStep({ step: "3" })).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// parseNumericalDoCommandArgs
// ---------------------------------------------------------------------------

describe("parseNumericalDoCommandArgs", () => {
  const ref = new Date(2026, 3, 9, 12, 0, 0);

  it("with no rest adds step to today (default 1)", () => {
    const r = parseNumericalDoCommandArgs("\n", [], ref, 1);
    expect(r).toEqual({ ok: true, targetDate: "2026-04-09", marker: "1" });
  });

  it("with no rest adds custom step on top of existing value", () => {
    const content = "\n- [4] 2026-04-09\n";
    expect(parseNumericalDoCommandArgs(content, [], ref, 3)).toEqual({
      ok: true,
      targetDate: "2026-04-09",
      marker: "7",
    });
  });

  it("treats sole rest arg as date when not a value token", () => {
    const r = parseNumericalDoCommandArgs("\n", ["yesterday"], ref, 1);
    expect(r).toEqual({ ok: true, targetDate: "2026-04-08", marker: "1" });
  });

  it("still parses value then date", () => {
    const r = parseNumericalDoCommandArgs("\n", ["+2", "yesterday"], ref, 1);
    expect(r).toEqual({ ok: true, targetDate: "2026-04-08", marker: "2" });
  });
});

// ---------------------------------------------------------------------------
// applyCompletion
// ---------------------------------------------------------------------------

describe("applyCompletion", () => {
  const emptyContent = "\n";
  const withFull = "\n- [x] 2026-04-07\n";
  const withPartial = "\n- [/] 2026-04-07\n";
  const withTwo = "\n- [x] 2026-04-05\n- [x] 2026-04-07\n";

  it("adds a full completion to empty content", () => {
    const result = applyCompletion(emptyContent, "2026-04-07", "x");
    expect(result.type).toBe("added");
    if (result.type === "added") expect(result.content).toContain("- [x] 2026-04-07");
  });

  it("adds a partial completion", () => {
    const result = applyCompletion(emptyContent, "2026-04-07", "/");
    expect(result.type).toBe("added");
    if (result.type === "added") expect(result.content).toContain("- [/] 2026-04-07");
  });

  it("inserts entries in date order", () => {
    const result = applyCompletion(withTwo, "2026-04-06", "x");
    expect(result.type).toBe("added");
    if (result.type === "added") {
      const lines = result.content.split("\n").filter((l) => l.startsWith("- ["));
      expect(lines).toEqual([
        "- [x] 2026-04-05",
        "- [x] 2026-04-06",
        "- [x] 2026-04-07",
      ]);
    }
  });

  it("returns already_done when marking full again", () => {
    expect(applyCompletion(withFull, "2026-04-07", "x")).toEqual({ type: "already_done", marker: "x" });
  });

  it("returns already_done when marking partial again", () => {
    expect(applyCompletion(withPartial, "2026-04-07", "/")).toEqual({ type: "already_done", marker: "/" });
  });

  it("upgrades partial to full", () => {
    const result = applyCompletion(withPartial, "2026-04-07", "x");
    expect(result.type).toBe("upgraded");
    if (result.type === "upgraded") {
      expect(result.content).toContain("- [x] 2026-04-07");
      expect(result.content).not.toContain("- [/] 2026-04-07");
    }
  });

  it("ignores downgrade from full to partial", () => {
    expect(applyCompletion(withFull, "2026-04-07", "/").type).toBe("downgrade_ignored");
  });

  // Numerical
  it("adds a numeric entry", () => {
    const result = applyCompletion(emptyContent, "2026-04-07", "15");
    expect(result.type).toBe("added");
    if (result.type === "added") expect(result.content).toContain("- [15] 2026-04-07");
  });

  it("adds a signed numeric entry", () => {
    const neg = applyCompletion(emptyContent, "2026-04-07", "-1");
    expect(neg.type).toBe("added");
    if (neg.type === "added") expect(neg.content).toContain("- [-1] 2026-04-07");

    const pos = applyCompletion(emptyContent, "2026-04-08", "+1");
    expect(pos.type).toBe("added");
    if (pos.type === "added") expect(pos.content).toContain("- [+1] 2026-04-08");
  });

  it("replaces a lower numeric value with a higher one", () => {
    const result = applyCompletion("\n- [5] 2026-04-07\n", "2026-04-07", "15");
    expect(result.type).toBe("upgraded");
    if (result.type === "upgraded") {
      expect(result.content).toContain("- [15] 2026-04-07");
      expect(result.content).not.toContain("- [5] 2026-04-07");
    }
  });

  it("replaces a higher numeric value with a lower one (no downgrade protection)", () => {
    const result = applyCompletion("\n- [15] 2026-04-07\n", "2026-04-07", "5");
    expect(result.type).toBe("upgraded");
  });

  it("returns already_done for identical numeric value", () => {
    expect(applyCompletion("\n- [15] 2026-04-07\n", "2026-04-07", "15"))
      .toEqual({ type: "already_done", marker: "15" });
  });

  it("adds a completion with a note", () => {
    const result = applyCompletion(emptyContent, "2026-04-07", "x", DEFAULT_SYMBOLS, "Morning run");
    expect(result.type).toBe("added");
    if (result.type === "added") {
      expect(result.content).toContain("- [x] 2026-04-07 Morning run");
    }
  });

  it("preserves an existing note when upgrading partial to full if no new note is passed", () => {
    const result = applyCompletion("\n- [/] 2026-04-07 felt tired\n", "2026-04-07", "x");
    expect(result.type).toBe("upgraded");
    if (result.type === "upgraded") {
      expect(result.content).toContain("- [x] 2026-04-07 felt tired");
    }
  });

  it("replaces note when a new note is passed", () => {
    const result = applyCompletion("\n- [x] 2026-04-07 old\n", "2026-04-07", "x", DEFAULT_SYMBOLS, "new text");
    expect(result.type).toBe("upgraded");
    if (result.type === "upgraded") {
      expect(result.content).toContain("- [x] 2026-04-07 new text");
      expect(result.content).not.toContain("old");
    }
  });

  it("returns already_done when marker and note match", () => {
    expect(
      applyCompletion("\n- [x] 2026-04-07 same\n", "2026-04-07", "x", DEFAULT_SYMBOLS, "same"),
    ).toEqual({ type: "already_done", marker: "x" });
  });

  // Custom symbols
  const bulletSymbols = { done: "•", partial: "-" };

  it("adds a completion using custom done symbol", () => {
    const result = applyCompletion(emptyContent, "2026-04-07", "•", bulletSymbols);
    expect(result.type).toBe("added");
    if (result.type === "added") expect(result.content).toContain("- [•] 2026-04-07");
  });

  it("upgrades custom partial to custom done", () => {
    const result = applyCompletion("\n- [-] 2026-04-07\n", "2026-04-07", "•", bulletSymbols);
    expect(result.type).toBe("upgraded");
    if (result.type === "upgraded") {
      expect(result.content).toContain("- [•] 2026-04-07");
      expect(result.content).not.toContain("- [-] 2026-04-07");
    }
  });

  it("ignores downgrade from custom done to custom partial", () => {
    expect(applyCompletion("\n- [•] 2026-04-07\n", "2026-04-07", "-", bulletSymbols).type).toBe("downgrade_ignored");
  });
});

// ---------------------------------------------------------------------------
// parseCompletions
// ---------------------------------------------------------------------------

describe("parseCompletions", () => {
  it("parses full and partial completions", () => {
    const content = "\n- [x] 2026-04-05\n- [/] 2026-04-06\n- [x] 2026-04-07\n";
    const map = parseCompletions(content);
    expect(map.get("2026-04-05")?.marker).toBe("x");
    expect(map.get("2026-04-06")?.marker).toBe("/");
    expect(map.get("2026-04-07")?.marker).toBe("x");
  });

  it("parses numeric markers", () => {
    const content = "\n- [5] 2026-04-06\n- [12] 2026-04-07\n";
    const map = parseCompletions(content);
    expect(map.get("2026-04-06")?.marker).toBe("5");
    expect(map.get("2026-04-07")?.marker).toBe("12");
  });

  it("parses signed integer markers", () => {
    const content = "\n- [-1] 2026-04-06\n- [+1] 2026-04-07\n";
    const map = parseCompletions(content);
    expect(map.get("2026-04-06")?.marker).toBe("-1");
    expect(map.get("2026-04-07")?.marker).toBe("+1");
  });

  it("parses optional notes after the date", () => {
    const content = "\n- [x] 2026-04-07 great session\n";
    const map = parseCompletions(content);
    expect(map.get("2026-04-07")).toEqual({ marker: "x", note: "great session" });
  });

  it("ignores non-completion lines", () => {
    const content = "\nSome description text\n- [x] 2026-04-07\n";
    expect(parseCompletions(content).size).toBe(1);
  });

  it("returns empty map for empty content", () => {
    expect(parseCompletions("").size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseCompletionLine / formatCompletionLine
// ---------------------------------------------------------------------------

describe("parseCompletionLine", () => {
  it("parses lines without notes", () => {
    expect(parseCompletionLine("- [x] 2026-04-07")).toEqual({
      marker: "x",
      date: "2026-04-07",
      note: undefined,
    });
  });

  it("parses lines with notes", () => {
    expect(parseCompletionLine("- [15] 2026-04-05  steps")).toEqual({
      marker: "15",
      date: "2026-04-05",
      note: "steps",
    });
  });

  it("returns null for non-completion lines", () => {
    expect(parseCompletionLine("not a completion")).toBeNull();
  });
});

describe("formatCompletionLine", () => {
  it("omits note when absent", () => {
    expect(formatCompletionLine("x", "2026-04-07")).toBe("- [x] 2026-04-07");
  });

  it("appends note after the date", () => {
    expect(formatCompletionLine("x", "2026-04-07", "hello")).toBe("- [x] 2026-04-07 hello");
  });
});

// ---------------------------------------------------------------------------
// calcLongestStreak
// ---------------------------------------------------------------------------

describe("calcLongestStreak", () => {
  it("returns 0 for no completions", () => {
    expect(calcLongestStreak(new Map())).toBe(0);
  });

  it("returns 1 for a single completion", () => {
    expect(calcLongestStreak(new Map([["2026-04-07", "x"]]))).toBe(1);
  });

  it("counts consecutive days", () => {
    const map = new Map([["2026-04-05", "x"], ["2026-04-06", "/"], ["2026-04-07", "x"]]);
    expect(calcLongestStreak(map)).toBe(3);
  });

  it("finds the longest run across a gap", () => {
    const map = new Map([
      ["2026-04-01", "x"], ["2026-04-02", "x"],
      ["2026-04-04", "x"], ["2026-04-05", "x"], ["2026-04-06", "x"],
    ]);
    expect(calcLongestStreak(map)).toBe(3);
  });

  it("is not confused by DST transitions (Mar 29 in Europe)", () => {
    const map = new Map([["2026-03-28", "x"], ["2026-03-29", "x"], ["2026-03-30", "x"]]);
    expect(calcLongestStreak(map)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// calcCurrentStreak
// ---------------------------------------------------------------------------

describe("calcCurrentStreak", () => {
  const today = new Date("2026-04-07T12:00:00");

  it("returns 0 when today is not completed", () => {
    expect(calcCurrentStreak(new Map([["2026-04-06", "x"]]), today)).toBe(0);
  });

  it("returns 1 when only today is completed", () => {
    expect(calcCurrentStreak(new Map([["2026-04-07", "x"]]), today)).toBe(1);
  });

  it("counts consecutive days back from today", () => {
    const map = new Map([["2026-04-05", "x"], ["2026-04-06", "/"], ["2026-04-07", "x"]]);
    expect(calcCurrentStreak(map, today)).toBe(3);
  });

  it("stops at the first gap", () => {
    const map = new Map([["2026-04-04", "x"], ["2026-04-06", "x"], ["2026-04-07", "x"]]);
    expect(calcCurrentStreak(map, today)).toBe(2);
  });

  it("counts partial completions as part of the streak", () => {
    const map = new Map([["2026-04-06", "/"], ["2026-04-07", "/"]]);
    expect(calcCurrentStreak(map, today)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// calcNegativeStreak
// ---------------------------------------------------------------------------

describe("calcNegativeStreak", () => {
  const today = new Date("2026-04-07T12:00:00");

  it("returns never slipped when there are no entries", () => {
    expect(calcNegativeStreak(new Map(), today)).toEqual({ days: 0, lastSlip: null });
  });

  it("uses the most recent slip on or before today", () => {
    const map = new Map([
      ["2026-03-15", "x"],
      ["2026-04-01", "x"],
    ]);
    expect(calcNegativeStreak(map, today)).toEqual({ days: 6, lastSlip: "2026-04-01" });
  });

  it("returns 0 days when the slip is today", () => {
    const map = new Map([["2026-04-07", "x"]]);
    expect(calcNegativeStreak(map, today)).toEqual({ days: 0, lastSlip: "2026-04-07" });
  });

  it("ignores slips after today", () => {
    const map = new Map([["2026-05-01", "x"]]);
    expect(calcNegativeStreak(map, today)).toEqual({ days: 0, lastSlip: null });
  });
});

// ---------------------------------------------------------------------------
// calcLongestNegativeCleanStreak
// ---------------------------------------------------------------------------

describe("calcLongestNegativeCleanStreak", () => {
  const today = new Date("2026-04-07T12:00:00");

  it("returns null when there are no slips", () => {
    expect(calcLongestNegativeCleanStreak(new Map(), today)).toBeNull();
  });

  it("returns clean days since the only slip when that beats inter-slip gaps", () => {
    const map = new Map([["2026-04-01", "x"]]);
    expect(calcLongestNegativeCleanStreak(map, today)).toBe(6);
  });

  it("takes the max of between-slip clean runs and the run after the last slip", () => {
    const map = new Map([
      ["2026-04-01", "x"],
      ["2026-04-05", "x"],
    ]);
    // Apr 2–4 = 3 clean; after Apr 5 slip: Apr 6–7 = 2 clean
    expect(calcLongestNegativeCleanStreak(map, today)).toBe(3);
  });

  it("ignores slips after today", () => {
    const map = new Map([
      ["2026-04-01", "x"],
      ["2026-05-01", "x"],
    ]);
    expect(calcLongestNegativeCleanStreak(map, today)).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// filterCompletionsForStreak
// ---------------------------------------------------------------------------

describe("filterCompletionsForStreak", () => {
  const map = new Map([
    ["2026-04-05", { marker: "3" }],
    ["2026-04-06", { marker: "5" }],
    ["2026-04-07", { marker: "12" }],
  ]);

  it("returns all markers when threshold is null", () => {
    expect(filterCompletionsForStreak(map, null)).toEqual(completionMarkersOnly(map));
  });

  it("excludes entries below the threshold", () => {
    const result = filterCompletionsForStreak(map, 5);
    expect(result.has("2026-04-05")).toBe(false);
  });

  it("includes entries at the threshold", () => {
    const result = filterCompletionsForStreak(map, 5);
    expect(result.has("2026-04-06")).toBe(true);
  });

  it("includes entries above the threshold", () => {
    const result = filterCompletionsForStreak(map, 5);
    expect(result.has("2026-04-07")).toBe(true);
  });

  it("returns empty map when all entries are below threshold", () => {
    expect(filterCompletionsForStreak(map, 100).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// numericValuesForDays
// ---------------------------------------------------------------------------

describe("numericValuesForDays", () => {
  it("maps numeric markers and 0 for missing", () => {
    const completions = parseCompletions("\n- [10] 2026-04-05\n- [20] 2026-04-07\n");
    const days = [new Date(2026, 3, 5), new Date(2026, 3, 6), new Date(2026, 3, 7)];
    expect(numericValuesForDays(completions, days)).toEqual([10, 0, 20]);
  });

  it("maps signed integer markers", () => {
    const completions = parseCompletions("\n- [-1] 2026-04-05\n- [+1] 2026-04-06\n");
    const days = [new Date(2026, 3, 5), new Date(2026, 3, 6)];
    expect(numericValuesForDays(completions, days)).toEqual([-1, 1]);
  });

  it("treats non-numeric markers as 0", () => {
    const completions = parseCompletions("\n- [x] 2026-04-05\n- [/] 2026-04-06\n");
    const days = [new Date(2026, 3, 5), new Date(2026, 3, 6)];
    expect(numericValuesForDays(completions, days)).toEqual([0, 0]);
  });
});

// ---------------------------------------------------------------------------
// lastNDaysFromToday
// ---------------------------------------------------------------------------

describe("lastNDaysFromToday", () => {
  it("returns n local days oldest-first ending on today", () => {
    const t = new Date(2026, 3, 8);
    expect(lastNDaysFromToday(t, 7).map(isoLocal)).toEqual([
      "2026-04-02",
      "2026-04-03",
      "2026-04-04",
      "2026-04-05",
      "2026-04-06",
      "2026-04-07",
      "2026-04-08",
    ]);
  });
});

// ---------------------------------------------------------------------------
// numericSparkline
// ---------------------------------------------------------------------------

describe("numericSparkline", () => {
  it("returns empty for empty input", () => {
    expect(numericSparkline([])).toBe("");
  });

  it("maps endpoints to bottom and top blocks", () => {
    expect(numericSparkline([0, 100])).toBe("\u2581\u2588");
  });

  it("uses flat bottom for all zeros", () => {
    expect(numericSparkline([0, 0, 0])).toBe("\u2581\u2581\u2581");
  });

  it("uses mid block for constant non-zero series", () => {
    expect(numericSparkline([42, 42, 42])).toBe("\u2585\u2585\u2585");
  });

  it("expands range with axis min/max like show", () => {
    expect(numericSparkline([50, 50], { min: 0, max: 100 })).toBe("\u2585\u2585");
  });
});

// ---------------------------------------------------------------------------
// markerLevelsForDays / discreteSparkline / negativeSparklineForDays
// ---------------------------------------------------------------------------

describe("markerLevelsForDays", () => {
  it("returns marker levels in day order", () => {
    const completions = parseCompletions("\n- [x] 2026-04-07\n- [/] 2026-04-08\n");
    const days = [new Date(2026, 3, 7), new Date(2026, 3, 8)];
    expect(markerLevelsForDays(completions, days, { partial: null, full: null })).toEqual([
      "full",
      "partial",
    ]);
  });
});

describe("discreteSparkline", () => {
  it("maps none and low to bottom, partial to mid, full to top", () => {
    expect(discreteSparkline(["none", "partial", "full", "low"])).toBe(
      "\u2581\u2585\u2588\u2581",
    );
  });
});

describe("negativeSparklineForDays", () => {
  it("uses bottom for clean days and top for slips", () => {
    const completions = parseCompletions("\n- [x] 2026-04-07\n");
    const days = [new Date(2026, 3, 6), new Date(2026, 3, 7)];
    expect(negativeSparklineForDays(completions, days)).toBe("\u2581\u2588");
  });
});

// ---------------------------------------------------------------------------
// countCompletionLevelTotals
// ---------------------------------------------------------------------------

describe("countCompletionLevelTotals", () => {
  const sym = DEFAULT_SYMBOLS;
  const numTh = { partial: 5, full: 10 };
  const boolTh = { partial: null, full: null };

  it("counts boolean completions", () => {
    const c = parseCompletions("- [x] 2026-04-01\n- [/] 2026-04-02\n- [x] 2026-04-03\n");
    expect(countCompletionLevelTotals(c, false, boolTh, sym)).toEqual({ done: 2, partial: 1, undone: 0 });
  });

  it("counts numerical tiers", () => {
    const c = parseCompletions("- [12] 2026-04-01\n- [7] 2026-04-02\n- [3] 2026-04-03\n");
    expect(countCompletionLevelTotals(c, false, numTh, sym)).toEqual({ done: 1, partial: 1, undone: 1 });
  });

  it("negative habit counts slips as undone only", () => {
    const c = parseCompletions("- [x] 2026-04-01\n- [x] 2026-04-05\n");
    expect(countCompletionLevelTotals(c, true, boolTh, sym)).toEqual({ done: 0, partial: 0, undone: 2 });
  });
});

// ---------------------------------------------------------------------------
// markerLevel
// ---------------------------------------------------------------------------

describe("markerLevel", () => {
  const num = { partial: 5, full: 10 };
  const bool = { partial: null, full: null };

  it("x → full", () => expect(markerLevel("x", bool)).toBe("full"));
  it("/ → partial", () => expect(markerLevel("/", bool)).toBe("partial"));
  it("undefined → none", () => expect(markerLevel(undefined, bool)).toBe("none"));
  it("empty string → none", () => expect(markerLevel("", bool)).toBe("none"));

  it("numeric >= full → full", () => expect(markerLevel("15", num)).toBe("full"));
  it("numeric == full → full", () => expect(markerLevel("10", num)).toBe("full"));
  it("numeric >= partial but < full → partial", () => expect(markerLevel("7", num)).toBe("partial"));
  it("numeric == partial → partial", () => expect(markerLevel("5", num)).toBe("partial"));
  it("numeric < partial → low", () => expect(markerLevel("3", num)).toBe("low"));
  it("zero < partial → low", () => expect(markerLevel("0", num)).toBe("low"));

  it("custom done symbol → full", () => expect(markerLevel("•", bool, { done: "•", partial: "-" })).toBe("full"));
  it("custom partial symbol → partial", () => expect(markerLevel("-", bool, { done: "•", partial: "-" })).toBe("partial"));
  it("default x is not full when custom symbols are set", () => expect(markerLevel("x", bool, { done: "•", partial: "-" })).toBe("low"));
});

// ---------------------------------------------------------------------------
// habitLabel
// ---------------------------------------------------------------------------

describe("habitLabel", () => {
  it("returns the name as label when no icon", () => {
    const { label, width } = habitLabel("Meditate");
    expect(label).toBe("Meditate");
    expect(width).toBe(8);
  });

  it("prepends icon and space when icon is provided", () => {
    expect(habitLabel("Meditate", "🧘").label).toBe("🧘 Meditate");
  });

  it("reports correct visual width for emoji icon (emoji = 2 columns)", () => {
    expect(habitLabel("Meditate", "🧘").width).toBe(11);
  });

  it("returns name width without icon", () => {
    expect(habitLabel("Go").width).toBe(2);
  });

  it("ignores undefined icon the same as no icon", () => {
    expect(habitLabel("Run", undefined)).toEqual(habitLabel("Run"));
  });
});

// ---------------------------------------------------------------------------
// removeCompletion
// ---------------------------------------------------------------------------

describe("removeCompletion", () => {
  it("removes a full completion for the given date", () => {
    const content = "\n- [x] 2026-04-07\n";
    expect(removeCompletion(content, "2026-04-07")).not.toContain("2026-04-07");
  });

  it("removes a partial completion", () => {
    const content = "\n- [/] 2026-04-07\n";
    expect(removeCompletion(content, "2026-04-07")).not.toContain("2026-04-07");
  });

  it("removes a numerical completion", () => {
    const content = "\n- [3200] 2026-04-07\n";
    expect(removeCompletion(content, "2026-04-07")).not.toContain("2026-04-07");
  });

  it("removes a line that includes a note", () => {
    const content = "\n- [x] 2026-04-07 optional note here\n";
    expect(removeCompletion(content, "2026-04-07")).not.toContain("- [x]");
  });

  it("leaves other dates untouched", () => {
    const content = "\n- [x] 2026-04-06\n- [x] 2026-04-07\n";
    const result = removeCompletion(content, "2026-04-07");
    expect(result).toContain("2026-04-06");
    expect(result).not.toContain("2026-04-07");
  });

  it("is a no-op when date is not present", () => {
    const content = "\n- [x] 2026-04-06\n";
    expect(removeCompletion(content, "2026-04-07")).toBe(content);
  });

  it("does not remove non-completion lines that mention the date", () => {
    const content = "\nCompleted on 2026-04-07 manually\n- [x] 2026-04-07\n";
    const result = removeCompletion(content, "2026-04-07");
    expect(result).toContain("Completed on 2026-04-07 manually");
    expect(result).not.toContain("- [x] 2026-04-07");
  });
});

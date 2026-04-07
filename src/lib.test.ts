import { describe, it, expect } from "vitest";
import {
  applyCompletion,
  removeCompletion,
  parseCompletions,
  calcCurrentStreak,
  calcLongestStreak,
  calcNegativeStreak,
  habitLabel,
  filterCompletionsForStreak,
  markerLevel,
} from "./lib.js";

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
    expect(map.get("2026-04-05")).toBe("x");
    expect(map.get("2026-04-06")).toBe("/");
    expect(map.get("2026-04-07")).toBe("x");
  });

  it("parses numeric markers", () => {
    const content = "\n- [5] 2026-04-06\n- [12] 2026-04-07\n";
    const map = parseCompletions(content);
    expect(map.get("2026-04-06")).toBe("5");
    expect(map.get("2026-04-07")).toBe("12");
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
// filterCompletionsForStreak
// ---------------------------------------------------------------------------

describe("filterCompletionsForStreak", () => {
  const map = new Map([["2026-04-05", "3"], ["2026-04-06", "5"], ["2026-04-07", "12"]]);

  it("returns the same map when threshold is null", () => {
    expect(filterCompletionsForStreak(map, null)).toBe(map);
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

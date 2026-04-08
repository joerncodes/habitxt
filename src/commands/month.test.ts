import { describe, it, expect } from "vitest";
import chalk from "chalk";
import { buildDowRow, buildNumRow, buildHabitCells, groupHabits, DOW, MONTH_COL, HabitRow } from "./month.js";

// Force chalk to emit ANSI codes even in non-TTY test environments
chalk.level = 3;

const habit = (name: string, category: string | null = null): HabitRow => ({
  name,
  icon: undefined,
  category,
  completions: new Map(),
  thresholds: { partial: null, full: null },
  isNegative: false,
});

// ---------------------------------------------------------------------------
// groupHabits
// ---------------------------------------------------------------------------

describe("groupHabits", () => {
  it("returns a single null group when no habits have categories", () => {
    const groups = groupHabits([habit("A"), habit("B")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBeNull();
    expect(groups[0].habits.map((h) => h.name)).toEqual(["A", "B"]);
  });

  it("groups habits by category", () => {
    const groups = groupHabits([
      habit("Meditate", "Mindfulness"),
      habit("Exercise", "Fitness"),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["Fitness", "Mindfulness"]);
  });

  it("sorts categories alphabetically", () => {
    const groups = groupHabits([
      habit("C", "Zebra"),
      habit("A", "Alpha"),
      habit("B", "Mango"),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["Alpha", "Mango", "Zebra"]);
  });

  it("places uncategorized habits last", () => {
    const groups = groupHabits([
      habit("Orphan"),
      habit("Run", "Fitness"),
    ]);
    expect(groups[0].category).toBe("Fitness");
    expect(groups[1].category).toBeNull();
    expect(groups[1].habits[0].name).toBe("Orphan");
  });

  it("preserves habit order within a group", () => {
    const groups = groupHabits([
      habit("Yoga", "Mindfulness"),
      habit("Meditate", "Mindfulness"),
    ]);
    expect(groups[0].habits.map((h) => h.name)).toEqual(["Yoga", "Meditate"]);
  });

  it("returns empty array for empty input", () => {
    expect(groupHabits([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildDowRow
// ---------------------------------------------------------------------------

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("buildDowRow", () => {
  // April 2026: starts on Wednesday (index 3)
  it("returns the correct number of cells", () => {
    expect(buildDowRow(2026, 3, 30, null)).toHaveLength(30);
  });

  it("first letter of April 2026 is W (Wednesday)", () => {
    const row = buildDowRow(2026, 3, 30, null);
    expect(strip(row[0]).trim()).toBe("W");
  });

  it("each cell is centered in MONTH_COL width", () => {
    const row = buildDowRow(2026, 3, 30, null);
    for (const cell of row) {
      expect(strip(cell)).toHaveLength(MONTH_COL);
    }
  });

  it("only produces valid DOW letters", () => {
    const row = buildDowRow(2026, 3, 30, null);
    for (const cell of row) {
      expect(DOW).toContain(strip(cell).trim());
    }
  });

  it("cycles through all 7 days across a full week", () => {
    // January 2026 starts on Thursday
    const row = buildDowRow(2026, 0, 31, null);
    const letters = row.map((c) => strip(c).trim());
    expect(letters.slice(0, 7)).toEqual(["T", "F", "S", "S", "M", "T", "W"]);
  });

  it("applies bold+underline to today's column", () => {
    const row = buildDowRow(2026, 3, 30, 7); // Apr 7 = today
    expect(row[6]).not.toBe(row[5]);           // today cell differs from neighbours
    expect(strip(row[6]).trim()).toBe("T");     // content is still correct
    expect(strip(row[5]).trim()).toBe("M");     // non-today cell unaffected
  });
});

// ---------------------------------------------------------------------------
// buildNumRow
// ---------------------------------------------------------------------------

describe("buildNumRow", () => {
  it("returns correct count for 30-day month", () => {
    expect(buildNumRow(30, null)).toHaveLength(30);
  });

  it("returns correct count for 31-day month", () => {
    expect(buildNumRow(31, null)).toHaveLength(31);
  });

  it("zero-pads single digit days", () => {
    const row = buildNumRow(9, null);
    expect(strip(row[0]).trim()).toBe("01");
    expect(strip(row[8]).trim()).toBe("09");
  });

  it("does not pad double digit days", () => {
    const row = buildNumRow(31, null);
    expect(strip(row[9]).trim()).toBe("10");
    expect(strip(row[30]).trim()).toBe("31");
  });

  it("each cell is MONTH_COL wide (ignoring ANSI)", () => {
    for (const cell of buildNumRow(31, null)) {
      expect(strip(cell)).toHaveLength(MONTH_COL);
    }
  });

  it("applies bold+underline to today's column", () => {
    const row = buildNumRow(30, 7);
    expect(row[6]).not.toBe(row[5]);
    expect(strip(row[6]).trim()).toBe("07");
  });
});

// ---------------------------------------------------------------------------
// buildHabitCells
// ---------------------------------------------------------------------------

describe("buildHabitCells", () => {
  const completions = new Map([
    ["2026-04-01", { marker: "x" }],
    ["2026-04-03", { marker: "/" }],
  ]);
  const todayStr = "2026-04-05";
  const noThresholds = { partial: null, full: null };

  it("returns correct cell count", () => {
    expect(buildHabitCells(completions, 2026, 3, 30, todayStr, noThresholds)).toHaveLength(30);
  });

  it("future days are blank (no marker)", () => {
    const cells = buildHabitCells(completions, 2026, 3, 30, todayStr, noThresholds);
    for (let i = 5; i < 30; i++) expect(cells[i].trim()).toBe("");
  });

  it("past day with no completion is a plain space cell", () => {
    const cells = buildHabitCells(completions, 2026, 3, 30, todayStr, noThresholds);
    expect(cells[1]).toBe(" \u0020 ");
    expect(cells[1]).toHaveLength(MONTH_COL);
  });

  it("today with no completion is a plain space cell", () => {
    const cells = buildHabitCells(new Map(), 2026, 3, 30, todayStr, noThresholds);
    expect(cells[4]).toBe("   ");
  });

  it("completed day contains the marker character", () => {
    const cells = buildHabitCells(completions, 2026, 3, 30, todayStr, noThresholds);
    expect(strip(cells[0])).toContain("x");
    expect(strip(cells[2])).toContain("/");
  });

  it("numerical >= full threshold renders green", () => {
    const num = new Map([["2026-04-01", { marker: "12" }]]);
    const cells = buildHabitCells(num, 2026, 3, 30, todayStr, { partial: 5, full: 10 });
    expect(strip(cells[0])).toContain("12");
    // green = different from plain
    expect(cells[0]).not.toBe(" 12 ");
  });

  it("numerical >= partial but < full renders yellow", () => {
    const num = new Map([["2026-04-01", { marker: "7" }]]);
    const cellsNum  = buildHabitCells(num, 2026, 3, 30, todayStr, { partial: 5, full: 10 });
    const cellsFull = buildHabitCells(new Map([["2026-04-01", { marker: "12" }]]), 2026, 3, 30, todayStr, { partial: 5, full: 10 });
    // partial cell differs from full cell (different chalk color)
    expect(cellsNum[0]).not.toBe(cellsFull[0]);
    expect(strip(cellsNum[0])).toContain("7");
  });

  it("numerical < partial is plain", () => {
    const num = new Map([["2026-04-01", { marker: "3" }]]);
    const cells = buildHabitCells(num, 2026, 3, 30, todayStr, { partial: 5, full: 10 });
    expect(cells[0]).toBe(" 3 ");
  });

  it("two-digit number fits in MONTH_COL (right-aligned)", () => {
    const num = new Map([["2026-04-01", { marker: "12" }]]);
    const cells = buildHabitCells(num, 2026, 3, 30, todayStr, { partial: 5, full: 10 });
    expect(strip(cells[0])).toHaveLength(MONTH_COL);
    expect(strip(cells[0])).toContain("12");
  });

  it("number >= 100 is capped to '99+' (3 chars)", () => {
    const num = new Map([["2026-04-01", { marker: "150" }]]);
    const cells = buildHabitCells(num, 2026, 3, 30, todayStr, { partial: 50, full: 100 });
    expect(strip(cells[0])).toBe("99+");
    expect(strip(cells[0])).toHaveLength(MONTH_COL);
  });

  it("negative habit: clean day is green, slip is red", () => {
    const map = new Map([["2026-04-01", { marker: "x" }]]);
    const cells = buildHabitCells(map, 2026, 3, 30, todayStr, noThresholds, undefined, true);
    expect(cells[0]).not.toBe(" x ");
    expect(strip(cells[0])).toContain("x");
    const empty = buildHabitCells(new Map(), 2026, 3, 30, todayStr, noThresholds, undefined, true);
    expect(empty[1]).not.toBe(" \u0020 ");
  });
});

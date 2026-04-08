import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadTodayHabits } from "../lib.js";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function writeHabit(
  dir: string,
  filename: string,
  frontmatter: Record<string, unknown>,
  completions: string[] = []
) {
  const fmLines = ["---"];
  for (const [k, v] of Object.entries(frontmatter)) {
    fmLines.push(typeof v === "string" ? `${k}: ${v}` : `${k}: ${JSON.stringify(v)}`);
  }
  fmLines.push("---", "");
  const body = completions.map((c) => {
    const spaceIdx = c.indexOf(" ");
    const marker   = c.slice(0, spaceIdx);
    const date     = c.slice(spaceIdx + 1);
    return `- [${marker}] ${date}`;
  }).join("\n");
  fs.writeFileSync(path.join(dir, filename), fmLines.join("\n") + (body ? body + "\n" : ""));
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe("loadTodayHabits", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "habitxt-today-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true });
  });

  it("returns empty array when directory does not exist", () => {
    expect(loadTodayHabits("/nonexistent-dir-habitxt", "2026-04-07")).toEqual([]);
  });

  it("returns empty array for an empty habits directory", () => {
    expect(loadTodayHabits(dir, "2026-04-07")).toEqual([]);
  });

  it("returns one entry for a single boolean habit with no completions", () => {
    writeHabit(dir, "Meditate.md", { name: "Meditate" });
    const entries = loadTodayHabits(dir, "2026-04-07");
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("Meditate");
    expect(entries[0].isNumerical).toBe(false);
    expect(entries[0].isNegative).toBe(false);
    expect(entries[0].negativeLastSlip).toBeUndefined();
    expect(entries[0].todayMarker).toBeUndefined();
    expect(entries[0].currentStreak).toBe(0);
    expect(entries[0].category).toBeNull();
  });

  it("reads today's marker correctly", () => {
    writeHabit(dir, "Meditate.md", { name: "Meditate" }, ["x 2026-04-07"]);
    const entries = loadTodayHabits(dir, "2026-04-07");
    expect(entries[0].todayMarker).toBe("x");
  });

  it("reads partial marker correctly", () => {
    writeHabit(dir, "Journal.md", { name: "Journal" }, ["/ 2026-04-07"]);
    const entries = loadTodayHabits(dir, "2026-04-07");
    expect(entries[0].todayMarker).toBe("/");
  });

  it("todayMarker is undefined when today is not completed", () => {
    writeHabit(dir, "Run.md", { name: "Run" }, ["x 2026-04-06"]);
    const entries = loadTodayHabits(dir, "2026-04-07");
    expect(entries[0].todayMarker).toBeUndefined();
  });

  it("calculates currentStreak correctly", () => {
    // streak of 3: Apr 5, 6, 7
    writeHabit(dir, "Meditate.md", { name: "Meditate" }, [
      "x 2026-04-05",
      "x 2026-04-06",
      "x 2026-04-07",
    ]);
    const entries = loadTodayHabits(dir, "2026-04-07");
    expect(entries[0].currentStreak).toBe(3);
  });

  it("skips archived habits", () => {
    writeHabit(dir, "OldHabit.md", { name: "OldHabit", status: "archived" });
    writeHabit(dir, "Active.md",   { name: "Active" });
    const entries = loadTodayHabits(dir, "2026-04-07");
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("Active");
  });

  it("skips hidden habits", () => {
    writeHabit(dir, "Quiet.md", { name: "Quiet", status: "hidden" });
    writeHabit(dir, "Active.md", { name: "Active" });
    const entries = loadTodayHabits(dir, "2026-04-07");
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("Active");
  });

  it("reads isNumerical and thresholds from numerical habit", () => {
    writeHabit(dir, "Steps.md", {
      name:    "Steps",
      type:    "numerical",
      partial: 3000,
      full:    10000,
    });
    const entries = loadTodayHabits(dir, "2026-04-07");
    expect(entries[0].isNumerical).toBe(true);
    expect(entries[0].thresholds).toEqual({ partial: 3000, full: 10000 });
  });

  it("reads numerical marker as todayMarker", () => {
    writeHabit(dir, "Steps.md", { name: "Steps", type: "numerical" }, ["3200 2026-04-07"]);
    const entries = loadTodayHabits(dir, "2026-04-07");
    expect(entries[0].todayMarker).toBe("3200");
  });

  it("reads icon and filePath correctly", () => {
    writeHabit(dir, "Meditate.md", { name: "Meditate", icon: "🧘" });
    const entries = loadTodayHabits(dir, "2026-04-07");
    expect(entries[0].icon).toBe("🧘");
    expect(entries[0].filePath).toBe(path.join(dir, "Meditate.md"));
  });

  it("falls back to filename (minus .md) when no name in frontmatter", () => {
    writeHabit(dir, "NoName.md", {});
    const entries = loadTodayHabits(dir, "2026-04-07");
    expect(entries[0].name).toBe("NoName");
  });

  it("sorts categorized entries alphabetically by category, uncategorized last", () => {
    writeHabit(dir, "Run.md",      { name: "Run",      category: "Fitness" });
    writeHabit(dir, "Meditate.md", { name: "Meditate", category: "Mindfulness" });
    writeHabit(dir, "Orphan.md",   { name: "Orphan" });
    writeHabit(dir, "Yoga.md",     { name: "Yoga",     category: "Fitness" });

    const entries = loadTodayHabits(dir, "2026-04-07");
    expect(entries.map((e) => e.name)).toEqual(["Run", "Yoga", "Meditate", "Orphan"]);
    expect(entries.map((e) => e.category)).toEqual(["Fitness", "Fitness", "Mindfulness", null]);
  });

  it("preserves file-name order within the same category", () => {
    writeHabit(dir, "A.md", { name: "A", category: "Health" });
    writeHabit(dir, "B.md", { name: "B", category: "Health" });
    writeHabit(dir, "C.md", { name: "C", category: "Health" });
    const entries = loadTodayHabits(dir, "2026-04-07");
    expect(entries.map((e) => e.name)).toEqual(["A", "B", "C"]);
  });

  it("reads negative habit and clean streak", () => {
    writeHabit(
      dir,
      "NoAlcohol.md",
      { name: "No Alcohol", type: "negative" },
      ["x 2026-04-01"],
    );
    const entries = loadTodayHabits(dir, "2026-04-07");
    expect(entries).toHaveLength(1);
    expect(entries[0].isNegative).toBe(true);
    expect(entries[0].isNumerical).toBe(false);
    expect(entries[0].negativeLastSlip).toBe("2026-04-01");
    expect(entries[0].currentStreak).toBe(6);
  });

  it("negative habit with no slips reports never slipped", () => {
    writeHabit(dir, "NoJunk.md", { name: "No Junk", type: "negative" });
    const entries = loadTodayHabits(dir, "2026-04-07");
    expect(entries[0].isNegative).toBe(true);
    expect(entries[0].negativeLastSlip).toBeNull();
    expect(entries[0].currentStreak).toBe(0);
  });
});

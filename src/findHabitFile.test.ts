import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { findHabitFile } from "./lib.js";

function writeHabit(dir: string, filename: string, frontmatter: Record<string, unknown>) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(frontmatter)) {
    lines.push(`${k}: ${JSON.stringify(v)}`);
  }
  lines.push("---", "");
  fs.writeFileSync(path.join(dir, filename), lines.join("\n"));
}

describe("findHabitFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "habitxt-"));
    writeHabit(dir, "Meditate.md", {
      name: "Meditate",
      aliases: ["Meditation", "SitDownAndShutUp"],
    });
    writeHabit(dir, "Exercise.md", { name: "Exercise", aliases: ["Workout"] });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true });
  });

  it("resolves by exact filename (without .md)", () => {
    expect(findHabitFile("Meditate", dir)).toBe(path.join(dir, "Meditate.md"));
  });

  it("resolves by alias (exact case)", () => {
    expect(findHabitFile("Meditation", dir)).toBe(path.join(dir, "Meditate.md"));
  });

  it("resolves by alias (case-insensitive)", () => {
    expect(findHabitFile("meditation", dir)).toBe(path.join(dir, "Meditate.md"));
    expect(findHabitFile("SITDOWNANDSHUTUP", dir)).toBe(path.join(dir, "Meditate.md"));
  });

  it("resolves a different habit by alias", () => {
    expect(findHabitFile("Workout", dir)).toBe(path.join(dir, "Exercise.md"));
  });

  it("returns null when name does not match any file or alias", () => {
    expect(findHabitFile("Ghost", dir)).toBeNull();
  });

  it("direct filename match takes priority over alias scan", () => {
    // If a file named Meditation.md exists, it should be returned directly
    writeHabit(dir, "Meditation.md", { name: "Meditation" });
    expect(findHabitFile("Meditation", dir)).toBe(path.join(dir, "Meditation.md"));
  });

  it("handles habit with no aliases field", () => {
    writeHabit(dir, "NoAlias.md", { name: "NoAlias" });
    expect(findHabitFile("NoAlias", dir)).toBe(path.join(dir, "NoAlias.md"));
    expect(findHabitFile("something", dir)).toBeNull();
  });
});

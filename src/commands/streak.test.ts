import { describe, it, expect } from "vitest";
import { streakLeaderboardCompare } from "./streak.js";
import type { TodayEntry } from "../lib.js";

const base = (over: Partial<TodayEntry>): TodayEntry => ({
  name: "H",
  filePath: "/x.md",
  category: null,
  isNumerical: false,
  isNegative: false,
  thresholds: { partial: null, full: null },
  todayMarker: undefined,
  todayNote: undefined,
  currentStreak: 0,
  longestStreak: 0,
  ...over,
});

describe("streakLeaderboardCompare (current)", () => {
  it("orders by current streak descending for non-negative habits", () => {
    const a = base({ name: "A", currentStreak: 3 });
    const b = base({ name: "B", currentStreak: 10 });
    expect(streakLeaderboardCompare(a, b, "current")).toBeGreaterThan(0);
    expect(streakLeaderboardCompare(b, a, "current")).toBeLessThan(0);
  });

  it("ties break by name", () => {
    const y = base({ name: "Yoga", currentStreak: 5 });
    const z = base({ name: "Zen", currentStreak: 5 });
    expect(streakLeaderboardCompare(y, z, "current")).toBeLessThan(0);
    expect(streakLeaderboardCompare(z, y, "current")).toBeGreaterThan(0);
  });

  it("ranks never-slipped negative habits above any finite streak", () => {
    const never = base({
      name: "N",
      isNegative: true,
      negativeLastSlip: null,
      currentStreak: 0,
      longestStreak: null,
    });
    const long = base({ name: "L", currentStreak: 9999, longestStreak: 100 });
    expect(streakLeaderboardCompare(never, long, "current")).toBeLessThan(0);
    expect(streakLeaderboardCompare(long, never, "current")).toBeGreaterThan(0);
  });

  it("orders two never-slipped negative habits by name", () => {
    const a = base({
      name: "B",
      isNegative: true,
      negativeLastSlip: null,
      currentStreak: 0,
      longestStreak: null,
    });
    const b = base({
      name: "A",
      isNegative: true,
      negativeLastSlip: null,
      currentStreak: 0,
      longestStreak: null,
    });
    expect(streakLeaderboardCompare(a, b, "current")).toBeGreaterThan(0);
  });
});

describe("streakLeaderboardCompare (longest)", () => {
  it("orders by longest streak descending", () => {
    const a = base({ name: "A", longestStreak: 5 });
    const b = base({ name: "B", longestStreak: 12 });
    expect(streakLeaderboardCompare(a, b, "longest")).toBeGreaterThan(0);
    expect(streakLeaderboardCompare(b, a, "longest")).toBeLessThan(0);
  });

  it("ranks never-slipped negative habits above any finite longest streak", () => {
    const never = base({
      name: "N",
      isNegative: true,
      negativeLastSlip: null,
      currentStreak: 0,
      longestStreak: null,
    });
    const long = base({ name: "L", currentStreak: 1, longestStreak: 9999 });
    expect(streakLeaderboardCompare(never, long, "longest")).toBeLessThan(0);
    expect(streakLeaderboardCompare(long, never, "longest")).toBeGreaterThan(0);
  });

  it("ties break by name", () => {
    const y = base({ name: "Yoga", longestStreak: 7 });
    const z = base({ name: "Zen", longestStreak: 7 });
    expect(streakLeaderboardCompare(y, z, "longest")).toBeLessThan(0);
  });
});

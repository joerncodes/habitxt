#!/usr/bin/env node
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import * as fs from "fs";
import { realpathSync } from "fs";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import {
  findHabitFile,
  applyCompletion,
  removeCompletion,
  parseCompletions,
  completionMarkersOnly,
  filterCompletionsForStreak,
  calcCurrentStreak,
  calcLongestStreak,
  loadTodayHabits,
  isoLocal,
  CONFIG,
  resolveNumericalDoMarker,
  parseNumericalStep,
  markerLevel,
  type TodayEntry,
  type Symbols,
} from "./lib.js";

// ---------------------------------------------------------------------------
// App factory (testable)
// ---------------------------------------------------------------------------

function todayCompletion(e: TodayEntry, sym: Symbols): "done" | "partial" | "undone" {
  if (e.isNegative) return e.todayMarker === undefined ? "done" : "undone";
  if (e.isNumerical) {
    const level = markerLevel(e.todayMarker, e.thresholds, sym);
    return level === "full" ? "done" : level === "none" ? "undone" : "partial";
  }
  if (e.todayMarker === sym.done) return "done";
  if (e.todayMarker === sym.partial) return "partial";
  return "undone";
}

export function createApp(habitsDir: string, symbols: Symbols, apiKey: string) {
  const app = new Hono();

  // Auth middleware
  app.use("*", async (c, next) => {
    const auth = c.req.header("Authorization");
    if (!auth || auth !== `Bearer ${apiKey}`) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    return next();
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function readHabit(name: string) {
    const filePath = findHabitFile(name, habitsDir);
    if (!filePath) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = matter(raw);
    return { filePath, parsed };
  }

  // ---------------------------------------------------------------------------
  // GET /habits
  // ---------------------------------------------------------------------------

  app.get("/habits", (c) => {
    if (!fs.existsSync(habitsDir)) return c.json([]);
    const files = fs.readdirSync(habitsDir).filter((f) => f.endsWith(".md"));
    const habits = files.flatMap((f) => {
      const raw = fs.readFileSync(`${habitsDir}/${f}`, "utf8");
      const { data } = matter(raw);
      if (data.status === "archived" || data.status === "hidden") return [];
      return [{
        name: typeof data.name === "string" ? data.name : f.replace(/\.md$/, ""),
        icon: typeof data.icon === "string" ? data.icon : null,
        category: typeof data.category === "string" && data.category.trim() ? data.category.trim() : null,
        type: typeof data.type === "string" ? data.type : "boolean",
      }];
    });
    return c.json(habits);
  });

  // ---------------------------------------------------------------------------
  // GET /habits/:name
  // ---------------------------------------------------------------------------

  app.get("/habits/:name", (c) => {
    const result = readHabit(c.req.param("name"));
    if (!result) return c.json({ error: "Habit not found" }, 404);
    const { parsed } = result;
    const today = new Date();

    const completions = parseCompletions(parsed.content);
    const isNumerical = parsed.data.type === "numerical";
    const partial = typeof parsed.data.partial === "number" ? parsed.data.partial : null;
    const streakMap = isNumerical
      ? filterCompletionsForStreak(completions, partial)
      : completionMarkersOnly(completions);

    const completionsObj: Record<string, { marker: string; note?: string }> = {};
    for (const [date, entry] of completions) {
      completionsObj[date] = entry.note ? { marker: entry.marker, note: entry.note } : { marker: entry.marker };
    }

    return c.json({
      ...(parsed.data as Record<string, unknown>),
      completions: completionsObj,
      currentStreak: calcCurrentStreak(streakMap, today),
      longestStreak: calcLongestStreak(streakMap),
    });
  });

  // ---------------------------------------------------------------------------
  // POST /habits/:name/do
  // ---------------------------------------------------------------------------

  app.post("/habits/:name/do", async (c) => {
    const result = readHabit(c.req.param("name"));
    if (!result) return c.json({ error: "Habit not found" }, 404);
    const { filePath, parsed } = result;

    let body: { date?: string; marker?: string; note?: string } = {};
    try {
      body = await c.req.json();
    } catch {
      // empty body is fine — all fields optional
    }

    const date = body.date ?? isoLocal(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ error: "Invalid date format — use YYYY-MM-DD" }, 400);
    }

    const isNegative = parsed.data.type === "negative";
    const isNumerical = !isNegative && parsed.data.type === "numerical";

    let marker: string;
    if (body.marker !== undefined) {
      if (isNumerical) {
        const resolved = resolveNumericalDoMarker(parsed.content, date, body.marker);
        if (!resolved) return c.json({ error: "Invalid numerical marker value" }, 400);
        marker = resolved;
      } else {
        marker = body.marker;
      }
    } else if (isNumerical) {
      const step = parseNumericalStep(parsed.data);
      const markerDefault = resolveNumericalDoMarker(parsed.content, date, `+${step}`);
      if (!markerDefault) return c.json({ error: "Could not apply default numerical increment" }, 400);
      marker = markerDefault;
    } else {
      marker = symbols.done;
    }

    const applyResult = applyCompletion(parsed.content, date, marker, symbols, body.note);
    if (applyResult.type === "added" || applyResult.type === "upgraded") {
      fs.writeFileSync(filePath, matter.stringify(applyResult.content, parsed.data));
    }

    return c.json({ result: applyResult.type });
  });

  // ---------------------------------------------------------------------------
  // DELETE /habits/:name/do/:date
  // ---------------------------------------------------------------------------

  app.delete("/habits/:name/do/:date", (c) => {
    const result = readHabit(c.req.param("name"));
    if (!result) return c.json({ error: "Habit not found" }, 404);
    const { filePath, parsed } = result;

    const date = c.req.param("date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ error: "Invalid date format — use YYYY-MM-DD" }, 400);
    }

    const newContent = removeCompletion(parsed.content, date);
    fs.writeFileSync(filePath, matter.stringify(newContent, parsed.data));
    return new Response(null, { status: 204 });
  });

  // ---------------------------------------------------------------------------
  // GET /today
  // ---------------------------------------------------------------------------

  app.get("/today", (c) => {
    const todayStr = isoLocal(new Date());
    const entries = loadTodayHabits(habitsDir, todayStr);
    return c.json(entries.map((e) => ({
      name: e.name,
      icon: e.icon ?? null,
      category: e.category,
      type: e.isNumerical ? "numerical" : e.isNegative ? "negative" : "boolean",
      todayMarker: e.todayMarker ?? null,
      todayNote: e.todayNote ?? null,
      completion: todayCompletion(e, symbols),
      currentStreak: e.currentStreak,
      longestStreak: e.longestStreak,
    })));
  });

  return app;
}

// ---------------------------------------------------------------------------
// Start (only when run directly, not when imported by tests)
// ---------------------------------------------------------------------------

const _isMain = (() => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (_isMain) {
  const apiKey = process.env.HABITXT_API_KEY;
  if (!apiKey) {
    console.error("habitxt-server: HABITXT_API_KEY env var is required");
    process.exit(1);
  }

  const port = parseInt(process.env.HABITXT_PORT ?? "3000", 10);
  const app = createApp(CONFIG.habitsDir, CONFIG.symbols, apiKey);

  serve({ fetch: app.fetch, port }, () => {
    console.log(`habitxt-server listening on port ${port}`);
  });
}

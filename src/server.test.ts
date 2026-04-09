import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createApp } from "./server.js";

const TEST_KEY = "test-key";
const SYMBOLS = { done: "x", partial: "/" };

function auth() {
  return { Authorization: `Bearer ${TEST_KEY}` };
}

function writeHabit(
  dir: string,
  filename: string,
  frontmatter: Record<string, unknown>,
  completions: string[] = [],
) {
  const fmLines = ["---"];
  for (const [k, v] of Object.entries(frontmatter)) {
    fmLines.push(typeof v === "string" ? `${k}: ${v}` : `${k}: ${JSON.stringify(v)}`);
  }
  fmLines.push("---", "");
  const body = completions.map((c) => `- [${c}]`).join("\n");
  fs.writeFileSync(path.join(dir, filename), fmLines.join("\n") + (body ? body + "\n" : ""));
}

function writeHabitWithCompletions(
  dir: string,
  filename: string,
  frontmatter: Record<string, unknown>,
  lines: string[] = [],
) {
  const fmLines = ["---"];
  for (const [k, v] of Object.entries(frontmatter)) {
    fmLines.push(typeof v === "string" ? `${k}: ${v}` : `${k}: ${JSON.stringify(v)}`);
  }
  fmLines.push("---", "");
  fs.writeFileSync(path.join(dir, filename), fmLines.join("\n") + lines.join("\n") + (lines.length ? "\n" : ""));
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe("habitxt REST API", () => {
  let dir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "habitxt-server-"));
    app = createApp(dir, SYMBOLS, TEST_KEY);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true });
  });

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  describe("auth", () => {
    it("rejects requests without Authorization header", async () => {
      const res = await app.request("/habits");
      expect(res.status).toBe(401);
    });

    it("rejects requests with wrong API key", async () => {
      const res = await app.request("/habits", { headers: { Authorization: "Bearer wrong" } });
      expect(res.status).toBe(401);
    });

    it("accepts requests with correct API key", async () => {
      const res = await app.request("/habits", { headers: auth() });
      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /habits
  // ---------------------------------------------------------------------------

  describe("GET /habits", () => {
    it("returns empty array for empty directory", async () => {
      const res = await app.request("/habits", { headers: auth() });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("lists open habits", async () => {
      writeHabit(dir, "Meditate.md", { name: "Meditate", icon: "🧘", category: "Mind" });
      writeHabit(dir, "Run.md", { name: "Run", category: "Body" });
      const res = await app.request("/habits", { headers: auth() });
      const body = await res.json() as { name: string }[];
      expect(body.map((h) => h.name).sort()).toEqual(["Meditate", "Run"]);
    });

    it("excludes archived habits", async () => {
      writeHabit(dir, "Meditate.md", { name: "Meditate" });
      writeHabit(dir, "OldHabit.md", { name: "OldHabit", status: "archived" });
      const res = await app.request("/habits", { headers: auth() });
      const body = await res.json() as { name: string }[];
      expect(body.map((h) => h.name)).toEqual(["Meditate"]);
    });

    it("excludes hidden habits", async () => {
      writeHabit(dir, "Visible.md", { name: "Visible" });
      writeHabit(dir, "Hidden.md", { name: "Hidden", status: "hidden" });
      const res = await app.request("/habits", { headers: auth() });
      const body = await res.json() as { name: string }[];
      expect(body.map((h) => h.name)).toEqual(["Visible"]);
    });

    it("returns correct fields", async () => {
      writeHabit(dir, "Steps.md", { name: "Steps", icon: "👟", category: "Health", type: "numerical" });
      const res = await app.request("/habits", { headers: auth() });
      const body = await res.json() as unknown[];
      expect(body[0]).toMatchObject({ name: "Steps", icon: "👟", category: "Health", type: "numerical" });
    });
  });

  // ---------------------------------------------------------------------------
  // GET /habits/:name
  // ---------------------------------------------------------------------------

  describe("GET /habits/:name", () => {
    it("returns 404 for unknown habit", async () => {
      const res = await app.request("/habits/Unknown", { headers: auth() });
      expect(res.status).toBe(404);
    });

    it("returns habit detail with empty completions", async () => {
      writeHabit(dir, "Meditate.md", { name: "Meditate", description: "10 min" });
      const res = await app.request("/habits/Meditate", { headers: auth() });
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.name).toBe("Meditate");
      expect(body.description).toBe("10 min");
      expect(body.completions).toEqual({});
      expect(body.currentStreak).toBe(0);
      expect(body.longestStreak).toBe(0);
    });

    it("includes completions in response", async () => {
      writeHabitWithCompletions(dir, "Meditate.md", { name: "Meditate" }, [
        "- [x] 2026-04-08",
        "- [x] 2026-04-07 good session",
      ]);
      const res = await app.request("/habits/Meditate", { headers: auth() });
      const body = await res.json() as Record<string, unknown>;
      expect(body.completions).toMatchObject({
        "2026-04-08": { marker: "x" },
        "2026-04-07": { marker: "x", note: "good session" },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // POST /habits/:name/do
  // ---------------------------------------------------------------------------

  describe("POST /habits/:name/do", () => {
    it("returns 404 for unknown habit", async () => {
      const res = await app.request("/habits/Unknown/do", {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-08" }),
      });
      expect(res.status).toBe(404);
    });

    it("adds a completion and returns added", async () => {
      writeHabit(dir, "Meditate.md", { name: "Meditate" });
      const res = await app.request("/habits/Meditate/do", {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-08" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { result: string };
      expect(body.result).toBe("added");
      const content = fs.readFileSync(path.join(dir, "Meditate.md"), "utf8");
      expect(content).toContain("- [x] 2026-04-08");
    });

    it("returns already_done when completion exists", async () => {
      writeHabitWithCompletions(dir, "Meditate.md", { name: "Meditate" }, ["- [x] 2026-04-08"]);
      const res = await app.request("/habits/Meditate/do", {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-08" }),
      });
      const body = await res.json() as { result: string };
      expect(body.result).toBe("already_done");
    });

    it("upgrades partial to full", async () => {
      writeHabitWithCompletions(dir, "Meditate.md", { name: "Meditate" }, ["- [/] 2026-04-08"]);
      const res = await app.request("/habits/Meditate/do", {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-08" }),
      });
      const body = await res.json() as { result: string };
      expect(body.result).toBe("upgraded");
    });

    it("stores a note with the completion", async () => {
      writeHabit(dir, "Meditate.md", { name: "Meditate" });
      await app.request("/habits/Meditate/do", {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-08", note: "great focus" }),
      });
      const content = fs.readFileSync(path.join(dir, "Meditate.md"), "utf8");
      expect(content).toContain("- [x] 2026-04-08 great focus");
    });

    it("returns 400 for invalid date format", async () => {
      writeHabit(dir, "Meditate.md", { name: "Meditate" });
      const res = await app.request("/habits/Meditate/do", {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ date: "not-a-date" }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for numerical habit without marker", async () => {
      writeHabit(dir, "Steps.md", { name: "Steps", type: "numerical" });
      const res = await app.request("/habits/Steps/do", {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-08" }),
      });
      expect(res.status).toBe(400);
    });

    it("records numerical habit with marker value", async () => {
      writeHabit(dir, "Steps.md", { name: "Steps", type: "numerical" });
      const res = await app.request("/habits/Steps/do", {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-08", marker: "8000" }),
      });
      expect(res.status).toBe(200);
      const content = fs.readFileSync(path.join(dir, "Steps.md"), "utf8");
      expect(content).toContain("- [8000] 2026-04-08");
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /habits/:name/do/:date
  // ---------------------------------------------------------------------------

  describe("DELETE /habits/:name/do/:date", () => {
    it("returns 404 for unknown habit", async () => {
      const res = await app.request("/habits/Unknown/do/2026-04-08", {
        method: "DELETE",
        headers: auth(),
      });
      expect(res.status).toBe(404);
    });

    it("removes a completion and returns 204", async () => {
      writeHabitWithCompletions(dir, "Meditate.md", { name: "Meditate" }, ["- [x] 2026-04-08"]);
      const res = await app.request("/habits/Meditate/do/2026-04-08", {
        method: "DELETE",
        headers: auth(),
      });
      expect(res.status).toBe(204);
      const content = fs.readFileSync(path.join(dir, "Meditate.md"), "utf8");
      expect(content).not.toContain("2026-04-08");
    });

    it("returns 400 for invalid date", async () => {
      writeHabit(dir, "Meditate.md", { name: "Meditate" });
      const res = await app.request("/habits/Meditate/do/baddate", {
        method: "DELETE",
        headers: auth(),
      });
      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /today
  // ---------------------------------------------------------------------------

  describe("GET /today", () => {
    it("returns empty array with no habits", async () => {
      const res = await app.request("/today", { headers: auth() });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("returns today's habit status", async () => {
      writeHabit(dir, "Meditate.md", { name: "Meditate", category: "Mind" });
      const res = await app.request("/today", { headers: auth() });
      const body = await res.json() as { name: string; todayMarker: string | null }[];
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("Meditate");
      expect(body[0].todayMarker).toBeNull();
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { resolveHabitsDir } from "./config.js";

function writeToml(dir: string, filename: string, content: string) {
  fs.writeFileSync(path.join(dir, filename), content);
}

describe("resolveHabitsDir", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "habitxt-cfg-"));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
  });

  it("falls back to <cwd>/habits when nothing is configured", () => {
    expect(resolveHabitsDir(undefined, tmp, tmp)).toBe(path.join(tmp, "habits"));
  });

  it("env var takes highest priority over all config files", () => {
    const envPath = path.join(tmp, "env-habits");
    writeToml(tmp, "habitxt.toml", `habitsDir = "local-habits"\n`);
    expect(resolveHabitsDir(envPath, tmp, tmp)).toBe(path.resolve(envPath));
  });

  it("env var path is resolved to an absolute path", () => {
    expect(resolveHabitsDir("relative/path", tmp, tmp)).toBe(
      path.resolve("relative/path")
    );
  });

  it("local habitxt.toml is used when env var is absent", () => {
    writeToml(tmp, "habitxt.toml", `habitsDir = "/absolute/habits"\n`);
    expect(resolveHabitsDir(undefined, tmp, tmp)).toBe("/absolute/habits");
  });

  it("local config habitsDir is resolved relative to cwd", () => {
    writeToml(tmp, "habitxt.toml", `habitsDir = "my-habits"\n`);
    expect(resolveHabitsDir(undefined, tmp, tmp)).toBe(path.join(tmp, "my-habits"));
  });

  it("global ~/.habitxt.toml is used when no env var and no local config", () => {
    writeToml(tmp, ".habitxt.toml", `habitsDir = "/global/habits"\n`);
    expect(resolveHabitsDir(undefined, tmp, tmp)).toBe("/global/habits");
  });

  it("local config takes priority over global ~/.habitxt.toml", () => {
    writeToml(tmp, "habitxt.toml", `habitsDir = "/local/habits"\n`);
    writeToml(tmp, ".habitxt.toml", `habitsDir = "/global/habits"\n`);
    expect(resolveHabitsDir(undefined, tmp, tmp)).toBe("/local/habits");
  });

  it("falls back to default when local config has no habitsDir key", () => {
    writeToml(tmp, "habitxt.toml", `# no habitsDir here\n`);
    expect(resolveHabitsDir(undefined, tmp, tmp)).toBe(path.join(tmp, "habits"));
  });

  it("falls back to default when global config has no habitsDir key", () => {
    writeToml(tmp, ".habitxt.toml", `# no habitsDir here\n`);
    expect(resolveHabitsDir(undefined, tmp, tmp)).toBe(path.join(tmp, "habits"));
  });
});

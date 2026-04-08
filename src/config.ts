import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { parse } from "smol-toml";

export interface Symbols {
  done: string;
  partial: string;
}

/** First column of `habitxt year` calendar rows. */
export type WeekStart = "sun" | "mon";

export interface ResolvedConfig {
  habitsDir: string;
  symbols: Symbols;
  weekStart: WeekStart;
}

interface HabitxtConfig {
  habitsDir?: string;
  doneSymbol?: string;
  partialSymbol?: string;
  weekStart?: string;
}

function readToml(filePath: string): HabitxtConfig {
  try {
    return parse(fs.readFileSync(filePath, "utf8")) as HabitxtConfig;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`habitxt: error reading config ${filePath}: ${msg}`);
    process.exit(1);
  }
}

function parseWeekStart(raw: unknown, filePath: string): WeekStart {
  const s = String(raw).trim().toLowerCase();
  if (s === "sun" || s === "sunday") return "sun";
  if (s === "mon" || s === "monday") return "mon";
  console.error(`habitxt: invalid weekStart in ${filePath}: use "sun" or "mon"`);
  process.exit(1);
}

/**
 * Resolve config using the following priority order:
 *   1. HABITXT_DIR env var (for habitsDir only)
 *   2. ./habitxt.toml  (project-local)
 *   3. ~/.habitxt.toml  (user-global)
 *   4. defaults
 *
 * Parameters are injectable for testing.
 */
export function resolveConfig(
  envDir: string | undefined = process.env.HABITXT_DIR,
  cwd: string = process.cwd(),
  home: string = os.homedir(),
): ResolvedConfig {
  let habitsDir: string | undefined;
  let fileSymbols: Partial<Symbols> = {};
  let weekStart: WeekStart | undefined;

  const localConfig = path.join(cwd, "habitxt.toml");
  if (fs.existsSync(localConfig)) {
    const cfg = readToml(localConfig);
    if (cfg.habitsDir) habitsDir = path.resolve(cwd, cfg.habitsDir);
    if (cfg.doneSymbol)    fileSymbols.done    = cfg.doneSymbol;
    if (cfg.partialSymbol) fileSymbols.partial = cfg.partialSymbol;
    if (cfg.weekStart !== undefined) weekStart = parseWeekStart(cfg.weekStart, localConfig);
  }

  if (!habitsDir || !fileSymbols.done || !fileSymbols.partial || weekStart === undefined) {
    const globalConfig = path.join(home, ".habitxt.toml");
    if (fs.existsSync(globalConfig)) {
      const cfg = readToml(globalConfig);
      if (!habitsDir && cfg.habitsDir) habitsDir = path.resolve(cfg.habitsDir);
      if (!fileSymbols.done    && cfg.doneSymbol)    fileSymbols.done    = cfg.doneSymbol;
      if (!fileSymbols.partial && cfg.partialSymbol) fileSymbols.partial = cfg.partialSymbol;
      if (weekStart === undefined && cfg.weekStart !== undefined) {
        weekStart = parseWeekStart(cfg.weekStart, globalConfig);
      }
    }
  }

  if (envDir) habitsDir = path.resolve(envDir);

  return {
    habitsDir: habitsDir ?? path.resolve(cwd, "habits"),
    symbols: {
      done:    fileSymbols.done    ?? "x",
      partial: fileSymbols.partial ?? "/",
    },
    weekStart: weekStart ?? "sun",
  };
}

/** @deprecated Use resolveConfig().habitsDir instead. */
export function resolveHabitsDir(
  envDir: string | undefined = process.env.HABITXT_DIR,
  cwd: string = process.cwd(),
  home: string = os.homedir(),
): string {
  return resolveConfig(envDir, cwd, home).habitsDir;
}

export const CONFIG: ResolvedConfig = resolveConfig();
export const HABITS_DIR = CONFIG.habitsDir;

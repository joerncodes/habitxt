import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { parse } from "smol-toml";

export interface Symbols {
  done: string;
  partial: string;
}

export interface ResolvedConfig {
  habitsDir: string;
  symbols: Symbols;
}

interface HabitxtConfig {
  habitsDir?: string;
  doneSymbol?: string;
  partialSymbol?: string;
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

  const localConfig = path.join(cwd, "habitxt.toml");
  if (fs.existsSync(localConfig)) {
    const cfg = readToml(localConfig);
    if (cfg.habitsDir) habitsDir = path.resolve(cwd, cfg.habitsDir);
    if (cfg.doneSymbol)    fileSymbols.done    = cfg.doneSymbol;
    if (cfg.partialSymbol) fileSymbols.partial = cfg.partialSymbol;
  }

  if (!habitsDir || !fileSymbols.done || !fileSymbols.partial) {
    const globalConfig = path.join(home, ".habitxt.toml");
    if (fs.existsSync(globalConfig)) {
      const cfg = readToml(globalConfig);
      if (!habitsDir && cfg.habitsDir) habitsDir = path.resolve(cfg.habitsDir);
      if (!fileSymbols.done    && cfg.doneSymbol)    fileSymbols.done    = cfg.doneSymbol;
      if (!fileSymbols.partial && cfg.partialSymbol) fileSymbols.partial = cfg.partialSymbol;
    }
  }

  if (envDir) habitsDir = path.resolve(envDir);

  return {
    habitsDir: habitsDir ?? path.resolve(cwd, "habits"),
    symbols: {
      done:    fileSymbols.done    ?? "x",
      partial: fileSymbols.partial ?? "/",
    },
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

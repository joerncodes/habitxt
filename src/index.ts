#!/usr/bin/env node
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";
import { doCommand } from "./commands/do.js";
import { showCommand } from "./commands/show.js";
import { monthCommand } from "./commands/month.js";
import { createCommand } from "./commands/create.js";
import { completionsCommand } from "./commands/completions.js";
import { listCommand } from "./commands/list.js";
import { archiveCommand } from "./commands/archive.js";
import { hideCommand } from "./commands/hide.js";
import { editCommand } from "./commands/edit.js";
import { dayCommand } from "./commands/day.js";
import { failCommand } from "./commands/fail.js";
import { streakCommand } from "./commands/streak.js";
import { yearCommand } from "./commands/year.js";

const program = new Command();
const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const { version } = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
program.name("habitxt").description("Text-based habit tracker").version(version);

doCommand(program);
showCommand(program);
monthCommand(program);
createCommand(program);
completionsCommand(program);
listCommand(program);
archiveCommand(program);
hideCommand(program);
editCommand(program);
dayCommand(program);
failCommand(program);
streakCommand(program);
yearCommand(program);

/** Bare `habitxt YYYY-MM-DD` → `habitxt day YYYY-MM-DD` (Commander has no dynamic command names). */
const ISO_DATE_ARG = /^\d{4}-\d{2}-\d{2}$/;
const HABITXT_SUBCOMMANDS = new Set([
  "do",
  "show",
  "month",
  "create",
  "completions",
  "_list",
  "archive",
  "hide",
  "unhide",
  "edit",
  "day",
  "today",
  "yesterday",
  "fail",
  "streak",
  "year",
]);
const argv = process.argv;
if (
  argv.length >= 3 &&
  argv[2] !== undefined &&
  !argv[2].startsWith("-") &&
  ISO_DATE_ARG.test(argv[2]) &&
  !HABITXT_SUBCOMMANDS.has(argv[2])
) {
  argv.splice(2, 0, "day");
}

program.parse(argv);

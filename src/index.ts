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
import { todayCommand } from "./commands/today.js";
import { streakCommand } from "./commands/streak.js";

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
todayCommand(program);
streakCommand(program);

program.parse();

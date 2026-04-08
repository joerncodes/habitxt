#!/usr/bin/env node
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

const program = new Command();
program.name("habitxt").description("Text-based habit tracker").version("1.1.3");

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

program.parse();

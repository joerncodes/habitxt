import { Command } from "commander";
import * as fs from "fs";
import matter from "gray-matter";
import { findHabitFile } from "../lib.js";

export function hideCommand(program: Command) {
  program
    .command("hide <habit>")
    .description("Hide a habit from month and today views (still completable via `do`)")
    .action((habit: string) => {
      const filePath = findHabitFile(habit);
      if (!filePath) {
        console.error(`Habit not found: "${habit}"`);
        process.exit(1);
      }

      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = matter(raw);

      if (parsed.data.status === "hidden") {
        console.log(`"${habit}" is already hidden.`);
        return;
      }

      parsed.data.status = "hidden";
      fs.writeFileSync(filePath, matter.stringify(parsed.content, parsed.data));
      console.log(`"${habit}" hidden.`);
    });

  program
    .command("unhide <habit>")
    .description("Show a hidden habit in month and today views again")
    .action((habit: string) => {
      const filePath = findHabitFile(habit);
      if (!filePath) {
        console.error(`Habit not found: "${habit}"`);
        process.exit(1);
      }

      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = matter(raw);

      if (parsed.data.status !== "hidden") {
        console.log(`"${habit}" is not hidden.`);
        return;
      }

      delete parsed.data.status;
      fs.writeFileSync(filePath, matter.stringify(parsed.content, parsed.data));
      console.log(`"${habit}" is visible in month and today again.`);
    });
}

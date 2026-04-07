import { Command } from "commander";
import * as fs from "fs";
import matter from "gray-matter";
import { findHabitFile } from "../lib.js";

export function archiveCommand(program: Command) {
  program
    .command("archive <habit>")
    .description("Archive a habit so it no longer appears in the month view")
    .action((habit: string) => {
      const filePath = findHabitFile(habit);
      if (!filePath) {
        console.error(`Habit not found: "${habit}"`);
        process.exit(1);
      }

      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = matter(raw);

      if (parsed.data.status === "archived") {
        console.log(`"${habit}" is already archived.`);
        return;
      }

      parsed.data.status = "archived";
      fs.writeFileSync(filePath, matter.stringify(parsed.content, parsed.data));
      console.log(`"${habit}" archived.`);
    });
}

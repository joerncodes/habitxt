import { Command } from "commander";
import { spawnSync } from "child_process";
import { findHabitFile } from "../lib.js";

export function editCommand(program: Command) {
  program
    .command("edit <habit>")
    .description("Open a habit file in $EDITOR")
    .action((habit: string) => {
      const filePath = findHabitFile(habit);
      if (!filePath) {
        console.error(`Habit not found: "${habit}"`);
        process.exit(1);
      }

      const editor = process.env.EDITOR || process.env.VISUAL || "vi";
      const result = spawnSync(editor, [filePath], { stdio: "inherit" });
      if (result.error) {
        console.error(`Failed to open editor "${editor}": ${result.error.message}`);
        process.exit(1);
      }
    });
}

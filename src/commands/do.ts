import { Command } from "commander";
import * as fs from "fs";
import matter from "gray-matter";
import { findHabitFile, applyCompletion, CONFIG } from "../lib.js";

export function doCommand(program: Command) {
  program
    .command("do <habit> [valueOrDate] [date]")
    .description("Mark a habit as done for today or a specific date (YYYY-MM-DD)")
    .option("-p, --partial", "Mark as partially completed (boolean habits only)")
    .action((habit: string, valueOrDate?: string, date?: string, opts?: { partial?: boolean }) => {
      const filePath = findHabitFile(habit);
      if (!filePath) {
        console.error(`Habit not found: "${habit}"`);
        process.exit(1);
      }

      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = matter(raw);
      const isNegative = parsed.data.type === "negative";
      const isNumerical = !isNegative && parsed.data.type === "numerical";

      let marker: string;
      let targetDate: string;

      if (isNumerical) {
        if (!valueOrDate || !/^\d+$/.test(valueOrDate)) {
          console.error(`Numerical habit requires a value: habitxt do ${habit} <value> [date]`);
          process.exit(1);
        }
        marker = valueOrDate;
        targetDate = date ?? new Date().toISOString().slice(0, 10);
      } else {
        // valueOrDate is actually the date for boolean habits
        targetDate = valueOrDate ?? new Date().toISOString().slice(0, 10);
        marker = opts?.partial ? CONFIG.symbols.partial : CONFIG.symbols.done;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        console.error(`Invalid date format: "${targetDate}". Use YYYY-MM-DD.`);
        process.exit(1);
      }

      const wasArchived = parsed.data.status === "archived";
      if (wasArchived) {
        delete parsed.data.status;
        console.log(`ℹ "${habit}" was archived — unarchiving.`);
      }

      const result = applyCompletion(parsed.content, targetDate, marker);

      switch (result.type) {
        case "added":
          fs.writeFileSync(filePath, matter.stringify(result.content, parsed.data));
          console.log(
            isNegative
              ? `✓ "${habit}" — slip recorded on ${targetDate}.`
              : isNumerical
                ? `✓ "${habit}" recorded ${marker} on ${targetDate}.`
                : `✓ "${habit}" marked as ${opts?.partial ? "partially done" : "done"} on ${targetDate}.`,
          );
          break;
        case "upgraded":
          fs.writeFileSync(filePath, matter.stringify(result.content, parsed.data));
          console.log(
            isNegative
              ? `✓ "${habit}" — slip updated on ${targetDate}.`
              : isNumerical
                ? `✓ "${habit}" updated to ${marker} on ${targetDate}.`
                : `✓ "${habit}" upgraded from partial to done on ${targetDate}.`,
          );
          break;
        case "already_done":
          if (wasArchived) fs.writeFileSync(filePath, matter.stringify(parsed.content, parsed.data));
          console.log(
            isNegative
              ? `"${habit}" already slipped on ${targetDate}.`
              : isNumerical
                ? `"${habit}" already recorded ${marker} on ${targetDate}.`
                : `"${habit}" already ${result.marker === CONFIG.symbols.done ? "completed" : "partially completed"} on ${targetDate}.`,
          );
          break;
        case "downgrade_ignored":
          if (wasArchived) fs.writeFileSync(filePath, matter.stringify(parsed.content, parsed.data));
          console.log(
            isNegative
              ? `"${habit}" already logged this slip on ${targetDate}.`
              : `"${habit}" already fully completed on ${targetDate}.`,
          );
          break;
      }
    });
}

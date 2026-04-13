import { Command } from "commander";
import * as fs from "fs";
import matter from "gray-matter";
import {
  findHabitFile,
  CONFIG,
  isoLocal,
  applyPrefailForToday,
} from "../lib.js";

export function failCommand(program: Command) {
  program
    .command("fail <habit>")
    .description(
      "Mark today as failed early: boolean/numerical — clear today’s entry; negative — log today’s slip. Sets `prefailed` so `habitxt today` shows a red [f] and a dimmed row until local midnight.",
    )
    .action((habit: string) => {
      const filePath = findHabitFile(habit);
      if (!filePath) {
        console.error(`Habit not found: "${habit}"`);
        process.exit(1);
      }

      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = matter(raw);
      const isNegative = parsed.data.type === "negative";
      const todayStr = isoLocal(new Date());
      const { body, frontmatter } = applyPrefailForToday(
        parsed.content,
        parsed.data as Record<string, unknown>,
        todayStr,
        isNegative,
        CONFIG.symbols,
      );

      fs.writeFileSync(filePath, matter.stringify(body, frontmatter));
      console.log(
        isNegative
          ? `✓ "${habit}" — slip recorded; \`today\` shows [f] (dim) until tomorrow.`
          : `✓ "${habit}" — failed for today; \`today\` shows [f] (dim) until tomorrow.`,
      );
    });
}

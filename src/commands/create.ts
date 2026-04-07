import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import chalk from "chalk";
import { input, search, select } from "@inquirer/prompts";
import { HABITS_DIR } from "../lib.js";

function loadExistingCategories(habitsDir: string): string[] {
  const files = fs.readdirSync(habitsDir).filter((f) => f.endsWith(".md"));
  const cats = new Set<string>();
  for (const file of files) {
    const raw = fs.readFileSync(path.join(habitsDir, file), "utf8");
    const category = matter(raw).data.category as string | undefined;
    if (category) cats.add(category);
  }
  return [...cats].sort();
}

export function createCommand(program: Command) {
  program
    .command("create <name>")
    .description("Create a new habit file interactively")
    .action(async (name: string) => {
      const filePath = path.join(HABITS_DIR, `${name}.md`);

      if (fs.existsSync(filePath)) {
        console.error(`Habit already exists: ${filePath}`);
        process.exit(1);
      }

      const icon = await input({ message: "Icon (emoji, or leave blank):" });
      const description = await input({ message: "Description:" });

      const habitType = await select<"boolean" | "numerical" | "negative">({
        message: "Type:",
        choices: [
          {
            name: `${chalk.bold("boolean")}  mark days you did the habit; streaks count consecutive completed days`,
            value: "boolean",
          },
          {
            name: `${chalk.bold("numerical")}  log a number each day (e.g. steps); colors use partial/full thresholds`,
            value: "numerical",
          },
          {
            name: `${chalk.bold("negative")}  habit to avoid; log slips, streak is consecutive clean days since the last slip`,
            value: "negative",
          },
        ],
        default: "boolean",
      });

      const existingCategories = loadExistingCategories(HABITS_DIR);
      const category = await search<string>({
        message: "Category (leave blank for none):",
        source: (term) => {
          const options = existingCategories
            .filter((c) => !term || c.toLowerCase().includes(term.toLowerCase()))
            .map((c) => ({ name: c, value: c }));
          // If the typed term is new, offer it as a create option
          const isNew = term && !existingCategories.some((c) => c.toLowerCase() === term.toLowerCase());
          if (isNew) options.unshift({ name: `Create "${term}"`, value: term });
          options.push({ name: "(none)", value: "" });
          return options;
        },
      });

      const aliasesRaw = await input({
        message: "Aliases (comma-separated, or leave blank):",
      });
      const aliases = aliasesRaw
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      // Build frontmatter
      const data: Record<string, unknown> = { name };
      if (icon) data.icon = icon;
      if (description) data.description = description;
      if (category) data.category = category;
      if (aliases.length > 0) data.aliases = aliases;

      if (habitType === "negative") {
        data.type = "negative";
      } else if (habitType === "numerical") {
        const partialStr = await input({ message: "Partial threshold (number):" });
        const fullStr = await input({ message: "Full threshold (number):" });
        const partial = Number(partialStr);
        const full = Number(fullStr);
        if (!Number.isFinite(partial) || !Number.isInteger(partial)) {
          console.error("Partial threshold must be an integer.");
          process.exit(1);
        }
        if (!Number.isFinite(full) || !Number.isInteger(full)) {
          console.error("Full threshold must be an integer.");
          process.exit(1);
        }
        data.type = "numerical";
        data.partial = partial;
        data.full = full;
      }

      fs.mkdirSync(HABITS_DIR, { recursive: true });
      fs.writeFileSync(filePath, matter.stringify("", data));
      console.log(`\nCreated ${filePath}`);
    });
}

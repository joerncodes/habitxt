import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { input, search } from "@inquirer/prompts";
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

      fs.mkdirSync(HABITS_DIR, { recursive: true });
      fs.writeFileSync(filePath, matter.stringify("", data));
      console.log(`\nCreated ${filePath}`);
    });
}

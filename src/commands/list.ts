import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { HABITS_DIR } from "../lib.js";

export function listCommand(program: Command) {
  // Hidden command used by shell completion to enumerate habit names + aliases
  program
    .command("_list", { hidden: true })
    .description("Print all habit names and aliases, one per line")
    .action(() => {
      if (!fs.existsSync(HABITS_DIR)) return;
      const files = fs.readdirSync(HABITS_DIR).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        const raw = fs.readFileSync(path.join(HABITS_DIR, file), "utf8");
        const data = matter(raw).data;
        const name = (data.name as string | undefined) ?? path.basename(file, ".md");
        console.log(name);
        const aliases: string[] = data.aliases ?? [];
        for (const alias of aliases) console.log(alias);
      }
    });
}

#!/usr/bin/env node
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsx = resolve(__dirname, "node_modules/.bin/tsx");
const entry = resolve(__dirname, "src/server.ts");

const child = spawn(tsx, [entry, ...process.argv.slice(2)], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync, traverse } from "@babel/core";

// Check parsed regex literals, not strings or comments containing feature probes.
function hasLookbehind(pattern: string): boolean {
  let inCharacterClass = false;
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index];
    if (character === "\\") {
      index++;
    } else if (character === "[") {
      inCharacterClass = true;
    } else if (character === "]") {
      inCharacterClass = false;
    } else if (!inCharacterClass && (pattern.startsWith("(?<=", index) || pattern.startsWith("(?<!", index))) {
      return true;
    }
  }
  return false;
}

export function findIncompatibleSyntax(source: string, filename = "bundle.js"): string[] {
  let ast;
  try {
    ast = parseSync(source, { filename, configFile: false, babelrc: false, sourceType: "unambiguous" });
  } catch (error) {
    throw new Error(`Cannot parse ${filename}: ${error instanceof Error ? error.message : error}`);
  }
  if (!ast) throw new Error(`Cannot parse ${filename}`);

  const failures: string[] = [];
  const report = (node: { loc?: { start: { line: number; column: number } } | null }, reason: string) => {
    failures.push(`${filename}:${node.loc?.start.line ?? 1}:${(node.loc?.start.column ?? 0) + 1}: ${reason}`);
  };
  traverse(ast, {
    RegExpLiteral({ node }) {
      if (hasLookbehind(node.pattern)) report(node, "lookbehind regex literal");
      if (/[dv]/.test(node.flags)) report(node, "regex flags unavailable on iOS 15.0");
    },
    StaticBlock({ node }) {
      report(node, "class static block");
    },
  });
  return failures;
}

export function checkBundle(directory: string): number {
  const files: string[] = [];
  const collect = (folder: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const filename = join(folder, entry.name);
      if (entry.isDirectory()) collect(filename);
      else if (entry.isFile() && /\.m?js$/.test(entry.name)) files.push(filename);
    }
  };
  collect(directory);
  if (files.length === 0) throw new Error(`No JavaScript assets found in ${directory}`);

  const failures = files.sort().flatMap((filename) => findIncompatibleSyntax(readFileSync(filename, "utf8"), filename));
  if (failures.length > 0) throw new Error(failures.join("\n"));
  return files.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const directory = process.argv[2] ?? fileURLToPath(new URL("../../server/frontend/dist/assets", import.meta.url));
    console.log(`Checked ${checkBundle(directory)} JavaScript assets for iOS 15 syntax regressions.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

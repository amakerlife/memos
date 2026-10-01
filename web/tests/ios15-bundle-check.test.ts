// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkBundle, findIncompatibleSyntax } from "../scripts/check-ios15";

const directories: string[] = [];
const createDirectory = () => {
  const directory = mkdtempSync(join(tmpdir(), "memos-ios15-check-"));
  directories.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("iOS 15 bundle check", () => {
  it.each([
    "export default /(?<=a)b/;",
    "const re = /(?<!a)b/;",
    "const re = /a/d;",
    "const re = /a/v;",
    "class A { static {} }",
  ])("rejects unsupported syntax: %s", (source) => expect(findIncompatibleSyntax(source)).not.toHaveLength(0));

  it("ignores strings, comments, escaped text and character classes", () => {
    expect(
      findIncompatibleSyntax(
        [
          "// /(?<=a)b/",
          'const probe = "prefix(?<=a)b";',
          "const template = `(?<!a)b`;",
          'try { new RegExp(probe).test("ab"); } catch {}',
          String.raw`const escaped = /\(\?<=a\)/;`,
          "const characters = /[(?<=]/;",
          "const supported = /(?<name>a)(?=b)/u;",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("checks regex literals inside template substitutions", () => {
    expect(findIncompatibleSyntax("const value = `result: ${/(?<=a)b/.test('ab')}`;")[0]).toContain("lookbehind regex literal");
  });

  it("fails on missing, empty or malformed JavaScript assets", () => {
    const directory = createDirectory();
    expect(() => checkBundle(join(directory, "missing"))).toThrow();
    expect(() => checkBundle(directory)).toThrow("No JavaScript assets");
    writeFileSync(join(directory, "broken.js"), "const = ;");
    expect(() => checkBundle(directory)).toThrow("Cannot parse");
  });

  it("checks lazy chunks in nested directories", () => {
    const directory = createDirectory();
    const lazy = join(directory, "lazy");
    mkdirSync(lazy);
    writeFileSync(join(directory, "index.js"), "export const ready = true;");
    writeFileSync(join(lazy, "markdown.js"), "export default /(?<=a)b/;");
    expect(() => checkBundle(directory)).toThrow("markdown.js:1:16: lookbehind regex literal");
    writeFileSync(join(lazy, "markdown.js"), "export default /ab/;");
    expect(checkBundle(directory)).toBe(2);
  });
});

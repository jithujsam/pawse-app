import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

/**
 * Screens show their words through the copy catalogue (src/text), so each one has a stable id and one place to change.
 * This test parses the screen sources and fails if visible words are written straight into the markup, into a
 * label-like prop, or into a toast, instead. Lists of choices (habits, situations, currencies...) and generated lines
 * stay in code and are listed in the catalogue's "lists" and "generated" groups (src/text/dynamic.ts).
 */
const ROOT = join(__dirname, "..", "src");
const FILES = [
  ...readdirSync(join(ROOT, "screens")).filter((f) => f.endsWith(".tsx") && f !== "Simulator.tsx").map((f) => join(ROOT, "screens", f)),
  ...readdirSync(join(ROOT, "ui")).filter((f) => f.endsWith(".tsx")).map((f) => join(ROOT, "ui", f)),
  join(ROOT, "App.tsx"), join(ROOT, "Companion.tsx"), join(ROOT, "Pet3D.tsx"),
];

/** Props that carry words a person reads or hears. */
const TEXT_PROPS = new Set(["placeholder", "aria-label", "title", "alt", "hint", "otherPlaceholder", "clearLabel", "commitLabel", "otherLabel", "label", "name"]);
const hasWords = (s: string) => /[A-Za-z]{2,}/.test(s);
/** Not words: the unlit symbols and keys that sit in the markup. */
const SYMBOL_ONLY = /^[^A-Za-z]*$/;

function hardCoded(file: string): string[] {
  const src = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n)) { const text = n.getText().replace(/\s+/g, " ").trim(); if (text && hasWords(text) && !SYMBOL_ONLY.test(text)) found.push(text); }
    if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer) && TEXT_PROPS.has(n.name.getText()) && hasWords(n.initializer.text) && n.name.getText() !== "name") found.push(`${n.name.getText()}="${n.initializer.text}"`);
    if (ts.isCallExpression(n) && /^(toast|window\.confirm|confirm|alert)$/.test(n.expression.getText())) {
      const a = n.arguments[0];
      if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a) || ts.isTemplateExpression(a)) && hasWords(a.getText())) found.push(`${n.expression.getText()}(${a.getText()})`);
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return found;
}

describe("screens use the copy catalogue", () => {
  for (const file of FILES) {
    it(`${file.slice(ROOT.length + 1)} has no hard-coded visible text`, () => {
      expect(hardCoded(file), "Move this text into src/text/sections and show it with t()").toEqual([]);
    });
  }
});

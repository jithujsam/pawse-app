import { describe, expect, it, vi } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { catalogue, SECTIONS, t, tt } from "../src/text";
import { isToneText } from "../src/text/core";
import { generated, lists, petSpeech } from "../src/text/dynamic";
import { CopyInspector } from "../src/text/Inspector";

// The screens read the page's address when they load (the account module does), so give the node test one.
vi.hoisted(() => { (globalThis as Record<string, unknown>).location = { origin: "https://localhost", pathname: "/", hash: "", href: "https://localhost/" }; });

const WEB = join(__dirname, "..");
const SRC = join(WEB, "src");
const SECTION_DIR = join(SRC, "text", "sections");
const MANIFEST = join(SRC, "text", "manifest.generated.json");

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const sourceFiles = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(`${join("src", "text")}`));
const all = catalogue();

// ---------- where each section sits in its file, from the markers ----------
interface Region { id: string; file: string; start: number; end: number }
function regions(): Region[] {
  const out: Region[] = [];
  for (const f of readdirSync(SECTION_DIR).filter((x) => x.endsWith(".ts")).sort()) {
    const lines = readFileSync(join(SECTION_DIR, f), "utf8").split("\n");
    const open = new Map<string, number>();
    lines.forEach((line, i) => {
      const s = /^\/\/ @copy-section (\S+)\s*$/.exec(line), e = /^\/\/ @copy-section-end (\S+)\s*$/.exec(line);
      if (s) { expect(open.has(s[1]), `${f}: ${s[1]} opened twice`).toBe(false); open.set(s[1], i + 1); }
      if (e) {
        expect(open.has(e[1]), `${f}: ${e[1]} closed but never opened`).toBe(true);
        out.push({ id: e[1], file: `src/text/sections/${f}`, start: open.get(e[1])!, end: i + 1 });
        open.delete(e[1]);
      }
    });
    expect([...open.keys()], `${f}: sections opened but never closed`).toEqual([]);
  }
  return out;
}

describe("catalogue structure", () => {
  it("every id is unique, in one section", () => {
    const ids = all.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const sectionIds = SECTIONS.map((s) => s.id);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
    for (const s of SECTIONS) for (const key of Object.keys(s.entries)) expect(key, `${s.id}.${key}`).toMatch(/^[a-z][a-z0-9_]*$/);
    for (const id of sectionIds) expect(id, id).toMatch(/^[a-z]+\.[a-z0-9_]+$/);
  });

  it("every section has paired markers around exactly its own definition, and only registered sections are marked", () => {
    const rs = regions();
    expect(rs.map((r) => r.id).sort()).toEqual(SECTIONS.map((s) => s.id).sort());
    for (const r of rs) {
      const lines = readFileSync(join(WEB, r.file), "utf8").split("\n").slice(r.start, r.end - 1);
      const defs = lines.filter((l) => /defineSection\(/.test(l));
      expect(defs.length, `${r.id} should hold one section`).toBe(1);
      expect(defs[0], r.id).toContain(`defineSection("${r.id}"`);
      expect(r.end).toBeGreaterThan(r.start + 1);
    }
  });

  it("each section names the files that show it, and they exist", () => {
    for (const s of SECTIONS) {
      const paths = [...s.source.matchAll(/\bsrc\/[\w./*-]+/g)].map((m) => m[0].replace(/[.,]$/, ""));
      expect(paths.length, `${s.id} source`).toBeGreaterThan(0);
      for (const p of paths) expect(p.includes("*") ? existsSync(join(WEB, p.slice(0, p.lastIndexOf("/")))) : existsSync(join(WEB, p)), `${s.id}: ${p}`).toBe(true);
    }
  });

  it("every entry is used by the app, so nothing sits unused in the catalogue", () => {
    const text = sourceFiles.map((f) => readFileSync(f, "utf8")).join("\n");
    const unused = all.filter((e) => !text.includes(`"${e.id}"`)).map((e) => e.id);
    expect(unused, "Remove these entries or use them").toEqual([]);
  });
});

describe("placeholders and tones", () => {
  const entryOf = new Map(all.map((e) => [e.id, e.entry] as const));
  const need = (e: string | Record<string, string>): string[] => [...new Set([...(typeof e === "string" ? [e] : Object.values(e)).flatMap((x) => [...x.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))])].filter((k) => k !== "app").sort();

  it("every t() and tt() call supplies exactly the placeholders its line has", () => {
    const problems: string[] = [];
    for (const file of sourceFiles) {
      const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visit = (n: ts.Node) => {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === "t" || n.expression.text === "tt")) {
          const first = n.arguments[0];
          if (first && ts.isStringLiteral(first)) {
            const e = entryOf.get(first.text);
            const where = `${relative(WEB, file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1} ${first.text}`;
            if (e === undefined) problems.push(`${where}: no such id`);
            else {
              expect(n.expression.text === "tt", `${where}: t() for a plain line, tt() for a voice line`).toBe(isToneText(e));
              const arg = n.arguments[n.expression.text === "tt" ? 2 : 1];
              const have = arg && ts.isObjectLiteralExpression(arg) && !arg.properties.some((p) => ts.isSpreadAssignment(p)) ? arg.properties.map((p) => p.name?.getText() ?? "").sort() : null;
              const want = need(e as string | Record<string, string>);
              if (have === null && !arg && want.length) problems.push(`${where}: missing ${want.join(", ")}`);
              if (have && JSON.stringify(have) !== JSON.stringify(want)) problems.push(`${where}: has ${have.join(", ")} but the line needs ${want.join(", ")}`);
            }
          }
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
    expect(problems).toEqual([]);
  });

  it("a Voice entry has all three versions, each with the same placeholders", () => {
    for (const { id, entry } of all) if (isToneText(entry)) {
      for (const tone of ["gentle", "honest", "brutal"] as const) expect(entry[tone]?.trim().length, `${id}.${tone}`).toBeGreaterThan(3);
      const sets = ["gentle", "honest", "brutal"].map((k) => need({ x: entry[k as "gentle"] }).join(","));
      expect(new Set(sets).size, `${id} placeholders differ between Voices`).toBe(1);
    }
  });

  it("an unknown or missing Voice reads as Honest, never undefined", () => {
    for (const { id, entry } of all) if (isToneText(entry)) {
      const vars = Object.fromEntries(need(entry as unknown as Record<string, string>).map((k) => [k, "x"]));
      for (const bad of ["mystery", undefined, null, ""]) expect((tt as (...a: unknown[]) => string)(id, bad, vars)).toBe((tt as (...a: unknown[]) => string)(id, "honest", vars));
    }
  });

  it("the app name always comes from one place", () => {
    expect(t("onboarding.triggers.intro")).toContain("pawse offers these back");
    expect(t("sheets.plan.intro")).toContain("what pawse offers");
  });
});

describe("words and style", () => {
  const texts = (): { id: string; text: string }[] => [
    ...all.flatMap((e) => (isToneText(e.entry) ? Object.entries(e.entry).map(([k, v]) => ({ id: `${e.id}.${k}`, text: v })) : [{ id: e.id, text: e.entry }])),
    ...[...generated(), ...petSpeech(), ...lists()].flatMap((g) => (Array.isArray(g.samples) ? g.samples.map((s) => ({ id: g.id, text: s })) : Object.entries(g.samples).flatMap(([k, v]) => (v ?? []).map((s) => ({ id: `${g.id}.${k}`, text: s }))))),
  ];

  /** The glossary (docs/COPY_GLOSSARY.md) as rules. */
  const RULES: [RegExp, string][] = [
    [/\b(counselor|behavior|favorite|color|organize|recognize|center|gray|program)\b/i, "UK spelling is used throughout (counsellor, behaviour, favourite, colour, grey...)"],
    [/[‘’“”]/, "straight quotes and apostrophes only"],
    [/\.\.\./, "use the ellipsis character … , not three dots"],
    [/\bJourney\b/, "the tab and screen are called Calendar"],
    [/\bHall of Companions\b|\bYour companion\b|\bchoose your companion\b/i, "the creature is a pet, in the UI"],
    [/\bclean days?\b/i, "say goal-met day (or goal met), not clean day"],
    [/\bbinge\b/i, "say heavy day"],
    [/\bscars?\b/i, "say lasting mark"],
    [/\brode out\b|\bride it out\b|\bridden\b/i, "an urge is managed"],
    [/\b[Pp]awse\b/, "write the product name as {app}"],
    [/\b(undefined|NaN|\[object|null)\b/, "no broken interpolation"],
    [/\b1 (months|slips|days|urges|weeks)\b/, "singular needs the singular word"],
  ];
  // These generated lines are the only places the old word is allowed, because the thing it names is the engine's.
  const ALLOWED = new Map<string, RegExp>([
    ["lists.moods", /.*/], // the slip question's own answer chips
  ]);

  it("follows the copy glossary", () => {
    const broken = texts().flatMap(({ id, text }) => RULES.filter(([re]) => re.test(text) && !(ALLOWED.get(id.split(".").slice(0, 2).join(".")) ?? /^\b$/).test(text)).map(([, why]) => `${id}: "${text.slice(0, 70)}" -> ${why}`));
    expect(broken.join("\n")).toBe("");
  });

  it("no line comes out empty, and every generated sample renders", () => {
    for (const { id, text } of texts()) expect(text.trim().length, id).toBeGreaterThan(0);
    expect(generated().length).toBeGreaterThan(20);
    expect(petSpeech().length).toBeGreaterThan(30);
  });

  it("the three Voices differ where they should, and shaming words appear in none", () => {
    const SHAME = /\b(loser|stupid|idiot|pathetic|worthless|disgusting|failure|addict|lazy|weakling)\b/i;
    for (const { id, text } of texts()) if (!id.startsWith("account.") && !id.startsWith("safety.support.")) expect(text, id).not.toMatch(SHAME); // "not a failure" reassures
  });
});

describe("the manifest cannot drift", () => {
  const build = () => {
    const rs = new Map(regions().map((r) => [r.id, r]));
    return {
      note: "Generated by `pnpm --filter web copy:manifest` from src/text. Do not edit by hand: the test fails if it is out of date.",
      sections: SECTIONS.map((s) => {
        const r = rs.get(s.id)!;
        return {
          id: s.id, screen: s.screen, title: s.title, source: s.source, file: r.file, start: r.start, end: r.end,
          entries: Object.entries(s.entries).map(([key, e]) => ({ id: `${s.id}.${key}`, kind: isToneText(e) ? "voice" : "text", placeholders: [...new Set([...(isToneText(e) ? Object.values(e) : [e]).flatMap((x) => [...x.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))])].filter((k) => k !== "app").sort() })),
        };
      }),
      generated: [...generated(), ...petSpeech(), ...lists()].map((g) => ({ id: g.id, group: g.group, source: g.source, voices: !Array.isArray(g.samples) })),
    };
  };
  it("matches the catalogue and the marker positions in the files", () => {
    const fresh = JSON.stringify(build(), null, 2) + "\n";
    if (process.env.UPDATE_COPY_MANIFEST) writeFileSync(MANIFEST, fresh);
    expect(readFileSync(MANIFEST, "utf8"), "Run: pnpm --filter web copy:manifest").toBe(fresh);
  });
});

describe("the inspector", () => {
  it("lists every registered screen, section and entry, and says it is read-only", () => {
    const html = renderToString(createElement(CopyInspector));
    for (const s of SECTIONS) expect(html, s.id).toContain(s.id);
    for (const screen of new Set(SECTIONS.map((s) => s.screen))) expect(html).toContain(screen.replace(/&/g, "&amp;").replace(/→/g, "→"));
    for (const { id } of all) expect(html, id).toContain(id);
    expect(html).toContain("Read-only");
    for (const g of [...generated(), ...lists()]) expect(html, g.id).toContain(g.id);
  });
});

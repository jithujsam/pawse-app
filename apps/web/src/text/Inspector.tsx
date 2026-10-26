import { useMemo, useState } from "react";
import { catalogue, SECTIONS } from "./index";
import { generated, lists, petSpeech, type GeneratedLine } from "./dynamic";
import { isToneText, type ToneText } from "./core";
import manifest from "./manifest.generated.json";

/**
 * Developer view of all the app's words, for every screen at once. Open /#copy in a dev build.
 * It is read-only: nothing typed here changes the app. To change a line, edit the file and the lines named under each
 * section (the part between its @copy-section markers), then run `pnpm --filter web copy:manifest`.
 */
const TONE_NAME = { gentle: "Gentle", honest: "Honest", brutal: "Direct" } as const;
const where = (id: string) => (manifest.sections as { id: string; file: string; start: number; end: number }[]).find((s) => s.id === id);

function VoiceRows({ entry }: { entry: ToneText }) {
  return <>{(["gentle", "honest", "brutal"] as const).map((t) => <div key={t}><b>{TONE_NAME[t]}:</b> {entry[t]}</div>)}</>;
}

export function CopyInspector() {
  const [q, setQ] = useState("");
  const [screen, setScreen] = useState("");
  const all = useMemo(() => catalogue(), []);
  const screens = useMemo(() => [...new Set(SECTIONS.map((s) => s.screen))], []);
  const extra: GeneratedLine[] = useMemo(() => [...generated(), ...petSpeech(), ...lists()], []);
  const needle = q.trim().toLowerCase();
  // The same words in more than one entry: either a shared phrase on purpose, or two lines that have drifted apart.
  const dupes = useMemo(() => {
    const seen = new Map<string, string[]>();
    for (const e of all) if (!isToneText(e.entry) && e.entry.length > 14) seen.set(e.entry.toLowerCase(), [...(seen.get(e.entry.toLowerCase()) ?? []), e.id]);
    return new Map([...seen].filter(([, ids]) => ids.length > 1).flatMap(([, ids]) => ids.map((id) => [id, ids] as const)));
  }, [all]);
  const show = (text: string, id: string) => !needle || text.toLowerCase().includes(needle) || id.toLowerCase().includes(needle);

  return (
    <main style={{ font: "14px/1.45 system-ui, sans-serif", padding: 16, maxWidth: 980, margin: "0 auto", color: "CanvasText", background: "Canvas" }}>
      <h1 style={{ marginBottom: 4 }}>Copy inspector</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Read-only. This lists the words in the app: <b>source</b> text in the catalogue, then <b>generated</b> lines and <b>lists</b> built by code.
        Editing nothing here changes the app. Change a line in the file and between the markers shown under its section.
        {" "}{SECTIONS.length} sections, {all.length} entries, {screens.length} screens.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search text or id" aria-label="Search text or id" style={{ flex: "1 1 240px", padding: 8 }} />
        <select value={screen} onChange={(e) => setScreen(e.target.value)} aria-label="Screen" style={{ padding: 8 }}>
          <option value="">All screens</option>
          {screens.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <h2>Source text</h2>
      {SECTIONS.filter((s) => !screen || s.screen === screen).map((s) => {
        const rows = all.filter((e) => e.section.id === s.id).filter((e) => show(isToneText(e.entry) ? Object.values(e.entry).join(" ") : e.entry, e.id));
        if (!rows.length) return null;
        const w = where(s.id);
        return (
          <section key={s.id} id={s.id} style={{ border: "1px solid GrayText", borderRadius: 8, padding: 12, margin: "12px 0" }}>
            <h3 style={{ margin: 0 }}><code>{s.id}</code> · {s.title}</h3>
            <p style={{ margin: "2px 0 8px", opacity: 0.75 }}>
              {s.screen} · shown by <code>{s.source}</code>
              {w && <> · edit <code>{w.file}</code> lines {w.start}–{w.end}</>}
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} style={{ verticalAlign: "top", borderTop: "1px solid color-mix(in srgb, GrayText 30%, transparent)" }}>
                    <td style={{ padding: "6px 8px 6px 0", width: "34%", wordBreak: "break-all" }}><code>{e.id}</code></td>
                    <td style={{ padding: "6px 0" }}>
                      {isToneText(e.entry) ? <VoiceRows entry={e.entry} /> : e.entry}
                      {dupes.has(e.id) && <div style={{ color: "GrayText" }}>Same words also in: {dupes.get(e.id)!.filter((x) => x !== e.id).join(", ")}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      {(["generated", "pet-speech", "lists"] as const).map((group) => (
        <div key={group}>
          <h2>{group === "generated" ? "Generated lines (built by code, per Voice)" : group === "pet-speech" ? "Pet speech (src/voice.ts)" : "Lists of choices"}</h2>
          {extra.filter((x) => x.group === group).filter((x) => show(JSON.stringify(x.samples) + x.title, x.id)).map((x) => (
            <section key={x.id} style={{ border: "1px dashed GrayText", borderRadius: 8, padding: 12, margin: "10px 0" }}>
              <h3 style={{ margin: 0 }}><code>{x.id}</code> · {x.title}</h3>
              <p style={{ margin: "2px 0 8px", opacity: 0.75 }}>Generated from <code>{x.source}</code>. Change it there; the text below is computed.</p>
              {Array.isArray(x.samples)
                ? <ul style={{ margin: 0 }}>{x.samples.map((s, i) => <li key={i}>{s}</li>)}</ul>
                : (["gentle", "honest", "brutal"] as const).map((t) => <div key={t}><b>{TONE_NAME[t]}:</b> {(x.samples as Record<string, string[]>)[t]?.join(" · ")}</div>)}
            </section>
          ))}
        </div>
      ))}
    </main>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { simulatorSend, simulatorThread, type SimMessage } from "./actions";
import { useHydrated } from "@/components/app/useHydrated";

type Person = { id: string; name: string; phone: string; status: string };

const QUICK = ["YES", "repeat", "I don't understand", "ok", "STOP"];

export function Simulator({ jobId, people }: { jobId: string; people: Person[] }) {
  const [selected, setSelected] = useState<string | null>(people[0]?.id ?? null);
  const [thread, setThread] = useState<SimMessage[]>([]);
  const [status, setStatus] = useState("");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const ready = useHydrated();

  const load = useCallback(async () => {
    if (!selected) return;
    const t = await simulatorThread(jobId, selected);
    setThread(t.messages);
    setStatus(t.status);
  }, [jobId, selected]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 2500);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => bottom.current?.scrollIntoView({ block: "end" }), [thread.length]);

  const send = (body: string, voice = false) => {
    if (!selected || !body.trim()) return;
    setError(null);
    setText(""); // clear now, so typing the next reply isn't wiped when this one finishes
    start(async () => {
      try {
        await simulatorSend(jobId, selected, body, voice);
        await load();
      } catch {
        setText(body);
        setError("Couldn't send. Try again.");
      }
    });
  };

  if (!people.length) return <div className="card text-sm">No candidates have been invited yet. Start screening first.</div>;
  const person = people.find((p) => p.id === selected);

  return (
    <div className="grid md:grid-cols-3 gap-4" data-ready={ready || undefined}>
      <div className="card card-sm space-y-1 h-fit">
        {people.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className="w-full text-left rounded-lg px-3 py-2 text-sm"
            style={p.id === selected ? { background: "var(--color-surface-container)" } : undefined}
          >
            <div className="font-medium">{p.name}</div>
            <div className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>{p.phone}</div>
          </button>
        ))}
      </div>

      <div className="md:col-span-2 mx-auto w-full max-w-sm">
        <div className="rounded-[2rem] border-8 overflow-hidden" style={{ borderColor: "#0B1C30" }}>
          <div className="px-4 py-3 text-white text-sm" style={{ background: "#075E54" }}>
            <div className="font-medium">Screening · {person?.name}</div>
            <div className="text-xs opacity-80">{status.replace("_", " ")}</div>
          </div>
          <div className="h-[460px] overflow-y-auto p-3 space-y-2" style={{ background: "#ECE5DD" }}>
            {thread.map((m) => (
              <div key={m.id} data-from={m.direction === "in" ? "candidate" : "recruiter"} className={`flex ${m.direction === "in" ? "justify-end" : "justify-start"}`}>
                <div
                  className="rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap break-words shadow-sm"
                  style={{ background: m.direction === "in" ? "#DCF8C6" : "#FFFFFF", color: "#111" }}
                >
                  {m.voice && <div className="text-xs opacity-70 mb-1">🎤 Voice note</div>}
                  {m.body}
                </div>
              </div>
            ))}
            {thread.length === 0 && <p className="text-xs text-center opacity-60">Waiting for the invite…</p>}
            <div ref={bottom} />
          </div>
          <div className="p-2 bg-white space-y-2">
            <div className="flex flex-wrap gap-1">
              {QUICK.map((q) => (
                <button key={q} onClick={() => send(q)} disabled={pending} className="badge badge-neutral" style={{ cursor: "pointer" }}>
                  {q}
                </button>
              ))}
            </div>
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}
            >
              <input className="input" placeholder="Type a reply" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} aria-label="Reply" />
              <button className="btn-base btn-primary" style={{ padding: "8px 12px" }} disabled={pending || !text.trim()}>
                Send
              </button>
              <button
                type="button"
                className="btn-base btn-ghost"
                style={{ padding: "8px 10px" }}
                title="Send the text as a simulated voice note"
                aria-label="Send as voice note"
                disabled={pending || !text.trim()}
                onClick={() => send(text, true)}
              >
                🎤
              </button>
            </form>
            {error && <p className="text-xs" style={{ color: "var(--color-error)" }}>{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

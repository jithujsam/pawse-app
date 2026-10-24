import { useEffect, useRef, useState } from "react";

/**
 * Talk to your companion and it says it back in its own squeaky voice, like the talking-pet toys.
 * The recording lives only in memory for a few seconds: nothing is saved, nothing is sent.
 */
export type TalkState = "idle" | "listening" | "talking" | "denied";

const MAX_MS = 6000;
const PITCH = 1.55;

export function useTalkBack() {
  const [state, setState] = useState<TalkState>("idle");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const ctx = useRef<AudioContext | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout>>();
  const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  useEffect(() => () => { clearTimeout(stopTimer.current); rec.current?.stream.getTracks().forEach((t) => t.stop()); void ctx.current?.close(); }, []);

  async function start() {
    if (!supported || state === "listening" || state === "talking") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => { stream.getTracks().forEach((t) => t.stop()); void playBack(); };
      rec.current = r;
      r.start();
      setState("listening");
      stopTimer.current = setTimeout(stop, MAX_MS);
    } catch { setState("denied"); }
  }

  function stop() {
    clearTimeout(stopTimer.current);
    if (rec.current?.state === "recording") rec.current.stop();
  }

  async function playBack() {
    const blob = new Blob(chunks.current, { type: chunks.current[0]?.type || "audio/webm" });
    chunks.current = [];
    if (blob.size < 2000) { setState("idle"); return; }
    try {
      ctx.current ??= new AudioContext();
      const buf = await ctx.current.decodeAudioData(await blob.arrayBuffer());
      const src = ctx.current.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = PITCH; // faster playback raises the pitch: the classic chipmunk voice
      const gain = ctx.current.createGain();
      gain.gain.value = 1.4;
      src.connect(gain).connect(ctx.current.destination);
      setState("talking");
      src.onended = () => setState("idle");
      src.start();
    } catch { setState("idle"); }
  }

  return { state, supported, start, stop };
}

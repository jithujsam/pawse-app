import { haptic } from "../haptics";
import { pad } from "../dates";

/**
 * A 12-hour time picker that looks the same on every phone, unlike the system one which follows
 * the phone's 24-hour setting. Value in and out is "HH:MM" (24-hour), the way it's stored.
 */
export function TimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [h24, m] = (value || "20:00").split(":").map(Number);
  const pm = h24 >= 12;
  const h12 = h24 % 12 || 12;
  const set = (h: number, min: number, isPm: boolean) => { haptic.select(); onChange(`${pad((h % 12) + (isPm ? 12 : 0))}:${pad(min)}`); };
  return (
    <div className="timepick" role="group" aria-label={label}>
      <select className="input" aria-label="Hour" value={h12} onChange={(e) => set(Number(e.target.value), m, pm)}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span aria-hidden>:</span>
      <select className="input" aria-label="Minute" value={m - (m % 5)} onChange={(e) => set(h12, Number(e.target.value), pm)}>
        {Array.from({ length: 12 }, (_, i) => i * 5).map((x) => <option key={x} value={x}>{pad(x)}</option>)}
      </select>
      <div className="segmented ampm" role="radiogroup" aria-label="AM or PM">
        {[false, true].map((p) => (
          <button key={String(p)} type="button" role="radio" aria-checked={pm === p} className="seg" onClick={() => set(h12, m, p)}>
            {pm === p && <span className="seg-pill" />}<span className="seg-label">{p ? "PM" : "AM"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

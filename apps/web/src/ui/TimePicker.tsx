import { haptic } from "../haptics";
import { pad } from "../dates";
import { Select } from "./Controls";
import { t } from "../text";

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
      <select className="input dropdown" aria-label={t("ui.common.hour")} value={h12} onChange={(e) => set(Number(e.target.value), m, pm)}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span aria-hidden>:</span>
      <select className="input dropdown" aria-label={t("ui.common.minute")} value={m - (m % 5)} onChange={(e) => set(h12, Number(e.target.value), pm)}>
        {Array.from({ length: 12 }, (_, i) => i * 5).map((x) => <option key={x} value={x}>{pad(x)}</option>)}
      </select>
      <Select className="ampm" label={t("ui.common.am_pm")} value={pm} onChange={(p) => set(h12, m, p)} options={[{ value: false, label: "AM" }, { value: true, label: "PM" }]} />
    </div>
  );
}

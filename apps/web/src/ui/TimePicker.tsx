import { haptic } from "../haptics";
import { pad } from "../dates";
import { Select } from "./Controls";
import { Dropdown } from "./Dropdown";
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
      <Dropdown label={t("ui.common.hour")} selected={String(h12)} className="hour"
        items={Array.from({ length: 12 }, (_, i) => ({ key: String(i + 1), label: String(i + 1) }))}
        onPick={(k) => set(Number(k), m, pm)} />
      <span aria-hidden>:</span>
      <Dropdown label={t("ui.common.minute")} selected={String(m - (m % 5))} className="minute"
        items={Array.from({ length: 12 }, (_, i) => ({ key: String(i * 5), label: pad(i * 5) }))}
        onPick={(k) => set(h12, Number(k), pm)} />
      <Select className="ampm" label={t("ui.common.am_pm")} value={pm} onChange={(p) => set(h12, m, p)} options={[{ value: false, label: "AM" }, { value: true, label: "PM" }]} />
    </div>
  );
}

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { getData } from "./store";

const native = Capacitor.isNativePlatform();
const on = () => getData().settings.haptics !== false;
const buzz = (ms: number | number[]) => { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } };

/** Small, meaningful taps. Silent when the person turns haptics off. */
export const haptic = {
  tap() { if (!on()) return; if (native) void Haptics.impact({ style: ImpactStyle.Light }); else buzz(8); },
  select() { if (!on()) return; if (native) void Haptics.selectionChanged(); else buzz(4); },
  success() { if (!on()) return; if (native) void Haptics.notification({ type: NotificationType.Success }); else buzz([10, 40, 18]); },
  warn() { if (!on()) return; if (native) void Haptics.notification({ type: NotificationType.Warning }); else buzz([24, 60, 24]); },
  heavy() { if (!on()) return; if (native) void Haptics.impact({ style: ImpactStyle.Heavy }); else buzz(30); },
};

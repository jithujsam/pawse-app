import { describe, expect, it, vi } from "vitest";

// The in-app update only installs a file whose SHA-256 is in latest.json; otherwise people get the browser download.
const calls: string[] = [];
let installError: string | null = null;
vi.stubGlobal("window", { location: { href: "" } });
vi.stubGlobal("__APP_VERSION__", "3.1.0");
vi.stubGlobal("__APP_CODE__", 9);
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" },
  registerPlugin: () => ({
    addListener: async () => ({ remove: async () => undefined }),
    download: async (o: { url: string; sha256: string }) => { calls.push(`download ${o.sha256.slice(0, 4)}`); },
    install: async () => { calls.push("install"); if (installError) throw new Error(installError); },
  }),
}));
vi.mock("../src/ui/Toast", () => ({ toast: vi.fn() }));

const { canInstallInApp, installUpdate } = await import("../src/update");
const sha = "ab".repeat(32);
const base = { name: "9.9.9", code: 99, url: "https://raw.githubusercontent.com/jithujsam/pawse-releases/main/apk/Pawse-9.9.9.apk" };

describe("in-app update", () => {
  it("installs in the app only when latest.json carries a 64-character SHA-256", () => {
    expect(canInstallInApp({ ...base, sha256: sha })).toBe(true);
    expect(canInstallInApp(base)).toBe(false);
    expect(canInstallInApp({ ...base, sha256: "abc" })).toBe(false);
  });

  it("downloads then opens the installer", async () => {
    expect(await installUpdate({ ...base, sha256: sha })).toBe("installing");
    expect(calls).toEqual(["download abab", "install"]);
  });

  it("falls back to the browser download without a checksum", async () => {
    calls.length = 0;
    expect(await installUpdate(base)).toBe("browser");
    expect(calls).toEqual([]);
    expect(window.location.href).toBe(base.url);
  });

  it("reports the unknown-apps switch being off", async () => {
    installError = "permission";
    expect(await installUpdate({ ...base, sha256: sha })).toBe("permission");
  });
});

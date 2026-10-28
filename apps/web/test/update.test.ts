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
const opened: string[] = [];
vi.mock("../src/native", () => ({ openExternal: (u: string) => { opened.push(u); } }));

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
    expect(opened).toEqual([base.url]);
  });

  it("reports the unknown-apps switch being off", async () => {
    installError = "permission";
    expect(await installUpdate({ ...base, sha256: sha })).toBe("permission");
  });
});

const { parseLatest, pendingUpdates, shouldPrompt } = await import("../src/update");

describe("update manifest and popup rules", () => {
  it("accepts a good manifest and rejects malformed ones", () => {
    expect(parseLatest({ ...base, sha256: sha })?.code).toBe(99);
    expect(parseLatest({ ...base, code: "99" })).toBeNull();
    expect(parseLatest({ ...base, code: 1.5 })).toBeNull();
    expect(parseLatest({ ...base, url: "http://raw.githubusercontent.com/jithujsam/pawse-releases/main/a.apk" })).toBeNull();
    expect(parseLatest({ ...base, url: "https://evil.example/a.apk" })).toBeNull();
    expect(parseLatest({ ...base, sha256: "abc" })).toBeNull();
    expect(parseLatest(null)).toBeNull();
  });

  it("shows the launch popup once per version: not after Later or Don't remind on it, but again for a newer one", () => {
    const l = { ...base, code: 20 };
    expect(shouldPrompt(l, {})).toBe(true);
    expect(shouldPrompt(l, { skipped: 20 })).toBe(false);
    expect(shouldPrompt(l, { later: 20 })).toBe(false);
    expect(shouldPrompt({ ...l, code: 21 }, { later: 20 })).toBe(true);
    expect(shouldPrompt({ ...l, code: 21 }, { skipped: 20 })).toBe(true);
  });

  it("keeps the versions missed since the installed one, newest first, and drops bad history entries", () => {
    const parsed = parseLatest({ ...base, sha256: sha, history: [
      { name: "9.9.8", code: 98, notes: "Eight" },
      { name: "9.9.0", code: 90 },
      { name: "bad", code: "x" },
      { name: "ancient", code: 5 },
    ] });
    expect(parsed?.history?.map((h) => h.code)).toEqual([98, 90, 5]);
    expect(pendingUpdates(parsed!).map((v) => v.code)).toEqual([99, 98, 90]);
    expect(pendingUpdates({ ...base, sha256: sha, code: 9 } as never)).toEqual([]);
  });
});

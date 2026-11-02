import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "sb-syysftnaubbpolrmicvd-auth-token";
const store = new Map<string, string>();
let savedSession: () => { user: { id: string } } | null;

beforeAll(async () => {
  // No browser here: give the module the two globals it reads when it loads.
  vi.stubGlobal("location", { origin: "http://localhost", pathname: "/" });
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
  ({ savedSession } = await import("../src/supabase"));
});
beforeEach(() => store.clear());

describe("saved sign-in", () => {
  it("is read from storage so the login screen doesn't flash while a token refreshes", () => {
    expect(savedSession()).toBeNull();
    store.set(KEY, JSON.stringify({ access_token: "a", refresh_token: "r", user: { id: "u1" } }));
    expect(savedSession()?.user.id).toBe("u1");
  });
  it("ignores anything that isn't a whole session", () => {
    for (const bad of ["not json", "null", JSON.stringify({ access_token: "a" }), JSON.stringify({ access_token: "a", refresh_token: "r" })]) {
      store.set(KEY, bad);
      expect(savedSession()).toBeNull();
    }
  });
});

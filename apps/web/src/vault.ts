/**
 * App lock. With a PIN set, everything on the phone is encrypted with AES-GCM under a key derived
 * from the PIN (PBKDF2-SHA-256). The PIN itself is never stored. A wrong PIN fails to decrypt.
 * Repeated failures lock the screen for longer and longer.
 */

const ITERATIONS = 310_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export interface Sealed { v: 1; salt: string; iv: string; ct: string; iterations: number }

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export interface VaultKey { key: CryptoKey; salt: Uint8Array<ArrayBuffer>; iterations: number }

export async function newKey(pin: string): Promise<VaultKey> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { key: await deriveKey(pin, salt, ITERATIONS), salt, iterations: ITERATIONS };
}

export async function seal(k: VaultKey, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k.key, enc.encode(JSON.stringify(value))));
  return { v: 1, salt: b64(k.salt), iv: b64(iv), ct: b64(ct), iterations: k.iterations };
}

/** Returns the key and the decrypted value, or null when the PIN is wrong. */
export async function open(pin: string, s: Sealed): Promise<{ k: VaultKey; value: unknown } | null> {
  const salt = unb64(s.salt);
  const key = await deriveKey(pin, salt, s.iterations);
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(s.iv) }, key, unb64(s.ct));
    return { k: { key, salt, iterations: s.iterations }, value: JSON.parse(dec.decode(pt)) };
  } catch {
    return null;
  }
}

export const isPinShaped = (pin: string) => /^\d{4,6}$/.test(pin);

/** Too-easy PINs: repeated digits and straight runs. */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true;
  const d = pin.split("").map(Number);
  const up = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  const down = d.every((x, i) => i === 0 || x === d[i - 1] - 1);
  return up || down || ["1212", "6969", "1122", "2580", "0852"].includes(pin);
}

export interface Lockout { fails: number; until: number }

/** 5 free tries, then 30 seconds, doubling each time, capped at 15 minutes. */
export function afterFailure(l: Lockout, now = Date.now()): Lockout {
  const fails = l.fails + 1;
  const wait = fails < 5 ? 0 : Math.min(15 * 60_000, 30_000 * 2 ** (fails - 5));
  return { fails, until: now + wait };
}

import type { Accessory, Personality, Species } from "./types";

/** One coat: the colours the art is painted with. `dark` is ear tips, socks, patches; `iris` the eye colour. */
export interface Coat { id: string; label: string; fur: string; shade: string; belly: string; inner: string; dark: string; iris: string; marks?: string }

export const SPECIES: { id: Species; label: string; blurb: string; off?: true }[] = [
  { id: "dog", label: "Dog", blurb: "Loyal, waits by the door" },
  { id: "cat", label: "Cat", blurb: "Quiet, notices everything" },
  { id: "rabbit", label: "Rabbit", blurb: "Gentle, a little shy", off: true },
  { id: "fox", label: "Fox", blurb: "Clever and curious" },
  { id: "owl", label: "Owl", blurb: "Up late with you", off: true },
  { id: "panda", label: "Panda", blurb: "Slow, soft, unbothered", off: true },
];

/**
 * The species a person can pick now: the dog, cat and fox, which also come in 3D. The rabbit, owl and panda are
 * switched off for now but kept whole, so pets that already are one stay as they are.
 */
export const PICKABLE = SPECIES.filter((s) => !s.off);

export const COATS: Record<Species, Coat[]> = {
  dog: [
    { id: "golden", label: "Golden", fur: "#dda466", shade: "#b97a3e", belly: "#f7e6cb", inner: "#a1612f", dark: "#8f5426", iris: "#4a2c16" },
    { id: "cocoa", label: "Cocoa", fur: "#8d5c3c", shade: "#69432a", belly: "#dcbd9d", inner: "#4f301e", dark: "#3f2516", iris: "#2a170c" },
    { id: "cream", label: "Cream", fur: "#f0dfc0", shade: "#d3b78c", belly: "#fff8ec", inner: "#c59f70", dark: "#b88d5c", iris: "#3d2616" },
  ],
  cat: [
    { id: "tabby", label: "Grey tabby", fur: "#a3a8b2", shade: "#7b818c", belly: "#eef0f3", inner: "#f0b6b6", dark: "#6a707b", iris: "#9cc45b", marks: "#6a707b" },
    { id: "ginger", label: "Ginger", fur: "#eaa762", shade: "#c97b3b", belly: "#fcecd8", inner: "#f2b0a6", dark: "#c06f30", iris: "#d9a021", marks: "#c26f31" },
    { id: "tuxedo", label: "Tuxedo", fur: "#3c3c45", shade: "#26262c", belly: "#f4f4f4", inner: "#e9a5a5", dark: "#1f1f24", iris: "#e5c34c" },
  ],
  rabbit: [
    { id: "cream", label: "Cream", fur: "#f3e8d8", shade: "#d9c6ad", belly: "#fffbf4", inner: "#f2b8bd", dark: "#cdb497", iris: "#3a2a2a" },
    { id: "grey", label: "Grey", fur: "#bcb8b2", shade: "#97918a", belly: "#f0eeea", inner: "#efb3b8", dark: "#8a847d", iris: "#2a2222" },
    { id: "brown", label: "Brown", fur: "#a97d5a", shade: "#855e40", belly: "#ead8c4", inner: "#e9a9ad", dark: "#6f4c33", iris: "#2a1a12" },
  ],
  fox: [
    { id: "red", label: "Red", fur: "#e47c3c", shade: "#bd5b23", belly: "#fff5ec", inner: "#3d2b25", dark: "#3d2b25", iris: "#d59b1d" },
    { id: "arctic", label: "Arctic", fur: "#f2f2f5", shade: "#cfd3db", belly: "#ffffff", inner: "#a7aebb", dark: "#9ba2af", iris: "#5b8fc7" },
    { id: "silver", label: "Silver", fur: "#737785", shade: "#525562", belly: "#eaebef", inner: "#26272c", dark: "#26272c", iris: "#d8a72d" },
  ],
  owl: [
    { id: "barn", label: "Barn", fur: "#cd9e68", shade: "#a87a42", belly: "#fcf4e8", inner: "#e9c89c", dark: "#7c5530", iris: "#f2a321", marks: "#9a7046" },
    { id: "snowy", label: "Snowy", fur: "#eef1f5", shade: "#c9ced7", belly: "#ffffff", inner: "#dde2e9", dark: "#8f98a5", iris: "#f2c230", marks: "#9aa3ae" },
    { id: "brown", label: "Brown", fur: "#8c6648", shade: "#6b4b33", belly: "#ead9c4", inner: "#c9ab8a", dark: "#4a3222", iris: "#f08a1c", marks: "#5c4029" },
  ],
  panda: [
    { id: "classic", label: "Classic", fur: "#f8f6f1", shade: "#ddd8cd", belly: "#ffffff", inner: "#2c2c31", dark: "#2c2c31", iris: "#1a1a1a" },
    { id: "brown", label: "Qinling", fur: "#f4ede3", shade: "#dacebc", belly: "#fffaf3", inner: "#6c4b36", dark: "#6c4b36", iris: "#2a1a10" },
  ],
};

export const coatFor = (species: Species, id?: string): Coat => COATS[species].find((c) => c.id === id) ?? COATS[species][0];

export const PERSONALITIES: { id: Personality; label: string; blurb: string }[] = [
  { id: "playful", label: "Playful", blurb: "Bouncy, loud about good days" },
  { id: "calm", label: "Calm", blurb: "Soft-spoken, naps a lot" },
  { id: "sassy", label: "Sassy", blurb: "Side-eye, dry jokes" },
  { id: "wise", label: "Wise", blurb: "Few words, all of them true" },
];

/** Accessories and the clean-streak milestone that unlocks each one. */
export const ACCESSORIES: { id: Accessory; label: string; days: number }[] = [
  { id: "bandana", label: "Bandana", days: 3 },
  { id: "bow", label: "Bow", days: 7 },
  { id: "flowers", label: "Flower crown", days: 14 },
  { id: "scarf", label: "Scarf", days: 30 },
  { id: "glasses", label: "Glasses", days: 60 },
  { id: "crown", label: "Crown", days: 100 },
];

export const NAMES: Record<Species, string[]> = {
  dog: ["Biscuit", "Mochi", "Pepper", "Bean"], cat: ["Miso", "Luna", "Pixel", "Olive"], rabbit: ["Clover", "Pip", "Hazel", "Nimbus"],
  fox: ["Ember", "Rusty", "Juniper", "Maple"], owl: ["Hoot", "Sage", "Willow", "Nova"], panda: ["Bao", "Dumpling", "Momo", "Tofu"],
};

const TUXEDO = { dark: [0x2c, 0x2c, 0x36], light: [0xf4, 0xf4, 0xf4], lo: 0.5, hi: 0.7 };

/** Repaints the 3D cat atlas for the tuxedo: dark fur goes charcoal, light areas (muzzle, bib, paws) stay white. sRGB RGBA bytes, edited in place. */
export function tuxedoPixels(px: Uint8ClampedArray): void {
  for (let i = 0; i < px.length; i += 4) {
    const lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    const x = Math.min(1, Math.max(0, (lum - TUXEDO.lo) / (TUXEDO.hi - TUXEDO.lo)));
    const t = x * x * (3 - 2 * x);
    for (let c = 0; c < 3; c++) px[i + c] = TUXEDO.dark[c] + (TUXEDO.light[c] - TUXEDO.dark[c]) * t;
  }
}

/** Mixes two #rrggbb colours; t = 0 gives a, 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, "0")).join("")}`;
}

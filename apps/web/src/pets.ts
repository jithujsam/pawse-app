import type { Personality, Species } from "./types";

/** One coat: the colours the art is painted with. `dark` is ear tips, socks, patches; `iris` the eye colour. */
export interface Coat { id: string; label: string; fur: string; shade: string; belly: string; inner: string; dark: string; iris: string; marks?: string }

export const SPECIES: { id: Species; label: string; blurb: string; off?: true }[] = [
  { id: "dog", label: "Dog", blurb: "Loyal, waits by the door" },
  { id: "cat", label: "Cat", blurb: "Quiet, notices everything", off: true },
  { id: "fox", label: "Fox", blurb: "Clever and curious" },
];

/**
 * The species a person can pick now: the dog and fox. The cat stays for pets that already are one.
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
  fox: [
    { id: "red", label: "Red", fur: "#e47c3c", shade: "#bd5b23", belly: "#fff5ec", inner: "#3d2b25", dark: "#3d2b25", iris: "#d59b1d" },
    { id: "arctic", label: "Arctic", fur: "#f2f2f5", shade: "#cfd3db", belly: "#ffffff", inner: "#a7aebb", dark: "#9ba2af", iris: "#5b8fc7" },
    { id: "silver", label: "Silver", fur: "#737785", shade: "#525562", belly: "#eaebef", inner: "#26272c", dark: "#26272c", iris: "#d8a72d" },
  ],
};

/** Breeds a species can be, for the species that have more than one. Missing a breed means the first one. */
/** Husky colourings: grey, black and red, each with a white chest and face. */
const HUSKY_COATS: Coat[] = [
  { id: "grey", label: "Grey and white", fur: "#9aa0a8", shade: "#7a8089", belly: "#f7f7f5", inner: "#e9e4dc", dark: "#5c626b", iris: "#6f9cc4" },
  { id: "black", label: "Black and white", fur: "#2b2b30", shade: "#1c1c21", belly: "#f4f4f2", inner: "#e9e4dc", dark: "#141418", iris: "#6f9cc4" },
  { id: "red", label: "Red and white", fur: "#b8642c", shade: "#8e4a1e", belly: "#fbf3e8", inner: "#e9d2b8", dark: "#6e3a18", iris: "#8a6a3a" },
];

export const BREEDS: Partial<Record<Species, { id: string; label: string; coats?: Coat[] }[]>> = {
  dog: [{ id: "shiba", label: "Shiba Inu" }, { id: "husky", label: "Husky", coats: HUSKY_COATS }],
};

export const breedFor = (species: Species, id?: string) => BREEDS[species]?.find((b) => b.id === id) ?? BREEDS[species]?.[0];

/** The colourings a companion can have: its breed's own, or the species' coats. */
export const coatsFor = (species: Species, breed?: string): Coat[] => breedFor(species, breed)?.coats ?? COATS[species];

export const coatFor = (species: Species, id?: string, breed?: string): Coat => coatsFor(species, breed).find((c) => c.id === id) ?? coatsFor(species, breed)[0];

export const PERSONALITIES: { id: Personality; label: string; blurb: string }[] = [
  { id: "playful", label: "Playful", blurb: "Bouncy, loud about good days" },
  { id: "calm", label: "Calm", blurb: "Soft-spoken, naps a lot" },
  { id: "sassy", label: "Sassy", blurb: "Side-eye, dry jokes" },
  { id: "wise", label: "Wise", blurb: "Few words, all of them true" },
];

export const NAMES: Record<Species, string[]> = {
  dog: ["Biscuit", "Mochi", "Pepper", "Bean"], cat: ["Miso", "Luna", "Pixel", "Olive"],
  fox: ["Ember", "Rusty", "Juniper", "Maple"],
};

const TUXEDO = { dark: [0x35, 0x3d, 0x4f], light: [0xf4, 0xf4, 0xf4], lo: 0.5, hi: 0.7 };

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

import { coatsFor } from "./pets";
import type { Mood } from "./Companion";
import type { Species } from "./types";

/** The still portrait of a pet (public/portraits, made by scripts/portraits.cjs): happy, idle or sad. */
export function portraitSrc(species: Species, breed: string | undefined, coat: string | undefined, mood: Mood): string {
  const b = species === "dog" ? (breed ?? "shiba") : "_";
  const m = mood === "happy" ? "happy" : mood === "sad" || mood === "hurt" || mood === "sick" || mood === "dying" ? "sad" : "idle";
  return `portraits/${species}-${b}-${coat ?? coatsFor(species, species === "dog" ? b : undefined)[0].id}-${m}.png`;
}

import { mix } from "./pets";

export type SceneMood = "storm" | "overcast" | "clearing" | "clear" | "golden";
export type SceneTime = "day" | "dusk" | "night";

export interface SceneInput { wellness: number; rescue: boolean; slipToday: boolean; milestoneToday: boolean; hour: number }
export interface Scene {
  mood: SceneMood; time: SceneTime; rain: number; ink: "light" | "dark";
  skyTop: string; skyBottom: string; ground: string; light: { color: string; intensity: number };
}

const TABLE: Record<SceneMood, { top: string; bottom: string; ground: string; light: string; intensity: number }> = {
  storm: { top: "#3E4650", bottom: "#5B636B", ground: "#4A4640", light: "#C9D3DD", intensity: 0.9 },
  overcast: { top: "#8D969E", bottom: "#B4BAC0", ground: "#6E6A5E", light: "#E6E9EC", intensity: 1.2 },
  clearing: { top: "#A9C3D6", bottom: "#D9E4EA", ground: "#7C8B5E", light: "#F4F1EA", intensity: 1.4 },
  clear: { top: "#7FB2DA", bottom: "#CFE3EF", ground: "#6F9450", light: "#FFF8EE", intensity: 1.6 },
  golden: { top: "#E8B57A", bottom: "#F6DDBA", ground: "#8A9A4E", light: "#FFE2B8", intensity: 1.7 },
};

export const sceneTime = (hour: number): SceneTime => (hour >= 6 && hour < 17 ? "day" : hour >= 17 && hour < 20 ? "dusk" : "night");

/** The weather and light of the pet's scene, from how well it is and what the day holds. Pure: no DOM, no clock. */
export function sceneFor({ wellness, rescue, slipToday, milestoneToday, hour }: SceneInput): Scene {
  let mood: SceneMood = milestoneToday || wellness >= 95 ? "golden" : wellness >= 80 ? "clear" : wellness >= 60 ? "clearing" : wellness >= 40 ? "overcast" : "storm";
  if (rescue && (mood === "clear" || mood === "golden") && wellness < 95) mood = "clearing";
  const time = sceneTime(hour);
  const row = TABLE[mood];
  let skyTop = row.top, skyBottom = row.bottom, ground = row.ground, intensity = row.intensity;
  if (time === "dusk") { skyTop = mix(skyTop, "#4A3A33", 0.35); skyBottom = mix(skyBottom, "#4A3A33", 0.35); intensity *= 0.8; }
  if (time === "night") { skyTop = mix(skyTop, "#0B0F14", 0.7); skyBottom = mix(skyBottom, "#0B0F14", 0.7); ground = mix(ground, "#0B0F14", 0.5); intensity *= 0.55; }
  return {
    mood, time, ink: mood === "storm" || mood === "overcast" || time === "night" ? "light" : "dark",
    rain: mood === "storm" ? 24 : mood === "overcast" ? 10 : slipToday ? 12 : 0,
    skyTop, skyBottom, ground, light: { color: row.light, intensity },
  };
}

export type Period = "morning" | "afternoon" | "evening" | "night" | "midnight";
export type Season = "winter" | "spring" | "summer" | "autumn";
export interface Ambient { period: Period; season: Season }

export const periodOf = (hour: number): Period =>
  hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : hour >= 17 && hour < 20 ? "evening" : hour >= 20 ? "night" : "midnight";
/** Northern-hemisphere months: Dec-Feb winter, Mar-May spring, Jun-Aug summer, Sep-Nov autumn. */
export const seasonOf = (month: number): Season => (month === 11 || month <= 1 ? "winter" : month <= 4 ? "spring" : month <= 7 ? "summer" : "autumn");
/** The sun or moon and the season's touch behind the pet, or null when the person has turned it off (Me, Appearance). */
export const ambientFor = (now: Date, on: boolean): Ambient | null => (on ? { period: periodOf(now.getHours()), season: seasonOf(now.getMonth()) } : null);

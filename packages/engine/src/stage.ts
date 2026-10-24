export type Stage = "baby" | "young" | "adult" | "middle" | "old" | "frail" | "dead";

export function stageForAge(age: number): Stage {
  if (age >= 100) return "dead";
  if (age >= 80) return "frail";
  if (age >= 70) return "old";
  if (age >= 50) return "middle";
  if (age >= 30) return "adult";
  if (age >= 10) return "young";
  return "baby";
}

export const STAGE_LABEL: Record<Stage, string> = {
  baby: "Baby", young: "Young", adult: "Adult", middle: "Middle-aged",
  old: "Old", frail: "Frail", dead: "Gone",
};

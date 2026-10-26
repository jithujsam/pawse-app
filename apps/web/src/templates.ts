import { DEFAULT_CLASS_WEIGHTS, type HabitClass } from "@detox/engine";

export const weightFor = (cls: HabitClass) => DEFAULT_CLASS_WEIGHTS[cls];

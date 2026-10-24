import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";

/** Counts smoothly from the last value to the new one. */
export function AnimatedNumber({ value, decimals = 0, format, from }: { value: number; decimals?: number; format?: (n: number) => string; from?: number }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(from ?? value);
  const text = useTransform(mv, (v) => {
    const r = Number(v.toFixed(decimals));
    return format ? format(r) : r.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  });
  useEffect(() => {
    if (reduce) { mv.set(value); return; }
    const c = animate(mv, value, { type: "spring", stiffness: 90, damping: 22 });
    return () => c.stop();
  }, [value, reduce, mv]);
  return <motion.span className="num">{text}</motion.span>;
}

/**
 * The page's small behaviours, without React: the phone menu and the entrances. The questions are native
 * <details>. Everything here only enhances markup that already reads in full without script.
 */
const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T & Element>(s) as T | null;
const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll<T & Element>(s)] as T[];
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function menu() {
  const btn = $<HTMLButtonElement>(".nav-toggle"), links = $("#nav-links");
  if (!btn || !links) return;
  const set = (open: boolean) => { btn.setAttribute("aria-expanded", String(open)); links.toggleAttribute("data-open", open); };
  btn.addEventListener("click", () => set(btn.getAttribute("aria-expanded") !== "true"));
  links.addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("a")) set(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") { set(false); btn.focus(); } });
}

/** Each section's parts rise in once, heading first. Content is visible without script and under reduced motion. */
function entrances() {
  if (reduced() || !("IntersectionObserver" in window)) return;
  const groups = $$("[data-rise]");
  groups.forEach((g) => $$(":scope > *", g).forEach((c, i) => c.style.setProperty("--i", String(i))));
  document.documentElement.classList.add("rise-ready");
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  groups.forEach((g) => io.observe(g));
}

export function wire() {
  menu();
  entrances();
}

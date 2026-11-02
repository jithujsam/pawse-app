/**
 * The page's small behaviours, without React: the phone menu, the tool list, the questions, the pinned Missions
 * screen and the entrances. Everything here only enhances markup that already reads in full without script.
 */
const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T & Element>(s) as T | null;
const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll<T & Element>(s)] as T[];
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const wide = () => matchMedia("(min-width: 900px)").matches;

function menu() {
  const btn = $<HTMLButtonElement>(".nav-toggle"), links = $("#nav-links");
  if (!btn || !links) return;
  const set = (open: boolean) => { btn.setAttribute("aria-expanded", String(open)); links.toggleAttribute("data-open", open); };
  btn.addEventListener("click", () => set(btn.getAttribute("aria-expanded") !== "true"));
  links.addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("a")) set(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") { set(false); btn.focus(); } });
}

/** The tools, set as the app's own command list: type to filter, arrows or hover to move, the screen follows. */
function tools() {
  const root = $(".tools");
  if (!root) return;
  const input = $<HTMLInputElement>(".tools-search", root);
  const rows = $$<HTMLButtonElement>(".tool", root);
  const shots = $$<HTMLImageElement>(".tools-shot img", root);
  const empty = $(".tools-empty", root);
  const select = (row: HTMLButtonElement | undefined) => {
    if (!row) return;
    rows.forEach((r) => r.setAttribute("aria-selected", String(r === row)));
    shots.forEach((s) => s.toggleAttribute("data-on", s.dataset.tool === row.dataset.tool));
  };
  const visible = () => rows.filter((r) => !r.parentElement!.hidden);
  rows.forEach((r) => {
    r.addEventListener("click", () => select(r));
    r.addEventListener("pointerenter", (e) => { if ((e as PointerEvent).pointerType === "mouse") select(r); });
    r.addEventListener("focus", () => select(r));
  });
  input?.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    rows.forEach((r) => { r.parentElement!.hidden = !!q && !r.textContent!.toLowerCase().includes(q); });
    if (empty) empty.hidden = visible().length > 0;
    const cur = rows.find((r) => r.getAttribute("aria-selected") === "true");
    if (!cur || cur.parentElement!.hidden) select(visible()[0]);
  });
  root.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const vis = visible(), i = vis.findIndex((r) => r.getAttribute("aria-selected") === "true");
    const next = vis[Math.max(0, Math.min(vis.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
    if (next) { e.preventDefault(); select(next); next.focus(); }
  });
  select(rows[0]);
}

/** Questions on the left, the chosen answer large on the right (on a phone, it opens under its question). */
function faq() {
  const root = $(".faq");
  const pane = $(".faq-pane");
  if (!root || !pane) return;
  const qs = $$<HTMLButtonElement>(".faq-q", root);
  const show = (q: HTMLButtonElement) => {
    qs.forEach((x) => {
      const on = x === q;
      x.setAttribute("aria-expanded", String(on));
      $(`#${x.getAttribute("aria-controls")}`)!.hidden = wide() || !on;
    });
    pane.innerHTML = $(`#${q.getAttribute("aria-controls")}`)!.innerHTML;
    pane.dataset.q = q.id;
    if (!reduced()) { pane.classList.remove("swap"); void pane.offsetWidth; pane.classList.add("swap"); }
  };
  qs.forEach((q) => {
    q.addEventListener("click", () => show(q));
    q.addEventListener("focus", () => { if (wide()) show(q); });
    q.addEventListener("pointerenter", (e) => { if (wide() && (e as PointerEvent).pointerType === "mouse") show(q); });
  });
  root.classList.add("faq-live");
  show(qs[0]);
  matchMedia("(min-width: 900px)").addEventListener("change", () => show(qs.find((q) => q.getAttribute("aria-expanded") === "true") ?? qs[0]));
}

/** The Missions screen stays pinned while the three stages pass; it crossfades to the matching screen. */
function stages() {
  const steps = $$("[data-stage]");
  const shots = $$<HTMLImageElement>(".stages-shot img");
  if (!steps.length || !shots.length) return;
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) {
      const k = (e.target as HTMLElement).dataset.stage;
      shots.forEach((s) => s.toggleAttribute("data-on", s.dataset.stage === k));
      steps.forEach((s) => s.toggleAttribute("data-on", s === e.target));
    }
  }, { rootMargin: "-45% 0px -45% 0px" });
  steps.forEach((s) => io.observe(s));
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
  tools();
  faq();
  stages();
  entrances();
}

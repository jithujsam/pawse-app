import { wellness } from "@detox/engine";

/**
 * The page's behaviours, without a framework. Everything here enhances markup that already reads in full without script,
 * and every move has a prefers-reduced-motion fallback that keeps the content and drops the travel.
 */
const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T & Element>(s) as T | null;
const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll<T & Element>(s)] as T[];
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Event hooks, off by default (site.config.ts: analyticsHooks). When on: a "pawse:event" CustomEvent, plus dataLayer if present. */
function track(name: string) {
  if ($<HTMLMetaElement>('meta[name="pawse-analytics"]')?.content !== "on") return;
  window.dispatchEvent(new CustomEvent("pawse:event", { detail: { name } }));
  (window as unknown as { dataLayer?: unknown[] }).dataLayer?.push({ event: name });
}

function events() {
  document.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-event]");
    if (el?.dataset.event) track(el.dataset.event);
  });
}

/** Parts rise in once as they enter. Visible without script and under reduced motion. */
function reveals() {
  if (reduced() || !("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("reveal-ready");
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
  $$("[data-reveal]").forEach((el, i) => { el.style.setProperty("--d", `${(i % 3) * 80}ms`); io.observe(el); });
}

/** A gentle parallax on the hero: the pet drifts up a little more slowly than the page. Transform only. */
function parallax() {
  const stage = $("[data-parallax]");
  const dog = stage && $(".stage-dog", stage);
  if (!stage || !dog || reduced()) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = Math.min(window.scrollY, 900);
    dog.style.setProperty("--py", `${(-y * 0.08).toFixed(1)}px`);
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
}

/**
 * The journey: the app's own wellness rule for a rescued dog (@detox/engine), driven by one slider. The conditions
 * light up on the days they heal in the app (1, 3, 6, 10, 15, 21), and the dog cross-fades from the day-0 render to the healed one.
 */
function journey() {
  const root = $("[data-journey]");
  const slider = root && $<HTMLInputElement>("[data-scrub]", root);
  if (!root || !slider) return;
  const day = $("[data-day]", root)!, well = $("[data-wellness]", root)!, happy = $<HTMLElement>("[data-happy]", root)!;
  const bars = $$("i", $(".wbar", root)!), items = $$("[data-at]", root), none = $("[data-none]", root)!;
  const set = (n: number) => {
    const w = wellness({ mode: "rescue", phase: "recovery", run: n, issue: null });
    day.textContent = String(n); well.textContent = String(w);
    bars.forEach((b, i) => b.toggleAttribute("data-on", i < w / 5));
    items.forEach((li) => li.toggleAttribute("data-on", n >= Number(li.dataset.at)));
    none.hidden = n > 0;
    // The dog dulls to vivid as it heals (a colour change only), then the healed render takes over on day 21.
    const t = n / 21, sad = $<HTMLElement>(".jd-sad", root)!;
    sad.style.setProperty("--sat", String(0.55 + 0.45 * t)); sad.style.setProperty("--bri", String(0.86 + 0.14 * t));
    sad.style.opacity = n >= 21 ? "0" : "1"; happy.style.opacity = n >= 21 ? "1" : "0";
    slider.value = String(n);
    slider.setAttribute("aria-valuetext", `Day ${n}, wellness ${w} of 100`);
  };
  set(0);
  slider.addEventListener("input", () => { stopped = true; set(Number(slider.value)); });
  let stopped = false;
  if (reduced() || !("IntersectionObserver" in window)) return;
  // Once, as it scrolls into view, show the first eight days by themselves (unless the visitor has already touched it).
  const io = new IntersectionObserver((es) => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    let n = 0;
    const t = setInterval(() => { if (stopped || n >= 8) return clearInterval(t); set(++n); }, 260);
  }, { threshold: 0.5 });
  io.observe($(".journey-stage", root)!);
}

/** Copies the UPI ID. The ID is plain text on the page, so this only saves typing. */
function copyButtons() {
  $$<HTMLButtonElement>("[data-copy]").forEach((btn) => {
    const label = btn.textContent ?? "";
    btn.addEventListener("click", async () => {
      const text = $(btn.dataset.copy ?? "")?.textContent?.trim();
      if (!text) return;
      try { await navigator.clipboard.writeText(text); btn.textContent = "Copied"; } catch { btn.textContent = "Select and copy"; }
      setTimeout(() => { btn.textContent = label; }, 1800);
    });
  });
}

/**
 * The payment-confirmation and waitlist forms post to the address filled in at build time (VITE_FORM_ENDPOINT, see
 * site.config.ts). Without script they submit normally; with it, the form is replaced by a thank-you in place.
 * No card data is ever handled: the payment form carries a name, an email and a payment reference.
 */
function forms() {
  $$<HTMLFormElement>("form[data-form]").forEach((form) => {
    const error = $<HTMLElement>(".form-error", form);
    const done = form.nextElementSibling as HTMLElement | null;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const button = $<HTMLButtonElement>("button[type=submit]", form);
      if (button) button.disabled = true;
      if (error) error.hidden = true;
      try {
        const res = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(String(res.status));
        track(form.dataset.eventSubmit ?? "form_submit");
        form.hidden = true;
        if (done) { done.hidden = false; done.focus(); }
      } catch {
        if (error) error.hidden = false;
        if (button) button.disabled = false;
      }
    });
  });
}

export function wire() {
  events();
  reveals();
  parallax();
  journey();
  copyButtons();
  forms();
}

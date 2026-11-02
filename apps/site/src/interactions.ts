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
 * No card data is ever handled here: the form only carries a name, an email and a payment reference.
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
  menu();
  entrances();
  copyButtons();
  forms();
}

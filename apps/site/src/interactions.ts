/**
 * The only script on the page. It opens and closes the two panels (payment and waitlist), copies the UPI ID and
 * sends the two forms. Everything else is plain HTML and CSS: no animation, no scroll effects.
 */
const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T & Element>(s) as T | null;
const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll<T & Element>(s)] as T[];

/** Buttons with data-open="pay" or "waitlist" open that panel. A click on the dark backdrop, or Close, shuts it. */
function panels() {
  $$("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dlg = $<HTMLDialogElement>(`#${btn.dataset.open}`);
      dlg?.showModal();
    });
  });
  $$<HTMLDialogElement>("dialog.panel").forEach((dlg) => {
    $$("[data-close]", dlg).forEach((b) => b.addEventListener("click", () => dlg.close()));
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  });
}

/** Copies the UPI ID. The ID is plain text on the page, so this only saves typing. */
function copyButtons() {
  $$<HTMLButtonElement>("[data-copy]").forEach((btn) => {
    const label = btn.textContent ?? "";
    btn.addEventListener("click", async () => {
      const text = $(btn.dataset.copy ?? "")?.textContent?.trim();
      if (!text) return;
      try { await navigator.clipboard.writeText(text); btn.textContent = btn.dataset.copied ?? ""; } catch { btn.textContent = btn.dataset.copyFail ?? ""; }
      setTimeout(() => { btn.textContent = label; }, 1800);
    });
  });
}

/** Both forms post to the address filled in at build time (see site.config.ts), then swap themselves for a thank-you. */
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
  panels();
  copyButtons();
  forms();
}

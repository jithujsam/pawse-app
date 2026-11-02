/**
 * Everything you edit by hand for the Founding Member offer lives in this one file.
 * Values are filled into index.html at build time (see `siteHtml` in vite.config.ts), so the page reads in full
 * without JavaScript. After editing, run `pnpm --filter site build` (or restart `pnpm --filter site dev`).
 */
export const config = {
  /** Price in rupees, one time. */
  priceInr: 249,
  /** Shown as "about $3" for visitors outside India. */
  priceUsdApprox: 3,

  /** The first N Founding Members. Spots left = spotsTotal - spotsTaken. Change spotsTaken by hand after each confirmed payment. */
  spotsTotal: 50,
  spotsTaken: 0,

  /** The refund line next to the button. */
  refundWindow: "until the Google Play launch",

  // ---- India: UPI -------------------------------------------------------------------------------------------
  /** TODO: replace with your real UPI ID. While it starts with "TODO" the "Pay in your UPI app" button is hidden. */
  upiId: "TODO-your-upi-id@bank",
  /** The name people see when they pay. */
  upiPayeeName: "Pawse",
  /** TODO: put your QR image in apps/site/public/pay/ and set its path here, e.g. "/pay/upi-qr.png". Empty shows a placeholder. */
  qrImage: "",

  // ---- Outside India ----------------------------------------------------------------------------------------
  /** TODO: an external payment link (PayPal.me, Ko-fi, Stripe Payment Link, ...). Empty hides the button. */
  internationalPaymentLink: "",

  // ---- Forms ------------------------------------------------------------------------------------------------
  /**
   * Where the payment form and the waitlist form post to. Prefer the environment variables so the address is not in git:
   *   VITE_FORM_ENDPOINT      the payment confirmation form (for example a Formspree or Web3Forms form URL)
   *   VITE_WAITLIST_ENDPOINT  the Google Play waitlist (optional; falls back to VITE_FORM_ENDPOINT)
   * The values below are only used when the variables are not set. Empty means "not connected yet".
   */
  formEndpoint: "",
  waitlistEndpoint: "",
};

export type SiteConfig = typeof config;

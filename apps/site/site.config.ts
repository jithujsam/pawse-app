/**
 * Every value you edit by hand lives in this one file (and every word lives in src/copy.ts).
 * After editing, run `pnpm --filter site build` (or restart `pnpm --filter site dev`).
 *
 * The pay button only shows when ALL THREE of these are filled in: upiId, qrImage and a payment form address.
 * If any is empty, the page shows the Google Play waitlist instead and says nothing about setup.
 */
export const config = {
  /** Price in rupees, one time. */
  priceInr: 249,

  /** Total Founding Member spots. */
  spotsTotal: 50,
  /**
   * Spots left. While this is the same as spotsTotal (or higher) the page says "First 50 spots".
   * Set it below spotsTotal and the page says "N of 50 spots left". At 0 the pay button is hidden and the waitlist shows.
   * Change it by hand after each confirmed payment.
   */
  spotsLeft: 50,

  /** Shown in the Founding Member box: "Full refund until ...". */
  refundWindow: "the Google Play launch",

  // ---- UPI ---------------------------------------------------------------------------------------------------
  /** Your UPI ID, for example "name@bank". Empty hides the pay button. */
  upiId: "",
  /** The name people see when they pay. */
  upiPayeeName: "Pawse",
  /** Your UPI QR image. Put the file in apps/site/public/pay/ and set its path, for example "/pay/upi-qr.png". Empty hides the pay button. */
  qrImage: "",

  // ---- Forms -------------------------------------------------------------------------------------------------
  /**
   * Where the payment form and the waitlist form post to. Prefer the environment variables so the address is not in git:
   *   VITE_FORM_ENDPOINT      the payment confirmation form (for example a Formspree or Web3Forms form URL)
   *   VITE_WAITLIST_ENDPOINT  the Google Play waitlist (optional; falls back to VITE_FORM_ENDPOINT)
   * The values below are only used when the variables are not set. Empty means "not connected".
   */
  formEndpoint: "",
  waitlistEndpoint: "",

  // ---- Page ----------------------------------------------------------------------------------------------------
  /** The public address of the page, with no trailing slash, for example "https://pawse.app". Empty leaves out the canonical and og:url tags. */
  siteUrl: "",
  /** Where the footer "Privacy" link goes. Empty links to the privacy answer on this page. */
  privacyUrl: "",
};

export type SiteConfig = typeof config;

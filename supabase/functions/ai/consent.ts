/**
 * AI writing is opt-in. The person's choice is `aiConsent` in their profile settings (the app syncs it there), so the server
 * can enforce it for every app version instead of trusting each one to ask. Anything but a literal `true` is a no.
 */
export const consentGiven = (settings: unknown): boolean =>
  !!settings && typeof settings === "object" && (settings as { aiConsent?: unknown }).aiConsent === true;

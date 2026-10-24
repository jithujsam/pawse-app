const PATTERNS = [
  /\bkill (myself|me)\b/i, /\bsuicid/i, /\bend (it all|my life)\b/i, /\bwant to die\b/i,
  /\bhurt(ing)? myself\b/i, /\bself[- ]?harm/i, /\bno reason to live\b/i, /\bbetter off dead\b/i,
  /\btake my (own )?life\b/i, /\bdon'?t want to (live|be alive|be here anymore)\b/i, /\bcan'?t go on\b/i, /\bend myself\b/i,
];
export const hasCrisisLanguage = (text: string) => PATTERNS.some((p) => p.test(text));

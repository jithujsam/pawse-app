// Two-device end-to-end test against the live Supabase project. Needs `vite preview` on :4173.
// Run: node apps/web/test/e2e-live.cjs <screenshot-dir>. Creates a throwaway account and deletes it at the end (set KEEP=1 to keep it).
const { chromium } = require('playwright');
const out = process.argv[2];
const email = `companion.e2e.live.${Date.now()}@mailinator.com`;
const password = 'Tq7!vRmz-e2e-Companion';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function phone(b, name) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(`${name} pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) p.errs.push(`${name} console: ${m.text()}`); });
  p.shot = (n) => p.screenshot({ path: `${out}/${name}-${n}.png` });
  p.btn = (n) => p.getByRole('button', { name: n, exact: true }).first();
  return { ctx, p };
}

(async () => {
  const b = await chromium.launch();
  log('account', email);

  // ---------- Phone A: sign up, onboard, log a slip ----------
  const A = await phone(b, 'A'); const a = A.p;
  await a.goto('http://localhost:4173/');
  await a.btn('Skip').click();
  await a.getByLabel('Email').fill(email);
  await a.getByLabel('Password', { exact: true }).fill(password);
  await a.getByRole('button', { name: 'Create account' }).last().click();
  await a.getByRole('heading', { name: 'Choose your companion' }).waitFor({ timeout: 20000 });
  log('A: signed up, no email needed, onboarding shown');
  await a.btn('Continue').click();
  await a.getByLabel('Companion name').fill('Pepper'); await a.btn('Continue').click();
  await a.getByRole('button', { name: "Ordering food I didn't plan" }).click(); await a.btn('Continue').click();
  await a.getByRole('button', { name: 'About once a day' }).click(); await a.btn('Continue').click();
  await a.getByRole('button', { name: "When I'm stressed" }).click(); await a.btn('Continue').click();
  await a.btn('Continue').click(); await a.btn('Not now').click();
  await a.getByRole('switch').click(); await a.btn('Meet Pepper').click();
  await a.btn("Let's go").click({ timeout: 10000 });
  await a.btn('Skip').click({ timeout: 5000 }).catch(() => {});
  log('A: onboarded');
  await a.btn('I slipped').click();
  await a.getByLabel('How much did you spend?').fill('450');
  await a.getByRole('button', { name: 'Delivery order' }).click();
  await a.getByRole('button', { name: 'Stressed' }).click();
  await a.getByRole('radio', { name: '4 of 5' }).click();
  await a.btn('Save slip').click();
  await a.waitForTimeout(6000);
  const line = await a.locator('.bubble').first().textContent();
  const aiTag = await a.locator('.ai-tag').count();
  log(`A: slip saved. Explanation: "${line.trim()}" (${aiTag ? 'AI' : 'app wording, AI unavailable'})`);
  await a.shot('1-slip-result');
  await a.btn('Done').click();
  await a.waitForTimeout(5000);
  await a.btn('You').click(); await a.waitForTimeout(1500);
  log('A: sync status:', (await a.locator('.sync-line').first().textContent()).trim());
  await a.shot('2-you-synced');

  // ---------- Phone B: new device, same account ----------
  const B = await phone(b, 'B'); const p = B.p;
  await p.goto('http://localhost:4173/');
  await p.btn('Skip').click();
  await p.getByRole('radio', { name: 'Sign in' }).click();
  await p.getByLabel('Email').fill(email);
  await p.getByLabel('Password', { exact: true }).fill(password);
  await p.getByRole('button', { name: 'Sign in' }).last().click();
  await p.locator('.hero-name h2').waitFor({ timeout: 25000 });
  log(`B: restored companion "${await p.locator('.hero-name h2').textContent()}", slips this week: ${(await p.locator('.stat .v').first().textContent()).trim()}`);
  await p.btn('Skip').click({ timeout: 4000 }).catch(() => {});
  await p.shot('3-restored');

  // B goes offline, deletes the slip and changes the tone
  await B.ctx.setOffline(true);
  await p.btn('Calendar').click(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: 'Delete this slip' }).click();
  await p.btn('You').click(); await p.waitForTimeout(800);
  await p.getByRole('radio', { name: 'Gentle' }).click();
  await p.waitForTimeout(3000);
  log('B: offline, deleted the slip and set tone Gentle. Sync status:', (await p.locator('.sync-line').first().textContent()).trim());
  await p.shot('4-offline');
  await B.ctx.setOffline(false);
  await p.evaluate(() => window.dispatchEvent(new Event('online')));
  await p.waitForTimeout(6000);
  log('B: back online. Sync status:', (await p.locator('.sync-line').first().textContent()).trim());

  // A picks up B's changes
  await a.reload(); await a.waitForTimeout(8000);
  await a.btn('Skip').click({ timeout: 3000 }).catch(() => {});
  const slipsA = (await a.locator('.stat .v').first().textContent()).trim();
  await a.btn('You').click(); await a.waitForTimeout(1200);
  const toneA = await a.locator('[role="radio"][aria-checked="true"]').first().textContent();
  log(`A: after B's offline changes synced -> slips this week ${slipsA}, tone ${toneA}`);
  await a.shot('5-a-updated');

  console.log('EMAIL=' + email);
  // ---------- delete account from B ----------
  if (process.env.KEEP) { console.log('kept account for DB checks'); await b.close(); return; }
  await p.btn('Delete account').click();
  await p.btn('Delete my account for good').click();
  await p.getByRole('heading', { name: /Your habits/ }).waitFor({ timeout: 15000 }).catch(() => {});
  log('B: account deleted, back at:', (await p.locator('h1').first().textContent()).trim());
  await p.shot('6-deleted');

  const errs = [...a.errs, ...p.errs];
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
})().catch((e) => { console.error('FAIL', e.message.split('\n')[0]); process.exit(1); });

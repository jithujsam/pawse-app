// Two-phone end-to-end test against the live Supabase project. Needs `pnpm dev` on :5173.
// Run: node apps/web/test/e2e-live.cjs <screenshot-dir>. Creates a throwaway account and deletes it at the end (KEEP=1 keeps it).
const { chromium } = require('playwright');
const out = process.argv[2];
const email = `pawse.e2e.${Date.now()}@mailinator.com`;
const password = 'Tq7!vRmz-e2e-Pawse';
const URL = process.env.APP_URL || 'http://localhost:5173/';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const results = [];
const check = (name, ok, detail = '') => { results.push([ok ? 'PASS' : 'FAIL', name, detail]); log(ok ? 'PASS' : 'FAIL', name, detail); };

async function phone(b, name) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(`${name} pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|status of 4/.test(m.text())) p.errs.push(`${name} console: ${m.text()}`); });
  p.shot = (n) => p.screenshot({ path: `${out}/${name}-${n}.png` });
  p.btn = (n) => p.getByRole('button', { name: n, exact: true }).first();
  p.nav = (n) => p.locator('nav').getByRole('button', { name: n, exact: true }).click();
  p.syncNow = async () => { await p.evaluate(async () => (await import('/src/sync.ts')).syncNow()); };
  p.rows = (table) => p.evaluate(async (t) => { const { supabase } = await import('/src/supabase.ts'); const { data, error } = await supabase.from(t).select('*'); return error ? { error: error.message } : data; }, table);
  return { ctx, p };
}

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  log('account', email);

  // ---------- Phone A: sign up and set up a fox ----------
  const A = await phone(b, 'A'); const a = A.p;
  await a.goto(URL);
  await a.btn('Skip').click();
  await a.getByLabel('Email').fill(email);
  await a.getByLabel('Password', { exact: true }).fill(password);
  await a.getByRole('button', { name: 'Create account' }).last().click();
  await a.getByRole('heading', { name: 'Choose your companion' }).waitFor({ timeout: 20000 });
  check('sign up without email confirmation', true);
  await a.getByRole('radio', { name: /Fox/ }).click(); await a.btn('Continue').click();
  await a.getByRole('button', { name: /Silver/ }).click(); await a.getByRole('radio', { name: /Sassy/ }).click(); await a.btn('Continue').click();
  await a.getByLabel('Companion name').fill('Ember'); await a.btn('Continue').click();
  await a.getByRole('button', { name: "Ordering food I didn't plan" }).click(); await a.btn('Continue').click();
  await a.getByRole('button', { name: 'About once a day' }).click(); await a.btn('Continue').click();
  await a.getByRole('button', { name: "When I'm stressed" }).click(); await a.btn('Continue').click();
  await a.btn('Continue').click(); await a.btn('Not now').click();
  await a.getByRole('switch').click(); await a.btn('Meet Ember').click();
  await a.btn("Let's go").click({ timeout: 10000 });
  await a.btn('Skip').click({ timeout: 5000 }).catch(() => {});
  await a.locator('.hero-name h2').waitFor();
  check('onboarding finished', (await a.locator('.hero-name h2').textContent()) === 'Ember');
  await a.waitForTimeout(3000);
  check('3D fox rendered on Home', (await a.locator('.pet3d canvas').count()) > 0);
  await a.shot('1-home');

  // A slip, with the AI explanation
  await a.btn('I slipped').click();
  await a.getByLabel('How much did you spend?').fill('450');
  await a.getByRole('button', { name: 'Delivery order' }).click();
  await a.getByRole('button', { name: 'Stressed' }).click();
  await a.getByRole('radio', { name: '4 of 5' }).click();
  await a.btn('Save slip').click();
  await a.locator('.ai-tag').waitFor({ timeout: 15000 }).catch(() => {});
  const line = (await a.locator('.bubble').first().textContent()).trim();
  check('slip saved with explanation', line.length > 10, `"${line}" (${(await a.locator('.ai-tag').count()) ? 'AI' : 'app wording'})`);
  await a.shot('2-slip');
  await a.btn('Done').click(); await a.waitForTimeout(800);

  // Health sheet
  await a.locator('.vital').first().click(); await a.waitForTimeout(800);
  const heart = (await a.locator('.health-num').textContent()).replace(/\D+.*/, '');
  check('health heart after a slip is capped at 80', Number(heart) <= 80, `heart ${heart}`);
  await a.getByRole('tab', { name: 'Conditions' }).click(); await a.waitForTimeout(500);
  check('conditions show the appetite issue with recovery days', /Off their food/.test(await a.locator('.cond').first().textContent()));
  await a.getByRole('tab', { name: 'History' }).click(); await a.waitForTimeout(500);
  check('history records the lifespan cost', /lost .* months of lifespan/.test(await a.locator('.timeline').textContent()));
  await a.shot('3-health');
  await a.keyboard.press('Escape'); await a.waitForTimeout(500);

  // Urge ridden out
  await a.getByRole('button', { name: 'Log or check in' }).click();
  await a.locator('.quick-tile', { hasText: 'Having an urge' }).click(); await a.waitForTimeout(500);
  await a.getByRole('button', { name: /Ride it out with/ }).click(); await a.waitForTimeout(21000);
  await a.btn('It passed').click(); await a.waitForTimeout(800);
  check('urge ridden out', /ridden out so far/.test(await a.locator('.urge-won').textContent()));
  await a.getByRole('button', { name: /Back to/ }).click(); await a.waitForTimeout(600);

  // Reflection
  await a.nav('Journey'); await a.waitForTimeout(800);
  await a.getByRole('radio', { name: 'Good' }).click();
  await a.locator('.reflect textarea').fill('E2E: walked instead of ordering.');
  await a.btn('Save reflection').click(); await a.waitForTimeout(500);

  // Sync and verify the server rows (read back under row-level security as this user)
  await a.syncNow(); await a.waitForTimeout(3000); await a.syncNow();
  const comp = await a.rows('companions'), urges = await a.rows('urges'), journal = await a.rows('journal'), entries = await a.rows('entries'), prof = await a.rows('profiles');
  check('companion synced with species, coat and personality', comp[0]?.species === 'fox' && comp[0]?.coat === 'silver' && comp[0]?.personality === 'sassy', JSON.stringify(comp.map((c) => [c.species, c.coat, c.personality])));
  check('slip synced', entries.length === 1);
  check('urge synced', urges.length === 1 && urges[0].outcome === 'rode_it_out', JSON.stringify(urges.error || urges.map((u) => u.outcome)));
  check('reflection synced', journal.length === 1 && journal[0].mood === 4, JSON.stringify(journal.error || journal.map((j) => j.body)));
  check('settings synced (12-hour reminder, region currency, quiet-days start)', !!prof[0]?.settings?.neglectFrom && !!prof[0]?.settings?.currency, JSON.stringify({ currency: prof[0]?.settings?.currency, neglectFrom: prof[0]?.settings?.neglectFrom, reminder: prof[0]?.settings?.reminder }));
  await a.nav('Me'); await a.waitForTimeout(800);
  await a.locator('.srow', { hasText: 'Account and backup' }).click(); await a.waitForTimeout(800);
  log('A sync line:', (await a.locator('.sync-line').first().textContent()).trim());
  await a.shot('4-synced');
  await a.btn('Back').click();

  // ---------- Phone B: new phone, same account ----------
  const B = await phone(b, 'B'); const p = B.p;
  await p.goto(URL);
  await p.btn('Skip').click();
  await p.getByRole('radio', { name: 'Sign in' }).click();
  await p.getByLabel('Email').fill(email);
  await p.getByLabel('Password', { exact: true }).fill(password);
  await p.getByRole('button', { name: 'Sign in' }).last().click();
  await p.locator('.hero-name h2').waitFor({ timeout: 25000 });
  await p.btn('Skip').click({ timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(1500);
  check('B restored the companion', (await p.locator('.hero-name h2').textContent()) === 'Ember');
  await p.nav('Me'); await p.waitForTimeout(800);
  const profile = await p.locator('.profile-card').textContent();
  check('B restored fox, sassy personality', /Fox/.test(profile) && /Sassy/.test(profile), profile.trim());
  await p.nav('Insights'); await p.waitForTimeout(1200);
  check('B restored the urge', /Ridden out\s*1/.test(await p.locator('[aria-label="Urges"]').textContent()));
  await p.nav('Journey'); await p.waitForTimeout(800);
  check('B restored the reflection', (await p.locator('.reflect').textContent()).includes('Done today'));
  await p.shot('5-restored');

  // B offline: delete the slip, change the tone; then reconnect
  await B.ctx.setOffline(true);
  await p.getByRole('button', { name: 'Delete this slip' }).click();
  await p.nav('Me'); await p.waitForTimeout(500);
  await p.locator('.srow', { hasText: 'Voice' }).click(); await p.waitForTimeout(500);
  await p.getByRole('radio', { name: 'Gentle' }).click();
  await p.btn('Back').click();
  await p.waitForTimeout(2000);
  await B.ctx.setOffline(false);
  await p.evaluate(() => window.dispatchEvent(new Event('online')));
  await p.waitForTimeout(6000); await p.syncNow();

  // A picks up B's offline changes
  await a.reload(); await a.waitForTimeout(8000);
  await a.btn('Skip').click({ timeout: 3000 }).catch(() => {});
  const slipsA = (await a.locator('.stat .v').first().textContent()).trim();
  check('A sees the slip deleted on B', slipsA === '0', `slips this week ${slipsA}`);
  await a.nav('Me'); await a.waitForTimeout(600);
  check('A sees the tone changed on B', /Gentle/.test(await a.locator('.srow', { hasText: 'Voice' }).textContent()));

  console.log('EMAIL=' + email);
  if (!process.env.KEEP) {
    await p.nav('Me'); await p.waitForTimeout(500);
    await p.locator('.srow', { hasText: 'Account and backup' }).click(); await p.waitForTimeout(800);
    await p.btn('Delete account').click();
    await p.btn('Delete my account for good').click();
    await p.waitForTimeout(5000);
    const gone = await p.evaluate(async () => { const { supabase } = await import('/src/supabase.ts'); const { data } = await supabase.auth.getSession(); return !data.session; });
    check('account deleted and signed out', gone);
  }

  const errs = [...a.errs, ...p.errs];
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  console.log(`\n${results.filter((r) => r[0] === 'PASS').length}/${results.length} checks passed`);
  await b.close();
})().catch((e) => { console.error('FAIL', e.message.split('\n')[0]); process.exit(1); });

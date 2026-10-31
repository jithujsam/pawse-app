const { chromium } = require('playwright');
const combos = [['dog','shiba',['golden','cocoa','cream']],['dog','husky',['grey','black','red']],['fox','_',['red','arctic','silver']],['cat','_',['tabby','ginger','tuxedo']]];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 320, height: 320 } });
  for (const [sp, breed, coats] of combos) for (const coat of coats) for (const mood of ['happy','idle','sad']) {
    await p.goto(`http://localhost:5173/#gallery/solo3d/${sp}/${mood}/${breed}/${coat}`); await p.reload(); await p.waitForTimeout(3000);
    await (await p.$('#solo')).screenshot({ path: `public/portraits/${sp}-${breed}-${coat}-${mood}.png`, omitBackground: true });
  }
  await b.close();
})();

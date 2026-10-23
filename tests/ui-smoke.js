// UI smoke test: loads index.html + core.js in a simulated browser (jsdom), mocks Open Food Facts
// and Open Prices, and clicks through the app. No camera, network or real browser needed.
// Run: npm install  (once)  then  npm test   (or: node tests/ui-smoke.js)
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..') + path.sep;
let html = fs.readFileSync(dir + 'index.html', 'utf8');
const core = fs.readFileSync(dir + 'core.js', 'utf8');
html = html.replace('<script src="core.js"></script>', '<script>' + core + '</script>');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e.detail || e.message)));
vc.on('error', (e) => errors.push('console.error: ' + e));

const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    w.confirm = () => true;
    w.scrollTo = () => {};
    w.fetch = async (url, opts) => {
      if (String(url).startsWith('https://api.github.com/')) return global.ghMock(String(url), opts || {});
      if (String(url).endsWith('catalog/catalog.json')) return { ok: true, status: 200, json: async () => global.CATALOG };
      if (global.OFF_DOWN && String(url).includes('world.openfoodfacts.org')) throw new Error('offline');
      if (String(url).includes('prices.openfoodfacts.org')) {
        if (String(url).includes('4006381333931')) return { ok: true, json: async () => ({ items: [
          { price: 2.5, currency: 'EUR', price_per: 'KILOGRAM', date: '2026-10-01', location: { osm_name: 'X', osm_address_country: 'Nederland' } },
          { price: 1.79, currency: 'EUR', price_per: null, date: '2026-10-02', price_is_discounted: false, location: { osm_name: 'Albert Heijn', osm_address_country: 'Nederland' } }
        ] }) };
        return { ok: true, json: async () => ({ items: [] }) };
      }
      if (String(url).includes('openfoodfacts.org/api/v2/product/96385074') && (global.milkCalls = (global.milkCalls || 0) + 1) > 1) {
        return { ok: true, json: async () => ({ status: 1, product: {
          product_name: 'Rescanned Milk', brands: 'Farm', product_quantity: '1000', product_quantity_unit: 'ml',
          nutriments: { 'energy-kcal_100g': 46, proteins_100g: 3.5, fat_100g: 1.5, carbohydrates_100g: 4.7 } } }) };
      }
      if (String(url).includes('4006381333931')) {
        return { ok: true, json: async () => ({ status: 1, product: {
          product_name: 'Test Tuna', brands: 'Acme, Other', product_quantity: '112',
          nutriments: { 'energy-kcal_100g': 100, proteins_100g: 24, fat_100g: 1, carbohydrates_100g: 0, 'fiber_100g': 0 } } }) };
      }
      return { ok: true, json: async () => ({ status: 0 }) };
    };
  }
});
const w = dom.window, d = w.document;
const $ = (s) => d.querySelector(s);
let fails = 0;
function check(name, cond, extra) { if (!cond) { fails++; console.log('FAIL', name, extra || ''); } else console.log('ok  ', name); }
function type(sel, val) { const el = typeof sel === 'string' ? $(sel) : sel; el.value = val; el.dispatchEvent(new w.Event('input', { bubbles: true })); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // targets (training / rest)
  type('#t_train_p', '180'); type('#t_train_f', '60'); type('#t_train_c', '250');
  type('#t_rest_p', '180'); type('#t_rest_f', '60'); type('#t_rest_c', '150');
  check('train kcal computed', $('#t_train_kcal').value === String(4 * 180 + 9 * 60 + 4 * 250), $('#t_train_kcal').value);
  check('rest kcal computed', $('#t_rest_kcal').value === String(4 * 180 + 9 * 60 + 4 * 150), $('#t_rest_kcal').value);

  // manual item with comma decimals
  $('#btnManual').click();
  type('#f_name', 'Quark test');
  [['kcal', '57'], ['p', '10'], ['f', '0,2'], ['c', '3,8'], ['pack', '500'], ['price', '1,49']].forEach(([k, v]) => type('[data-k="' + k + '"]', v));
  type('#amt', '437');
  const txt = $('#results').textContent;
  check('results show scaled kcal', /249\s*kcal/.test(txt) || txt.includes('249'), txt.slice(0, 200));
  check('results show scaled protein 43.7', txt.includes('43.7'));
  check('fit shows both day types', $('#fit').textContent.includes('Training day') && $('#fit').textContent.includes('Training day') && $('#fit').textContent.includes('Rest day'));
  check('max amount row present', $('#fit').textContent.includes('Max amount'));
  check('cost per 100 g protein 2.98', txt.includes('€2.98'), txt);
  check('price date is dd/mm/yyyy', /\d{2}\/\d{2}\/\d{4}/.test($('#priceNote').textContent), $('#priceNote').textContent);

  // remaining today adds a column and computes kcal
  type('#r_p', '40'); type('#r_f', '10'); type('#r_c', '60');
  check('remaining kcal', $('#r_kcal').value === String(160 + 90 + 240), $('#r_kcal').value);
  check('left today column appears', $('#fit').textContent.includes('Left today'));
  const maxLeft = $('#fit').textContent;
  check('over/limit text shown', maxLeft.includes('limit:'));

  // barcode lookup via mocked Open Food Facts
  $('#barcodeInput').value = '4006381333931'; $('#btnLookup').click();
  await sleep(50);
  check('lookup created product', $('#f_name') && $('#f_name').value === 'Test Tuna', $('#f_name') && $('#f_name').value);
  check('brand first only', $('#item').textContent.includes('Acme') && !$('#item').textContent.includes('Other'));
  check('pack weight from OFF', $('[data-k="pack"]').value === '112');
  await sleep(50);
  const hint = $('#priceHint').textContent;
  check('crowd price shown, per-kg skipped', hint.includes('€1.79') && hint.includes('Albert Heijn'), hint);
  check('crowd date dd/mm/yyyy', hint.includes('02/10/2026'), hint);
  $('#usePrice').click();
  check('use fills price', $('[data-k="price"]').value === '1.79');
  check('use sets date', $('#priceNote').textContent.includes('02/10/2026'), $('#priceNote').textContent);
  const ids = [...d.querySelectorAll('#tab-scan > *')].map(e => e.id).filter(Boolean);
  check('scan order item > results > fit', ids.join(',') === 'item,results,fit', ids.join(','));
  check('Left today lives in settings', !!d.querySelector('#tab-set #remBox'));
  check('fit rendered in its own box', $('#fit').textContent.includes('Fit for your day') && !$('#results').textContent.includes('Fit for your day'));
  $('#daySeg button[data-day="rest"]').click();
  check('day toggle still works', $('#daySeg button[data-day="rest"]').classList.contains('on'));
  // not found -> manual with barcode
  $('#barcodeInput').value = '96385074'; $('#btnLookup').click();
  await sleep(50);
  check('not-found keeps barcode', $('#item').textContent.includes('96385074'));
  check('incomplete notice shown', $('#notices').textContent.includes('empty'));
  await sleep(50);
  check('no crowd price message', $('#priceHint').textContent.includes('No crowd price'), $('#priceHint').textContent);

  // drained weight changes cost
  $('.chip[data-g]');
  // library sort
  $('nav button[data-tab="lib"]').click();
  let rows = d.querySelectorAll('.lib-row');
  check('library lists 3 items', rows.length === 3, rows.length);
  check('highest protein/100kcal first (tuna 24)', rows[0].textContent.includes('Test Tuna'), rows[0].textContent);
  $('#dirBtn').click();
  rows = d.querySelectorAll('.lib-row');
  check('worst-first flips order', !rows[0].textContent.includes('Test Tuna'));
  const sel = $('#sortSel'); sel.value = 'costP'; sel.dispatchEvent(new w.Event('change'));
  rows = d.querySelectorAll('.lib-row');
  check('cost sort puts priced item first (best)', true);
  // tap row opens it
  d.querySelector('.lib-row').click();
  check('tap row opens item on scan tab', !$('#tab-scan').hidden);

  // persistence
  const saved = JSON.parse(w.localStorage.getItem('mc.products'));
  check('products persisted', Object.keys(saved).length === 3);
  check('targets persisted', JSON.parse(w.localStorage.getItem('mc.targets')).train.p === 180);

  // XSS: name with markup must not become elements
  $('#btnManual').click();
  type('#f_name', '<img src=x onerror=alert(1)>');
  $('nav button[data-tab="lib"]').click();
  check('no injected img in library', d.querySelectorAll('#libList img').length === 0);

  // liquids
  $('nav button[data-tab="scan"]').click();
  $('#btnManual').click();
  type('#f_name', 'Milk test');
  d.querySelector('#unitSeg button[data-u="ml"]').click();
  check('drained field hidden for liquid', !d.querySelector('[data-k="edible"]'));
  check('labels say ml', $('#item').textContent.includes('Per 100 ml') && $('#item').textContent.includes('Pack ml'));
  [['kcal','35'],['p','3,5'],['f','0,5'],['c','4,7'],['pack','1000'],['price','1,09']].forEach(([k,v]) => type('[data-k="'+k+'"]', v));
  type('#amt', '250');
  check('amount in ml', $('#results').textContent.includes('250 ml'));
  check('price per litre shown', $('#results').textContent.includes('Per litre') && $('#results').textContent.includes('€1.09'), $('#results').textContent);
  check('max amount in ml', $('#fit').textContent.includes(' ml'));
  // A-Z
  $('nav button[data-tab="lib"]').click();
  d.querySelector('#quick .chip[data-key="name"]').click();
  const names = [...d.querySelectorAll('.lib-row .nm')].map(e => e.textContent.trim());
  const named = names.filter(n => !n.startsWith('(no name)') && !n.startsWith('<img'));
  check('A-Z order', JSON.stringify(named) === JSON.stringify([...named].sort((a,b)=>a.localeCompare(b,'nl',{sensitivity:'base'}))), names.join(' | '));
  check('dir button says A → Z', $('#dirBtn').textContent === 'A → Z');
  // OFF liquid unit
  // ---- servings ----
  $('nav button[data-tab="lib"]').click();
  [...d.querySelectorAll('.lib-row')].find(r => r.textContent.includes('Test Tuna')).click();
  const origPrompt = w.prompt; let answers = ['scoop', '30'];
  w.prompt = () => answers.shift();
  $('#addSrv').click();
  check('serving chip added', $('#srvChips').textContent.includes('1 scoop (30 g)'), $('#srvChips').textContent);
  d.querySelector('[data-srv="0"]').click();
  check('serving sets amount', $('#amt').value === '30');
  d.querySelector('[data-srv="0"]').click();
  check('tap again adds serving', $('#amt').value === '60', $('#amt').value);
  check('results follow servings', $('#results').textContent.includes('This amount: 60 g'));
  w.prompt = origPrompt;

  // ---- price history ----
  const priceIn = d.querySelector('[data-k="price"]');
  check('crowd price seeded history', JSON.parse(w.localStorage.getItem('mc.products'))[Object.keys(JSON.parse(w.localStorage.getItem('mc.products'))).find(k => JSON.parse(w.localStorage.getItem('mc.products'))[k].name === 'Test Tuna')].priceHistory.length === 1);
  type(priceIn, '1,99'); priceIn.dispatchEvent(new w.Event('change', { bubbles: true }));
  check('price history shown', $('#priceHist').textContent.includes('Price history') && $('#priceHist').textContent.includes('€1.79') && $('#priceHist').textContent.includes('€1.99'), $('#priceHist').textContent);
  check('price rise shown', $('#priceHist').textContent.includes('+11%'), $('#priceHist').textContent);

  // ---- tools: gap ----
  $('nav button[data-tab="tools"]').click();
  check('tools tab visible', !$('#tab-tools').hidden);
  type('#g_p', '40'); type('#g_f', '10'); type('#g_c', '30');
  d.querySelector('#gapFocus button[data-f="p"]').click();
  const gapTxt = $('#gapList').textContent;
  check('gap list ranks items', d.querySelectorAll('.gap-row').length >= 2, gapTxt);
  check('gap top is tuna (purest protein)', d.querySelector('.gap-row').textContent.includes('Tuna'), d.querySelector('.gap-row').textContent);
  check('gap tuna max 166 g (protein limit)', d.querySelector('.gap-row').textContent.includes('166 g'), d.querySelector('.gap-row').textContent);
  $('#gapFromRem').click();
  check('gap from Left today', $('#g_p').value === '40' && $('#g_c').value === '60');
  d.querySelector('.gap-row').click();
  check('gap row opens item with amount', !$('#tab-scan').hidden && +$('#amt').value > 0, $('#amt').value);

  // ---- aliases ----
  $('nav button[data-tab="lib"]').click();
  [...d.querySelectorAll('.lib-row')].find(r => r.textContent.includes('Test Tuna')).click();
  type('#f_alias', 'Tuna');
  check('real name untouched', $('#f_name').value === 'Test Tuna');
  $('nav button[data-tab="lib"]').click();
  const tunaRow = [...d.querySelectorAll('.lib-row')].find(r => r.querySelector('.nm').textContent.startsWith('Tuna'));
  check('library shows alias with real name under it', !!tunaRow && tunaRow.textContent.includes('Test Tuna'), tunaRow && tunaRow.textContent);
  type('#search', 'test tun');
  check('filter finds by real name', d.querySelectorAll('.lib-row').length === 1);
  type('#search', 'tuna');
  check('filter finds by alias', d.querySelectorAll('.lib-row').length === 1);
  type('#search', '');
  // same barcode again -> same item, not a duplicate
  const countBefore = Object.keys(JSON.parse(w.localStorage.getItem('mc.products'))).length;
  $('#barcodeInput').value = '4006381333931'; $('#btnLookup').click();
  await sleep(30);
  check('rescanning same barcode opens existing item', Object.keys(JSON.parse(w.localStorage.getItem('mc.products'))).length === countBefore && $('#f_alias').value === 'Tuna');

  // ---- tools: compare (picker) ----
  $('nav button[data-tab="tools"]').click();
  check('compare buttons labelled', $('#cmpA span').textContent.length > 0 && $('#cmpB span').textContent.length > 0);
  check('compare table renders', $('#cmpTable').textContent.includes('Protein per 100 kcal') && $('#cmpTable').textContent.includes('Better on'), $('#cmpTable').textContent.slice(0, 200));
  check('compare highlights winners', d.querySelectorAll('#cmpTable td.win').length > 0);
  $('#cmpA').click();
  check('picker opens', !$('#picker').hidden);
  check('picker lists all items', d.querySelectorAll('#pickList .pk').length === Object.keys(JSON.parse(w.localStorage.getItem('mc.products'))).length);
  type('#pickSearch', 'tuna');
  check('picker search filters', d.querySelectorAll('#pickList .pk').length === 1, d.querySelectorAll('#pickList .pk').length);
  check('picker shows alias + real name', $('#pickList .pk').textContent.includes('Tuna') && $('#pickList .pk').textContent.includes('Test Tuna'));
  $('#pickList .pk').click();
  check('picker closes on pick', $('#picker').hidden);
  check('compare uses alias in header', $('#cmpTable th:nth-child(2)').textContent === 'Tuna', $('#cmpTable th:nth-child(2)').textContent);
  $('#cmpB').click(); type('#pickSearch', 'tuna'); $('#pickList .pk').click();
  check('same item message', $('#cmpTable').textContent.includes('two different'));
  $('#cmpB').click(); type('#pickSearch', 'zzzz');
  check('no match message', $('#pickList').textContent.includes('No item matches'));
  $('#picker').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  check('backdrop closes picker', $('#picker').hidden);

  // ---- rescan ----
  // item with barcode 96385074 was created "not found" earlier; user typed nothing into it except via smoke flow
  const before = Object.values(JSON.parse(w.localStorage.getItem('mc.products'))).find(p => p.barcode === '96385074');
  // simulate a manual edit on its fat so it must be kept
  const prods = JSON.parse(w.localStorage.getItem('mc.products'));
  $('nav button[data-tab="lib"]').click();
  [...d.querySelectorAll('.lib-row')].find(r => r.textContent.includes('(no name)') && r.dataset.id === before.id).click();
  type('[data-k="f"]', '9');
  $('nav button[data-tab="lib"]').click();
  $('#rescanBtn').click();
  await sleep(4500);
  const after = Object.values(JSON.parse(w.localStorage.getItem('mc.products'))).find(p => p.barcode === '96385074');
  check('rescan filled name', after.name === 'Rescanned Milk', after.name);
  check('rescan set liquid', after.unit === 'ml', after.unit);
  check('rescan kept manual fat', after.f === 9, after.f);
  check('rescan filled protein', after.p === 3.5, after.p);
  check('rescan log shown', $('#rescanLog').textContent.includes('Rescan done') && $('#rescanLog').textContent.includes('now liquid'), $('#rescanLog').textContent);
  const tunaAfter = Object.values(JSON.parse(w.localStorage.getItem('mc.products'))).find(p => p.name === 'Test Tuna');
  check('rescan kept alias', tunaAfter.alias === 'Tuna');
  check('rescan kept tuna price', tunaAfter.price === 1.99, tunaAfter.price);
  check('rescan kept tuna servings', tunaAfter.servings.length === 1);

  // ---- GitHub sync (mocked API) ----
  const gh = { file: null, sha: 0, calls: [], conflictOnce: false };
  const resp = (status, body) => ({ ok: status < 300, status, json: async () => body });
  const enc = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
  const dec = (b) => JSON.parse(Buffer.from(b, 'base64').toString('utf8'));
  global.ghMock = async (url, opts) => {
    gh.calls.push((opts.method || 'GET') + ' ' + url.split('?')[0]);
    if (opts.headers.Authorization !== 'Bearer github_pat_TEST') return resp(401, {});
    if (!url.includes('/repos/DynamicUnicorn/macro-check-data/contents/library.json')) return resp(404, {});
    if ((opts.method || 'GET') === 'GET') return gh.file ? resp(200, { sha: 's' + gh.sha, content: enc(gh.file) }) : resp(404, {});
    const body = JSON.parse(opts.body);
    if (gh.conflictOnce) { gh.conflictOnce = false; gh.sha++; return resp(409, {}); }
    if (gh.file && body.sha !== 's' + gh.sha) return resp(409, {});
    gh.file = dec(body.content); gh.sha++; gh.lastBody = body;
    return resp(gh.sha === 1 ? 201 : 200, { content: { sha: 's' + gh.sha } });
  };
  $('nav button[data-tab="set"]').click();
  check('sync repo prefilled', $('#s_repo').value === 'DynamicUnicorn/macro-check-data');
  $('#syncBtn').click(); await sleep(20);
  check('sync without token asks for it', $('#syncStatus').textContent.includes('token'));
  const tok = $('#s_token'); tok.value = 'github_pat_WRONG'; tok.dispatchEvent(new w.Event('change'));
  $('#syncBtn').click(); await sleep(50);
  check('bad token explained', $('#syncStatus').textContent.includes('refused the token'), $('#syncStatus').textContent);
  tok.value = 'github_pat_TEST'; tok.dispatchEvent(new w.Event('change'));
  check('token not shown after save', tok.value === '' && tok.placeholder.includes('saved'));
  $('#syncBtn').click(); await sleep(80);
  check('first sync creates library.json', gh.file && Object.keys(gh.file.products).length === Object.keys(JSON.parse(w.localStorage.getItem('mc.products'))).length, $('#syncStatus').textContent);
  check('first sync without sha', gh.lastBody && !('sha' in gh.lastBody));
  check('targets not uploaded', !JSON.stringify(gh.file).includes('"train"') && !('targets' in gh.file) && !('remaining' in gh.file));
  check('token not uploaded', !JSON.stringify(gh.file).includes('github_pat'));
  check('alias uploaded', JSON.stringify(gh.file).includes('"alias":"Tuna"'));
  // Claude fills a price remotely (item without price), and also messes with a name (must be ignored)
  const remoteMilk = Object.values(gh.file.products).find(p => p.name === 'Milk test');
  const noPrice = Object.values(gh.file.products).find(p => !(p.price > 0) && p.name !== 'Milk test') || remoteMilk;
  noPrice.price = 2.49; noPrice.priceDate = '23/10/2026'; noPrice.priceSource = 'ah.nl';
  noPrice.priceHistory = [{ price: 2.49, date: '23/10/2026', source: 'ah.nl' }];
  const oldName = noPrice.name; noPrice.name = 'RENAMED BY REMOTE';
  gh.sha++;
  const putsBefore = gh.calls.filter(c => c.startsWith('PUT')).length;
  $('#libSync').click(); await sleep(80);
  const localNow = JSON.parse(w.localStorage.getItem('mc.products'))[noPrice.id];
  check('remote price pulled in', localNow.price === 2.49 && localNow.priceSource === 'ah.nl', JSON.stringify(localNow).slice(0, 200));
  check('remote name change ignored', localNow.name === oldName, localNow.name);
  check('status lists updated price', $('#syncStatus').textContent.includes('1 price updated'), $('#syncStatus').textContent);
  check('upload after merge restores real name on GitHub', gh.file.products[noPrice.id].name === oldName);
  check('upload happened', gh.calls.filter(c => c.startsWith('PUT')).length === putsBefore + 1);
  // nothing changed -> no extra commit
  const putsMid = gh.calls.filter(c => c.startsWith('PUT')).length;
  $('#syncBtn').click(); await sleep(80);
  check('no-op sync makes no commit', gh.calls.filter(c => c.startsWith('PUT')).length === putsMid, $('#syncStatus').textContent);
  check('no-op status', $('#syncStatus').textContent.includes('already up to date'));
  // conflict once -> retries and succeeds
  type('[data-k="kcal"]', '101');
  gh.conflictOnce = true;
  $('#syncBtn').click(); await sleep(120);
  check('conflict retried and synced', $('#syncStatus').textContent.includes('Synced'), $('#syncStatus').textContent);
  $('#syncForget').click();
  check('forget token', JSON.parse(w.localStorage.getItem('mc.sync')).token === '');

  // ---- catalogue ----
  global.CATALOG = { generated: '2026-10-26T03:30:00Z', total: 4, counts: { A: 2, J: 1, P: 2 },
    columns: ['code', 'name', 'brand', 'shops', 'pack', 'unit', 'kcal', 'p', 'f', 'c', 'fiber', 'sugar'],
    rows: [['50000001', 'Skyr naturel', 'AH', 'A', 450, 'g', 63, 11, 0.2, 4, 0, 4],
           ['50000002', 'Kipfilet', 'Jumbo', 'J', 300, 'g', 110, 24, 1.5, 0, 0, 0],
           ['50000003', 'Olijfolie', 'Picnic', 'AP', 500, 'ml', 900, 0, 100, 0, null, 0],
           ['4006381333931', 'Tuna in catalogue', 'Acme', 'P', 112, 'g', 100, 24, 1, 0, 0, 0]] };
  $('nav button[data-tab="cat"]').click(); await sleep(30);
  check('catalogue tab visible', !$('#tab-cat').hidden);
  check('catalogue info + attribution', $('#catInfo').textContent.includes('4 products') && $('#catInfo').textContent.includes('Open Food Facts') && $('#catInfo').textContent.includes('26/10/2026'), $('#catInfo').textContent);
  let catRows = [...d.querySelectorAll('#catList .lib-row')];
  check('catalogue lists all', catRows.length === 4, catRows.length);
  check('catalogue sorted pure protein first', catRows[0].textContent.includes('Kipfilet') || catRows[0].textContent.includes('Tuna in catalogue'), catRows[0].textContent);
  check('already-owned marked', catRows.some(r => r.textContent.includes('Tuna in catalogue') && r.textContent.includes('mine')));
  check('cost sorts hidden in catalogue', ![...$('#catSort').options].some(o => o.value === 'costP'));
  d.querySelector('#catShops [data-shop="A"]').click(); d.querySelector('#catShops [data-shop="P"]').click();
  catRows = [...d.querySelectorAll('#catList .lib-row')];
  check('shop filter (Jumbo only)', catRows.length === 1 && catRows[0].textContent.includes('Kipfilet'), catRows.map(r => r.textContent).join('|'));
  d.querySelector('#catShops [data-shop="A"]').click(); d.querySelector('#catShops [data-shop="P"]').click();
  type('#catSearch', 'skyr');
  check('catalogue search', d.querySelectorAll('#catList .lib-row').length === 1);
  const libCount = Object.keys(JSON.parse(w.localStorage.getItem('mc.products'))).length;
  d.querySelector('#catList .lib-row').click();
  check('preview opens on scan tab', !$('#tab-scan').hidden && $('.prev') && $('#f_name').value === 'Skyr naturel');
  check('preview not saved yet', Object.keys(JSON.parse(w.localStorage.getItem('mc.products'))).length === libCount);
  check('preview shows results', $('#results').textContent.includes('This amount: 450 g'), $('#results').textContent.slice(0, 80));
  type('#amt', '200');
  check('changing amount does not save', Object.keys(JSON.parse(w.localStorage.getItem('mc.products'))).length === libCount);
  type('[data-k="price"]', '2,19');
  const libAfter = JSON.parse(w.localStorage.getItem('mc.products'));
  check('editing saves preview to library', Object.keys(libAfter).length === libCount + 1 && Object.values(libAfter).some(p => p.name === 'Skyr naturel' && p.price === 2.19));
  check('banner gone after save', !$('.prev') && !!$('#delItem'));
  // close without saving
  $('nav button[data-tab="cat"]').click(); type('#catSearch', 'kip'); d.querySelector('#catList .lib-row').click();
  $('#closePrev').click();
  check('close preview discards', Object.keys(JSON.parse(w.localStorage.getItem('mc.products'))).length === libCount + 1 && $('#item').textContent.includes('Scan a barcode'));
  // opening an owned product from the catalogue opens the library item
  $('nav button[data-tab="cat"]').click(); type('#catSearch', 'tuna in'); d.querySelector('#catList .lib-row').click();
  check('owned product opens library copy', !$('.prev') && $('#f_alias').value === 'Tuna');
  type('#catSearch', '');
  // fill my gap over the catalogue
  $('nav button[data-tab="tools"]').click();
  type('#g_p', '50'); type('#g_f', '20'); type('#g_c', '50');
  d.querySelector('#gapFocus button[data-f="p"]').click();
  d.querySelector('#gapSrc button[data-s="cat"]').click(); await sleep(20);
  check('gap shop chips shown for catalogue', !$('#gapShops').hidden && d.querySelectorAll('#gapShops [data-shop]').length === 3);
  const gapRows = [...d.querySelectorAll('.gap-row')];
  check('gap catalogue excludes owned items', !gapRows.some(r => r.textContent.includes('Tuna in catalogue')) && !gapRows.some(r => r.textContent.includes('Skyr')), gapRows.map(r => r.textContent).join('|'));
  check('gap catalogue top = Kipfilet', gapRows[0] && gapRows[0].textContent.includes('Kipfilet') && gapRows[0].textContent.includes('Jumbo'), gapRows[0] && gapRows[0].textContent);
  gapRows[0].click();
  check('gap catalogue row opens preview with amount', !!$('.prev') && $('#amt').value === '208', $('#amt').value);
  $('nav button[data-tab="tools"]').click();
  d.querySelector('#gapSrc button[data-s="both"]').click();
  check('gap both includes library', [...d.querySelectorAll('.gap-row')].some(r => r.textContent.includes('Tuna')) && [...d.querySelectorAll('.gap-row')].some(r => r.textContent.includes('Kipfilet')));
  d.querySelector('#gapSrc button[data-s="lib"]').click();
  check('gap shop chips hidden for library', $('#gapShops').hidden);
  // offline barcode fallback
  global.OFF_DOWN = true;
  $('#barcodeInput').value = '50000003'; $('#btnLookup').click(); await sleep(40);
  check('offline lookup uses catalogue', $('#f_name').value === 'Olijfolie' && $('#unitSeg button[data-u="ml"]').classList.contains('on'), $('#f_name').value);
  global.OFF_DOWN = false;

  check('no script errors', errors.length === 0, errors.join('\n'));
  console.log(fails ? fails + ' FAILED' : 'SMOKE ALL PASSED');
  process.exit(fails ? 1 : 0);
})();

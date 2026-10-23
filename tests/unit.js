// Run: npm test  (or: node tests/unit.js)   (all numbers below are SYNTHETIC examples worked out by hand)
const MC = require('../core.js');
let fails = 0;
function eq(name, got, want, tol = 1e-6) {
  const ok = (got === want) || (typeof got === 'number' && typeof want === 'number' && Math.abs(got - want) <= tol);
  if (!ok) { fails++; console.log('FAIL', name, 'got', got, 'want', want); } else console.log('ok  ', name);
}

// parsing
eq('num comma', MC.num('1,5'), 1.5);
eq('num dot', MC.num(' 2.25 '), 2.25);
eq('num empty', MC.num(''), null);
eq('num junk', MC.num('abc'), null);
eq('dmy', MC.dmy(new Date(2026, 9, 3)), '03/10/2026');

// synthetic quark: per 100 g: 57 kcal, 10 P, 0.2 F, 3.8 C; 500 g pack at 1.49
const quark = { kcal: 57, p: 10, f: 0.2, c: 3.8, pack: 500, price: 1.49 };
const m = MC.metrics(quark);
eq('P per 100 kcal', m.pPer100kcal, 10 / 57 * 100);            // 17.5439
eq('cost per g protein', m.costPerGP, 1.49 / 50);               // 0.0298 (50 g protein in pack)
eq('kcal per euro', m.kcalPerEuro, 285 / 1.49);                 // 191.28
eq('protein share', m.pShare, 40 / 57 * 100, 1e-9);             // derived kcal = 57
const s = MC.scale(quark, 437);
eq('scaled kcal', s.kcal, 249.09);
eq('scaled protein', s.p, 43.7);

// fit: budget 50 P, 20 F, 100 C -> 780 kcal
const fit = MC.fit(quark, 437, { p: 50, f: 20, c: 100 });
eq('left protein', fit.left.p, 6.3, 1e-9);
eq('left kcal', fit.left.kcal, 780 - 249.09, 1e-9);
eq('max grams', fit.maxGrams, 500);
eq('limit', fit.limit, 'p');
eq('pct protein', fit.pct.p, 87.4, 1e-9);

// over budget -> negative left, max amount 0 when budget is negative
const over = MC.fit(quark, 100, { p: -5, f: 10, c: 10 });
eq('over max', over.maxGrams, 0);
eq('over limit', over.limit, 'p');
eq('missing budget', MC.fit(quark, 100, { p: 1, f: null, c: 2 }), null);

// drained weight changes cost per macro only
const tuna = { kcal: 100, p: 24, f: 1, c: 0, pack: 200, edible: 140, price: 1.89 };
const tm = MC.metrics(tuna);
eq('tuna cost per g protein', tm.costPerGP, 1.89 / (140 * 0.24));
eq('tuna carbs cost null', tm.costPerGC, null);

// kcal falls back to macros when label kcal missing
eq('kcal fallback', MC.kcalUsed({ p: 10, f: 5, c: 20 }), 40 + 45 + 80);

// sanity flag
eq('sanity ok', MC.sanity(quark), null);
eq('sanity flagged', MC.sanity({ kcal: 120, p: 10, f: 0.2, c: 3.8 }) !== null, true);
eq('sanity needs label kcal', MC.sanity({ p: 10, f: 0.2, c: 3.8 }), null);

// sorting: best first, nulls last
const list = [
  { name: 'a', kcal: 400, p: 20, f: 10, c: 40, pack: 100, price: 1 },
  { name: 'b', kcal: 100, p: 25, f: 1, c: 0, pack: 100, price: 2 },
  { name: 'c', kcal: 50, p: 5, f: 0, c: 8 }
];
eq('sort P/100kcal first', MC.sortProducts(list, 'pPer100kcal', 'best')[0].prod.name, 'b');
eq('sort cost protein: cheapest first', MC.sortProducts(list, 'costP', 'best')[0].prod.name, 'a'); // a: 1/20=0.05, b: 2/25=0.08
eq('sort cost nulls last', MC.sortProducts(list, 'costP', 'best')[2].prod.name, 'c');
eq('sort worst', MC.sortProducts(list, 'pPer100kcal', 'worst')[0].prod.name, 'a');

// csv
const csv = MC.toCsv([{ name: 'Kwark, "mager"', p: 10, priceDate: '23/10/2026' }]);
eq('csv quoting', csv.split('\n')[1].startsWith(',"Kwark, ""mager"""'), true);

// barcodes (real, well-known public EANs used only as checksum examples)
eq('ean13 valid', MC.validBarcode('4006381333931'), true);
eq('ean13 bad digit', MC.validBarcode('4006381333932'), false);
eq('ean8 valid', MC.validBarcode('96385074'), true);
eq('upca valid', MC.validBarcode('036000291452'), true);
eq('barcode junk', MC.validBarcode('12ab'), false);
eq('barcode wrong length', MC.validBarcode('123456789'), false);

// liquids: per 100 ml, drained ignored, price per litre
const milk = { unit: 'ml', kcal: 35, p: 3.5, f: 0.5, c: 4.7, pack: 1000, edible: 500, price: 1.09 };
eq('ml ignores drained', MC.edibleWeight(milk), 1000);
eq('price per litre', MC.metrics(milk).pricePerKg, 1.09);
eq('ml no drained price', MC.metrics(milk).pricePerKgDrained, null);
eq('scale ml', MC.scale(milk, 250).p, 8.75);
eq('price per kg (quark 500 g @1.49)', MC.metrics(quark).pricePerKg, 2.98);
eq('price per kg drained (tuna)', MC.metrics(tuna).pricePerKgDrained, 1.89 / 140 * 1000);
eq('unit default g', MC.unit({}), 'g');

// alphabetical
const al = [{ name: 'banaan' }, { name: '' }, { name: 'Appel' }, { name: 'item 10' }, { name: 'item 9' }];
eq('A-Z first', MC.sortProducts(al, 'name', 'best').map(r => r.prod.name).join('|'), 'Appel|banaan|item 9|item 10|');
eq('Z-A', MC.sortProducts(al, 'name', 'worst')[0].prod.name, 'item 10');
eq('Z-A unnamed last', MC.sortProducts(al, 'name', 'worst')[4].prod.name, '');
eq('csv has unit', MC.toCsv([milk]).split('\n')[1].includes(',ml,1000,'), true);

// ---- fill my gap ----
// gap 40 P / 10 F / 30 C = 160+90+120 = 370 kcal
const gap = { p: 40, f: 10, c: 30 };
const whey = { name: 'whey', kcal: 400, p: 80, f: 5, c: 8 };     // limit: protein at 50 g (P 40, F 2.5, C 4)
const oats = { name: 'oats', kcal: 380, p: 13, f: 7, c: 60 };    // C limit 50 g, F limit 142.9 -> 50 g: P 6.5, F 3.5, C 30
const oil = { name: 'oil', kcal: 900, p: 0, f: 100, c: 0 };      // F limit 10 g -> 90 kcal
const gp = MC.fillGap([whey, oats, oil, { name: 'bad', p: 1 }], gap, 'p');
eq('gap protein: whey first', gp[0].prod.name, 'whey');
eq('gap protein: whey amount', gp[0].amount, 50);
eq('gap protein: whey score', gp[0].score, 1);
eq('gap protein: oil excluded (no protein)', gp.some(r => r.prod.name === 'oil'), false);
eq('gap protein: incomplete excluded', gp.some(r => r.prod.name === 'bad'), false);
const gk = MC.fillGap([whey, oats, oil], gap, 'kcal');
eq('gap kcal: whey kcal score', gk.find(r => r.prod.name === 'whey').score, 200 / 370);
eq('gap kcal: oats limit carbs', gk.find(r => r.prod.name === 'oats').limit, 'c');
eq('gap kcal: oats first (190 vs 200?)', gk[0].prod.name, 'whey'); // whey 200 kcal, oats 190 kcal, oil 90
eq('gap: zero focus budget -> empty', MC.fillGap([whey], { p: 0, f: 10, c: 10 }, 'p').length, 0);

// ---- compare ----
const cmp = MC.compare(whey, oats);
eq('compare protein/100kcal winner', cmp.find(r => r.key === 'pPer100kcal').winner, 'a');
eq('compare carbs/100kcal winner', cmp.find(r => r.key === 'cPer100kcal').winner, 'b');
eq('compare kcal100 lower better', cmp.find(r => r.key === 'kcal100').winner, 'b');
eq('compare no price -> null', cmp.find(r => r.key === 'costP').winner, null);
eq('compare excludes name', cmp.some(r => r.key === 'name'), false);
eq('compare tie', MC.compare(whey, Object.assign({}, whey)).find(r => r.key === 'p100').winner, 'tie');

// ---- rescan merge ----
const found = { name: 'Halfvolle melk', brand: 'AH', kcal: 46, p: 3.5, f: 1.5, c: 4.7, pack: 1000, unit: 'ml' };
// tracked item: user typed protein and name; pack empty
const tr = { tracked: true, edited: { p: true, name: true }, name: 'My milk', p: 3.6, f: 1.4, kcal: 46, pack: null, edible: 200 };
const mr = MC.mergeLookup(tr, found);
eq('merge keeps edited name', mr.prod.name, 'My milk');
eq('merge keeps edited protein', mr.prod.p, 3.6);
eq('merge updates unedited fat', mr.prod.f, 1.5);
eq('merge fills pack', mr.prod.pack, 1000);
eq('merge sets liquid', mr.prod.unit, 'ml');
eq('merge clears drained for liquid', mr.prod.edible, null);
eq('merge does not mutate input', tr.f, 1.4);
// legacy item (no tracking): keeps all existing values, fills only empty ones
const lg = { name: 'Old', kcal: 50, p: 3, f: 1, c: null, pack: 500 };
const ml = MC.mergeLookup(lg, found);
eq('legacy keeps value', ml.prod.p, 3);
eq('legacy keeps pack', ml.prod.pack, 500);
eq('legacy fills empty carbs', ml.prod.c, 4.7);
eq('legacy fills missing unit', ml.prod.unit, 'ml');
eq('legacy changed list', ml.changed.sort().join(','), 'brand,c,unit');

// ---- price history ----
const ph = { price: 1.49, priceDate: '01/10/2026' };
MC.ensureHistory(ph);
eq('history seeded', ph.priceHistory.length, 1);
eq('same price no new entry', MC.recordPrice(ph, 1.49, '05/10/2026', 'manual'), false);
eq('new price entry', MC.recordPrice(ph, 1.79, '20/10/2026', 'manual'), true);
const st = MC.priceStats(ph);
eq('stats lowest', st.lowest, 1.49);
eq('stats change %', st.changePct, (1.79 - 1.49) / 1.49 * 100);
eq('price updated', ph.price, 1.79);
eq('zero price ignored', MC.recordPrice(ph, 0, 'x'), false);
eq('no history stats null', MC.priceStats({}), null);

// ---- aliases ----
const al1 = { alias: '  Quark ', name: 'Magere kwark lactosevrij', brand: 'AH' };
eq('alias wins', MC.displayName(al1), 'Quark');
eq('name when no alias', MC.displayName({ name: 'Tonijn' }), 'Tonijn');
eq('empty alias ignored', MC.displayName({ alias: '  ', name: 'Tonijn' }), 'Tonijn');
eq('search by alias', MC.matches(al1, 'quar'), true);
eq('search by real name', MC.matches(al1, 'LACTOSE'), true);
eq('search by brand', MC.matches(al1, 'ah'), true);
eq('search miss', MC.matches(al1, 'tuna'), false);
eq('A-Z uses alias', MC.sortProducts([{ name: 'Aardbei', alias: 'Zzz' }, { name: 'Banaan' }], 'name', 'best')[0].prod.name, 'Banaan');
eq('alias survives rescan merge', MC.mergeLookup({ tracked: true, edited: {}, alias: 'Quark', name: 'x' }, { name: 'y' }).prod.alias, 'Quark');
eq('csv alias first column', MC.toCsv([al1]).split('\n')[1].startsWith('  Quark ,'), true);

// ---- sync: merge prices ----
eq('dmyKey', MC.dmyKey('03/10/2026'), 20261003);
eq('dmyKey bad', MC.dmyKey('2026-10-03'), 0);
const loc = {
  a: { id: 'a', name: 'Quark', alias: 'Q', p: 10, price: null, priceDate: '', priceHistory: [] },
  b: { id: 'b', name: 'Tuna', price: 1.89, priceDate: '20/10/2026', priceSource: 'manual',
       priceHistory: [{ price: 1.89, date: '20/10/2026', source: 'manual' }] },
  c: { id: 'c', name: 'Milk', price: 1.19, priceDate: '23/10/2026', priceSource: 'manual',
       priceHistory: [{ price: 1.19, date: '23/10/2026', source: 'manual' }] },
  d: { id: 'd', name: 'New on phone' }
};
const rem = {
  a: { id: 'a', name: 'CHANGED REMOTELY', p: 99, price: 1.99, priceDate: '23/10/2026', priceSource: 'ah.nl',
       priceHistory: [{ price: 1.99, date: '23/10/2026', source: 'ah.nl' }] },
  b: { id: 'b', price: 1.79, priceDate: '01/10/2026', priceSource: 'ah.nl',
       priceHistory: [{ price: 1.79, date: '01/10/2026', source: 'ah.nl' }] },
  c: { id: 'c', price: 1.09, priceDate: '22/10/2026', priceSource: 'ah.nl', priceHistory: [] },
  z: { id: 'z', name: 'Deleted on phone', price: 5 }
};
const mp = MC.mergePrices(loc, rem);
eq('empty local price filled', mp.products.a.price, 1.99);
eq('price source copied', mp.products.a.priceSource, 'ah.nl');
eq('non-price fields never taken from remote', mp.products.a.name + mp.products.a.p + mp.products.a.alias, 'Quark10Q');
eq('newer local price kept', mp.products.b.price, 1.89);
eq('older remote price joins history, sorted', mp.products.b.priceHistory.map(e => e.price).join(','), '1.79,1.89');
eq('same-date tie keeps newer local (23 > 22)', mp.products.c.price, 1.19);
eq('local-only item untouched', JSON.stringify(mp.products.d), JSON.stringify(loc.d));
eq('remote-only item not resurrected', 'z' in mp.products, false);
eq('updated list', mp.updated.sort().join(','), 'a,b');
eq('inputs not mutated', loc.a.price === null && loc.b.priceHistory.length === 1, true);
eq('idempotent second merge', MC.mergePrices(mp.products, rem).updated.length, 0);

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);

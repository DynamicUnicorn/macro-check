// Run: node tests.js   (all numbers below are SYNTHETIC examples worked out by hand)
const MC = require('./core.js');
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
eq('csv quoting', csv.split('\n')[1].startsWith('"Kwark, ""mager"""'), true);

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

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);

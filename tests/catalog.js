// Run: npm test  (or: node tests/catalog.js) — tests the catalogue builder with a fake Open Food Facts export.
const { transform, addRow, buildFromLines, detectShops, parseQuantity, dedupe, mergeSimilar, similarNames, brandFamily, COLUMNS } = require('../scripts/build-catalog.js');
let fails = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log('FAIL', name, 'got', JSON.stringify(got), 'want', JSON.stringify(want)); } else console.log('ok  ', name);
}
const N = (p, f, c, extra) => Object.assign({ proteins_100g: p, fat_100g: f, carbohydrates_100g: c }, extra || {});
const quark = { code: '8719587412480', product_name: 'Lactosevrije magere kwark', brands: 'AH, Albert Heijn', product_quantity: '500',
  product_quantity_unit: 'g', nutriments: N(10, 0.2, 3.8, { 'energy-kcal_100g': 57, fiber_100g: 0, sugars_100g: 3.8 }) };
eq('transform basic', transform(quark, 'A'), ['8719587412480', 'Lactosevrije magere kwark', 'AH', 'A', 500, 'g', 57, 10, 0.2, 3.8, 0, 3.8, '', '']);
eq('columns length matches', transform(quark, 'A').length, COLUMNS.length);
eq('prefers Dutch name', transform(Object.assign({}, quark, { product_name_nl: 'Kwark NL' }), 'A')[1], 'Kwark NL');
eq('kcal from kJ', transform({ code: '12345678', product_name: 'x', nutriments: N(10, 4, 5, { energy_100g: 418.4 }) }, 'J')[6], 100);
eq('kcal from macros', transform({ code: '12345678', product_name: 'x', nutriments: N(10, 5, 20) }, 'J')[6], 165);
eq('liquid by unit', transform({ code: '12345678', product_name: 'melk', product_quantity: '1000', product_quantity_unit: 'ml', nutriments: N(3.5, 1.5, 4.7) }, 'P')[5], 'ml');
eq('liquid by quantity text', transform({ code: '12345678', product_name: 'cola', quantity: '1,5 l', nutriments: N(0, 0, 0) }, 'P')[5], 'ml');
eq('missing macro dropped', transform({ code: '12345678', product_name: 'x', nutriments: { proteins_100g: 1, fat_100g: 1 } }, 'A'), null);
eq('impossible macros dropped', transform({ code: '12345678', product_name: 'x', nutriments: N(60, 30, 30) }, 'A'), null);
eq('impossible kcal dropped', transform({ code: '12345678', product_name: 'x', nutriments: N(1, 1, 1, { 'energy-kcal_100g': 2000 }) }, 'A'), null);
eq('kJ path also checked against macros', transform({ code: '12345678', product_name: 'x', nutriments: N(1, 1, 1, { energy_100g: 418.4 }) }, 'J'), null);
eq('kcal contradicting macros dropped', transform({ code: '12345678', product_name: 'cottage', nutriments: N(11.8, 1, 3, { 'energy-kcal_100g': 23 }) }, 'J'), null);
eq('low-kcal mismatch dropped (26 vs ~49)', transform({ code: '12345678', product_name: 'kwark', nutriments: N(8.8, 0.1, 3.2, { 'energy-kcal_100g': 26 }) }, 'P'), null);
eq('small rounding difference kept', transform({ code: '12345678', product_name: 'komkommer', nutriments: N(0.7, 0.1, 1.8, { 'energy-kcal_100g': 14 }) }, 'A')[6], 14);
eq('kcal agreeing with macros kept', transform({ code: '12345678', product_name: 'cottage', nutriments: N(11.8, 4.3, 3.5, { 'energy-kcal_100g': 99 }) }, 'J')[6], 99);
eq('no name dropped', transform({ code: '12345678', nutriments: N(1, 1, 1) }, 'A'), null);
eq('bad barcode dropped', transform({ code: 'abc', product_name: 'x', nutriments: N(1, 1, 1) }, 'A'), null);
eq('silly pack ignored', transform({ code: '12345678', product_name: 'x', product_quantity: '0', nutriments: N(1, 1, 1) }, 'A')[4], null);
const m = new Map();
addRow(m, transform(quark, 'P')); addRow(m, transform(quark, 'A'));
eq('shops merged and ordered', m.get('8719587412480')[3], 'AP');

// ---- shop detection & quantities ----
eq('AH by store text', detectShops('Albert Heijn, Lidl', ''), 'A');
eq('AH by short store', detectShops('AH', ''), 'A');
eq('AH store word not matched inside other words', detectShops('Aholdhouse,Spar', ''), '');
eq('AH by brand tag', detectShops('', 'ah,albert-heijn'), 'A');
eq('AH sub-brand tag', detectShops('', 'ah-excellent'), 'A');
eq('brand tag with language prefix', detectShops('', 'xx:ah'), 'A');
eq('Jumbo + Picnic', detectShops('Jumbo,Picnic', ''), 'JP');
eq('Picnic brand', detectShops('', 'picnic'), 'P');
eq('no match', detectShops('Lidl, Aldi', 'milbona'), '');
eq('qty grams', parseQuantity('500 g'), { pack: 500, unit: 'g' });
eq('qty kg comma', parseQuantity('1,5 kg'), { pack: 1500, unit: 'g' });
eq('qty litre', parseQuantity('1,5 l'), { pack: 1500, unit: 'ml' });
eq('qty cl', parseQuantity('33cl'), { pack: 330, unit: 'ml' });
eq('qty multipack', parseQuantity('6 x 0,33 l'), { pack: 1980, unit: 'ml' });
eq('qty none', parseQuantity('1 stuk'), { pack: null, unit: null });
eq('pack from text in transform', transform({ code: '12345678', product_name: 'x', quantity: '250 g', nutriments: N(1, 1, 1) }, 'A')[4], 250);

// ---- duplicates ----
const R = (code, name, brand, shops, pack, kcal, p, f, c) => [code, name, brand, shops, pack, 'g', kcal, p, f, c, null, null, '', ''];
eq('brand family', [brandFamily('Albert Heijn'), brandFamily('AH Excellent'), brandFamily('JUMBO'), brandFamily('Unox')], ['ah', 'ah', 'jumbo', 'unox']);
const dd = dedupe([
  R('2369283505649', 'Geelvin tonijnsteak', 'JUMBO', 'J', null, 88, 21.3, 0.3, 0.2),
  R('2369283205389', 'Geelvin tonijnsteak', 'JUMBO', 'J', null, 88, 21.3, 0.3, 0.2),
  R('2369283405536', 'Geelvin Tonijnsteak', 'Jumbo', 'J', 250, 88, 21.3, 0.3, 0.1),
  R('8718452581313', 'Geelvin tonijnsteak', 'Jumbo', 'J', null, 88, 21.3, 0.3, 0.2),
  R('2369283305560', 'Geelvin tonijnsteak ontdooid', 'Jumbo', 'J', null, 88, 21.3, 0.3, 0.2),
  R('8718907855884', '100% pindakaas', 'AH', 'A', 350, 597, 27, 50, 10),
  R('0028007755860', '100% pindakaas', 'AH', 'A', 1000, 630, 27, 52, 10),
  R('8718265830394', 'Tonijn steaks', 'Albert Heijn', 'A', 250, 101, 23, 1, 0),
  R('8718452581399', 'Tonijn steaks', 'Jumbo', 'J', null, 101, 23, 1, 0)
]);
const tuna = dd.rows.find((r) => r[1].toLowerCase() === 'geelvin tonijnsteak');
eq('tuna copies merged into one', dd.rows.filter((r) => r[1].toLowerCase() === 'geelvin tonijnsteak').length, 1);
eq('regular barcode kept over in-store', tuna[0], '8718452581313');
eq('other barcodes kept as alt', tuna[12].split(' ').sort(), ['2369283205389', '2369283405536', '2369283505649']);
eq('pack size taken from a merged copy', tuna[4], 250);
eq('different name not merged (ontdooid)', dd.rows.some((r) => /ontdooid/.test(r[1])), true);
eq('real variants with different macros kept', dd.rows.filter((r) => r[1] === '100% pindakaas').length, 2);
eq('same name, different shop brand not merged', dd.rows.filter((r) => r[1] === 'Tonijn steaks').length, 2);
eq('merged count', dd.merged, 3);
const dd2 = dedupe([
  R('8718265891234', 'AH Tonijnsteak wit', 'Albert Heijn', 'A', 150, 144, 24, 5.4, 0),
  R('2303171504628', 'Tonijnsteak Wit', 'AH', 'A', null, 145, 24, 5.4, 0),
  R('39964045', 'Tonijn Steak', 'Albert Heijn', 'A', 260, 144, 24, 5.4, 0),
  R('8718265830394', 'Tonijnsteak', 'Albert Heijn', 'A', 260, 144, 24, 5.4, 0),
  R('8718452931811', 'Jumbo Penne', 'Jumbo', 'J', 500, 350, 12, 1.5, 70),
  R('8718452931812', 'Penne Rigate', 'Jumbo', 'J', 500, 350, 12, 1.5, 70)
]);
eq('shop prefix and spacing ignored', dd2.rows.length, 4);
eq('different words not merged (penne vs penne rigate)', dd2.rows.filter((r) => /penne/i.test(r[1])).length, 2);

// ---- tier 2: same product, different names ----
eq('similar: geelvin = yellowfin', similarNames('Geelvin tonijnsteak', 'Tonijnsteak Yellowfin'), true);
eq('similar: filler words ignored', similarNames('Tonijn Steak Vers', 'Geelvin tonijnsteak ontdooid'), true);
eq('not similar: flavours', similarNames('Aardbei drinkyoghurt', 'Drink yoghurt framboos'), false);
eq('not similar: seasoning', similarNames('Kipfilet Mexicaans', 'Kipfilet plakjes Bbq'), false);
eq('not similar: cheese age', similarNames('Goudse kaas jong', 'Goudse kaas belegen'), false);
eq('not similar: no shared core', similarNames('Penne', 'Fusilli'), false);
const ms = mergeSimilar([
  R('2369283505649', 'Geelvin tonijnsteak', 'JUMBO', 'J', null, 88, 21.3, 0.3, 0.2),
  R('8718452581399', 'Tonijnsteak Yellowfin', 'Jumbo', 'J', 250, 88, 21.3, 0.3, 0.2),
  R('2369283304822', 'Tonijn Steak Vers', 'Jumbo', 'J', null, 88, 21.3, 0.3, 0),
  R('2369283305560', 'Geelvin tonijnsteak ontdooid', 'Jumbo', 'J', null, 88, 21.3, 0.3, 0.2),
  R('8718452581313', 'Tonijn Steak', 'Jumbo', 'J', null, 101, 23, 1, 0),
  R('8718265891234', 'Tonijnsteak', 'AH', 'A', 150, 88, 21.3, 0.3, 0.2),
  R('8710000000001', 'Aardbei drinkyoghurt', 'AH', 'A', 500, 27, 3.1, 0.1, 4),
  R('8710000000002', 'Drink yoghurt framboos', 'AH', 'A', 500, 27, 3.1, 0.1, 4)
]);
const yf = ms.rows.find((r) => r[1] === 'Tonijnsteak Yellowfin');
eq('jumbo tuna steaks merged into regular-barcode entry', ms.rows.filter((r) => r[2].toLowerCase() === 'jumbo' && r[6] === 88).length, 1);
eq('merged names kept', yf[13].split(' | ').sort(), ['Geelvin tonijnsteak', 'Geelvin tonijnsteak ontdooid', 'Tonijn Steak Vers']);
eq('merged barcodes kept', yf[12].split(' ').length, 3);
eq('different nutrition not merged', ms.rows.some((r) => r[0] === '8718452581313'), true);
eq('other shop brand not merged', ms.rows.some((r) => r[0] === '8718265891234'), true);
eq('flavours not merged', ms.rows.filter((r) => /yoghurt/i.test(r[1])).length, 2);
eq('tier 2 merged count', ms.merged, 3);

// ---- full build from a fake export ----
const H = ['code', 'product_name', 'brands', 'brands_tags', 'stores', 'countries_tags', 'quantity',
  'energy-kcal_100g', 'energy_100g', 'proteins_100g', 'fat_100g', 'carbohydrates_100g', 'fiber_100g', 'sugars_100g'];
const L = (o) => H.map((h) => (o[h] == null ? '' : String(o[h]))).join('\t');
const lines = [H.join('\t'),
  L({ code: '10000000', product_name: 'Magere kwark', brands: 'AH', brands_tags: 'ah', stores: '', countries_tags: 'en:netherlands', quantity: '500 g', 'energy-kcal_100g': 57, proteins_100g: 10, fat_100g: 0.2, carbohydrates_100g: 3.8 }),
  L({ code: '10000001', product_name: 'Penne', brands: 'Jumbo', brands_tags: 'jumbo', stores: 'Jumbo, Albert Heijn', countries_tags: 'en:belgium,en:netherlands', quantity: '500 g', proteins_100g: 12, fat_100g: 1.5, carbohydrates_100g: 70 }),
  L({ code: '10000002', product_name: 'Belgian only', brands: 'AH', brands_tags: 'ah', countries_tags: 'en:belgium', proteins_100g: 1, fat_100g: 1, carbohydrates_100g: 1 }),
  L({ code: '10000003', product_name: 'Lidl thing', stores: 'Lidl', countries_tags: 'en:netherlands', proteins_100g: 1, fat_100g: 1, carbohydrates_100g: 1 }),
  L({ code: '10000004', product_name: 'No macros', stores: 'Picnic', countries_tags: 'en:netherlands', proteins_100g: 1 }),
  L({ code: '10000005', product_name: 'Halfvolle melk', brands: 'Picnic', brands_tags: 'picnic', stores: 'Picnic', countries_tags: 'en:netherlands', quantity: '1 l', proteins_100g: 3.5, fat_100g: 1.5, carbohydrates_100g: 4.7 }),
  L({ code: '10000000', product_name: 'Magere kwark dup', stores: 'Picnic', countries_tags: 'en:netherlands', proteins_100g: 10, fat_100g: 0.2, carbohydrates_100g: 3.8 })
];
async function* gen(arr) { for (const l of arr) yield l; }
(async () => {
  const cat = await buildFromLines(gen(lines), { log: () => {} });
  eq('kept NL + shop + complete macros', cat.rows.map((r) => r[0]).sort(), ['10000000', '10000001', '10000005']);
  eq('counts per shop', cat.counts, { A: 2, J: 1, P: 2 });
  eq('duplicate barcode merges shops', cat.rows.find((r) => r[0] === '10000000')[3], 'AP');
  eq('first entry data kept', cat.rows.find((r) => r[0] === '10000000')[1], 'Magere kwark');
  eq('kcal computed when missing', cat.rows.find((r) => r[0] === '10000001')[6], Math.round(4 * 12 + 9 * 1.5 + 4 * 70));
  eq('liquid from quantity text', cat.rows.find((r) => r[0] === '10000005').slice(4, 6), [1000, 'ml']);
  eq('stats', cat.stats, { lines: 7, nl: 6, shop: 5, kept: 4, merged: 0 }); // NL: all but the Belgian one; shop: all NL but Lidl; kept: minus 'No macros'
  eq('attribution present', /Open Food Facts/.test(cat.source) && /ODbL/.test(cat.license), true);
  let err = '';
  try { await buildFromLines(gen(['code\tproduct_name']), { log: () => {} }); } catch (e) { err = e.message; }
  eq('format change detected', /column "countries_tags" missing/.test(err), true);
  console.log(fails ? fails + ' FAILED' : 'CATALOG ALL PASSED');
  process.exit(fails ? 1 : 0);
})();

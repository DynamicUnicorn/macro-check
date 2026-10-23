// Run: npm test  (or: node tests/catalog.js) — tests the catalogue builder with a fake Open Food Facts export.
const { transform, addRow, buildFromLines, detectShops, parseQuantity, COLUMNS } = require('../scripts/build-catalog.js');
let fails = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log('FAIL', name, 'got', JSON.stringify(got), 'want', JSON.stringify(want)); } else console.log('ok  ', name);
}
const N = (p, f, c, extra) => Object.assign({ proteins_100g: p, fat_100g: f, carbohydrates_100g: c }, extra || {});
const quark = { code: '8719587412480', product_name: 'Lactosevrije magere kwark', brands: 'AH, Albert Heijn', product_quantity: '500',
  product_quantity_unit: 'g', nutriments: N(10, 0.2, 3.8, { 'energy-kcal_100g': 57, fiber_100g: 0, sugars_100g: 3.8 }) };
eq('transform basic', transform(quark, 'A'), ['8719587412480', 'Lactosevrije magere kwark', 'AH', 'A', 500, 'g', 57, 10, 0.2, 3.8, 0, 3.8]);
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
  eq('stats', cat.stats, { lines: 7, nl: 6, shop: 5, kept: 4 }); // NL: all but the Belgian one; shop: all NL but Lidl; kept: minus 'No macros'
  eq('attribution present', /Open Food Facts/.test(cat.source) && /ODbL/.test(cat.license), true);
  let err = '';
  try { await buildFromLines(gen(['code\tproduct_name']), { log: () => {} }); } catch (e) { err = e.message; }
  eq('format change detected', /column "countries_tags" missing/.test(err), true);
  console.log(fails ? fails + ' FAILED' : 'CATALOG ALL PASSED');
  process.exit(fails ? 1 : 0);
})();

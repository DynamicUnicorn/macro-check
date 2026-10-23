// Run: npm test  (or: node tests/catalog.js) — tests the catalogue builder with a fake Open Food Facts API.
const { transform, addRow, buildCatalog, COLUMNS } = require('../scripts/build-catalog.js');
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
eq('kcal from kJ', transform({ code: '12345678', product_name: 'x', nutriments: N(1, 1, 1, { energy_100g: 418.4 }) }, 'J')[6], 100);
eq('kcal from macros', transform({ code: '12345678', product_name: 'x', nutriments: N(10, 5, 20) }, 'J')[6], 165);
eq('liquid by unit', transform({ code: '12345678', product_name: 'melk', product_quantity: '1000', product_quantity_unit: 'ml', nutriments: N(3.5, 1.5, 4.7) }, 'P')[5], 'ml');
eq('liquid by quantity text', transform({ code: '12345678', product_name: 'cola', quantity: '1,5 l', nutriments: N(0, 0, 0) }, 'P')[5], 'ml');
eq('missing macro dropped', transform({ code: '12345678', product_name: 'x', nutriments: { proteins_100g: 1, fat_100g: 1 } }, 'A'), null);
eq('impossible macros dropped', transform({ code: '12345678', product_name: 'x', nutriments: N(60, 30, 30) }, 'A'), null);
eq('impossible kcal dropped', transform({ code: '12345678', product_name: 'x', nutriments: N(1, 1, 1, { 'energy-kcal_100g': 2000 }) }, 'A'), null);
eq('no name dropped', transform({ code: '12345678', nutriments: N(1, 1, 1) }, 'A'), null);
eq('bad barcode dropped', transform({ code: 'abc', product_name: 'x', nutriments: N(1, 1, 1) }, 'A'), null);
eq('silly pack ignored', transform({ code: '12345678', product_name: 'x', product_quantity: '0', nutriments: N(1, 1, 1) }, 'A')[4], null);
const m = new Map();
addRow(m, transform(quark, 'P')); addRow(m, transform(quark, 'A'));
eq('shops merged and ordered', m.get('8719587412480')[3], 'AP');

// fake API: AH store query has 150 products over 2 pages; brand query repeats some; Jumbo 1; Picnic 0; one 429.
let calls = 0, threw = false;
const fakeFetch = async (url) => {
  calls++;
  const u = new URL(url), q = u.searchParams, page = +q.get('page');
  if (q.get('countries_tags') !== 'en:netherlands') throw new Error('country filter missing');
  if (q.get('stores_tags') === 'jumbo' && !threw) { threw = true; return { ok: false, status: 429 }; }
  let prods = [];
  if (q.get('stores_tags') === 'albert-heijn') {
    const start = (page - 1) * 100, n = page === 1 ? 100 : 50;
    prods = Array.from({ length: n }, (_, i) => ({ code: String(10000000 + start + i), product_name: 'AH item ' + (start + i), nutriments: N(5, 5, 5) }));
    return { ok: true, status: 200, json: async () => ({ count: 150, products: prods }) };
  }
  if (q.get('brands_tags') === 'ah') prods = [{ code: '10000000', product_name: 'AH item 0', nutriments: N(5, 5, 5) }, { code: '99999999', product_name: 'bad', nutriments: {} }];
  if (q.get('stores_tags') === 'jumbo') prods = [{ code: '10000001', product_name: 'AH item 1', nutriments: N(5, 5, 5) }, { code: '20000000', product_name: 'Jumbo penne', nutriments: N(12, 1.5, 70) }];
  return { ok: true, status: 200, json: async () => ({ count: prods.length, products: prods }) };
};
(async () => {
  const waits = [];
  const cat = await buildCatalog({ fetch: fakeFetch, log: () => {}, wait: async (ms) => { waits.push(ms); }, delay: 6500 });
  eq('total deduped', cat.total, 151);
  eq('counts per shop', cat.counts, { A: 150, J: 2, P: 0 });
  eq('shared product has both shops', cat.rows.find((r) => r[0] === '10000001')[3], 'AJ');
  eq('paging stopped at count', calls, 9); // AH store 2 pages + ah brand + albert-heijn brand + jumbo store (429, retry) + jumbo brand + picnic store + picnic brand
  eq('rate-limit delay used', waits.filter((w) => w === 6500).length, 7); // 8 page requests, no delay before the first
  eq('429 waited before retry', waits.includes(60000), true);
  eq('sorted by name', cat.rows[0][1] <= cat.rows[1][1], true);
  eq('attribution present', /Open Food Facts/.test(cat.source) && /ODbL/.test(cat.license), true);
  console.log(fails ? fails + ' FAILED' : 'CATALOG ALL PASSED');
  process.exit(fails ? 1 : 0);
})();

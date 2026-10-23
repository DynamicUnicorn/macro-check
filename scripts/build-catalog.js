#!/usr/bin/env node
/*
 * Builds catalog/catalog.json: products sold at Albert Heijn, Jumbo and Picnic (Netherlands)
 * with complete macros, from Open Food Facts.
 * Runs on GitHub Actions (weekly + on demand). No dependencies; Node 20+.
 * Data: Open Food Facts contributors, Open Database License (ODbL) — https://world.openfoodfacts.org
 *
 * Source: the official nightly CSV export (Open Food Facts asks bulk users not to page through the API).
 * Usage: node scripts/build-catalog.js [--out catalog/catalog.json] [--from <url or local .csv/.csv.gz>]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const UA = 'MacroCheck/1.0 (personal nutrition web app; github.com/DynamicUnicorn/macro-check)';
// Official nightly export (tab-separated, gzipped, ~0.9 GB). Open Food Facts asks bulk users to use this, not the API.
const EXPORT_URL = 'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz';
const COLUMNS = ['code', 'name', 'brand', 'shops', 'pack', 'unit', 'kcal', 'p', 'f', 'c', 'fiber', 'sugar', 'alt', 'altn'];
const SHOP_NAMES = { A: 'Albert Heijn', J: 'Jumbo', P: 'Picnic' };

// Which of our shops a product is linked to, from the free-text "stores" field and the brand tags.
function detectShops(stores, brandsTags) {
  const st = ',' + String(stores || '').toLowerCase().replace(/\s*,\s*/g, ',') + ',';
  const bt = String(brandsTags || '').toLowerCase().split(',').map((t) => t.trim().replace(/^[a-z]{2}:/, ''));
  const hasBrand = (re) => bt.some((t) => re.test(t));
  let out = '';
  if (/albert[\s-]*heijn/.test(st) || /,\s*ah\s*,/.test(st) || hasBrand(/^(ah|albert-heijn)(-|$)/)) out += 'A';
  if (/jumbo/.test(st) || hasBrand(/^jumbo(-|$)/)) out += 'J';
  if (/picnic/.test(st) || hasBrand(/^picnic(-|$)/)) out += 'P';
  return out;
}

// "500 g", "1,5 l", "6 x 0,33 l", "2x250ml" -> { pack, unit }
function parseQuantity(q) {
  const s = String(q || '').toLowerCase().replace(/,/g, '.');
  const mult = { kg: 1000, g: 1, mg: 0.001, l: 1000, cl: 10, dl: 100, ml: 1 };
  let m = /(\d+)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(kg|g|mg|l|cl|dl|ml)\b/.exec(s);
  if (m) return { pack: +m[1] * +m[2] * mult[m[3]], unit: /l$/.test(m[3]) ? 'ml' : 'g' };
  m = /(\d+(?:\.\d+)?)\s*(kg|g|mg|l|cl|dl|ml)\b/.exec(s);
  if (m) return { pack: +m[1] * mult[m[2]], unit: /l$/.test(m[2]) ? 'ml' : 'g' };
  return { pack: null, unit: null };
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
const r1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

// One API product -> compact row, or null when it can't be trusted for macro maths.
function transform(prod, shopLetter) {
  if (!prod || !/^\d{8,14}$/.test(String(prod.code || ''))) return null;
  const n = prod.nutriments || {};
  const p = num(n.proteins_100g), f = num(n.fat_100g), c = num(n.carbohydrates_100g);
  if (p == null || f == null || c == null) return null;
  if (p < 0 || f < 0 || c < 0 || p + f + c > 105) return null;
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null) { const kj = num(n.energy_100g); if (kj != null) kcal = kj / 4.184; }
  if (kcal == null) kcal = 4 * p + 9 * f + 4 * c;
  if (kcal < 0 || kcal > 950) return null;
  // Label kcal must agree with the macros (4/9/4 + 2 per g fibre), 10 kcal or 15 %, whichever is larger (stricter than the app's warning, which allows 25 kcal).
  // Disagreeing entries are crowd-sourcing errors and would top "purest source" rankings with impossible values.
  const fib = num(n.fiber_100g) || 0, computed = 4 * p + 9 * f + 4 * c + 2 * Math.max(0, fib);
  if (Math.abs(kcal - computed) > Math.max(10, 0.15 * Math.max(kcal, computed))) return null;
  const name = String(prod.product_name_nl || prod.product_name || '').trim().replace(/\s+/g, ' ');
  if (!name) return null;
  const brand = String(prod.brands || '').split(',')[0].trim();
  const qu = String(prod.product_quantity_unit || '').toLowerCase(), pq = parseQuantity(prod.quantity);
  const unit = /^(ml|cl|l)$/.test(qu) || (!qu && pq.unit === 'ml') ? 'ml' : 'g';
  let pack = num(prod.product_quantity);
  if (pack == null) pack = pq.pack;
  if (pack != null && (pack <= 0 || pack > 20000)) pack = null;
  const fiber = num(n.fiber_100g), sugar = num(n.sugars_100g);
  return [String(prod.code), name.slice(0, 120), brand.slice(0, 60), shopLetter, r1(pack), unit,
    Math.round(kcal), r1(p), r1(f), r1(c), fiber == null || fiber < 0 ? null : r1(fiber), sugar == null || sugar < 0 ? null : r1(sugar), '', ''];
}

// Merge rows by barcode: shops are combined; the first complete row wins for the data.
function addRow(map, row) {
  const prev = map.get(row[0]);
  if (!prev) { map.set(row[0], row); return; }
  const shops = new Set((prev[3] + row[3]).split(''));
  prev[3] = ['A', 'J', 'P'].filter((s) => shops.has(s)).join('');
  if (prev[4] == null && row[4] != null) prev[4] = row[4];
}

// ---- duplicates ----
// In-store barcodes (GS1 prefix 20-29) encode one pack's weight/price, so fresh meat, fish and cheese get a new
// barcode for every pack; Open Food Facts then holds dozens of copies. Products are merged when they have the same
// shop brand, the same name (ignoring case/punctuation) and macros equal within rounding. Other barcodes go to 'alt'.
const isInStore = (code) => code.length === 13 && code[0] === '2';
const normName = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// Comparison key for names: lower case, no accents/punctuation/spaces, leading shop name removed
// ("AH Tonijnsteak wit" = "Tonijnsteak Wit", "Tonijn Steak" = "Tonijnsteak").
const nameKey = (s) => normName(s).replace(/^(albert heijn|ah|jumbo|picnic)\s+/, '').replace(/\s+/g, '');
function brandFamily(b) {
  const n = normName(b).replace(/\s+/g, '');
  if (/^(ah|albertheijn)/.test(n)) return 'ah';
  if (/^jumbo/.test(n)) return 'jumbo';
  if (/^picnic/.test(n)) return 'picnic';
  return n;
}
function sameMacros(a, b) {
  const kc = Math.abs(a[6] - b[6]) <= Math.max(3, 0.03 * Math.max(a[6], b[6]));
  return kc && [7, 8, 9].every((i) => Math.abs(a[i] - b[i]) <= 0.5);
}
function dedupe(rows) {
  const groups = new Map();
  for (const r of rows) {
    const k = brandFamily(r[2]) + '|' + nameKey(r[1]);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const out = [];
  let merged = 0;
  for (const list of groups.values()) {
    // regular barcodes first, then rows with a pack size, so the kept entry is the most useful one
    list.sort((a, b) => (isInStore(a[0]) - isInStore(b[0])) || ((a[4] == null) - (b[4] == null)) || a[0].localeCompare(b[0]));
    const clusters = [];
    for (const r of list) {
      const c = clusters.find((cl) => sameMacros(cl[0], r));
      if (c) c.push(r); else clusters.push([r]);
    }
    for (const cl of clusters) {
      const keep = cl[0].slice();
      if (cl.length > 1) {
        const shops = new Set(cl.map((r) => r[3]).join('').split(''));
        keep[3] = ['A', 'J', 'P'].filter((x) => shops.has(x)).join('');
        if (keep[4] == null) { const withPack = cl.find((r) => r[4] != null); if (withPack) keep[4] = withPack[4]; }
        keep[12] = cl.slice(1).map((r) => r[0]).join(' ');
        merged += cl.length - 1;
      }
      out.push(keep);
    }
  }
  return { rows: out, merged: merged };
}

// ---- tier 2: same product under different names ----
// Same shop brand + nutrition equal within rounding (kcal ±2, P/F/C ±0.3 g) + names sharing a core of 6+ letters
// ("Geelvin tonijnsteak" = "Tonijnsteak Yellowfin" = "Tonijn Steak Vers"). Words that don't identify the product
// are ignored; names that differ by a flavour/variety/cut word are never merged (identical labels are common there).
const FILLER = new Set(('ah jumbo picnic albert heijn bio biologisch biologische naturel vers verse ontdooid diepvries ' +
  'vriezer bevroren excellent basic terra gesneden plakken plakjes stuks stuk pack voordeelverpakking voordeelpak ' +
  'grootverpakking xl ca g gr gram kg ml cl l x de het een en met van op in a la à geelvin yellowfin').split(' '));
const VARIANT = ['aardbei', 'framboos', 'kers', 'mango', 'perzik', 'peach', 'banaan', 'appel', 'peer', 'citroen', 'lemon',
  'limoen', 'sinaas', 'orange', 'bosvrucht', 'cassis', 'vanil', 'caramel', 'karamel', 'chocola', 'choco', 'cacao', 'mokka',
  'hazelnoot', 'kokos', 'honing', 'kaneel', 'komijn', 'peper', 'paprika', 'kruiden', 'knoflook', 'ui', 'tomaat', 'pesto',
  'naturel', 'gezouten', 'ongezouten', 'zout', 'zoet', 'zuur', 'pittig', 'spicy', 'mild', 'jong', 'belegen', 'oud',
  'extra', 'bruisend', 'koolzuur', 'licht', 'kruimig', 'vastkokend', 'friet', 'hamlap', 'speklap', 'schnitzel', 'karbonade',
  'filet', 'drumstick', 'dij', 'vleugel', 'gehakt', 'burger', 'worst', 'rood', 'wit', 'groen', 'geel', 'zwart', 'bruin',
  'volkoren', 'spelt', 'rogge', 'mais', 'rijst', 'penne', 'fusilli', 'spaghetti', 'macaroni', 'lasagne', 'tagliatelle',
  'mager', 'halfvol', 'vol', 'light', 'zero', 'suikervrij', 'truffel', 'tartufo', 'grof', 'grove', 'crunchy', 'smooth',
  'mexica', 'bbq', 'barbecue', 'curry', 'kerrie', 'tandoori', 'italia', 'provenc', 'gerookt', 'gegrild', 'shoarma', 'gyros',
  'walnoot', 'amandel', 'pinda', 'sesam', 'teriyaki', 'sweet', 'chili', 'kip', 'rund', 'varken', 'kalkoen', 'zalm', 'tonijn'];
const words = (s) => normName(s).split(' ').filter((w) => w && !FILLER.has(w) && !/^\d+$/.test(w));
function lcsLen(a, b) {
  let best = 0, prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) if (a[i - 1] === b[j - 1]) { cur[j] = prev[j - 1] + 1; if (cur[j] > best) best = cur[j]; }
    prev = cur;
  }
  return best;
}
function similarNames(a, b) {
  const wa = words(a), wb = words(b), ka = wa.join(''), kb = wb.join('');
  if (!ka || !kb || lcsLen(ka, kb) < 6) return false;
  // a word found in only one name (not even inside a word of the other, e.g. "tonijn" in "tonijnsteak") must not be a variant word
  const only = (xs, ys) => xs.filter((w) => !ys.some((y) => y.includes(w) || w.includes(y)));
  return only(wa, wb).concat(only(wb, wa)).every((w) => !VARIANT.some((v) => w.includes(v)));
}
// Nutrition equal within label rounding: kcal ±2, protein/fat/carbs ±0.3 g.
const nearSame = (a, b) => Math.abs(a[6] - b[6]) <= 2 && [7, 8, 9].every((i) => Math.abs(a[i] - b[i]) <= 0.3);
function mergeSimilar(rows) {
  const groups = new Map();
  rows.forEach((r) => { const k = brandFamily(r[2]); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
  const out = [];
  let merged = 0;
  for (const list of groups.values()) {
    // best entry first (regular barcode, then with pack size); clusters only form between near-identical nutrition
    list.sort((a, b) => (isInStore(a[0]) - isInStore(b[0])) || ((a[4] == null) - (b[4] == null)) || a[0].localeCompare(b[0]));
    const byKcal = new Map();          // kcal bucket -> clusters, to avoid comparing everything with everything
    const clusters = [];
    for (const r of list) {
      const b = Math.round(r[6] / 5);
      let home = null;
      for (const bb of [b - 1, b, b + 1]) {
        for (const cl of byKcal.get(bb) || []) {
          if (cl.every((m) => nearSame(m, r) && similarNames(m[1], r[1]))) { home = cl; break; }   // must match every member
        }
        if (home) break;
      }
      if (home) home.push(r);
      else { const cl = [r]; clusters.push(cl); if (!byKcal.has(b)) byKcal.set(b, []); byKcal.get(b).push(cl); }
    }
    for (const cl of clusters) {
      const keep = cl[0].slice();
      if (cl.length > 1) {
        const shops = new Set(cl.map((r) => r[3]).join('').split(''));
        keep[3] = ['A', 'J', 'P'].filter((x) => shops.has(x)).join('');
        if (keep[4] == null) { const wp = cl.find((r) => r[4] != null); if (wp) keep[4] = wp[4]; }
        keep[12] = cl.flatMap((r, i) => (i ? [r[0]] : []).concat(r[12] ? r[12].split(' ') : [])).join(' ');
        const names = new Set([nameKey(keep[1])]);
        keep[13] = cl.slice(1).map((r) => r[1]).concat(cl[0][13] ? cl[0][13].split(' | ') : [])
          .filter((n) => { const k = nameKey(n); if (names.has(k)) return false; names.add(k); return true; }).join(' | ');
        merged += cl.length - 1;
      }
      out.push(keep);
    }
  }
  return { rows: out, merged: merged };
}

// One tab-separated export line -> API-like product object (only the fields we use), or null.
function lineToProduct(cols, ix) {
  const g = (k) => (ix[k] == null ? '' : cols[ix[k]] || '');
  const n = {};
  ['energy-kcal_100g', 'energy_100g', 'proteins_100g', 'fat_100g', 'carbohydrates_100g', 'fiber_100g', 'sugars_100g']
    .forEach((k) => { if (g(k) !== '') n[k] = g(k); });
  return {
    code: g('code'), product_name: g('product_name'), product_name_nl: g('product_name_nl'), brands: g('brands'),
    quantity: g('quantity'), product_quantity: g('product_quantity'), product_quantity_unit: g('product_quantity_unit'),
    nutriments: n
  };
}

// lines: async iterable of export lines (first line = header).
async function buildFromLines(lines, opts) {
  const log = (opts && opts.log) || console.log;
  const map = new Map(), stats = { lines: 0, nl: 0, shop: 0, kept: 0 };
  let ix = null;
  for await (const line of lines) {
    if (!ix) {
      ix = {}; line.split('\t').forEach((h, i) => { ix[h.trim()] = i; });
      for (const need of ['code', 'countries_tags', 'proteins_100g', 'fat_100g', 'carbohydrates_100g']) {
        if (ix[need] == null) throw new Error('Export format changed: column "' + need + '" missing');
      }
      continue;
    }
    stats.lines++;
    if (stats.lines % 500000 === 0) log('  ' + stats.lines + ' lines, ' + map.size + ' kept');
    if (line.indexOf('en:netherlands') < 0) continue;            // cheap pre-filter before splitting
    const cols = line.split('\t');
    if ((',' + (cols[ix.countries_tags] || '') + ',').indexOf(',en:netherlands,') < 0) continue;
    stats.nl++;
    const shops = detectShops(ix.stores == null ? '' : cols[ix.stores], ix.brands_tags == null ? '' : cols[ix.brands_tags]);
    if (!shops) continue;
    stats.shop++;
    const row = transform(lineToProduct(cols, ix), shops);
    if (row) { addRow(map, row); stats.kept++; }
  }
  if (!ix) throw new Error('Export was empty');
  const dd = dedupe(Array.from(map.values()));
  const ms = mergeSimilar(dd.rows);
  stats.merged = dd.merged + ms.merged;
  const rows = ms.rows.sort((a, b) => a[1].localeCompare(b[1], 'nl'));
  const counts = { A: 0, J: 0, P: 0 };
  rows.forEach((r) => r[3].split('').forEach((x) => counts[x]++));
  return {
    app: 'macro-check', format: 1, generated: new Date().toISOString(),
    source: 'Open Food Facts nightly export (static.openfoodfacts.org), products in the Netherlands linked to Albert Heijn / Jumbo / Picnic by store or brand',
    license: 'Open Database License (ODbL) — data from Open Food Facts contributors',
    shops: SHOP_NAMES, counts: counts, total: rows.length, columns: COLUMNS, rows: rows, stats: stats
  };
}

async function* exportLines(url) {
  const { Readable } = require('stream');
  const zlib = require('zlib');
  const readline = require('readline');
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('Download failed: HTTP ' + res.status);
  const body = Readable.fromWeb(res.body).pipe(zlib.createGunzip());
  yield* readline.createInterface({ input: body, crlfDelay: Infinity });
}

async function main() {
  const args = process.argv.slice(2);
  const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const out = path.resolve(get('--out', path.join(__dirname, '..', 'catalog', 'catalog.json')));
  const src = get('--from', EXPORT_URL);
  console.log('Reading ' + src);
  const lines = /^https?:/.test(src) ? exportLines(src)
    : require('readline').createInterface({ input: fs.createReadStream(src).pipe(/\.gz$/.test(src) ? require('zlib').createGunzip() : new (require('stream').PassThrough)()), crlfDelay: Infinity });
  const cat = await buildFromLines(lines);
  console.log('Stats: ' + JSON.stringify(cat.stats));
  console.log('Total kept: ' + cat.total + ' ' + JSON.stringify(cat.counts));
  // Safety: never replace a good catalogue with a tiny one after an API hiccup.
  let prev = 0;
  try { prev = JSON.parse(fs.readFileSync(out, 'utf8')).total || 0; } catch (e) { /* first run */ }
  if (cat.total < 200 || (prev && cat.total < prev * 0.6)) {
    console.error('::error::Refusing to write: only ' + cat.total + ' products (previous ' + prev + ').');
    process.exit(2);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(cat).replace(/\],\[/g, '],\n['));
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log('Wrote ' + out + ' (' + kb + ' KB)');
  // shows up in the run's annotations (readable via the API)
  console.log('::notice::Catalogue: ' + cat.total + ' products (AH ' + cat.counts.A + ', Jumbo ' + cat.counts.J + ', Picnic ' + cat.counts.P +
    '), ' + kb + ' KB. Export lines ' + cat.stats.lines + ', NL ' + cat.stats.nl + ', linked to a shop ' + cat.stats.shop +
    ', duplicates merged ' + cat.stats.merged + '.');
}

module.exports = { transform, addRow, buildFromLines, detectShops, parseQuantity, lineToProduct, dedupe, mergeSimilar, similarNames, brandFamily, COLUMNS };
if (require.main === module) main().catch((e) => { console.error('::error::' + (e && e.message || e)); console.error(e); process.exit(1); });

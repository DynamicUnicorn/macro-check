#!/usr/bin/env node
/*
 * Builds catalog/catalog.json: products sold at Albert Heijn, Jumbo and Picnic (Netherlands)
 * with complete macros, from the Open Food Facts search API.
 * Runs on GitHub Actions (weekly + on demand). No dependencies; Node 20+.
 * Data: Open Food Facts contributors, Open Database License (ODbL) — https://world.openfoodfacts.org
 *
 * Usage: node scripts/build-catalog.js [--out catalog/catalog.json] [--max-pages N]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const UA = 'MacroCheck/1.0 (personal nutrition web app; github.com/DynamicUnicorn/macro-check)';
const API = 'https://world.openfoodfacts.org/api/v2/search';
const FIELDS = ['code', 'product_name', 'product_name_nl', 'brands', 'quantity', 'product_quantity',
  'product_quantity_unit', 'nutriments', 'stores_tags', 'brands_tags', 'countries_tags'].join(',');
const PAGE_SIZE = 100;          // API maximum
const DELAY_MS = 6500;          // search API limit is 10 requests/minute
const SHOPS = {
  A: { name: 'Albert Heijn', queries: [{ stores_tags: 'albert-heijn' }, { brands_tags: 'ah' }, { brands_tags: 'albert-heijn' }] },
  J: { name: 'Jumbo', queries: [{ stores_tags: 'jumbo' }, { brands_tags: 'jumbo' }] },
  P: { name: 'Picnic', queries: [{ stores_tags: 'picnic' }, { brands_tags: 'picnic' }] }
};
const COLUMNS = ['code', 'name', 'brand', 'shops', 'pack', 'unit', 'kcal', 'p', 'f', 'c', 'fiber', 'sugar'];

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
  const name = String(prod.product_name_nl || prod.product_name || '').trim().replace(/\s+/g, ' ');
  if (!name) return null;
  const brand = String(prod.brands || '').split(',')[0].trim();
  const qu = String(prod.product_quantity_unit || '').toLowerCase();
  const unit = /^(ml|cl|l)$/.test(qu) || (!qu && /\d\s*(ml|cl|l)\b/i.test(prod.quantity || '')) ? 'ml' : 'g';
  let pack = num(prod.product_quantity);
  if (pack != null && (pack <= 0 || pack > 20000)) pack = null;
  const fiber = num(n.fiber_100g), sugar = num(n.sugars_100g);
  return [String(prod.code), name.slice(0, 120), brand.slice(0, 60), shopLetter, r1(pack), unit,
    Math.round(kcal), r1(p), r1(f), r1(c), fiber == null || fiber < 0 ? null : r1(fiber), sugar == null || sugar < 0 ? null : r1(sugar)];
}

// Merge rows by barcode: shops are combined; the first complete row wins for the data.
function addRow(map, row) {
  const prev = map.get(row[0]);
  if (!prev) { map.set(row[0], row); return; }
  const shops = new Set((prev[3] + row[3]).split(''));
  prev[3] = ['A', 'J', 'P'].filter((s) => shops.has(s)).join('');
  if (prev[4] == null && row[4] != null) prev[4] = row[4];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, fetchFn, log, wait) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetchFn(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.status === 429 || res.status >= 500) throw new Error('HTTP ' + res.status);
      if (!res.ok) throw new Error('HTTP ' + res.status + ' (not retried)');
      return await res.json();
    } catch (e) {
      if (/not retried/.test(e.message) || attempt === 4) throw e;
      log('  retry ' + attempt + ' after error: ' + e.message);
      await wait(60000 * attempt);
    }
  }
}

async function buildCatalog(opts) {
  const fetchFn = opts.fetch || fetch, log = opts.log || console.log;
  const wait = opts.wait || sleep, delay = opts.delay == null ? DELAY_MS : opts.delay;
  const maxPages = opts.maxPages || 400;
  const map = new Map(), stats = {};
  let first = true;
  for (const [letter, shop] of Object.entries(SHOPS)) {
    stats[letter] = { seen: 0, kept: 0 };
    for (const q of shop.queries) {
      for (let page = 1; page <= maxPages; page++) {
        const params = new URLSearchParams(Object.assign({}, q, {
          countries_tags: 'en:netherlands', fields: FIELDS, page_size: String(PAGE_SIZE), page: String(page)
        }));
        if (!first) await wait(delay);
        first = false;
        const data = await fetchJson(API + '?' + params, fetchFn, log, wait);
        const prods = (data && data.products) || [];
        stats[letter].seen += prods.length;
        for (const pr of prods) { const row = transform(pr, letter); if (row) { addRow(map, row); stats[letter].kept++; } }
        const total = num(data && data.count) || 0;
        log(shop.name + ' ' + JSON.stringify(q) + ' page ' + page + ': ' + prods.length + ' products (of ' + total + ')');
        if (prods.length < PAGE_SIZE || page * PAGE_SIZE >= total) break;
      }
    }
  }
  const rows = Array.from(map.values()).sort((a, b) => a[1].localeCompare(b[1], 'nl'));
  const counts = { A: 0, J: 0, P: 0 };
  rows.forEach((r) => r[3].split('').forEach((s) => counts[s]++));
  return {
    app: 'macro-check', format: 1, generated: new Date().toISOString(),
    source: 'Open Food Facts (world.openfoodfacts.org), products tagged Albert Heijn / Jumbo / Picnic in the Netherlands',
    license: 'Open Database License (ODbL) — data from Open Food Facts contributors',
    shops: { A: 'Albert Heijn', J: 'Jumbo', P: 'Picnic' }, counts: counts, total: rows.length,
    columns: COLUMNS, rows: rows, stats: stats
  };
}

async function main() {
  const args = process.argv.slice(2);
  const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const out = path.resolve(get('--out', path.join(__dirname, '..', 'catalog', 'catalog.json')));
  const cat = await buildCatalog({ maxPages: +get('--max-pages', 400) });
  console.log('Total kept: ' + cat.total + ' ' + JSON.stringify(cat.counts));
  // Safety: never replace a good catalogue with a tiny one after an API hiccup.
  let prev = 0;
  try { prev = JSON.parse(fs.readFileSync(out, 'utf8')).total || 0; } catch (e) { /* first run */ }
  if (cat.total < 200 || (prev && cat.total < prev * 0.6)) {
    console.error('Refusing to write: only ' + cat.total + ' products (previous ' + prev + ').');
    process.exit(2);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(cat).replace(/\],\[/g, '],\n['));
  console.log('Wrote ' + out + ' (' + Math.round(fs.statSync(out).size / 1024) + ' KB)');
}

module.exports = { transform, addRow, buildCatalog, COLUMNS, SHOPS };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

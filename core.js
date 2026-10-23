/* Macro Check — calculation core (no DOM, testable in Node) */
(function (root) {
  'use strict';

  // ---------- parsing & formatting ----------
  // Accepts "1,5" and "1.5" (Dutch keyboards). Empty / invalid -> null.
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const n = parseFloat(String(v).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  // dd/mm/yyyy
  function dmy(d) {
    d = d || new Date();
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  // ---------- energy ----------
  // Calories derived from macros (4/4/9), used for budgets.
  function macroKcal(p, f, c) { return 4 * (p || 0) + 9 * (f || 0) + 4 * (c || 0); }

  // Calories used for a product: label kcal if given, otherwise derived from macros.
  function kcalUsed(prod) {
    if (prod.kcal != null && prod.kcal > 0) return prod.kcal;
    return macroKcal(prod.p, prod.f, prod.c);
  }

  // Sanity check of label kcal vs macros (fibre counted at 2 kcal/g, as on EU labels).
  // Returns null if fine or no label kcal, else {label, computed}.
  function sanity(prod) {
    if (!(prod.kcal > 0)) return null;
    const computed = macroKcal(prod.p, prod.f, prod.c) + 2 * (prod.fiber || 0);
    const diff = Math.abs(prod.kcal - computed);
    const tol = Math.max(25, 0.15 * Math.max(prod.kcal, computed));
    return diff > tol ? { label: prod.kcal, computed: computed } : null;
  }

  function isIncomplete(prod) {
    return prod.p == null || prod.f == null || prod.c == null;
  }

  // ---------- names ----------
  // Your own name (alias) wins for display; the product name from the label/database is kept untouched.
  function displayName(prod) {
    const a = (prod.alias || '').trim();
    return a || (prod.name || '').trim();
  }
  // Case-insensitive search over alias, product name and brand.
  function matches(prod, q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return true;
    return [prod.alias, prod.name, prod.brand].join(' ').toLowerCase().indexOf(q) >= 0;
  }

  // ---------- per-product metrics ----------
  // 'g' (solids, per 100 g) or 'ml' (liquids, per 100 ml). Missing = 'g'.
  function unit(prod) { return prod && prod.unit === 'ml' ? 'ml' : 'g'; }

  function edibleWeight(prod) {
    if (unit(prod) === 'g' && prod.edible > 0) return prod.edible;
    if (prod.pack > 0) return prod.pack;
    return null;
  }

  function metrics(prod) {
    const kcal = kcalUsed(prod);
    const p = prod.p || 0, f = prod.f || 0, c = prod.c || 0, fi = prod.fiber || 0;
    const derived = macroKcal(p, f, c);
    const m = {
      kcal: kcal,
      p100: p, f100: f, c100: c,
      pPer100kcal: kcal > 0 ? (p / kcal) * 100 : null,
      fPer100kcal: kcal > 0 ? (f / kcal) * 100 : null,
      cPer100kcal: kcal > 0 ? (c / kcal) * 100 : null,
      fiberPer100kcal: kcal > 0 && prod.fiber != null ? (fi / kcal) * 100 : null,
      pShare: derived > 0 ? (4 * p / derived) * 100 : null,
      fShare: derived > 0 ? (9 * f / derived) * 100 : null,
      cShare: derived > 0 ? (4 * c / derived) * 100 : null,
      costPerGP: null, costPerGF: null, costPerGC: null, // euro per gram of that macro
      kcalPerEuro: null,
      pricePerKg: null,        // € per kg or per litre of the whole pack (shelf-label style)
      pricePerKgDrained: null  // € per kg of drained weight (solids only)
    };
    if (prod.price > 0 && prod.pack > 0) m.pricePerKg = prod.price / prod.pack * 1000;
    if (prod.price > 0 && unit(prod) === 'g' && prod.edible > 0) m.pricePerKgDrained = prod.price / prod.edible * 1000;
    const w = edibleWeight(prod);
    if (prod.price > 0 && w > 0) {
      const gP = (w * p) / 100, gF = (w * f) / 100, gC = (w * c) / 100;
      m.costPerGP = gP > 0 ? prod.price / gP : null;
      m.costPerGF = gF > 0 ? prod.price / gF : null;
      m.costPerGC = gC > 0 ? prod.price / gC : null;
      m.kcalPerEuro = (w * kcal) / 100 / prod.price;
    }
    return m;
  }

  // Nutrition for a given amount in grams.
  function scale(prod, grams) {
    const k = grams / 100;
    return {
      kcal: kcalUsed(prod) * k,
      p: (prod.p || 0) * k,
      f: (prod.f || 0) * k,
      c: (prod.c || 0) * k,
      fiber: (prod.fiber || 0) * k
    };
  }

  // ---------- budgets & fit ----------
  // b = {p, f, c} in grams (any of: a daily target, or what's left today).
  function budgetFrom(b) {
    if (!b || b.p == null || b.f == null || b.c == null) return null;
    return { kcal: macroKcal(b.p, b.f, b.c), p: b.p, f: b.f, c: b.c };
  }

  const KEYS = ['kcal', 'p', 'f', 'c'];

  function fit(prod, grams, b) {
    const B = budgetFrom(b);
    if (!B) return null;
    const s = scale(prod, grams);
    const out = { left: {}, pct: {}, maxGrams: null, limit: null };
    KEYS.forEach(function (k) {
      out.left[k] = B[k] - s[k];
      out.pct[k] = B[k] > 0 ? (s[k] / B[k]) * 100 : (s[k] > 0 ? Infinity : 0);
    });
    const per100 = { kcal: kcalUsed(prod), p: prod.p || 0, f: prod.f || 0, c: prod.c || 0 };
    let best = Infinity, lim = null;
    KEYS.forEach(function (k) {
      if (per100[k] > 0) {
        const cap = (Math.max(0, B[k]) / per100[k]) * 100;
        if (cap < best) { best = cap; lim = k; }
      }
    });
    if (best !== Infinity) { out.maxGrams = best; out.limit = lim; }
    return out;
  }

  // ---------- library sorting ----------
  // better: 'high' = bigger is better, 'low' = smaller is better
  const METRICS = [
    { key: 'name', label: 'Name (A–Z)', unit: '', better: 'high', text: true, get: function () { return null; }, dec: 0 },
    { key: 'pPer100kcal', label: 'Protein per 100 kcal', unit: 'g', better: 'high', get: function (m) { return m.pPer100kcal; }, dec: 1 },
    { key: 'fPer100kcal', label: 'Fat per 100 kcal', unit: 'g', better: 'high', get: function (m) { return m.fPer100kcal; }, dec: 1 },
    { key: 'cPer100kcal', label: 'Carbs per 100 kcal', unit: 'g', better: 'high', get: function (m) { return m.cPer100kcal; }, dec: 1 },
    { key: 'pShare', label: 'Protein share of calories', unit: '%', better: 'high', get: function (m) { return m.pShare; }, dec: 0 },
    { key: 'fShare', label: 'Fat share of calories', unit: '%', better: 'high', get: function (m) { return m.fShare; }, dec: 0 },
    { key: 'cShare', label: 'Carb share of calories', unit: '%', better: 'high', get: function (m) { return m.cShare; }, dec: 0 },
    { key: 'p100', label: 'Protein per 100 g/ml', unit: 'g', better: 'high', get: function (m) { return m.p100; }, dec: 1 },
    { key: 'f100', label: 'Fat per 100 g/ml', unit: 'g', better: 'high', get: function (m) { return m.f100; }, dec: 1 },
    { key: 'c100', label: 'Carbs per 100 g/ml', unit: 'g', better: 'high', get: function (m) { return m.c100; }, dec: 1 },
    { key: 'costP', label: '€ per 100 g protein', unit: '€', better: 'low', get: function (m) { return m.costPerGP == null ? null : m.costPerGP * 100; }, dec: 2 },
    { key: 'costF', label: '€ per 100 g fat', unit: '€', better: 'low', get: function (m) { return m.costPerGF == null ? null : m.costPerGF * 100; }, dec: 2 },
    { key: 'costC', label: '€ per 100 g carbs', unit: '€', better: 'low', get: function (m) { return m.costPerGC == null ? null : m.costPerGC * 100; }, dec: 2 },
    { key: 'pricePerKg', label: '€ per kg / litre', unit: '€', better: 'low', get: function (m) { return m.pricePerKg; }, dec: 2 },
    { key: 'kcalPerEuro', label: 'kcal per €', unit: 'kcal', better: 'high', get: function (m) { return m.kcalPerEuro; }, dec: 0 },
    { key: 'fiberPer100kcal', label: 'Fibre per 100 kcal', unit: 'g', better: 'high', get: function (m) { return m.fiberPer100kcal; }, dec: 1 },
    { key: 'kcal100', label: 'kcal per 100 g/ml', unit: 'kcal', better: 'low', get: function (m) { return m.kcal; }, dec: 0 }
  ];

  function metricDef(key) {
    for (let i = 0; i < METRICS.length; i++) if (METRICS[i].key === key) return METRICS[i];
    return METRICS[0];
  }

  // Returns [{prod, value}] with null values last. dir: 'best' (best first) or 'worst'.
  function sortProducts(list, key, dir) {
    const def = metricDef(key);
    if (def.text) {
      const named = list.map(function (prod) { return { prod: prod, value: null, text: displayName(prod) }; });
      named.sort(function (a, b) {
        if (!a.text !== !b.text) return a.text ? -1 : 1;   // unnamed items last
        const c = a.text.localeCompare(b.text, 'nl', { sensitivity: 'base', numeric: true });
        return dir === 'worst' ? -c : c;
      });
      return named;
    }
    const rows = list.map(function (prod) { return { prod: prod, value: def.get(metrics(prod)) }; });
    const have = rows.filter(function (r) { return r.value != null && Number.isFinite(r.value); });
    const none = rows.filter(function (r) { return !(r.value != null && Number.isFinite(r.value)); });
    const bestHigh = def.better === 'high';
    const wantHighFirst = dir === 'worst' ? !bestHigh : bestHigh;
    have.sort(function (a, b) { return wantHighFirst ? b.value - a.value : a.value - b.value; });
    return have.concat(none);
  }

  // ---------- fill my gap ----------
  // gap = {p, f, c} grams still to eat. focus: 'kcal' | 'p' | 'f' | 'c'.
  // For each item: the largest amount that overshoots no macro (and no kcal), and how much of the gap that fills.
  function fillGap(list, gap, focus) {
    const B = budgetFrom(gap);
    if (!B) return [];
    focus = focus || 'kcal';
    if (!(B[focus] > 0)) return [];
    const rows = [];
    list.forEach(function (prod) {
      if (isIncomplete(prod)) return;
      const f = fit(prod, 0, gap);
      if (!f || !(f.maxGrams > 0)) return;
      const got = scale(prod, f.maxGrams);
      if (!(got[focus] > 0)) return;
      rows.push({ prod: prod, amount: f.maxGrams, limit: f.limit, got: got, score: Math.min(1, got[focus] / B[focus]) });
    });
    rows.sort(function (a, b) { return b.score - a.score || a.amount - b.amount; });
    return rows;
  }

  // ---------- compare two items ----------
  function compare(a, b) {
    const ma = metrics(a), mb = metrics(b);
    return METRICS.filter(function (d) { return !d.text; }).map(function (d) {
      const va = d.get(ma), vb = d.get(mb);
      let winner = null;
      if (va != null && vb != null && Number.isFinite(va) && Number.isFinite(vb)) {
        const ra = Number(va.toFixed(d.dec)), rb = Number(vb.toFixed(d.dec));
        winner = ra === rb ? 'tie' : ((d.better === 'high') === (ra > rb) ? 'a' : 'b');
      }
      return { key: d.key, label: d.label, unit: d.unit, dec: d.dec, a: va, b: vb, winner: winner };
    });
  }

  // ---------- rescan merge ----------
  // Fields a barcode lookup may fill. Values the user typed (prod.edited[k]) are never replaced.
  // Items created before edit-tracking existed (no prod.tracked) keep every value they already have.
  const LOOKUP_FIELDS = ['name', 'brand', 'kcal', 'p', 'f', 'c', 'fiber', 'pack', 'unit'];
  function isProtected(prod, k) {
    const has = prod[k] != null && prod[k] !== '';
    return !!(prod.edited && prod.edited[k]) || (!prod.tracked && has);
  }
  function mergeLookup(prod, found) {
    const out = Object.assign({}, prod), changed = [];
    LOOKUP_FIELDS.forEach(function (k) {
      const v = found[k];
      if (v == null || v === '' || isProtected(prod, k)) return;
      if (prod[k] !== v) { out[k] = v; changed.push(k); }
    });
    if (out.unit === 'ml' && out.edible != null && !(prod.edited && prod.edited.edible)) { out.edible = null; changed.push('edible'); }
    if (changed.length && out.source !== 'off') out.source = 'off';
    return { prod: out, changed: changed };
  }

  // ---------- price history ----------
  function ensureHistory(prod) {
    if (!Array.isArray(prod.priceHistory)) prod.priceHistory = [];
    if (!prod.priceHistory.length && prod.price > 0) {
      prod.priceHistory.push({ price: prod.price, date: prod.priceDate || '', source: prod.priceSource || '' });
    }
    return prod.priceHistory;
  }
  // Mutates prod. Adds a history entry only when the price actually changed.
  function recordPrice(prod, price, date, source) {
    if (!(price > 0)) return false;
    const h = Array.isArray(prod.priceHistory) ? prod.priceHistory : (prod.priceHistory = []);
    const last = h[h.length - 1];
    prod.price = price; prod.priceDate = date; prod.priceSource = source || '';
    if (last && Math.abs(last.price - price) < 0.005) return false;
    h.push({ price: price, date: date, source: source || '' });
    if (h.length > 30) h.splice(0, h.length - 30);
    return true;
  }
  function priceStats(prod) {
    const h = Array.isArray(prod.priceHistory) ? prod.priceHistory : [];
    if (!h.length) return null;
    const prices = h.map(function (e) { return e.price; });
    const last = h[h.length - 1], prev = h.length > 1 ? h[h.length - 2] : null;
    return {
      count: h.length, lowest: Math.min.apply(null, prices), highest: Math.max.apply(null, prices),
      last: last.price, changePct: prev ? (last.price - prev.price) / prev.price * 100 : null
    };
  }

  // ---------- CSV ----------
  function csvCell(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCsv(products) {
    const head = ['alias', 'name', 'brand', 'barcode', 'kcal_per_100g', 'protein_per_100g', 'fat_per_100g', 'carbs_per_100g', 'fibre_per_100g',
      'unit', 'pack', 'drained_g', 'price_eur', 'price_date', 'source', 'added'];
    const lines = [head.join(',')];
    products.forEach(function (p) {
      lines.push([p.alias, p.name, p.brand, p.barcode, p.kcal, p.p, p.f, p.c, p.fiber, unit(p), p.pack, p.edible, p.price, p.priceDate, p.source, p.added]
        .map(csvCell).join(','));
    });
    return lines.join('\n');
  }

  // ---------- barcode validation (EAN-8 / UPC-A / EAN-13 / GTIN-14, GS1 check digit) ----------
  function validBarcode(code) {
    if (!/^\d+$/.test(code || '')) return false;
    if ([8, 12, 13, 14].indexOf(code.length) < 0) return false;
    let sum = 0, w = 3;
    for (let i = code.length - 2; i >= 0; i--) { sum += parseInt(code[i], 10) * w; w = w === 3 ? 1 : 3; }
    return ((10 - (sum % 10)) % 10) === parseInt(code[code.length - 1], 10);
  }

  const api = {
    num: num, dmy: dmy, displayName: displayName, matches: matches, macroKcal: macroKcal, kcalUsed: kcalUsed, sanity: sanity, isIncomplete: isIncomplete,
    unit: unit, edibleWeight: edibleWeight, metrics: metrics, scale: scale, budgetFrom: budgetFrom, fit: fit,
    validBarcode: validBarcode, METRICS: METRICS, metricDef: metricDef, sortProducts: sortProducts, toCsv: toCsv,
    fillGap: fillGap, compare: compare, LOOKUP_FIELDS: LOOKUP_FIELDS, isProtected: isProtected, mergeLookup: mergeLookup,
    ensureHistory: ensureHistory, recordPrice: recordPrice, priceStats: priceStats
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MC = api;
})(typeof self !== 'undefined' ? self : this);

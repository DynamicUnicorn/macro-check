# Macro Check

A small phone web app for the supermarket aisle. Scan a product's barcode (or type its macros), enter how much you'd eat, and see straight away:

- the calories and macros for that exact amount,
- how "pure" a source of protein, fat or carbs it is,
- what it costs per kg/litre and per gram of each macro,
- how it fits your training-day and rest-day targets, or what you have left today,
- which product in your library best fills what you still need to eat.

It is a companion to MacroFactor, not a replacement: MacroFactor tracks the diet, Macro Check judges whether a product is worth buying.

Live app: https://dynamicunicorn.github.io/macro-check/

---

## Contents

1. [Using the app](#using-the-app)
2. [What every number means](#what-every-number-means)
3. [Where the data comes from](#where-the-data-comes-from)
4. [Privacy and storage](#privacy-and-storage)
5. [Files in this project](#files-in-this-project)
6. [Updating and deploying](#updating-and-deploying)
7. [Tests](#tests)
8. [Known limitations](#known-limitations)
9. [Changelog](#changelog)

---

## Using the app

### First-time setup
1. Open the live link in **Chrome** (or Samsung Internet) on your phone and allow the camera when asked.
2. Menu → **Add to Home screen**. It then opens like an app and works offline (except lookups).
3. Go to **Settings** and fill in your **training day** and **rest day** targets (protein, fat, carbs in grams). Calories are calculated as 4×protein + 4×carbs + 9×fat. You only redo this when your targets change.

The app has four tabs: **Scan**, **Library**, **Tools** and **Settings**.

### Scan tab (top to bottom)
| Section | What it's for |
|---|---|
| **Scan / Manual / barcode box** | Scan with the camera (tap **🔦 Light** for the flashlight, shown when your phone supports it), type a barcode, or add an item by hand. A product you've scanned before opens from your library instantly. |
| **Item card** | Name, **Solid (g) / Liquid (ml)** switch, label values per 100 g or 100 ml, pack size, drained weight (solids only), price with **price history**, and the amount you plan to eat. Quick buttons: whole pack, ½ pack, drained, glass (250 ml, liquids), 100 g/ml, plus your own **servings**. |
| **This amount** | kcal, protein, fat and carbs for the amount entered, plus what that amount costs. |
| **Quality of the source** | Macros per 100 kcal and each macro's share of the calories. |
| **Cost** | € per kg or litre (and per kg drained), € per 100 g / 25 g protein, € per 100 g fat and carbs, kcal per €. |
| **Fit for your day** | One column each for *Left today* (if filled in under Settings), *Training day* and *Rest day*: what's left after eating this amount, % of the budget used, and the maximum amount you could eat plus which macro runs out first. Red = over budget, orange = 90 %+ used. The Training/Rest switch only highlights a column. |

**Servings:** tap **＋ Serving**, give it a name (scoop, egg, slice…) and the grams or ml of one serving. It's saved with that product. Tap the serving to set the amount; tap it again to add another (2 × scoop, 3 × scoop…). ✕ removes it.

**Price history:** every time you change a price (when you leave the field) the old price is kept with its date. Once there are two or more prices you see the last five, the change versus the previous price, and the lowest and highest seen.

**Crowd prices:** after a scan, the app checks Open Prices for a recent shop price for that barcode (Dutch shops preferred). If it finds one you get a **Use** button; it never fills in a price by itself. Most AH products have no crowd price yet, so usually you'll just type the shelf price.

### Library tab
Every scanned or manual item, sortable by:
- **Name (A–Z / Z–A)**
- protein / fat / carbs **per 100 kcal** ("purest source")
- protein / fat / carb **share of calories**
- protein / fat / carbs / kcal **per 100 g/ml**
- **€ per 100 g protein / fat / carbs**, **€ per kg / litre**, **kcal per €**
- **fibre per 100 kcal**

Quick chips: *Pure protein*, *Pure fat*, *Pure carbs*, *Cheapest protein/fat/carbs*, *A–Z*. The button next to the dropdown flips the order. Items without the needed data (e.g. no price) sit at the bottom marked *n/a*. ⚠️ = label kcal don't match the macros, ❓ = a macro is missing. Tap a row to open it.

**🔄 Rescan library** looks up every item that has a barcode again, about one per second, and shows what changed:
- Values you typed or changed yourself are **never** replaced. The app remembers per field which ones you edited.
- Items saved before v4 have no edit history, so for those the rescan only **fills empty fields** and never overwrites an existing value.
- Fields it can fill or update: name, brand, kcal, macros, fibre, pack size and solid/liquid. Switching to liquid clears the drained weight.
- **Empty prices** are filled from Open Prices, but only with a price from a Dutch shop. Prices you already have are never touched.
- Manual items (no barcode) are skipped.

### Tools tab
**Fill my gap:** enter what you still need to eat (or tap *Use "Left today"*), and choose what to fill mostly: calories, protein, fat or carbs. Every library item gets the **largest amount you can eat without going over any macro or the calories**, ranked by how much of your chosen target that amount fills. Each row shows the amount, number of packs, cost, the macros it delivers and which macro is the limit. Tap a row to open the item with that amount filled in.

**Compare two items:** pick two products and see every library metric side by side. The better value per line is green, and the bottom line counts how many lines each wins. Not every line matters for your goal (a cheaper kcal-per-€ isn't a win if you're cutting), so read the lines you care about.

### Settings tab
- **Left today:** optional. Copy the remaining protein, fat and carbs from MacroFactor; kcal are calculated. Used by *Fit for your day* and *Fill my gap*. The app warns you when the numbers are from an earlier day.
- Training and rest day targets.
- **Export CSV** (for a spreadsheet), **Backup (JSON)** and **Restore backup**.
- **Delete all items** (targets are kept).

---

## What every number means

All per-100 values are per **100 g** for solids and per **100 ml** for liquids, exactly as the label states them.

| Metric | Formula |
|---|---|
| kcal used | label kcal; if empty, 4P + 9F + 4C |
| Macro per 100 kcal | macro per 100 g ÷ kcal per 100 g × 100 |
| Share of calories | 4P (or 9F, 4C) ÷ (4P + 9F + 4C) × 100 % |
| Amount values | per-100 value × amount ÷ 100 |
| € per kg / litre | price ÷ pack size × 1000 |
| € per kg drained | price ÷ drained weight × 1000 (solids only) |
| € per gram of a macro | price ÷ (weight used × macro per 100 ÷ 100) |
| kcal per € | weight used × kcal per 100 ÷ 100 ÷ price |
| Max amount | smallest of (budget ÷ per-100 value × 100) over kcal, P, F and C; negative budgets count as 0 |
| Label check | flags when label kcal differ from 4P + 9F + 4C + 2×fibre by more than 25 kcal or 15 % |
| Fill my gap: amount | the max amount above, with your gap as the budget |
| Fill my gap: score | (chosen macro or kcal delivered at that amount) ÷ (gap for it), capped at 100 % |
| Price change | (new price − previous price) ÷ previous price |

"Weight used" for cost-per-macro is the drained weight if you entered one (solids), otherwise the pack size. Labels for canned fish usually describe the drained product, so entering the drained weight makes the € per gram protein honest. € per kg always uses the full pack, matching the shelf label.

EU labels already list carbohydrates *without* fibre, so no "net carbs" correction is applied.

---

## Where the data comes from

| Source | Used for | Cost |
|---|---|---|
| [Open Food Facts](https://world.openfoodfacts.org) | Product name, brand, macros, pack size and solid/liquid, looked up by barcode | Free, no key |
| [Open Prices](https://prices.openfoodfacts.org) | Optional crowd-sourced shop price suggestion | Free, no key |
| Phone camera | Barcode scanning via the browser's built-in `BarcodeDetector` (Chrome/Samsung on Android); falls back to the ZXing library from unpkg.com | Free |

Both databases are crowd-sourced: always glance at the label. If a product isn't found you can enter it manually, and you can correct any value after a lookup.

---

## Privacy and storage

- Your items, prices and targets are stored **only in your phone's browser** (localStorage). Nothing is uploaded.
- The only things sent anywhere are the scanned barcode (to Open Food Facts and Open Prices) and the camera library download.
- Clearing the browser's site data for the app **deletes everything**. Use *Backup (JSON)* now and then.
- The repository is public, but it contains only the app code, no personal data.

---

## Files in this project

| File | Purpose |
|---|---|
| `index.html` | The whole interface: layout, styles, and screen logic. |
| `core.js` | All calculations (metrics, scaling, budget fit, sorting, CSV, barcode checksum). No screen code, so it can be tested in Node. |
| `sw.js` | Service worker: caches the app for offline use and fast start. |
| `manifest.webmanifest` | Makes the app installable (name, icons, colours). |
| `icon-192.png`, `icon-512.png` | App icons. |
| `tests.js` | Unit tests for `core.js`. |
| `README.md` | This document. |

---

## Updating and deploying

The site is served by **GitHub Pages** from the `main` branch, root folder, of `DynamicUnicorn/macro-check`. Every push to `main` republishes the site within a minute or two.

When changing any app file:
1. Run the tests (below).
2. **Bump `VERSION` in `sw.js`** (e.g. `macro-check-v4` → `macro-check-v5`). Without this, phones keep showing the cached old version.
3. Commit and push to `main`.
4. On the phone, close and reopen the app once to load the new version.

Commits use the GitHub noreply address (`317667440+DynamicUnicorn@users.noreply.github.com`) because email privacy is on for the account; pushes with the real address are rejected.

---

## Tests

```
node tests.js
```
Runs hand-calculated checks for parsing (comma decimals), scaling, every metric, the budget fit and max amount, liquids, price per kg/litre, sorting (including A–Z), Fill my gap, Compare, the rescan merge rules (edited fields kept), price history, CSV output and barcode checksums. All test products are synthetic examples, not real label data.

---

## Known limitations

- **Camera scanning** needs HTTPS and a supported browser. Chrome/Samsung Internet on Android use the built-in detector; other browsers use the fallback library, which needs internet the first time.
- **Open Food Facts** asks apps to identify themselves with a custom User-Agent header; browsers don't allow a web page to set one, so requests go out with the browser's normal header.
- **Open Prices** coverage for Dutch shops is thin, and the app could not be tested against its live CORS policy. If the lookup is blocked, you simply see "No crowd price".
- **Pack size and solid/liquid** from Open Food Facts are sometimes missing or wrong; check them for new products.
- **MacroFactor** has no public API, so "Left today" is typed in by hand.
- Liquids are handled per 100 ml throughout; there is no conversion between grams and millilitres.
- **Flashlight** depends on the phone and browser exposing torch control; on phones that don't, the button stays hidden.
- **Fill my gap** ignores pack size: it may suggest 2.3 packs. It also ranks one product at a time, not combinations.
- **Rescan** has to stay open while it runs; leaving the app pauses it. Run it again to finish; already-updated items are simply re-checked.

---

## Changelog

All dates dd/mm/yyyy.

- **23/10/2026 – v4**: Tools tab with *Fill my gap* and *Compare*; flashlight in the scanner; saved servings; price history; *Rescan library* (keeps your own edits); *Left today* moved to Settings.
- **23/10/2026 – v3**: liquids (ml) support, € per kg/litre (and per kg drained), A–Z sorting, this documentation.
- **23/10/2026 – v2**: scan page reordered (item and numbers first, fit and *Left today* at the bottom); crowd price suggestion from Open Prices.
- **23/10/2026 – v1**: first version: barcode lookup, metrics, training/rest targets, budget fit, library sorting, CSV/backup.

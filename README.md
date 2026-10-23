# Macro Check

A small phone web app for the supermarket aisle. Scan a product's barcode (or type its macros), enter how much you'd eat, and see straight away:

- the calories and macros for that exact amount,
- how "pure" a source of protein, fat or carbs it is,
- what it costs per kg/litre and per gram of each macro,
- how it fits your training-day and rest-day targets, or what you have left today,
- which product in your library, or anywhere in the AH / Jumbo / Picnic catalogue, best fills what you still need to eat.

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
8. [Working on another machine](#working-on-another-machine)
9. [Sync and prices from Claude](#sync-and-prices-from-claude)
10. [Known limitations](#known-limitations)
11. [Changelog](#changelog)

---

## Using the app

### First-time setup
1. Open the live link in **Chrome** (or Samsung Internet) on your phone and allow the camera when asked.
2. Menu → **Add to Home screen**. It then opens like an app and works offline (except lookups).
3. Go to **Settings** and fill in your **training day** and **rest day** targets (protein, fat, carbs in grams). Calories are calculated as 4×protein + 4×carbs + 9×fat. You only redo this when your targets change.

The app has five tabs: **Scan**, **Library**, **Catalogue**, **Tools** and **Settings**.

### Scan tab (top to bottom)
| Section | What it's for |
|---|---|
| **Scan / Manual / barcode box** | Scan with the camera (tap **🔦 Light** for the flashlight, shown when your phone supports it), type a barcode, or add an item by hand. A product you've scanned before opens from your library instantly. |
| **Item card** | **Your name for it** (optional alias), the product name, **Solid (g) / Liquid (ml)** switch, label values per 100 g or 100 ml, pack size, drained weight (solids only), price with **price history**, and the amount you plan to eat. Quick buttons: whole pack, ½ pack, drained, glass (250 ml, liquids), 100 g/ml, plus your own **servings**. |
| **This amount** | kcal, protein, fat and carbs for the amount entered, plus what that amount costs. |
| **Quality of the source** | Macros per 100 kcal and each macro's share of the calories. |
| **Cost** | € per kg or litre (and per kg drained), € per 100 g / 25 g protein, € per 100 g fat and carbs, kcal per €. |
| **Fit for your day** | One column each for *Left today* (if filled in under Settings), *Training day* and *Rest day*: what's left after eating this amount, % of the budget used, and the maximum amount you could eat plus which macro runs out first. Red = over budget, orange = 90 %+ used. The Training/Rest switch only highlights a column. |

**Your own names (aliases):** give any product a name that makes sense to you, e.g. "Quark" for "AH Lactosevrije magere kwark". The alias is shown everywhere (library, Tools, picker, compare). The original product name stays as it is and shows in small text underneath. Search matches your name, the product name and the brand. Scanning the same barcode again opens the existing item, never a duplicate, and a rescan never touches your alias.

**Servings:** tap **＋ Serving**, give it a name (scoop, egg, slice…) and the grams or ml of one serving. It's saved with that product. Tap the serving to set the amount; tap it again to add another (2 × scoop, 3 × scoop…). ✕ removes it.

**Price history:** every time you change a price (when you leave the field) the old price is kept with its date. Once there are two or more prices you see the last five, the change versus the previous price, and the lowest and highest seen.

**Crowd prices:** after a scan, the app checks Open Prices for a recent shop price for that barcode (Dutch shops preferred). If it finds one you get a **Use** button; it never fills in a price by itself. Most AH products have no crowd price yet, so usually you'll just type the shelf price.

### Library tab
Every scanned or manual item, sortable by:
- **Name (A–Z / Z–A)**: by your alias when set, otherwise the product name
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

### Catalogue tab
Thousands of products sold at **Albert Heijn, Jumbo and Picnic**, taken from Open Food Facts and refreshed every week (see [The catalogue](#the-catalogue)).
- **Shop chips** (AH / Jumbo / Picnic) filter by shop. **Quick chips**: *Pure protein*, *Pure fat*, *Pure carbs*, *Lowest kcal*, *Most fibre*, *A–Z*. The dropdown has every macro metric (price metrics are left out: the catalogue has no prices). The search box matches name and brand.
- 60 results at a time; *Show more* loads the next 60. Products you already own are marked **✓ mine**.
- **Tap a product** to open it on the Scan tab as a *preview*: all the numbers and the fit for your day, without saving. **Save**, or editing anything (price, alias, a serving), adds it to your library. *Close* discards it. Opening a product you already own opens your own copy, with your edits.

### Tools tab
**Fill my gap:** enter what you still need to eat (or tap *Use "Left today"*), choose what to fill mostly (calories, protein, fat or carbs), and where to look: **My library**, the **Catalogue** (with shop chips), or **Both**. Catalogue products you already own are shown once, as your library copy. Every library item gets the **largest amount you can eat without going over any macro or the calories**, ranked by how much of your chosen target that amount fills. Each row shows the amount, number of packs, cost (library items with a price), the macros it delivers and which macro is the limit. Tap a row to open the item with that amount filled in (catalogue rows open as a preview).

**Compare two items:** tap each button to open a compact, searchable list (type part of your name, the product name or the brand), then pick two products and see every library metric side by side. The better value per line is green, and the bottom line counts how many lines each wins. Not every line matters for your goal (a cheaper kcal-per-€ isn't a win if you're cutting), so read the lines you care about.

### Settings tab
- **Sync with GitHub:** see [Sync and prices from Claude](#sync-and-prices-from-claude).
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
| `tests/unit.js` | Unit tests for `core.js` (hand-calculated cases). |
| `tests/ui-smoke.js` | UI test: runs the real `index.html` in a simulated browser (jsdom), with Open Food Facts and Open Prices mocked, and clicks through every feature. |
| `package.json`, `package-lock.json` | Test scripts and the one test dependency (jsdom). Not used by the app itself. |
| `.github/workflows/test.yml` | Runs all tests on GitHub on every push. |
| `scripts/build-catalog.js` | Builds the catalogue from Open Food Facts (no dependencies). |
| `catalog/catalog.json` | The catalogue itself, written by the weekly workflow. Don't edit by hand. |
| `.github/workflows/catalog.yml` | Weekly/on-demand catalogue build; commits the result and republishes the site. |
| `tests/catalog.js` | Tests for the catalogue builder, against a fake Open Food Facts API. |
| `CLAUDE.md` | Project conventions for Claude when working on this repo in a new session. |
| `README.md` | This document. |

---

## Updating and deploying

The site is served by **GitHub Pages** from the `main` branch, root folder, of `DynamicUnicorn/macro-check`. Every push to `main` republishes the site within a minute or two.

When changing any app file:
1. Run the tests: `npm test` (see below).
2. **Bump `VERSION` in `sw.js`** (e.g. `macro-check-v7` → `macro-check-v8`). Without this, phones keep showing the cached old version.
3. Commit and push to `main`.
4. On the phone, close and reopen the app once to load the new version.

Commits use the GitHub noreply address (`317667440+DynamicUnicorn@users.noreply.github.com`) because email privacy is on for the account; pushes with the real address are rejected.

---

## Tests

Needs [Node.js](https://nodejs.org) 20 or newer. From the project folder, on any machine:

```
npm install      # once: installs jsdom for the UI test
npm test         # runs both test suites
```

- `npm run test:unit`: hand-calculated checks for parsing (comma decimals), scaling, every metric, the budget fit and max amount, liquids, price per kg/litre, sorting (including A–Z), aliases and search, Fill my gap, Compare, the sync price-merge rules, the rescan merge rules (edited fields kept), price history, CSV output and barcode checksums. All test products are synthetic examples, not real label data.
- `npm run test:catalog`: the catalogue builder's filtering rules (missing or impossible macros, kJ conversion, liquids, shop merging) and a full run against a fake API, including paging, rate-limit waits and a retried 429.
- `npm run test:ui`: loads the app in a simulated browser and checks targets, manual entry, barcode lookup (mocked), crowd prices, layout order, liquids, servings, price history, the library and its sorting, aliases, the picker, Fill my gap, Compare, a full rescan, GitHub sync (against a mocked GitHub API), and the catalogue: filters, search, preview/save/close, Fill my gap over the catalogue, and the offline barcode fallback. It doesn't cover the camera, the flashlight or real network calls.

GitHub also runs `npm test` on every push (the **Actions** tab). A red cross on a commit means a test failed.

---

## Working on another machine

Everything needed lives in the GitHub repo; nothing depends on a specific computer.

1. `git clone https://github.com/DynamicUnicorn/macro-check` (or `git pull` in an existing copy).
2. `git config user.email "317667440+DynamicUnicorn@users.noreply.github.com"` in that copy, so pushes aren't blocked by email privacy.
3. `npm install`, then `npm test` before pushing.
4. Follow [Updating and deploying](#updating-and-deploying).

With Claude: open the same chat on any device, or start a new one and ask Claude to attach `DynamicUnicorn/macro-check`; `CLAUDE.md` gives it the project conventions.

---

## The catalogue

`catalog/catalog.json` is built by `scripts/build-catalog.js`, running on GitHub Actions (`.github/workflows/catalog.yml`):
- **When:** every Monday at 03:23 UTC, or on demand (GitHub → Actions → *catalogue* → *Run workflow*).
- **What:** the Open Food Facts search API, Netherlands only, products tagged with the **store** or **brand** Albert Heijn/AH, Jumbo or Picnic. A product found under several shops gets all of them.
- **Kept:** products with protein, fat and carbs per 100 g/ml. kcal comes from the label, else kJ ÷ 4.184, else 4/4/9. Products with impossible values (P+F+C over 105 g, kcal over 950, negative values) or no name are dropped.
- **Stored per product:** barcode, name (Dutch where available), brand, shops, pack size, g/ml, kcal, protein, fat, carbs, fibre, sugar.
- **Safety:** the job refuses to replace the catalogue with one less than 60 % of the previous size (an API outage shouldn't wipe it), and it respects the 10-searches-a-minute limit, so a full build takes a while.
- The app downloads the file the first time you open the Catalogue (or a catalogue search in Fill my gap) and then keeps it for offline use. If Open Food Facts is unreachable when you scan, the barcode is looked up in the catalogue instead.

**How complete is it?** Only as complete as Open Food Facts: products that someone has added and tagged with one of these shops. Store tags are often missing, so some products sold at a shop won't show up under it. New or corrected products appear in the Open Food Facts API **immediately** after they're saved, so they reach the catalogue at the next weekly build. Products you add through **MacroFactor's food submission** (with the consent slider on) are sent to Open Food Facts, so they flow in too, but MacroFactor doesn't say how quickly it forwards them.

**Licence:** the catalogue is a derived database of Open Food Facts, available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/). Data © Open Food Facts contributors. Keep this attribution if you reuse it.

---

## Sync and prices from Claude

The app can keep a copy of your **product library** in a **private** repo, `DynamicUnicorn/macro-check-data`, as `library.json`. That lets Claude look up shelf prices (e.g. on ah.nl) and write them into the file, and the app pulls them in. Your targets, "Left today" and the token itself are **never uploaded**.

**One-time setup**
1. Create the repo: `gh repo create macro-check-data --private --add-readme`
2. Create a fine-grained token (GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens): only repository `macro-check-data`, permission **Contents: Read and write**, expiry 1 year.
3. In the app: Settings → Sync with GitHub → paste the token. It's stored only on that phone, and the field never shows it again.
4. Make sure the Claude GitHub App can access `macro-check-data`.

**Each round**
1. Scan items, then tap **☁️ Sync** (Library tab or Settings).
2. Ask Claude to fill in prices. Claude edits only `price`, `priceDate`, `priceSource` and `priceHistory` in `library.json` and commits.
3. Tap **☁️ Sync** again. The status line lists which prices came in.

**How a sync works:** download `library.json` → merge prices → upload your library. The merge rules:
- Only price fields are taken from GitHub. Names, aliases, macros and servings always come from the phone.
- The newer price (by date) wins. On the same date the phone's price is kept. Both price histories are combined.
- Items deleted on the phone are not brought back.
- If nothing changed, nothing is committed. If GitHub changed during the sync, the app merges again once and retries.

**Errors:** the status line explains a bad or expired token (401), missing write permission (403) and a wrong repo name or no access (404). When the token expires, make a new one and paste it in.

---

## Known limitations

- **Camera scanning** needs HTTPS and a supported browser. Chrome/Samsung Internet on Android use the built-in detector; other browsers use the fallback library, which needs internet the first time.
- **Open Food Facts** asks apps to identify themselves with a custom User-Agent header; browsers don't allow a web page to set one, so requests go out with the browser's normal header.
- **Open Prices** coverage for Dutch shops is thin, and the app could not be tested against its live CORS policy. If the lookup is blocked, you simply see "No crowd price".
- **Pack size and solid/liquid** from Open Food Facts are sometimes missing or wrong; check them for new products.
- **MacroFactor** has no public API, so "Left today" is typed in by hand.
- Liquids are handled per 100 ml throughout; there is no conversion between grams and millilitres.
- **Flashlight** depends on the phone and browser exposing torch control; on phones that don't, the button stays hidden.
- **Catalogue** coverage depends on Open Food Facts' store and brand tags. Missing tags mean missing products; wrong labels mean wrong numbers. It has no prices.
- **Fill my gap** ignores pack size: it may suggest 2.3 packs. It also ranks one product at a time, not combinations.
- **Sync** stores the token in the phone's browser storage. Anyone with your unlocked phone could use it, but only on `macro-check-data`. Use *Forget token* if you lend your phone out. `library.json` must stay under 1 MB (roughly 1,500 items) for GitHub's contents API.
- **Rescan** has to stay open while it runs; leaving the app pauses it. Run it again to finish; already-updated items are simply re-checked.

---

## Changelog

All dates dd/mm/yyyy.

- **23/10/2026 – v7**: Catalogue of AH / Jumbo / Picnic products from Open Food Facts, rebuilt weekly on GitHub; preview and save to library; Fill my gap can search the catalogue; offline barcode fallback.
- **23/10/2026 – v6**: *Sync with GitHub*: product library to a private repo, prices merged back in. Targets and token never leave the phone.
- **23/10/2026 – tooling**: tests moved to `tests/`, made path-independent, runnable with `npm test` on any machine and on GitHub Actions; `CLAUDE.md` added.
- **23/10/2026 – v5**: custom names (aliases) shown everywhere without changing the product name; compact searchable item picker for Compare.
- **23/10/2026 – v4**: Tools tab with *Fill my gap* and *Compare*; flashlight in the scanner; saved servings; price history; *Rescan library* (keeps your own edits); *Left today* moved to Settings.
- **23/10/2026 – v3**: liquids (ml) support, € per kg/litre (and per kg drained), A–Z sorting, this documentation.
- **23/10/2026 – v2**: scan page reordered (item and numbers first, fit and *Left today* at the bottom); crowd price suggestion from Open Prices.
- **23/10/2026 – v1**: first version: barcode lookup, metrics, training/rest targets, budget fit, library sorting, CSV/backup.

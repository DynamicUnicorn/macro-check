// Run: npm test (or: node tests/release.js) — checks that one release number is used consistently.
// A mismatch lets a phone run a new page with an old core.js (or keep an old cache), which breaks the app.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html'), sw = read('sw.js');
const found = {
  'sw.js VERSION': (sw.match(/const VERSION = 'macro-check-v(\d+)'/) || [])[1],
  'sw.js SHELL core.js?v=': (sw.match(/'core\.js\?v=(\d+)'/) || [])[1],
  'index.html core.js?v=': (html.match(/<script src="core\.js\?v=(\d+)"><\/script>/) || [])[1],
  'Settings "Macro Check vN"': (html.match(/Macro Check v(\d+)/) || [])[1]
};
const vals = Object.values(found);
const ok = vals.every((v) => v && v === vals[0]);
console.log(Object.entries(found).map(([k, v]) => '  ' + k + ': ' + v).join('\n'));
console.log(ok ? 'RELEASE ALL PASSED (v' + vals[0] + ')' : 'FAIL release numbers differ — bump all four together');
process.exit(ok ? 0 : 1);

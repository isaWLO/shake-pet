const assert = require('node:assert/strict');
const fs = require('node:fs');
const { clampToyPosition } = require('../world-layout');

assert.deepEqual(
  clampToyPosition(900, -20, { width: 800, height: 600 }, { width: 240, height: 300 }),
  { left: 544, top: 16 }
);

const styles = fs.readFileSync(require.resolve('../styles.css'), 'utf8');
const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
assert.equal(styles.includes('html[data-platform="web"] #editor-ai'), false, 'web AI cutout button must stay visible');
assert.match(styles, /html\[data-platform="web"\] #capture\s*\{\s*display:\s*none;/, 'web screenshot button must stay hidden');
assert.equal(html.includes('web-capture.js'), false, 'web screenshot bridge must be removed');
assert.match(styles, /@media \(max-width: 560px\)[\s\S]*#toy[\s\S]*height: calc\(100dvh - 102px\)/, 'mobile toy layout must fit viewport height');
assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/, 'mobile viewport must be enabled');

console.log('web features: ok');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { clampToyPosition } = require('../world-layout');

assert.deepEqual(
  clampToyPosition(900, -20, { width: 800, height: 600 }, { width: 240, height: 300 }),
  { left: 544, top: 16 }
);

const styles = fs.readFileSync(require.resolve('../styles.css'), 'utf8');
assert.equal(styles.includes('html[data-platform="web"] #editor-ai'), false, 'web AI cutout button must stay visible');

console.log('web features: ok');

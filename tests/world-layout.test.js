const assert = require('node:assert/strict');
const { getWorldSize } = require('../world-layout');

assert.deepEqual(
  getWorldSize({ clientWidth: 486.4, clientHeight: 632.7 }, 1200, 800),
  { width: 486, height: 633 }
);

assert.deepEqual(
  getWorldSize({ clientWidth: 0, clientHeight: 0 }, 360, 460),
  { width: 360, height: 460 }
);

console.log('world layout: ok');

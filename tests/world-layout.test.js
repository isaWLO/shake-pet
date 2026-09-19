const assert = require('node:assert/strict');
const { getWorldSize, getAudioWaveImpulse } = require('../world-layout');

assert.deepEqual(
  getWorldSize({ clientWidth: 486.4, clientHeight: 632.7 }, 1200, 800),
  { width: 486, height: 633 }
);

assert.deepEqual(
  getWorldSize({ clientWidth: 0, clientHeight: 0 }, 360, 460),
  { width: 360, height: 460 }
);

const crest = getAudioWaveImpulse(
  { risePixels: 12, displayedLevel: .8, slope: .5 },
  1,
  1,
  1,
  .4
);
assert.ok(crest.y < -3, 'a nearby crest should lift the image');
assert.ok(Math.abs(crest.x) <= 1.2, 'horizontal motion should stay subtle');
assert.deepEqual(
  getAudioWaveImpulse({ risePixels: 12, displayedLevel: .8, slope: .5 }, 0, 1, 1, .4),
  { x: 0, y: 0 }
);
assert.deepEqual(
  getAudioWaveImpulse({ risePixels: 0, displayedLevel: .1, slope: 0 }, 1, 1, 1, 0),
  { x: 0, y: 0 }
);

console.log('world layout: ok');

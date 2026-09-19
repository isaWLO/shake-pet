const assert = require('node:assert/strict');
const { rgbaToIsNetInput, probabilitiesToAlpha } = require('../ai-cutout');

const input = rgbaToIsNetInput(new Uint8ClampedArray([
  255, 127, 0, 255,
  0, 255, 255, 255
]));

assert.ok(Math.abs(input[0] - 0.5) < 1e-6);
assert.ok(Math.abs(input[1] + 0.5) < 1e-6);
assert.ok(Math.abs(input[2] - (127 / 255 - 0.5)) < 1e-6);
assert.ok(Math.abs(input[3] - 0.5) < 1e-6);
assert.ok(Math.abs(input[4] + 0.5) < 1e-6);
assert.ok(Math.abs(input[5] - 0.5) < 1e-6);

assert.deepEqual(
  [...probabilitiesToAlpha(new Float32Array([0.2, 0.6, 1]), 8)],
  [0, 128, 255]
);
assert.throws(
  () => probabilitiesToAlpha(new Float32Array([0.4, 0.4]), 42),
  /没有识别到主体/
);

console.log('AI cutout conversion: ok');

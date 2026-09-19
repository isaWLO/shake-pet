const assert = require('node:assert/strict');
const {
  floodSelect,
  paintCircle,
  cleanMask,
  buildContainerDefinition,
  pointInPolygon,
  wallPoints,
  normalizeDefinition
} = require('../container-mask');

function rgba(width, height) {
  return new Uint8ClampedArray(width * height * 4);
}

function setPixel(data, width, x, y, red, green, blue, alpha) {
  const offset = (y * width + x) * 4;
  data.set([red, green, blue, alpha], offset);
}

{
  const width = 7;
  const height = 7;
  const pixels = rgba(width, height);
  for (let index = 1; index <= 5; index++) {
    setPixel(pixels, width, index, 1, 240, 120, 160, 255);
    setPixel(pixels, width, index, 5, 240, 120, 160, 255);
    setPixel(pixels, width, 1, index, 240, 120, 160, 255);
    setPixel(pixels, width, 5, index, 240, 120, 160, 255);
  }

  const selected = floodSelect(pixels, width, height, 3, 3, 0);
  assert.equal(selected.reduce((sum, value) => sum + value, 0), 9,
    'magic wand must not cross an opaque shell into a transparent exterior');
  assert.equal(selected[0], 0);

  const exterior = floodSelect(pixels, width, height, 0, 0, 0);
  assert.equal(exterior[3 * width + 3], 0,
    'selecting the exterior must not leak into the transparent screen opening');
}

{
  const mask = new Uint8Array(12 * 12);
  for (let y = 2; y <= 9; y++) {
    for (let x = 2; x <= 9; x++) mask[y * 12 + x] = 1;
  }
  mask[5 * 12 + 5] = 0;
  mask[0] = 1;

  const cleaned = cleanMask(mask, 12, 12);
  assert.equal(cleaned[0], 0, 'small disconnected islands must be discarded');
  assert.equal(cleaned[5 * 12 + 5], 1, 'holes inside the activity region must be filled');

  const definition = buildContainerDefinition(mask, 12, 12);
  assert.ok(definition);
  assert.ok(definition.polygon.length >= 4 && definition.polygon.length <= 96);
  assert.ok(definition.polygon.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1));
  assert.ok(pointInPolygon(definition.spawn, definition.polygon),
    'the saved spawn point must be inside the generated polygon');
  assert.equal(pointInPolygon([0.5, 0.5], definition.polygon), true);
  assert.equal(pointInPolygon([0.05, 0.05], definition.polygon), false);
}

{
  const mask = new Uint8Array(25);
  paintCircle(mask, 5, 5, 2, 2, 1.1, 1);
  assert.equal(mask[2 * 5 + 2], 1);
  assert.equal(mask[0], 0);
  paintCircle(mask, 5, 5, 2, 2, 0.4, 0);
  assert.equal(mask[2 * 5 + 2], 0);
}

assert.deepEqual(
  wallPoints({ polygon: [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]] }, 200, 100),
  [[50, 25], [150, 25], [150, 75], [50, 75]]
);

assert.equal(buildContainerDefinition(new Uint8Array(16), 4, 4), null,
  'an empty mask must not produce a container');

{
  const valid = normalizeDefinition({
    name: '  粉色游戏机  ',
    skinDataUrl: 'data:image/png;base64,AA==',
    polygon: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]],
    spawn: [0.5, 0.5]
  });
  assert.equal(valid.name, '粉色游戏机');
  assert.deepEqual(valid.spawn, [0.5, 0.5]);
  assert.equal(normalizeDefinition({ ...valid, skinDataUrl: 'https://example.com/a.png' }), null,
    'remote URLs must not be persisted as trusted custom skins');
  assert.equal(normalizeDefinition({ ...valid, polygon: [[0, 0], [1, 1]] }), null,
    'a malformed polygon must be rejected');
  assert.equal(normalizeDefinition({ ...valid, spawn: [0.95, 0.95] }), null,
    'the safe spawn point must be inside the activity region');
}

console.log('container mask: ok');

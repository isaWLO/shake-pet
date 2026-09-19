const assert = require('node:assert/strict');
const { selectionToPixels, withTimeout } = require('../capture-region');

assert.deepEqual(
  selectionToPixels({ x: 900, y: 500 }, { x: 100, y: 50 }, 1000, 600, 1500, 900),
  { x: 150, y: 75, width: 1200, height: 675 }
);

assert.deepEqual(
  selectionToPixels({ x: -20, y: 10 }, { x: 80, y: 90 }, 100, 100, 200, 200),
  { x: 0, y: 20, width: 160, height: 160 }
);

assert.throws(
  () => selectionToPixels({ x: NaN, y: 10 }, { x: 80, y: 90 }, 100, 100, 200, 200),
  /invalid selection/i
);

console.log('capture region: ok');

(async () => {
  await assert.rejects(
    withTimeout(new Promise(() => {}), 10, 'capture timed out'),
    /capture timed out/
  );
  console.log('capture timeout: ok');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

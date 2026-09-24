const assert = require('node:assert/strict');
const crypto = require('node:crypto').webcrypto;
const { loadWebAiModel } = require('../web-ai-model');

const good = new Uint8Array([1, 2, 3, 4]);
const expected = {
  size: good.length,
  sha256: crypto.subtle.digest('SHA-256', good).then(bytes =>
    [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join(''))
};

(async () => {
  const cacheEntries = new Map();
  let fetches = 0;
  const cache = {
    async match(key) {
      const bytes = cacheEntries.get(key);
      return bytes ? new Response(bytes) : undefined;
    },
    async put(key, response) {
      cacheEntries.set(key, new Uint8Array(await response.arrayBuffer()));
    },
    async delete(key) {
      cacheEntries.delete(key);
    }
  };

  const model = await loadWebAiModel({
    cacheStorage: { open: async () => cache },
    fetcher: async () => {
      fetches++;
      return new Response(good);
    },
    expected: { size: expected.size, sha256: await expected.sha256 }
  });
  assert.deepEqual([...model], [...good]);
  assert.deepEqual([...await loadWebAiModel({
    cacheStorage: { open: async () => cache },
    fetcher: async () => { throw new Error('cache should be used'); },
    expected: { size: expected.size, sha256: await expected.sha256 }
  })], [...good]);
  assert.equal(fetches, 1);
  console.log('web AI model cache: ok');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

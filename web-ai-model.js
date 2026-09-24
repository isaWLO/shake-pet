(function exposeWebAiModel(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.webAiModel = api;
})(typeof globalThis === 'object' ? globalThis : this, root => {
  const MODEL_URLS = [
    'https://hf-mirror.com/Ko033/isnet-general-use-onnx/resolve/5349b61/onnx/model_quantized.onnx?download=true',
    'https://huggingface.co/Ko033/isnet-general-use-onnx/resolve/5349b61/onnx/model_quantized.onnx?download=true'
  ];
  const MODEL_SIZE = 45902969;
  const MODEL_SHA256 = '5039225b9a4ac3df55f185d24b7a92d640c86cc4747002d7f23351e394de03a6';
  const CACHE_NAME = 'shake-pet-ai-model-v1';
  const CACHE_KEY = 'shake-pet-ai-model';

  function isValid(bytes, expected) {
    return bytes.byteLength === expected.size && expected.sha256;
  }

  async function hasExpectedHash(bytes, expected, cryptoProvider) {
    if (!isValid(bytes, expected)) return false;
    const subtle = cryptoProvider?.subtle || root.crypto?.subtle;
    if (!subtle) throw new Error('当前浏览器不支持 AI 模型校验');
    const digest = await subtle.digest('SHA-256', bytes);
    const actual = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return actual === expected.sha256;
  }

  async function openCache(cacheStorage) {
    if (!cacheStorage?.open) return null;
    try {
      return await cacheStorage.open(CACHE_NAME);
    } catch {
      return null;
    }
  }

  async function loadWebAiModel(options = {}) {
    const expected = options.expected || { size: MODEL_SIZE, sha256: MODEL_SHA256 };
    const fetcher = options.fetcher || ((url, init) => root.fetch(url, init));
    const cache = await openCache(options.cacheStorage === undefined ? root.caches : options.cacheStorage);
    if (cache) {
      const cached = await cache.match(CACHE_KEY);
      if (cached) {
        const bytes = new Uint8Array(await cached.arrayBuffer());
        if (await hasExpectedHash(bytes, expected, options.cryptoProvider)) return bytes;
        await cache.delete?.(CACHE_KEY);
      }
    }

    let lastError;
    for (const url of options.urls || MODEL_URLS) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetcher(url, { mode: 'cors' });
          if (!response.ok) {
            lastError = new Error(`AI 模型下载失败 (${response.status || '网络错误'})`);
            continue;
          }
          const storable = cache && typeof response.clone === 'function' ? response.clone() : null;
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (!await hasExpectedHash(bytes, expected, options.cryptoProvider)) {
            throw new Error('AI 模型校验失败，请重试');
          }
          if (cache && storable) await cache.put(CACHE_KEY, storable);
          return bytes;
        } catch (error) {
          lastError = error;
        }
      }
    }
    throw lastError || new Error('AI 模型下载失败');
  }

  return { MODEL_URLS, MODEL_SIZE, MODEL_SHA256, loadWebAiModel };
});

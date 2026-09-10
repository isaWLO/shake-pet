const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ensureAiModel } = require('../ai-model');

(async () => {
  const good = Buffer.from('verified model');
  const expected = {
    size: good.length,
    sha256: crypto.createHash('sha256').update(good).digest('hex')
  };
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shake-pet-ai-'));

  try {
    let fetches = 0;
    const fetcher = async () => {
      fetches++;
      return { ok: true, arrayBuffer: async () => good };
    };

    assert.deepEqual(await ensureAiModel(directory, fetcher, expected), good);
    assert.deepEqual(await ensureAiModel(directory, async () => { throw new Error('must not fetch'); }, expected), good);
    assert.equal(fetches, 1);

    await assert.rejects(
      () => ensureAiModel(path.join(directory, 'bad'), async () => ({
        ok: true,
        arrayBuffer: async () => Buffer.from('bad')
      }), expected),
      /校验失败/
    );
    console.log('AI model cache: ok');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

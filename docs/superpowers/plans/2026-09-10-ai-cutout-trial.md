# AI Precise Cutout Trial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Windows desktop-only “AI 精准抠图” action that downloads and caches a verified IS-Net model, removes complex backgrounds locally, and leaves the result editable in the existing cutout editor.

**Architecture:** Electron's main process owns the pinned model download and disk cache. The renderer lazily loads ONNX Runtime Web, runs the model on the existing editor image, and feeds the alpha mask back into the current manual-edit/apply pipeline. The web build keeps the control hidden and does not ship the runtime.

**Tech Stack:** Electron 37, browser Canvas 2D, ONNX Runtime Web WASM, Node.js test runner with `assert`

**Spec:** `docs/superpowers/specs/2026-09-10-ai-cutout-trial-design.md`

## Global Constraints

- Only the Windows desktop UI exposes AI cutout in this trial.
- Model URL is pinned to Ko033 IS-Net commit `5349b61`, file size `45902969`, SHA-256 `5039225b9a4ac3df55f185d24b7a92d640c86cc4747002d7f23351e394de03a6`.
- Images never leave the device; network is used only to download the model.
- Existing quick cutout, manual brush, crop, plastic rim, and physics flows remain intact.
- AI failure preserves the current editor pixels and reports an error.

---

### Task 1: Verified model cache

**Files:**
- Create: `ai-model.js`
- Create: `tests/ai-model.test.js`
- Modify: `main.js`
- Modify: `preload.js`

**Interfaces:**
- Produces: `ensureAiModel(directory: string, fetcher: Function, expected?: object): Promise<Buffer>`
- Produces: `window.desktopPet.getAiCutoutModel(): Promise<Uint8Array>`

- [ ] **Step 1: Write the failing cache test**

Use a temporary directory and a small fixture. Assert that the first call downloads and writes verified bytes, the second call reuses the file without fetching, and a wrong payload rejects before caching.

```js
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ensureAiModel } = require('../ai-model');

const good = Buffer.from('verified model');
const expected = { size: good.length, sha256: crypto.createHash('sha256').update(good).digest('hex') };
let fetches = 0;
const fetcher = async () => ({ ok: true, arrayBuffer: async () => good });
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shake-pet-ai-'));
assert.deepEqual(await ensureAiModel(directory, async (...args) => { fetches++; return fetcher(...args); }, expected), good);
assert.deepEqual(await ensureAiModel(directory, async () => { throw new Error('must not fetch'); }, expected), good);
assert.equal(fetches, 1);
await assert.rejects(() => ensureAiModel(path.join(directory, 'bad'), async () => ({ ok: true, arrayBuffer: async () => Buffer.from('bad') }), expected), /校验失败/);
await fs.rm(directory, { recursive: true, force: true });
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node tests/ai-model.test.js`

Expected: FAIL because `../ai-model` does not exist.

- [ ] **Step 3: Implement the minimum cache**

In `ai-model.js`, use `fs.mkdir`, `fs.readFile`, `crypto.createHash`, an atomic `.download` file, and `fs.rename`. Validate both byte length and SHA-256 for cached and downloaded bytes. Export `ensureAiModel` and the pinned constants.

In `main.js`, register `get-ai-cutout-model`, store under `path.join(app.getPath('userData'), 'models')`, and download with `net.fetch`.

In `preload.js`, expose `getAiCutoutModel: () => ipcRenderer.invoke('get-ai-cutout-model')`.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node tests/ai-model.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add ai-model.js tests/ai-model.test.js main.js preload.js
git commit -m "Add verified AI model cache"
```

### Task 2: Mask conversion and AI editor action

**Files:**
- Create: `ai-cutout.js`
- Create: `tests/ai-cutout.test.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `renderer.js`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `rgbaToIsNetInput(rgba: Uint8ClampedArray): Float32Array`
- Produces: `probabilitiesToAlpha(values: Float32Array, cleanup: number): Uint8ClampedArray`
- Consumes: `window.desktopPet.getAiCutoutModel()` from Task 1

- [ ] **Step 1: Write the failing mask test**

Assert channel-first RGB normalization and independently derived alpha values, including a low-probability background, soft edge, opaque center, and constant-mask rejection.

```js
const assert = require('node:assert/strict');
const { rgbaToIsNetInput, probabilitiesToAlpha } = require('../ai-cutout');

const input = rgbaToIsNetInput(new Uint8ClampedArray([255, 127, 0, 255, 0, 255, 255, 255]));
assert.ok(Math.abs(input[0] - 0.5) < 1e-6);
assert.ok(Math.abs(input[1] + 0.5) < 1e-6);
assert.ok(Math.abs(input[2] - (127 / 255 - 0.5)) < 1e-6);
assert.ok(Math.abs(input[3] - 0.5) < 1e-6);
assert.ok(Math.abs(input[4] + 0.5) < 1e-6);
assert.ok(Math.abs(input[5] - 0.5) < 1e-6);
assert.deepEqual([...probabilitiesToAlpha(new Float32Array([0.2, 0.6, 1]), 8)], [0, 128, 255]);
assert.throws(() => probabilitiesToAlpha(new Float32Array([0.4, 0.4]), 42), /没有识别到主体/);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node tests/ai-cutout.test.js`

Expected: FAIL because `../ai-cutout` does not exist.

- [ ] **Step 3: Implement mask conversion**

Create a browser/CommonJS-compatible `ai-cutout.js`. Convert interleaved RGBA to planar RGB with `channel / 255 - 0.5`. Min-max normalize model probabilities and map cleanup strength `8..100` to a `0..0.45` cutoff before producing `0..255` alpha.

- [ ] **Step 4: Run the mask test and verify GREEN**

Run: `node tests/ai-cutout.test.js`

Expected: PASS.

- [ ] **Step 5: Add the desktop-only editor action**

Install `onnxruntime-web`. Add `ai-cutout.js` before `renderer.js` and add an `#editor-ai` button beside quick recut. Hide it with `html[data-platform="web"] #editor-ai { display: none; }`.

In `renderer.js`, lazily load `node_modules/onnxruntime-web/dist/ort.min.js`, set its WASM path to the same distribution directory, create one cached WASM session from `getAiCutoutModel()`, and run tensor `[1, 3, 1024, 1024]` named `input_image`. Convert `output_image` to alpha, scale it back to the editor canvas, multiply it with the original alpha, and replace the editor pixels only after inference succeeds. Disable the button while running and restore it in `finally`.

- [ ] **Step 6: Run all tests**

Run: `npm test`

Expected: all existing and new tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add ai-cutout.js tests/ai-cutout.test.js index.html styles.css renderer.js package.json package-lock.json
git commit -m "Add local AI precise cutout trial"
```

### Task 3: Packaging and desktop smoke test

**Files:**
- Modify: `package.json`
- Modify: `scripts/build-web.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: desktop model cache and renderer AI action from Tasks 1-2
- Produces: packaged desktop runtime assets without adding AI files to the web build

- [ ] **Step 1: Update packaging and documentation**

Include `ai-model.js`, `ai-cutout.js`, and the required `node_modules/onnxruntime-web/dist/**/*` files in Electron Builder. Add a short README note: first AI use downloads about 46 MB, processing is local, and quick/manual cutout remain available.

- [ ] **Step 2: Verify code and builds**

Run: `node --check main.js; node --check preload.js; node --check renderer.js; node --check ai-model.js; node --check ai-cutout.js; npm test; npm run build:web`

Expected: every command exits 0; `dist-web` contains no model file or ONNX Runtime assets.

- [ ] **Step 3: Smoke-test Electron**

Run: `npm start`

Import one complex-background image, open scissors, press “AI 精准抠图”, confirm the model downloads once, background becomes transparent, manual restore/erase still works, and applying returns the item to the bottle with its plastic rim.

- [ ] **Step 4: Commit**

```powershell
git add package.json scripts/build-web.js README.md
git commit -m "Package AI cutout runtime"
```

# Custom Container Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate PNG-based custom-container editor whose painted connected region becomes the Matter.js collision boundary and is saved with bottle scenes.

**Architecture:** A dependency-free `container-mask.js` owns flood selection, connected-region cleanup, contour extraction, simplification, and polygon checks. Electron opens a dedicated editor window and returns one serializable container definition. The existing renderer maps that normalized polygon into its current canvas, reuses its wall-segment physics, and stores the definition in scene version 2.

**Tech Stack:** Electron 37, Canvas 2D, Matter.js 0.20, CommonJS-compatible browser JavaScript, Node assert tests.

**Spec:** `docs/superpowers/specs/2026-09-20-custom-container-design.md`

## Global Constraints

- First release supports one continuous activity region only.
- Keep the editor free of physical preview sprites.
- Preserve bottle and box scenes.
- Do not add dependencies.
- Keep the selected built-in asset at `assets/containers/retro-pink-pet.png`.

## Review Focus

- A transparent center separated from a transparent exterior selects only the clicked center region.
- Tiny disconnected paint islands do not become collision chambers.
- Holes erased inside the selected region are filled before contour extraction.
- Invalid or missing saved custom definitions fall back to bottle without crashing.
- Resizing and dragging cannot leave a sprite center outside the custom polygon.

---

### Task 1: Mask and contour engine

**Files:**
- Create: `container-mask.js`
- Create: `tests/container-mask.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `floodSelect(rgba, width, height, x, y, tolerance) -> Uint8Array`
- Produces: `paintCircle(mask, width, height, x, y, radius, value) -> void`
- Produces: `buildContainerDefinition(mask, width, height, options?) -> { polygon, spawn } | null`
- Produces: `pointInPolygon(point, polygon) -> boolean`
- Produces: `wallPoints(definition, width, height) -> number[][]`

- [ ] **Step 1: Write failing tests** covering a transparent interior separated from the exterior, largest-region cleanup, hole filling, point inclusion, normalized contour size, and scaled wall points.
- [ ] **Step 2: Run `node tests/container-mask.test.js`** and verify failure because `container-mask.js` does not exist.
- [ ] **Step 3: Implement the minimum browser/CommonJS module** with iterative queues, four-neighbour connectivity, boundary-edge tracing, closed-polygon simplification, and no dependency.
- [ ] **Step 4: Run `node tests/container-mask.test.js` and `npm test`** and verify both pass.
- [ ] **Step 5: Add the new test to the existing `npm test` chain and commit** with `Add custom container mask engine`.

### Task 2: Dedicated editor window

**Files:**
- Create: `custom-container.html`
- Create: `custom-container.js`
- Modify: `main.js`
- Modify: `preload.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1 `floodSelect`, `paintCircle`, `buildContainerDefinition`.
- Produces: `desktopPet.openContainerEditor(initial)` resolving to `null` or `{ name, skinDataUrl, polygon, spawn }`.

- [ ] **Step 1: Extend the contract test** to assert the editor files and IPC bridge names are present, then run it and verify failure.
- [ ] **Step 2: Add a single reusable Electron editor window** with explicit finish/cancel cleanup and a 900×700 resizable layout.
- [ ] **Step 3: Build the Canvas editor UI** with PNG import, built-in pink asset, magic wand, paint, erase, tolerance, brush size, undo, reset, overlay, validation, cancel, and save; do not add preview sprites.
- [ ] **Step 4: Include the editor files and built-in asset in electron-builder files.**
- [ ] **Step 5: Run the contract test and full suite, then commit** with `Add custom container editor`.

### Task 3: Renderer, physics, and scene persistence

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `renderer.js`
- Modify: `web-bridge.js`
- Modify: `tests/container-mask.test.js`

**Interfaces:**
- Consumes: Task 1 `wallPoints`, `pointInPolygon` and Task 2 `openContainerEditor` result.
- Produces: scene version 2 `container.custom` payload and backward-compatible restore behavior.

- [ ] **Step 1: Add failing tests** for malformed-definition rejection, normalized wall mapping, and relocation to the saved spawn point.
- [ ] **Step 2: Add the custom option and editor entry** to the existing container panel; web mode opens the same editor in a browser popup and uses `postMessage` to return the result.
- [ ] **Step 3: Load and apply the returned skin**; rebuild walls from its polygon, constrain out-of-region sprite centers, clip the audio waveform, and draw the PNG shell above sprites.
- [ ] **Step 4: Serialize scene version 2 and restore valid custom scenes**; malformed data falls back to bottle while version 1 scenes remain unchanged.
- [ ] **Step 5: Run `npm test` and `npm run build:web`; launch Electron for a smoke check** of editor open, built-in magic selection, brush/erase, save, resize, scene save, and scene restore.
- [ ] **Step 6: Commit** with `Integrate custom containers`.

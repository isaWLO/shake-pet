(function exposeAiCutout(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.aiCutout = api;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  function rgbaToIsNetInput(rgba) {
    const pixels = Math.floor(rgba.length / 4);
    const output = new Float32Array(pixels * 3);
    for (let pixel = 0; pixel < pixels; pixel++) {
      const source = pixel * 4;
      output[pixel] = rgba[source] / 255 - 0.5;
      output[pixels + pixel] = rgba[source + 1] / 255 - 0.5;
      output[pixels * 2 + pixel] = rgba[source + 2] / 255 - 0.5;
    }
    return output;
  }

  function probabilitiesToAlpha(values, cleanup) {
    let minimum = Infinity;
    let maximum = -Infinity;
    for (const value of values) {
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
    const range = maximum - minimum;
    if (!Number.isFinite(range) || range < 1e-6) throw new Error('AI 没有识别到主体');
    const strength = Math.max(8, Math.min(100, Number(cleanup) || 42));
    const cutoff = (strength - 8) / 92 * 0.45;
    return Uint8ClampedArray.from(values, value => {
      const normalized = (value - minimum) / range;
      return Math.round(Math.max(0, Math.min(1, (normalized - cutoff) / (1 - cutoff))) * 255);
    });
  }

  return { rgbaToIsNetInput, probabilitiesToAlpha };
});

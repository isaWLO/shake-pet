function selectionToPixels(start, end, viewportWidth, viewportHeight, imageWidth, imageHeight) {
  if (![start?.x, start?.y, end?.x, end?.y, viewportWidth, viewportHeight, imageWidth, imageHeight].every(Number.isFinite)
      || viewportWidth <= 0 || viewportHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    throw new TypeError('Invalid selection');
  }
  const left = Math.max(0, Math.min(viewportWidth, Math.min(start.x, end.x)));
  const top = Math.max(0, Math.min(viewportHeight, Math.min(start.y, end.y)));
  const right = Math.max(0, Math.min(viewportWidth, Math.max(start.x, end.x)));
  const bottom = Math.max(0, Math.min(viewportHeight, Math.max(start.y, end.y)));
  const x = Math.round(left * imageWidth / viewportWidth);
  const y = Math.round(top * imageHeight / viewportHeight);
  return {
    x,
    y,
    width: Math.round(right * imageWidth / viewportWidth) - x,
    height: Math.round(bottom * imageHeight / viewportHeight) - y
  };
}

function withTimeout(promise, milliseconds, message = 'Operation timed out') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })
  ]).finally(() => clearTimeout(timer));
}

if (typeof module !== 'undefined') module.exports = { selectionToPixels, withTimeout };

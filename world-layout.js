function getWorldSize(element, fallbackWidth, fallbackHeight) {
  return {
    width: Math.round(element.clientWidth || fallbackWidth),
    height: Math.round(element.clientHeight || fallbackHeight)
  };
}

function getQuickPanelPosition(point, viewport, panel) {
  const gap = 12;
  const padding = 8;
  const preferredLeft = point.x + gap + panel.width <= viewport.width - padding
    ? point.x + gap
    : point.x - panel.width - gap;
  return {
    left: Math.max(padding, Math.min(viewport.width - panel.width - padding, preferredLeft)),
    top: Math.max(padding, Math.min(viewport.height - panel.height - padding, point.y - 20))
  };
}

function getAudioControlMultiplier(value, midpointMultiplier) {
  return Math.max(0, Math.min(100, Number(value) || 0)) / 50 * midpointMultiplier;
}

function getAudioWaveDisplayLevel(value) {
  return Math.pow(Math.min(1, Math.max(0, value)), 1.9);
}

function getAudioWaveImpulse(wave, contact, bassStrength, strength, kick) {
  if (contact <= 0) return { x: 0, y: 0 };
  const sourceLift = Math.max(0,
    (wave.risePixels * .16 + wave.displayedLevel * 2.2 + kick * .45) * contact
  );
  if (sourceLift < 1.5) return { x: 0, y: 0 };
  const lift = Math.min(Math.min(12, 4 + bassStrength * 2), sourceLift * bassStrength * strength);
  if (lift < 3.2) return { x: 0, y: 0 };
  return {
    x: Math.max(-1.2, Math.min(1.2, wave.slope * lift * .14)),
    y: -lift
  };
}

if (typeof module !== 'undefined') module.exports = {
  getWorldSize,
  getQuickPanelPosition,
  getAudioControlMultiplier,
  getAudioWaveDisplayLevel,
  getAudioWaveImpulse
};

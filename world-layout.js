function getWorldSize(element, fallbackWidth, fallbackHeight) {
  return {
    width: Math.round(element.clientWidth || fallbackWidth),
    height: Math.round(element.clientHeight || fallbackHeight)
  };
}

function getAudioWaveImpulse(wave, contact, bassStrength, strength, kick) {
  if (contact <= 0) return { x: 0, y: 0 };
  const lift = Math.min(8, Math.max(0,
    (wave.risePixels * .16 + wave.displayedLevel * 2.2 + kick * .45)
    * contact * bassStrength * strength
  ));
  if (lift < 1.5) return { x: 0, y: 0 };
  return {
    x: Math.max(-1.2, Math.min(1.2, wave.slope * lift * .14)),
    y: -lift
  };
}

if (typeof module !== 'undefined') module.exports = { getWorldSize, getAudioWaveImpulse };

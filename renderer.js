const { Engine, Bodies, Body, Composite, Vertices } = Matter;

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');
const toy = document.querySelector('#toy');
const dragSpace = document.querySelector('.drag-space');
const empty = document.querySelector('#empty');
const removeButton = document.querySelector('#remove');
const cutoutButton = document.querySelector('#cutout');
const settingsPanel = document.querySelector('#settings-panel');
const shapeSelect = document.querySelector('#shape');
const colorInput = document.querySelector('#container-color');
const thresholdInput = document.querySelector('#threshold');
const thresholdValue = document.querySelector('#threshold-value');
const autoCutoutInput = document.querySelector('#auto-cutout');
const toastElement = document.querySelector('#toast');
const spriteSizeInput = document.querySelector('#sprite-size');
const spriteSizeValue = document.querySelector('#sprite-size-value');
const windowWidthInput = document.querySelector('#window-width');
const windowHeightInput = document.querySelector('#window-height');
const windowWidthValue = document.querySelector('#window-width-value');
const windowHeightValue = document.querySelector('#window-height-value');
const cutoutEditor = document.querySelector('#cutout-editor');
const editorCanvas = document.querySelector('#editor-canvas');
const editorContext = editorCanvas.getContext('2d', { willReadFrequently: true });
const brushSizeInput = document.querySelector('#brush-size');
const brushValue = document.querySelector('#brush-value');
const selectionPanel = document.querySelector('#selection-panel');
const rimWidthInput = document.querySelector('#rim-width');
const rimWidthValue = document.querySelector('#rim-width-value');
const defaultSizeInput = document.querySelector('#default-size');
const defaultSizeValue = document.querySelector('#default-size-value');
const defaultRimInput = document.querySelector('#default-rim');
const defaultRimValue = document.querySelector('#default-rim-value');
const scenePanel = document.querySelector('#scene-panel');
const sceneNameInput = document.querySelector('#scene-name');
const sceneListElement = document.querySelector('#scene-list');
const audioReactiveInput = document.querySelector('#audio-reactive');
const audioSensitivityInput = document.querySelector('#audio-sensitivity');
const audioSensitivityValue = document.querySelector('#audio-sensitivity-value');
const audioBassInput = document.querySelector('#audio-bass');
const audioBassValue = document.querySelector('#audio-bass-value');
const audioStrengthInput = document.querySelector('#audio-strength');
const audioStrengthValue = document.querySelector('#audio-strength-value');
const audioStatusElement = document.querySelector('#audio-status');
const audioStatusRow = document.querySelector('.audio-status-row');
const audioMeter = document.querySelector('#audio-meter');
const audioTestButton = document.querySelector('#audio-test');

document.documentElement.dataset.platform = window.desktopPet.platform || 'desktop';

const engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.0015 } });
engine.positionIterations = 12;
engine.velocityIterations = 8;
const sprites = new Map();
let walls = [];
let selectedBody = null;
let gravityOn = true;
let lastMotion = { vx: 0, vy: 0 };
let draggingWindow = false;
let toastTimer = null;
let editorOriginalCanvas = null;
let editorMode = 'erase';
let editorDrawing = false;
let editorLastPoint = null;
let currentSceneId = null;
let currentSceneName = '';
let draggedBody = null;
let draggedPointerId = null;
let spriteDragOffset = { x: 0, y: 0 };
let spriteDragLast = null;
let spriteDragVelocity = { x: 0, y: 0 };
let spriteDragStart = null;
let spriteDragMoved = false;
let viewportSize = null;
let audioStream = null;
let audioContext = null;
let audioAnalyser = null;
let audioSourceNode = null;
let audioFrequencyData = null;
let audioWaveformData = null;
let audioStartPromise = null;
let audioCaptureGeneration = 0;
let audioBassBaseline = .04;
let audioLastBeatAt = 0;
let audioLastLaunchAt = 0;
let audioBeatPending = false;
let audioKick = 0;
let audioVisualOffset = { x: 0, y: 0 };
let audioTestUntil = 0;
let audioTestStartedAt = 0;
let audioTestBeatIndex = -1;
const audioLevels = { volume: 0, bass: 0, mid: 0, high: 0 };
const audioSpectrum = new Float32Array(36);
const audioSpectrumRise = new Float32Array(audioSpectrum.length);

const preferences = JSON.parse(localStorage.getItem('shake-pet-preferences') || '{}');
shapeSelect.value = ['bottle', 'box'].includes(preferences.shape) ? preferences.shape : 'bottle';
colorInput.value = preferences.color || '#79b8ff';
thresholdInput.value = preferences.threshold || 42;
autoCutoutInput.checked = preferences.autoCutout !== false;
windowWidthInput.value = preferences.windowWidth || 360;
windowHeightInput.value = preferences.windowHeight || 460;
defaultSizeInput.value = preferences.defaultSize || 100;
defaultRimInput.value = preferences.defaultRim || 16;
audioReactiveInput.checked = false;
audioSensitivityInput.value = preferences.audioSensitivity || 100;
audioBassInput.value = preferences.audioBass || 100;
audioStrengthInput.value = preferences.audioStrength || 100;
thresholdValue.value = thresholdInput.value;
windowWidthValue.value = windowWidthInput.value;
windowHeightValue.value = windowHeightInput.value;
defaultSizeValue.value = `${defaultSizeInput.value}%`;
defaultRimValue.value = defaultRimInput.value;
audioSensitivityValue.value = `${audioSensitivityInput.value}%`;
audioBassValue.value = `${audioBassInput.value}%`;
audioStrengthValue.value = `${audioStrengthInput.value}%`;
toy.dataset.shape = shapeSelect.value;

function savePreferences() {
  localStorage.setItem('shake-pet-preferences', JSON.stringify({
    shape: shapeSelect.value,
    color: colorInput.value,
    threshold: Number(thresholdInput.value),
    autoCutout: autoCutoutInput.checked,
    windowWidth: Number(windowWidthInput.value),
    windowHeight: Number(windowHeightInput.value),
    defaultSize: Number(defaultSizeInput.value),
    defaultRim: Number(defaultRimInput.value),
    audioSensitivity: Number(audioSensitivityInput.value),
    audioBass: Number(audioBassInput.value),
    audioStrength: Number(audioStrengthInput.value)
  }));
}

function showToast(message) {
  clearTimeout(toastTimer);
  toastElement.textContent = message;
  toastElement.classList.remove('hidden');
  toastTimer = setTimeout(() => toastElement.classList.add('hidden'), 2200);
}

function setAudioStatus(message, state = '') {
  if (audioStatusElement.textContent !== message) audioStatusElement.textContent = message;
  audioStatusRow.classList.toggle('active', state === 'active');
  audioStatusRow.classList.toggle('error', state === 'error');
}

function stopSystemAudio(message = '尚未开启', state = '') {
  audioCaptureGeneration++;
  audioStartPromise = null;
  const stream = audioStream;
  const context = audioContext;
  const sourceNode = audioSourceNode;
  audioStream = null;
  audioContext = null;
  audioAnalyser = null;
  audioSourceNode = null;
  audioFrequencyData = null;
  audioWaveformData = null;
  if (stream) for (const track of stream.getTracks()) track.stop();
  if (sourceNode) sourceNode.disconnect();
  if (context && context.state !== 'closed') context.close().catch(() => {});
  audioReactiveInput.checked = false;
  audioMeter.value = 0;
  setAudioStatus(message, state);
}

async function startSystemAudio() {
  if (audioAnalyser) return;
  if (audioStartPromise) return audioStartPromise;
  const generation = ++audioCaptureGeneration;
  const startPromise = (async () => {
    setAudioStatus('正在连接…', 'active');
    let stream;
    let context;
    try {
      let captureLabel = '系统音频';
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: { width: 1, height: 1, frameRate: 1 }
        });
      } catch (displayError) {
        if (window.desktopPet.platform === 'win32') throw displayError;
      }
      if (!stream?.getAudioTracks().length && window.desktopPet.platform !== 'win32') {
        if (stream) for (const track of stream.getTracks()) track.stop();
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        captureLabel = '麦克风';
      }
      if (generation !== audioCaptureGeneration) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) throw new Error('没有读取到系统音频轨道');
      for (const track of stream.getVideoTracks()) track.stop();

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      context = new AudioContextClass({ latencyHint: 'interactive' });
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = .72;
      const sourceNode = context.createMediaStreamSource(stream);
      sourceNode.connect(analyser);
      await context.resume();
      if (generation !== audioCaptureGeneration) {
        sourceNode.disconnect();
        for (const track of stream.getTracks()) track.stop();
        await context.close();
        return;
      }

      audioStream = stream;
      audioContext = context;
      audioAnalyser = analyser;
      audioSourceNode = sourceNode;
      audioFrequencyData = new Uint8Array(analyser.frequencyBinCount);
      audioWaveformData = new Uint8Array(analyser.fftSize);
      audioTrack.addEventListener('ended', () => {
        if (audioStream === stream) stopSystemAudio('音频捕获已停止');
      }, { once: true });
      audioReactiveInput.checked = true;
      setAudioStatus(`正在监听${captureLabel}`, 'active');
      showToast(captureLabel === '系统音频' ? '已开启电脑音频震动' : '系统音频不可用，已改用麦克风');
    } catch (error) {
      if (stream) for (const track of stream.getTracks()) track.stop();
      if (context && context.state !== 'closed') await context.close().catch(() => {});
      if (generation !== audioCaptureGeneration) return;
      stopSystemAudio('无法读取系统音频', 'error');
      throw error;
    }
  })();
  audioStartPromise = startPromise;
  try {
    await startPromise;
  } finally {
    if (audioStartPromise === startPromise) audioStartPromise = null;
  }
}

function frequencyBandLevel(minimumHz, maximumHz) {
  if (!audioAnalyser || !audioFrequencyData || !audioContext) return 0;
  const nyquist = audioContext.sampleRate / 2;
  const first = Math.max(0, Math.floor(minimumHz / nyquist * audioFrequencyData.length));
  const last = Math.min(audioFrequencyData.length - 1, Math.ceil(maximumHz / nyquist * audioFrequencyData.length));
  let total = 0;
  for (let index = first; index <= last; index++) total += audioFrequencyData[index];
  return total / Math.max(1, last - first + 1) / 255;
}

function approachAudioLevel(current, target) {
  return current + (target - current) * (target > current ? .46 : .14);
}

function updateAudioSpectrum(targetForIndex) {
  for (let index = 0; index < audioSpectrum.length; index++) {
    const current = audioSpectrum[index];
    const target = Math.max(0, Math.min(1, targetForIndex(index)));
    const next = current + (target - current) * (target > current ? .42 : .12);
    audioSpectrumRise[index] = Math.max(0, next - current);
    audioSpectrum[index] = next;
  }
}

function audioSpectrumTarget(sample, sensitivity) {
  const amplified = Math.max(0, sample) * Math.max(0, sensitivity) * 1.65;
  return amplified / (1 + amplified * .72);
}

function updateSpectrumFromFrequencyData(sensitivity) {
  const nyquist = audioContext.sampleRate / 2;
  updateAudioSpectrum(index => {
    const progress = index / Math.max(1, audioSpectrum.length - 1);
    const frequency = 35 * Math.pow(9000 / 35, progress);
    const center = Math.max(0, Math.min(audioFrequencyData.length - 1, Math.round(frequency / nyquist * audioFrequencyData.length)));
    let total = 0;
    let samples = 0;
    for (let offset = -1; offset <= 1; offset++) {
      const bin = center + offset;
      if (bin < 0 || bin >= audioFrequencyData.length) continue;
      total += audioFrequencyData[bin];
      samples++;
    }
    return audioSpectrumTarget(total / Math.max(1, samples) / 255, sensitivity);
  });
}

function updateTestSpectrum(elapsed, pulse) {
  updateAudioSpectrum(index => {
    const wave = .34 + Math.pow((Math.sin(index * .43 + elapsed * .006) + 1) / 2, 1.5) * .66;
    return (.12 + pulse * .88) * wave;
  });
}

function audioWaveMaximumHeight(baseline) {
  const top = shapeSelect.value === 'bottle' ? 14 : 18;
  return Math.max(24, baseline - top);
}

function audioWaveDisplayLevel(value) {
  return Math.pow(Math.min(1, Math.max(0, value)), 1.65);
}

function audioWaveHorizontalRange() {
  return shapeSelect.value === 'bottle'
    ? { left: innerWidth * .13, right: innerWidth * .87 }
    : { left: 18, right: innerWidth - 18 };
}

function audioWaveSampleAtX(x, values = audioSpectrum) {
  const { left, right } = audioWaveHorizontalRange();
  const progress = Math.max(0, Math.min(1, (x - left) / Math.max(1, right - left)));
  const offset = progress * (values.length - 1);
  const first = Math.floor(offset);
  const second = Math.min(values.length - 1, first + 1);
  const mix = offset - first;
  return values[first] * (1 - mix) + values[second] * mix;
}

function audioWaveMetricsAtX(x) {
  const { left, right } = audioWaveHorizontalRange();
  const spacing = (right - left) / Math.max(1, audioSpectrum.length - 1);
  const level = audioWaveSampleAtX(x);
  const rawRise = audioWaveSampleAtX(x, audioSpectrumRise);
  const displayedLevel = audioWaveDisplayLevel(level);
  const displayedRise = Math.max(0, displayedLevel - audioWaveDisplayLevel(level - rawRise));
  const baseline = innerHeight - (shapeSelect.value === 'bottle' ? 31 : 36);
  const maximumHeight = audioWaveMaximumHeight(baseline);
  return {
    level,
    displayedLevel,
    risePixels: displayedRise * maximumHeight,
    slope: audioWaveSampleAtX(x + spacing) - audioWaveSampleAtX(x - spacing),
    y: baseline - displayedLevel * maximumHeight
  };
}

function drawAudioWaveform() {
  let peak = 0;
  for (const value of audioSpectrum) peak = Math.max(peak, value);
  if (peak < .012) return;

  const path = containerPath(shapeSelect.value, innerWidth, innerHeight);
  const rgb = hexToRgb(colorInput.value);
  const { left, right } = audioWaveHorizontalRange();
  const baseline = innerHeight - (shapeSelect.value === 'bottle' ? 31 : 36);
  const maximumHeight = audioWaveMaximumHeight(baseline);

  ctx.save();
  ctx.clip(path);
  ctx.beginPath();
  ctx.moveTo(left, baseline);
  for (let index = 0; index < audioSpectrum.length; index++) {
    const x = left + (right - left) * index / (audioSpectrum.length - 1);
    const y = baseline - audioWaveDisplayLevel(audioSpectrum[index]) * maximumHeight;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(right, baseline);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, baseline - maximumHeight, 0, baseline);
  fill.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},.24)`);
  fill.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},.03)`);
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  for (let index = 0; index < audioSpectrum.length; index++) {
    const x = left + (right - left) * index / (audioSpectrum.length - 1);
    const y = baseline - audioWaveDisplayLevel(audioSpectrum[index]) * maximumHeight;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(${Math.min(255, rgb.r + 70)},${Math.min(255, rgb.g + 70)},${Math.min(255, rgb.b + 70)},.65)`;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.restore();
}

function analyzeAudio(now) {
  let volume = 0;
  let bass = 0;
  let mid = 0;
  let high = 0;
  const testing = now < audioTestUntil;

  if (testing) {
    const elapsed = now - audioTestStartedAt;
    const beatIndex = Math.floor(elapsed / 360);
    const phase = (elapsed % 360) / 360;
    const pulse = Math.exp(-phase * 7);
    volume = .28 + pulse * .62;
    bass = .18 + pulse * .82;
    mid = .22 + pulse * .25;
    high = .10 + pulse * .16;
    updateTestSpectrum(elapsed, pulse);
    if (beatIndex !== audioTestBeatIndex) {
      audioTestBeatIndex = beatIndex;
      audioBeatPending = true;
    }
    setAudioStatus('测试中', 'active');
  } else if (audioAnalyser && audioFrequencyData && audioWaveformData) {
    audioAnalyser.getByteFrequencyData(audioFrequencyData);
    audioAnalyser.getByteTimeDomainData(audioWaveformData);
    let squares = 0;
    for (const sample of audioWaveformData) {
      const normalized = (sample - 128) / 128;
      squares += normalized * normalized;
    }
    const sensitivity = Number(audioSensitivityInput.value) / 100;
    const rms = Math.sqrt(squares / audioWaveformData.length);
    volume = Math.max(0, Math.min(1, (rms - .012) * sensitivity * 3.4));
    bass = Math.max(0, Math.min(1, (frequencyBandLevel(20, 180) - .025) * sensitivity * 2.15));
    mid = Math.max(0, Math.min(1, (frequencyBandLevel(180, 2200) - .018) * sensitivity * 2.0));
    high = Math.max(0, Math.min(1, (frequencyBandLevel(2200, 9000) - .012) * sensitivity * 2.2));
    updateSpectrumFromFrequencyData(sensitivity);

    audioBassBaseline = audioBassBaseline * .965 + bass * .035;
    if (bass > .13 && bass > audioBassBaseline * 1.48 && now - audioLastBeatAt > 130) {
      audioLastBeatAt = now;
      audioBeatPending = true;
    }
    setAudioStatus(volume + bass > .035 ? '正在响应' : '正在监听', 'active');
  } else {
    updateAudioSpectrum(() => 0);
    if (!audioStatusRow.classList.contains('error')) setAudioStatus('尚未开启');
  }

  audioLevels.volume = approachAudioLevel(audioLevels.volume, volume);
  audioLevels.bass = approachAudioLevel(audioLevels.bass, bass);
  audioLevels.mid = approachAudioLevel(audioLevels.mid, mid);
  audioLevels.high = approachAudioLevel(audioLevels.high, high);
  audioMeter.value = Math.min(1, audioLevels.volume * .72 + audioLevels.bass * .48);
}

function applyAudioReactiveMotion(now) {
  analyzeAudio(now);
  const strength = Number(audioStrengthInput.value) / 100;
  const bassStrength = Number(audioBassInput.value) / 100;
  audioKick *= .86;

  const bodies = Composite.allBodies(engine.world).filter(body => sprites.has(body.id) && !body.isStatic);
  if (audioBeatPending) {
    audioBeatPending = false;
    if (now - audioLastLaunchAt > 110) {
      audioLastLaunchAt = now;
      audioKick = Math.max(audioKick, .65 + audioLevels.bass * .95);
      const launchSpeed = Math.min(18, (6 + audioLevels.bass * 8 + audioLevels.volume * 4) * bassStrength * strength);
      for (const body of bodies) {
        const wave = audioWaveMetricsAtX(body.position.x);
        const localLaunch = launchSpeed * (.82 + wave.level * .36);
        Body.setVelocity(body, {
          x: Math.max(-18, Math.min(18, body.velocity.x * .78 + wave.slope * localLaunch * .55)),
          y: Math.max(-18, Math.min(18, Math.min(0, body.velocity.y) - localLaunch))
        });
        Body.setAngularVelocity(body, Math.max(-.18, Math.min(.18, body.angularVelocity * .82 + wave.slope * localLaunch * .055)));
        body.plugin = body.plugin || {};
        body.plugin.audioWaveLiftAt = now;
      }
    }
  }

  const activity = audioLevels.volume * .7 + audioLevels.mid * .25 + audioLevels.high * .12;
  const amplitude = Math.min(6, (activity * 3.1 + audioKick * 3.2) * strength);
  let leftEnergy = 0;
  let rightEnergy = 0;
  let spectrumPeak = 0;
  for (let index = 0; index < audioSpectrum.length; index++) {
    spectrumPeak = Math.max(spectrumPeak, audioSpectrum[index]);
    if (index < audioSpectrum.length / 2) leftEnergy += audioSpectrum[index];
    else rightEnergy += audioSpectrum[index];
  }
  const balance = (rightEnergy - leftEnergy) / Math.max(1, audioSpectrum.length / 2);
  const targetX = balance * amplitude * 1.5;
  const targetY = -(audioLevels.bass * .65 + audioKick) * strength * 2.1;
  audioVisualOffset.x += (targetX - audioVisualOffset.x) * .48;
  audioVisualOffset.y += (targetY - audioVisualOffset.y) * .48;

  if (activity > .008 || audioKick > .01 || spectrumPeak > .012) {
    for (const body of bodies) {
      const wave = audioWaveMetricsAtX(body.position.x);
      const contact = Math.max(0, Math.min(1, (body.bounds.max.y + 10 - wave.y) / 26));
      body.plugin = body.plugin || {};
      if (wave.risePixels > .35 && contact > 0 && now - (body.plugin.audioWaveLiftAt || 0) > 82) {
        const waveLift = Math.min(12, (1.1 + wave.risePixels * .28 + wave.displayedLevel * 3) * (.35 + contact * .65) * bassStrength * strength);
        if (waveLift > .8) {
          Body.setVelocity(body, {
            x: Math.max(-18, Math.min(18, body.velocity.x * .88 + wave.slope * waveLift * .35)),
            y: Math.max(-18, Math.min(18, Math.min(0, body.velocity.y) - waveLift))
          });
          body.plugin.audioWaveLiftAt = now;
        }
      }
      Body.applyForce(body, body.position, {
        x: wave.slope * activity * strength * .00048 * body.mass,
        y: -(wave.displayedLevel * .70 + audioLevels.bass * .30) * bassStrength * strength * .00030 * body.mass
      });
    }
  }
}

function addWall(x1, y1, x2, y2, thickness = 26) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const wall = Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(dx, dy), thickness, {
    isStatic: true,
    angle: Math.atan2(dy, dx),
    friction: .2,
    restitution: .25
  });
  walls.push(wall);
}

function containerWallPoints(width, height) {
  if (shapeSelect.value === 'bottle') {
    return [[width*.30,8],[width*.70,8],[width*.70,66],[width-25,138],[width-13,height-48],[width-34,height-13],[34,height-13],[13,height-48],[25,138],[width*.30,66]];
  }
  return [[10,14],[width-10,14],[width-10,height-18],[10,height-18]];
}

function buildWalls(width, height) {
  for (const wall of walls) Composite.remove(engine.world, wall);
  walls = [];
  const points = containerWallPoints(width, height);
  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    addWall(current[0], current[1], next[0], next[1], 20);
  }
  Composite.add(engine.world, walls);
}

function horizontalContainerBounds(y, width, height) {
  const points = containerWallPoints(width, height);
  const intersections = [];
  for (let index = 0; index < points.length; index++) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    if (Math.abs(y2 - y1) < .001 || y < Math.min(y1, y2) || y > Math.max(y1, y2)) continue;
    const progress = (y - y1) / (y2 - y1);
    intersections.push(x1 + (x2 - x1) * progress);
  }
  if (intersections.length < 2) return null;
  return { left: Math.min(...intersections), right: Math.max(...intersections) };
}

function horizontalCorrection(body, width, height, yOffset) {
  const wallClearance = 12;
  let minimum = -Infinity;
  let maximum = Infinity;
  for (const vertex of body.vertices) {
    const bounds = horizontalContainerBounds(vertex.y + yOffset, width, height);
    if (!bounds) return null;
    minimum = Math.max(minimum, bounds.left + wallClearance - vertex.x);
    maximum = Math.min(maximum, bounds.right - wallClearance - vertex.x);
  }
  if (minimum > maximum) return null;
  return Math.max(minimum, Math.min(maximum, 0));
}

function keepBodyInside(body, width, height) {
  const points = containerWallPoints(width, height);
  const wallClearance = 12;
  const top = Math.min(...points.map(point => point[1])) + wallClearance;
  const bottom = Math.max(...points.map(point => point[1])) - wallClearance;
  const topExtent = body.position.y - body.bounds.min.y;
  const bottomExtent = body.bounds.max.y - body.position.y;
  const targetY = Math.max(top + topExtent, Math.min(bottom - bottomExtent, body.position.y));
  const initialYOffset = targetY - body.position.y;
  const availableDrop = Math.max(0, bottom - (body.bounds.max.y + initialYOffset));
  let yOffset = initialYOffset;
  let xOffset = horizontalCorrection(body, width, height, yOffset);

  // A wide picture cannot stay in a narrow bottle neck. Move it down only as
  // far as needed to reach a section that can contain its complete outline.
  for (let extra = 4; xOffset === null && extra < availableDrop; extra += 4) {
    yOffset = initialYOffset + extra;
    xOffset = horizontalCorrection(body, width, height, yOffset);
  }
  if (xOffset === null && availableDrop > 0) {
    yOffset = initialYOffset + availableDrop;
    xOffset = horizontalCorrection(body, width, height, yOffset);
  }
  if (xOffset === null) {
    xOffset = width / 2 - body.position.x;
  }

  if (Math.abs(xOffset) > .01 || Math.abs(yOffset) > .01) {
    Body.setPosition(body, { x: body.position.x + xOffset, y: body.position.y + yOffset });
    Body.setVelocity(body, { x: body.velocity.x * .25, y: Math.min(2, body.velocity.y * .25) });
  }
}

function fitSpritesToContainer(width, height, previousSize = null) {
  for (const body of Composite.allBodies(engine.world)) {
    if (!sprites.has(body.id)) continue;
    if (previousSize?.width > 0 && previousSize?.height > 0) {
      Body.setPosition(body, {
        x: body.position.x * width / previousSize.width,
        y: body.position.y * height / previousSize.height
      });
    }
    keepBodyInside(body, width, height);
  }
}

function resize() {
  const width = innerWidth;
  const height = innerHeight;
  const dpr = devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fitSpritesToContainer(width, height, viewportSize);
  buildWalls(width, height);
  viewportSize = { width, height };
}

function hexToRgb(hex) {
  const number = parseInt(hex.slice(1), 16);
  return { r: number >> 16, g: (number >> 8) & 255, b: number & 255 };
}

function containerPath(shape, width, height) {
  const path = new Path2D();
  if (shape === 'bottle') {
    path.moveTo(width * .30, 8);
    path.lineTo(width * .70, 8);
    path.lineTo(width * .70, 66);
    path.bezierCurveTo(width * .72, 88, width - 38, 104, width - 24, 140);
    path.lineTo(width - 13, height - 48);
    path.quadraticCurveTo(width - 10, height - 18, width - 36, height - 12);
    path.lineTo(36, height - 12);
    path.quadraticCurveTo(10, height - 18, 13, height - 48);
    path.lineTo(24, 140);
    path.bezierCurveTo(38, 104, width * .28, 88, width * .30, 66);
    path.closePath();
  } else {
    path.roundRect(8, 11, width - 16, height - 28, 10);
  }
  return path;
}

function drawContainer() {
  const rgb = hexToRgb(colorInput.value);
  const path = containerPath(shapeSelect.value, innerWidth, innerHeight);
  const gradient = ctx.createLinearGradient(0, 0, innerWidth, innerHeight);
  gradient.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},.26)`);
  gradient.addColorStop(.55, `rgba(${rgb.r},${rgb.g},${rgb.b},.10)`);
  gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},.21)`);
  ctx.fillStyle = gradient;
  ctx.fill(path);
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(${Math.min(255, rgb.r + 60)},${Math.min(255, rgb.g + 60)},${Math.min(255, rgb.b + 60)},.58)`;
  ctx.stroke(path);

  ctx.save();
  ctx.clip(path);
  const shine = ctx.createLinearGradient(0, 0, innerWidth, 0);
  shine.addColorStop(0, 'rgba(255,255,255,.18)');
  shine.addColorStop(.18, 'rgba(255,255,255,.02)');
  shine.addColorStop(.82, 'rgba(255,255,255,.01)');
  shine.addColorStop(1, 'rgba(255,255,255,.12)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.restore();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function removeConnectedBackground(imageData, width, height, threshold) {
  const data = imageData.data;
  const cornerSize = Math.max(2, Math.min(8, Math.floor(Math.min(width, height) / 20)));
  let red = 0, green = 0, blue = 0, samples = 0;
  const sampleCorner = (startX, startY) => {
    for (let y = startY; y < startY + cornerSize; y++) {
      for (let x = startX; x < startX + cornerSize; x++) {
        const offset = (y * width + x) * 4;
        if (data[offset + 3] > 20) {
          red += data[offset]; green += data[offset + 1]; blue += data[offset + 2]; samples++;
        }
      }
    }
  };
  sampleCorner(0, 0);
  sampleCorner(width - cornerSize, 0);
  sampleCorner(0, height - cornerSize);
  sampleCorner(width - cornerSize, height - cornerSize);
  const background = samples ? [red / samples, green / samples, blue / samples] : [255, 255, 255];
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const qualifies = (pixel) => {
    const offset = pixel * 4;
    if (data[offset + 3] < 20) return true;
    return Math.hypot(data[offset] - background[0], data[offset + 1] - background[1], data[offset + 2] - background[2]) <= threshold;
  };
  const enqueue = (pixel) => {
    if (!visited[pixel] && qualifies(pixel)) {
      visited[pixel] = 1;
      queue[tail++] = pixel;
    }
  };
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const pixel = queue[head++];
    data[pixel * 4 + 3] = 0;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x < width - 1) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y < height - 1) enqueue(pixel + width);
  }
}

function featherImageData(imageData, width, height, radius = 2) {
  const data = imageData.data;
  const alpha = new Uint8Array(width * height);
  for (let pixel = 0; pixel < alpha.length; pixel++) alpha[pixel] = data[pixel * 4 + 3];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x;
      if (alpha[pixel] === 0) continue;
      let nearest = radius + 1;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (alpha[ny * width + nx] === 0) nearest = Math.min(nearest, Math.max(Math.abs(dx), Math.abs(dy)));
        }
      }
      if (nearest <= radius) data[pixel * 4 + 3] = Math.round(alpha[pixel] * (nearest / (radius + 1)));
    }
  }
}

function keepLargestForegroundComponent(imageData, width, height) {
  const data = imageData.data;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let largest = [];
  for (let start = 0; start < width * height; start++) {
    if (visited[start] || data[start * 4 + 3] <= 12) continue;
    let head = 0, tail = 0;
    const component = [];
    visited[start] = 1;
    queue[tail++] = start;
    while (head < tail) {
      const pixel = queue[head++];
      component.push(pixel);
      const x = pixel % width, y = Math.floor(pixel / width);
      const neighbors = [];
      if (x > 0) neighbors.push(pixel - 1);
      if (x < width - 1) neighbors.push(pixel + 1);
      if (y > 0) neighbors.push(pixel - width);
      if (y < height - 1) neighbors.push(pixel + width);
      for (const next of neighbors) {
        if (!visited[next] && data[next * 4 + 3] > 12) {
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (component.length > largest.length) largest = component;
  }
  const keep = new Uint8Array(width * height);
  for (const pixel of largest) keep[pixel] = 1;
  for (let pixel = 0; pixel < width * height; pixel++) {
    if (!keep[pixel]) data[pixel * 4 + 3] = 0;
  }
}

function cropSubjectCanvas(source, padding = 2) {
  const context = source.getContext('2d', { willReadFrequently: true });
  const data = context.getImageData(0, 0, source.width, source.height).data;
  let minX = source.width, minY = source.height, maxX = -1, maxY = -1;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (data[(y * source.width + x) * 4 + 3] > 8) {
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX) throw new Error('没有识别到主体');
  const output = document.createElement('canvas');
  output.width = maxX - minX + 1 + padding * 2;
  output.height = maxY - minY + 1 + padding * 2;
  const cropWidth = maxX-minX+1;
  const cropHeight = maxY-minY+1;
  output.getContext('2d').drawImage(source, minX, minY, cropWidth, cropHeight, padding, padding, cropWidth, cropHeight);
  return output;
}

function createPlasticFrame(source, rimRadius = 6) {
  const margin = rimRadius + 2;
  const output = document.createElement('canvas');
  output.width = source.width + margin * 2;
  output.height = source.height + margin * 2;
  const ring = document.createElement('canvas');
  ring.width = output.width;
  ring.height = output.height;
  const ringContext = ring.getContext('2d');
  if (rimRadius > 0) {
    const samples = Math.max(16, rimRadius * 4);
    for (let index = 0; index < samples; index++) {
      const angle = index / samples * Math.PI * 2;
      ringContext.drawImage(source, margin + Math.cos(angle)*rimRadius, margin + Math.sin(angle)*rimRadius);
    }
  }
  ringContext.globalCompositeOperation = 'source-in';
  const rimGradient = ringContext.createLinearGradient(0, 0, output.width, output.height);
  rimGradient.addColorStop(0, 'rgba(255,255,255,.62)');
  rimGradient.addColorStop(.45, 'rgba(218,241,255,.30)');
  rimGradient.addColorStop(1, 'rgba(150,202,240,.22)');
  ringContext.fillStyle = rimGradient;
  ringContext.fillRect(0, 0, output.width, output.height);
  ringContext.globalCompositeOperation = 'destination-out';
  ringContext.drawImage(source, margin, margin);

  const outputContext = output.getContext('2d');
  outputContext.drawImage(ring, 0, 0);
  outputContext.drawImage(source, margin, margin);
  return output;
}

function processImageCanvases(image, removeBackground, threshold, rimWidth = 16) {
  const processingScale = Math.min(1, 900 / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * processingScale));
  const height = Math.max(1, Math.round(image.naturalHeight * processingScale));
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const sourceContext = source.getContext('2d', { willReadFrequently: true });
  sourceContext.drawImage(image, 0, 0, width, height);
  const imageData = sourceContext.getImageData(0, 0, width, height);
  const data = imageData.data;

  if (removeBackground) removeConnectedBackground(imageData, width, height, threshold);
  keepLargestForegroundComponent(imageData, width, height);
  featherImageData(imageData, width, height, 2);
  sourceContext.putImageData(imageData, 0, 0);

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 12) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX) throw new Error('没有识别到主体');
  const base = cropSubjectCanvas(source, 2);
  return { base, framed: createPlasticFrame(base, rimWidth) };
}

function convexHull(points) {
  if (points.length <= 3) return points;
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x-o.x)*(b.y-o.y) - (a.y-o.y)*(b.x-o.x);
  const lower = [];
  for (const point of points) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = points.length - 1; index >= 0; index--) {
    const point = points[index];
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

function visibleHull(image, displayWidth, displayHeight) {
  const sample = document.createElement('canvas');
  sample.width = image.naturalWidth;
  sample.height = image.naturalHeight;
  const sampleContext = sample.getContext('2d', { willReadFrequently: true });
  sampleContext.drawImage(image, 0, 0);
  const data = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
  const points = [];
  const visible = (x, y) => data[(y * sample.width + x) * 4 + 3] > 8;
  for (let y = 0; y < sample.height; y += 2) {
    let left = -1, right = -1;
    for (let x = 0; x < sample.width; x++) if (visible(x,y)) { left=x; break; }
    for (let x = sample.width-1; x >= 0; x--) if (visible(x,y)) { right=x; break; }
    if (left >= 0) { points.push({x:left,y}); if (right !== left) points.push({x:right,y}); }
  }
  for (let x = 0; x < sample.width; x += 2) {
    let top = -1, bottom = -1;
    for (let y = 0; y < sample.height; y++) if (visible(x,y)) { top=y; break; }
    for (let y = sample.height-1; y >= 0; y--) if (visible(x,y)) { bottom=y; break; }
    if (top >= 0) { points.push({x,y:top}); if (bottom !== top) points.push({x,y:bottom}); }
  }
  return convexHull(points).map(point => ({
    x: (point.x / sample.width - .5) * displayWidth,
    y: (point.y / sample.height - .5) * displayHeight
  }));
}

function createSpriteBody(image, width, height, x, y) {
  const options = { restitution: .45, friction: .14, frictionAir: .009 };
  const hull = visibleHull(image, width, height);
  if (hull.length >= 3) return Bodies.fromVertices(x, y, [hull], options, true);
  return Bodies.rectangle(x, y, width, height, options);
}

function replaceSelectedBody(sprite, image, width, height) {
  const oldBody = selectedBody;
  const newBody = createSpriteBody(image, width, height, oldBody.position.x, oldBody.position.y);
  Body.setAngle(newBody, oldBody.angle);
  Body.setVelocity(newBody, oldBody.velocity);
  Body.setAngularVelocity(newBody, oldBody.angularVelocity);
  Composite.remove(engine.world, oldBody);
  sprites.delete(oldBody.id);
  Composite.add(engine.world, newBody);
  sprites.set(newBody.id, sprite);
  selectedBody = newBody;
  Object.assign(sprite, { img: image, w: width, h: height, collisionW: width, collisionH: height });
}

function displaySize(image) {
  const max = 118;
  let scale = Math.min(max / image.naturalWidth, max / image.naturalHeight, 1);
  if (Math.min(image.naturalWidth, image.naturalHeight) * scale < 34) {
    scale = Math.min(max / Math.max(image.naturalWidth, image.naturalHeight), 34 / Math.min(image.naturalWidth, image.naturalHeight));
  }
  return { width: image.naturalWidth * scale, height: image.naturalHeight * scale };
}

async function addImage(item) {
  try {
    const originalImage = await loadImage(item.dataUrl);
    const defaultRim = Number(defaultRimInput.value);
    const defaultScale = Number(defaultSizeInput.value);
    const processed = processImageCanvases(originalImage, autoCutoutInput.checked, Number(thresholdInput.value), defaultRim);
    const baseImage = await loadImage(processed.base.toDataURL('image/png'));
    const image = await loadImage(processed.framed.toDataURL('image/png'));
    const baseSize = displaySize(baseImage);
    const pixelScale = baseSize.width / baseImage.naturalWidth;
    const width = image.naturalWidth * pixelScale * defaultScale / 100;
    const height = image.naturalHeight * pixelScale * defaultScale / 100;
    const body = createSpriteBody(image, width, height, 75 + Math.random() * Math.max(20, innerWidth - 150), 82 + Math.random() * 55);
    sprites.set(body.id, {
      img: image,
      baseImg: baseImage,
      originalImg: originalImage,
      name: item.name,
      w: width,
      h: height,
      collisionW: width,
      collisionH: height,
      pixelScale,
      scalePercent: defaultScale,
      rimWidth: defaultRim
    });
    Composite.add(engine.world, body);
    empty.classList.add('hidden');
  } catch (error) {
    showToast(`${item.name || '图片'}：${error.message || '导入失败'}`);
  }
}

async function addFiles(items) {
  for (const item of items) await addImage(item);
}

function serializeCurrentScene() {
  const items = [];
  for (const body of Composite.allBodies(engine.world)) {
    const sprite = sprites.get(body.id);
    if (!sprite) continue;
    items.push({
      name: sprite.name,
      originalSrc: sprite.originalImg.src,
      baseSrc: sprite.baseImg.src,
      pixelScale: sprite.pixelScale,
      scalePercent: sprite.scalePercent,
      rimWidth: sprite.rimWidth,
      x: body.position.x / innerWidth,
      y: body.position.y / innerHeight,
      angle: body.angle
    });
  }
  return {
    version: 1,
    container: {
      shape: shapeSelect.value,
      color: colorInput.value,
      width: Number(windowWidthInput.value),
      height: Number(windowHeightInput.value),
      defaultSize: Number(defaultSizeInput.value),
      defaultRim: Number(defaultRimInput.value)
    },
    items
  };
}

async function saveCurrentScene(asNew = false) {
  const requestedName = sceneNameInput.value.trim();
  const result = await window.desktopPet.saveScene({
    id: asNew ? null : currentSceneId,
    name: requestedName || currentSceneName || '未命名瓶子',
    scene: serializeCurrentScene()
  });
  currentSceneId = result.id;
  currentSceneName = result.name;
  sceneNameInput.value = result.name;
  await refreshSceneList();
  showToast(asNew ? '已保存为新瓶子' : '当前瓶子已更新');
}

function clearCurrentItems() {
  setSelection(null);
  for (const body of Composite.allBodies(engine.world)) {
    if (sprites.has(body.id)) Composite.remove(engine.world, body);
  }
  sprites.clear();
  empty.classList.remove('hidden');
}

async function restoreSavedScene(requestedId = null) {
  try {
    const entry = await window.desktopPet.loadScene(requestedId);
    const scene = entry?.scene;
    if (!scene?.container || !Array.isArray(scene.items)) {
      await refreshSceneList();
      return;
    }
    clearCurrentItems();
    currentSceneId = entry.id;
    currentSceneName = entry.name;
    sceneNameInput.value = entry.name;
    const container = scene.container;
    shapeSelect.value = ['bottle', 'box'].includes(container.shape) ? container.shape : 'bottle';
    colorInput.value = container.color || '#79b8ff';
    windowWidthInput.value = container.width || 360;
    windowHeightInput.value = container.height || 460;
    defaultSizeInput.value = container.defaultSize || 100;
    defaultRimInput.value = container.defaultRim || 16;
    defaultSizeValue.value = `${defaultSizeInput.value}%`;
    defaultRimValue.value = defaultRimInput.value;
    toy.dataset.shape = shapeSelect.value;
    updateWindowSize();
    savePreferences();
    await new Promise(resolve => setTimeout(resolve, 420));
    for (const saved of scene.items) {
      try {
        const [originalImage, baseImage] = await Promise.all([loadImage(saved.originalSrc), loadImage(saved.baseSrc)]);
        const baseCanvas = document.createElement('canvas');
        baseCanvas.width = baseImage.naturalWidth;
        baseCanvas.height = baseImage.naturalHeight;
        baseCanvas.getContext('2d').drawImage(baseImage, 0, 0);
        const rimWidth = Math.max(1, Math.min(32, Number(saved.rimWidth) || 16));
        const image = await loadImage(createPlasticFrame(baseCanvas, rimWidth).toDataURL('image/png'));
        const pixelScale = Number(saved.pixelScale) || displaySize(baseImage).width / baseImage.naturalWidth;
        const scalePercent = Number(saved.scalePercent) || 100;
        const width = image.naturalWidth * pixelScale * scalePercent / 100;
        const height = image.naturalHeight * pixelScale * scalePercent / 100;
        const savedX = Number(saved.x);
        const savedY = Number(saved.y);
        const normalizedX = Number.isFinite(savedX) ? savedX : .5;
        const normalizedY = Number.isFinite(savedY) ? savedY : .5;
        const body = createSpriteBody(
          image, width, height,
          Math.max(30, Math.min(innerWidth-30, normalizedX * innerWidth)),
          Math.max(30, Math.min(innerHeight-30, normalizedY * innerHeight))
        );
        Body.setAngle(body, Number(saved.angle) || 0);
        sprites.set(body.id, {
          img: image, baseImg: baseImage, originalImg: originalImage, name: saved.name,
          w: width, h: height, collisionW: width, collisionH: height,
          pixelScale, scalePercent, rimWidth
        });
        Composite.add(engine.world, body);
      } catch (error) {
        console.warn('Skipped one saved image:', error);
      }
    }
    empty.classList.toggle('hidden', sprites.size > 0);
    if (sprites.size) showToast(`正在展示：${entry.name}`);
    await refreshSceneList();
  } catch (error) {
    showToast('保存文件读取失败');
  }
}

async function refreshSceneList() {
  const library = await window.desktopPet.listScenes();
  sceneListElement.replaceChildren();
  if (!library.scenes.length) {
    const emptyRow = document.createElement('div');
    emptyRow.className = 'scene-row';
    emptyRow.textContent = '还没有保存的瓶子';
    sceneListElement.appendChild(emptyRow);
    return;
  }
  for (const scene of library.scenes.sort((a,b) => b.updatedAt-a.updatedAt)) {
    const row = document.createElement('div');
    row.className = `scene-row${scene.id === currentSceneId ? ' active' : ''}`;
    const name = document.createElement('span');
    name.textContent = scene.name;
    const showButton = document.createElement('button');
    showButton.textContent = scene.id === currentSceneId ? '展示中' : '展示';
    showButton.disabled = scene.id === currentSceneId;
    showButton.addEventListener('click', () => restoreSavedScene(scene.id));
    const deleteButton = document.createElement('button');
    deleteButton.textContent = '×';
    deleteButton.title = '删除这个瓶子';
    deleteButton.addEventListener('click', async () => {
      if (!confirm(`删除“${scene.name}”？`)) return;
      const result = await window.desktopPet.deleteScene(scene.id);
      if (scene.id === currentSceneId) {
        currentSceneId = null;
        currentSceneName = '';
        if (result.activeId) await restoreSavedScene(result.activeId);
        else clearCurrentItems();
      }
      await refreshSceneList();
    });
    row.append(name, showButton, deleteButton);
    sceneListElement.appendChild(row);
  }
}

function fileToItem(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, dataUrl: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setSelection(body, showPanel = true) {
  selectedBody = body;
  const enabled = Boolean(body);
  removeButton.disabled = !enabled;
  cutoutButton.disabled = !enabled;
  selectionPanel.classList.toggle('hidden', !enabled || !showPanel);
  if (enabled) {
    const sprite = sprites.get(body.id);
    spriteSizeInput.value = sprite.scalePercent || 100;
    spriteSizeValue.value = `${spriteSizeInput.value}%`;
    rimWidthInput.value = sprite.rimWidth || 16;
    rimWidthValue.value = rimWidthInput.value;
  } else {
    spriteSizeInput.value = 100;
    spriteSizeValue.value = '100%';
  }
}

function removeSelected() {
  if (!selectedBody) return;
  sprites.delete(selectedBody.id);
  Composite.remove(engine.world, selectedBody);
  setSelection(null);
  empty.classList.toggle('hidden', sprites.size > 0);
  showToast('已删除图片');
}

async function recutSelected() {
  openCutoutEditor();
}

function resetEditorAutoCutout() {
  if (!editorOriginalCanvas) return;
  editorContext.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
  editorContext.drawImage(editorOriginalCanvas, 0, 0);
  const imageData = editorContext.getImageData(0, 0, editorCanvas.width, editorCanvas.height);
  removeConnectedBackground(imageData, editorCanvas.width, editorCanvas.height, Number(thresholdInput.value));
  editorContext.putImageData(imageData, 0, 0);
}

function openCutoutEditor() {
  if (!selectedBody) return;
  const sprite = sprites.get(selectedBody.id);
  const original = sprite.originalImg;
  const scale = Math.min(1, 800 / Math.max(original.naturalWidth, original.naturalHeight));
  editorCanvas.width = Math.max(1, Math.round(original.naturalWidth * scale));
  editorCanvas.height = Math.max(1, Math.round(original.naturalHeight * scale));
  editorOriginalCanvas = document.createElement('canvas');
  editorOriginalCanvas.width = editorCanvas.width;
  editorOriginalCanvas.height = editorCanvas.height;
  editorOriginalCanvas.getContext('2d').drawImage(original, 0, 0, editorCanvas.width, editorCanvas.height);
  resetEditorAutoCutout();
  editorMode = 'erase';
  document.querySelector('#mode-erase').classList.add('active');
  document.querySelector('#mode-restore').classList.remove('active');
  settingsPanel.classList.add('hidden');
  document.querySelector('#settings').classList.remove('active');
  cutoutEditor.classList.remove('hidden');
}

function closeCutoutEditor() {
  editorDrawing = false;
  editorLastPoint = null;
  editorOriginalCanvas = null;
  cutoutEditor.classList.add('hidden');
}

function editorPoint(event) {
  const rect = editorCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * editorCanvas.width / rect.width,
    y: (event.clientY - rect.top) * editorCanvas.height / rect.height
  };
}

function paintEditorCircle(point) {
  const radius = Number(brushSizeInput.value) / 2 * editorCanvas.width / Math.max(1, editorCanvas.getBoundingClientRect().width);
  editorContext.save();
  editorContext.beginPath();
  editorContext.arc(point.x, point.y, radius, 0, Math.PI * 2);
  editorContext.clip();
  if (editorMode === 'erase') {
    editorContext.clearRect(point.x-radius-1, point.y-radius-1, radius*2+2, radius*2+2);
  } else {
    editorContext.drawImage(editorOriginalCanvas, 0, 0);
  }
  editorContext.restore();
}

function paintEditorStroke(from, to) {
  const distance = Math.hypot(to.x-from.x, to.y-from.y);
  const step = Math.max(1, Number(brushSizeInput.value) / 5);
  const count = Math.max(1, Math.ceil(distance / step));
  for (let index = 1; index <= count; index++) {
    paintEditorCircle({ x: from.x + (to.x-from.x)*index/count, y: from.y + (to.y-from.y)*index/count });
  }
}

async function applyManualCutout() {
  if (!selectedBody) return closeCutoutEditor();
  try {
    const working = document.createElement('canvas');
    working.width = editorCanvas.width;
    working.height = editorCanvas.height;
    const workingContext = working.getContext('2d', { willReadFrequently: true });
    workingContext.drawImage(editorCanvas, 0, 0);
    const imageData = workingContext.getImageData(0, 0, working.width, working.height);
    keepLargestForegroundComponent(imageData, working.width, working.height);
    featherImageData(imageData, working.width, working.height, 2);
    workingContext.putImageData(imageData, 0, 0);
    const sprite = sprites.get(selectedBody.id);
    const base = cropSubjectCanvas(working, 2);
    const framed = createPlasticFrame(base, sprite.rimWidth || 16);
    const baseImage = await loadImage(base.toDataURL('image/png'));
    const image = await loadImage(framed.toDataURL('image/png'));
    const baseSize = displaySize(baseImage);
    sprite.pixelScale = baseSize.width / baseImage.naturalWidth;
    sprite.baseImg = baseImage;
    const scaleFactor = (sprite.scalePercent || 100) / 100;
    const width = image.naturalWidth * sprite.pixelScale * scaleFactor;
    const height = image.naturalHeight * sprite.pixelScale * scaleFactor;
    replaceSelectedBody(sprite, image, width, height);
    closeCutoutEditor();
    showToast('手动抠图已应用');
  } catch (error) {
    showToast(error.message || '无法应用抠图');
  }
}

function bodyAt(x, y) {
  const bodies = Composite.allBodies(engine.world);
  for (let index = bodies.length - 1; index >= 0; index--) {
    const body = bodies[index];
    if (!body.isStatic && Vertices.contains(body.vertices, { x, y })) return body;
  }
  return null;
}

function tick() {
  applyAudioReactiveMotion(performance.now());
  Engine.update(engine, 1000 / 60);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.save();
  ctx.translate(audioVisualOffset.x, audioVisualOffset.y);
  drawContainer();
  drawAudioWaveform();
  for (const body of Composite.allBodies(engine.world)) {
    const sprite = sprites.get(body.id);
    if (!sprite) continue;
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);
    ctx.shadowColor = 'rgba(0,0,0,.34)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    ctx.drawImage(sprite.img, -sprite.w / 2, -sprite.h / 2, sprite.w, sprite.h);
    if (body === selectedBody) {
      ctx.shadowColor = 'transparent';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(-sprite.w / 2 - 4, -sprite.h / 2 - 4, sprite.w + 8, sprite.h + 8);
    }
    ctx.restore();
  }
  ctx.restore();
  requestAnimationFrame(tick);
}

window.desktopPet.onWindowMotion(({ vx, vy }) => {
  if (!Number.isFinite(vx) || !Number.isFinite(vy)) return;
  const ax = Math.max(-0.0055, Math.min(0.0055, -vx * .0036));
  const ay = Math.max(-0.0055, Math.min(0.0055, -vy * .0036));
  for (const body of Composite.allBodies(engine.world)) {
    if (!body.isStatic) {
      const offset = Math.min(18, (body.bounds.max.y - body.bounds.min.y) * .28);
      Body.applyForce(body, { x: body.position.x, y: body.position.y + offset }, { x: ax * body.mass, y: ay * body.mass });
      const impulseX = Math.max(-2.8, Math.min(2.8, -vx * .58));
      const impulseY = Math.max(-2.8, Math.min(2.8, -vy * .58));
      Body.setVelocity(body, {
        x: Math.max(-18, Math.min(18, body.velocity.x + impulseX)),
        y: Math.max(-18, Math.min(18, body.velocity.y + impulseY))
      });
      const spin = Math.max(-.055, Math.min(.055, (vx - vy) * .012));
      Body.setAngularVelocity(body, Math.max(-.16, Math.min(.16, body.angularVelocity + spin)));
    }
  }
  lastMotion = { vx, vy };
});

canvas.addEventListener('pointerdown', (event) => {
  const rect = canvas.getBoundingClientRect();
  const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  const body = bodyAt(point.x, point.y);
  if (body) {
    setSelection(body, false);
    draggedBody = body;
    draggedPointerId = event.pointerId;
    spriteDragOffset = { x: body.position.x - point.x, y: body.position.y - point.y };
    spriteDragLast = { ...point, time: performance.now() };
    spriteDragStart = { ...point };
    spriteDragMoved = false;
    spriteDragVelocity = { x: 0, y: 0 };
    Body.setStatic(body, true);
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('dragging');
    return;
  }
  setSelection(null);
  beginWindowDrag(event);
});

function beginWindowDrag(event) {
  if (draggingWindow || event.button !== 0) return;
  draggingWindow = true;
  canvas.classList.add('dragging');
  window.desktopPet.beginWindowDrag(event.screenX, event.screenY);
}

dragSpace.addEventListener('pointerdown', beginWindowDrag);

canvas.addEventListener('pointermove', event => {
  if (!draggedBody || event.pointerId !== draggedPointerId) return;
  const rect = canvas.getBoundingClientRect();
  const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  if (Math.hypot(point.x - spriteDragStart.x, point.y - spriteDragStart.y) > 4) spriteDragMoved = true;
  const now = performance.now();
  const dt = Math.max(8, now - spriteDragLast.time);
  spriteDragVelocity = {
    x: Math.max(-8, Math.min(8, (point.x - spriteDragLast.x) / dt * 7)),
    y: Math.max(-8, Math.min(8, (point.y - spriteDragLast.y) / dt * 7))
  };
  Body.setPosition(draggedBody, {
    x: Math.max(18, Math.min(innerWidth - 18, point.x + spriteDragOffset.x)),
    y: Math.max(18, Math.min(innerHeight - 18, point.y + spriteDragOffset.y))
  });
  spriteDragLast = { ...point, time: now };
});

function endSpriteDrag(event) {
  if (!draggedBody || (event?.pointerId != null && event.pointerId !== draggedPointerId)) return;
  const body = draggedBody;
  Body.setStatic(body, false);
  Body.setVelocity(body, spriteDragVelocity);
  if (!spriteDragMoved) setSelection(body, true);
  else selectionPanel.classList.add('hidden');
  if (draggedPointerId != null && canvas.hasPointerCapture(draggedPointerId)) canvas.releasePointerCapture(draggedPointerId);
  draggedBody = null;
  draggedPointerId = null;
  spriteDragLast = null;
  spriteDragStart = null;
  spriteDragMoved = false;
  canvas.classList.remove('dragging');
}

function endWindowDrag() {
  if (!draggingWindow) return;
  draggingWindow = false;
  canvas.classList.remove('dragging');
  window.desktopPet.endWindowDrag();
}

window.addEventListener('pointerup', event => { endSpriteDrag(event); endWindowDrag(); });
window.addEventListener('blur', () => { endSpriteDrag(); endWindowDrag(); });
document.querySelector('#add').addEventListener('click', async () => addFiles(await window.desktopPet.pickImages()));
document.querySelector('#remove').addEventListener('click', removeSelected);
document.querySelector('#cutout').addEventListener('click', openCutoutEditor);
document.querySelector('#save').addEventListener('click', () => {
  scenePanel.classList.toggle('hidden');
  settingsPanel.classList.add('hidden');
  refreshSceneList().catch(() => showToast('瓶子库读取失败'));
});
document.querySelector('#scene-close').addEventListener('click', () => scenePanel.classList.add('hidden'));
document.querySelector('#scene-new').addEventListener('click', () => saveCurrentScene(true).catch(() => showToast('保存失败')));
document.querySelector('#scene-update').addEventListener('click', () => saveCurrentScene(!currentSceneId).catch(() => showToast('保存失败')));
document.querySelector('#close').addEventListener('click', () => window.desktopPet.close());
document.querySelector('#settings').addEventListener('click', (event) => {
  settingsPanel.classList.toggle('hidden');
  event.currentTarget.classList.toggle('active', !settingsPanel.classList.contains('hidden'));
});
document.querySelector('#gravity').addEventListener('click', (event) => {
  gravityOn = !gravityOn;
  engine.gravity.y = gravityOn ? 1 : 0;
  event.currentTarget.classList.toggle('active', gravityOn);
});

shapeSelect.addEventListener('change', () => {
  toy.dataset.shape = shapeSelect.value;
  fitSpritesToContainer(innerWidth, innerHeight);
  buildWalls(innerWidth, innerHeight);
  savePreferences();
});
colorInput.addEventListener('input', savePreferences);
defaultSizeInput.addEventListener('input', () => {
  defaultSizeValue.value = `${defaultSizeInput.value}%`;
  savePreferences();
});
defaultRimInput.addEventListener('input', () => {
  defaultRimValue.value = defaultRimInput.value;
  savePreferences();
});
thresholdInput.addEventListener('input', () => {
  thresholdValue.value = thresholdInput.value;
  savePreferences();
});
autoCutoutInput.addEventListener('change', savePreferences);
audioSensitivityInput.addEventListener('input', () => {
  audioSensitivityValue.value = `${audioSensitivityInput.value}%`;
  savePreferences();
});
audioBassInput.addEventListener('input', () => {
  audioBassValue.value = `${audioBassInput.value}%`;
  savePreferences();
});
audioStrengthInput.addEventListener('input', () => {
  audioStrengthValue.value = `${audioStrengthInput.value}%`;
  savePreferences();
});
audioReactiveInput.addEventListener('change', async () => {
  if (!audioReactiveInput.checked) {
    stopSystemAudio();
    showToast('已关闭电脑音频震动');
    return;
  }
  try {
    await startSystemAudio();
  } catch (error) {
    console.error('Unable to start system audio:', error);
    showToast('无法读取电脑音频，请重试');
  }
});
audioTestButton.addEventListener('click', () => {
  audioTestStartedAt = performance.now();
  audioTestUntil = audioTestStartedAt + 1800;
  audioTestBeatIndex = -1;
  audioKick = 1;
  showToast('正在测试音频震动');
});

spriteSizeInput.addEventListener('input', () => {
  spriteSizeValue.value = `${spriteSizeInput.value}%`;
  if (!selectedBody) return;
  const sprite = sprites.get(selectedBody.id);
  const nextPercent = Number(spriteSizeInput.value);
  const ratio = nextPercent / (sprite.scalePercent || 100);
  Body.scale(selectedBody, ratio, ratio);
  sprite.w *= ratio;
  sprite.h *= ratio;
  sprite.collisionW *= ratio;
  sprite.collisionH *= ratio;
  sprite.scalePercent = nextPercent;
});

let rimUpdateTimer = null;
rimWidthInput.addEventListener('input', () => {
  rimWidthValue.value = rimWidthInput.value;
  if (!selectedBody) return;
  const sprite = sprites.get(selectedBody.id);
  sprite.rimWidth = Number(rimWidthInput.value);
  clearTimeout(rimUpdateTimer);
  rimUpdateTimer = setTimeout(async () => {
    if (!selectedBody || sprites.get(selectedBody.id) !== sprite) return;
    const base = document.createElement('canvas');
    base.width = sprite.baseImg.naturalWidth;
    base.height = sprite.baseImg.naturalHeight;
    base.getContext('2d').drawImage(sprite.baseImg, 0, 0);
    const framed = createPlasticFrame(base, sprite.rimWidth);
    const image = await loadImage(framed.toDataURL('image/png'));
    if (!selectedBody || sprites.get(selectedBody.id) !== sprite) return;
    const scaleFactor = (sprite.scalePercent || 100) / 100;
    const width = image.naturalWidth * sprite.pixelScale * scaleFactor;
    const height = image.naturalHeight * sprite.pixelScale * scaleFactor;
    replaceSelectedBody(sprite, image, width, height);
  }, 70);
});

document.querySelector('#lock').addEventListener('click', () => {
  showToast('已锁定，按 Ctrl+Shift+L 解锁');
  setTimeout(() => window.desktopPet.setClickThrough(true), 650);
});
window.desktopPet.onLockState(locked => {
  document.body.classList.toggle('locked', locked);
  document.querySelector('#lock').classList.toggle('active', locked);
  if (!locked) showToast('已解锁');
});

let resizeFrame = null;
function updateWindowSize() {
  windowWidthValue.value = windowWidthInput.value;
  windowHeightValue.value = windowHeightInput.value;
  savePreferences();
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null;
    window.desktopPet.setWindowSize(Number(windowWidthInput.value), Number(windowHeightInput.value));
  });
}
windowWidthInput.addEventListener('input', updateWindowSize);
windowHeightInput.addEventListener('input', updateWindowSize);
document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => {
  const [width, height] = button.dataset.size.split(',').map(Number);
  windowWidthInput.value = width;
  windowHeightInput.value = height;
  updateWindowSize();
}));

function chooseEditorMode(mode) {
  editorMode = mode;
  document.querySelector('#mode-erase').classList.toggle('active', mode === 'erase');
  document.querySelector('#mode-restore').classList.toggle('active', mode === 'restore');
}
document.querySelector('#mode-erase').addEventListener('click', () => chooseEditorMode('erase'));
document.querySelector('#mode-restore').addEventListener('click', () => chooseEditorMode('restore'));
document.querySelector('#editor-auto').addEventListener('click', resetEditorAutoCutout);
document.querySelector('#editor-close').addEventListener('click', closeCutoutEditor);
document.querySelector('#editor-cancel').addEventListener('click', closeCutoutEditor);
document.querySelector('#editor-apply').addEventListener('click', applyManualCutout);
brushSizeInput.addEventListener('input', () => { brushValue.value = brushSizeInput.value; });

editorCanvas.addEventListener('pointerdown', event => {
  event.preventDefault();
  editorDrawing = true;
  editorCanvas.setPointerCapture(event.pointerId);
  editorLastPoint = editorPoint(event);
  paintEditorCircle(editorLastPoint);
});
editorCanvas.addEventListener('pointermove', event => {
  if (!editorDrawing) return;
  const point = editorPoint(event);
  paintEditorStroke(editorLastPoint, point);
  editorLastPoint = point;
});
editorCanvas.addEventListener('pointerup', event => {
  editorDrawing = false;
  editorLastPoint = null;
  if (editorCanvas.hasPointerCapture(event.pointerId)) editorCanvas.releasePointerCapture(event.pointerId);
});
editorCanvas.addEventListener('pointercancel', () => { editorDrawing = false; editorLastPoint = null; });

window.addEventListener('keydown', (event) => {
  if (!cutoutEditor.classList.contains('hidden')) {
    if (event.key === 'Escape') closeCutoutEditor();
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') removeSelected();
  if (event.key === 'Escape') {
    setSelection(null);
    settingsPanel.classList.add('hidden');
    document.querySelector('#settings').classList.remove('active');
  }
});
function draggedImageUrl(dataTransfer) {
  const downloadUrl = dataTransfer.getData('DownloadURL');
  const downloadMatch = downloadUrl.match(/^[^:]+:[^:]*:(https?:\/\/.+)$/i);
  if (downloadMatch) return downloadMatch[1];
  const uriList = dataTransfer.getData('text/uri-list').split(/\r?\n/).find(line => line && !line.startsWith('#'));
  if (uriList && /^https?:\/\//i.test(uriList)) return uriList;
  const html = dataTransfer.getData('text/html');
  if (html) {
    const image = new DOMParser().parseFromString(html, 'text/html').querySelector('img[src]');
    if (image && /^https?:\/\//i.test(image.src)) return image.src;
  }
  const text = dataTransfer.getData('text/plain').trim();
  return /^https?:\/\/\S+$/i.test(text) ? text : null;
}

window.addEventListener('dragenter', event => event.preventDefault());
window.addEventListener('dragover', event => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
});
window.addEventListener('drop', async event => {
  event.preventDefault();
  if (!cutoutEditor.classList.contains('hidden')) return;
  const files = [...event.dataTransfer.files].filter(file => file.type.startsWith('image/') && file.size > 0);
  try {
    if (files.length) {
      await addFiles(await Promise.all(files.map(fileToItem)));
      return;
    }
    const url = draggedImageUrl(event.dataTransfer);
    if (!url) throw new Error('没有读取到图片文件或图片地址');
    showToast('正在读取网页图片…');
    await addImage(await window.desktopPet.loadImageUrl(url));
  } catch (error) {
    showToast(error.message || '网页图片导入失败');
  }
});
window.addEventListener('resize', resize);
window.addEventListener('beforeunload', () => stopSystemAudio());

resize();
updateWindowSize();
restoreSavedScene();
requestAnimationFrame(tick);

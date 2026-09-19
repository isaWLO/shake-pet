const canvas = document.querySelector('#canvas');
const context = canvas.getContext('2d');
const sourceCanvas = document.createElement('canvas');
const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
const overlayCanvas = document.createElement('canvas');
const overlayContext = overlayCanvas.getContext('2d');
const statusElement = document.querySelector('#status');
const nameInput = document.querySelector('#name');
const toleranceInput = document.querySelector('#tolerance');
const brushInput = document.querySelector('#brush');
let skinDataUrl = '';
let mask = new Uint8Array(0);
let history = [];
let mode = 'magic';
let drawing = false;
let lastPoint = null;

function setStatus(message) {
  statusElement.textContent = message;
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法读取这张图片'));
    image.src = source;
  });
}

function render() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(sourceCanvas, 0, 0);
  if (!mask.length) return;
  const overlay = overlayContext.createImageData(canvas.width, canvas.height);
  for (let index = 0; index < mask.length; index++) {
    if (!mask[index]) continue;
    const offset = index * 4;
    overlay.data[offset] = 86;
    overlay.data[offset + 1] = 184;
    overlay.data[offset + 2] = 255;
    overlay.data[offset + 3] = 112;
  }
  overlayContext.putImageData(overlay, 0, 0);
  context.drawImage(overlayCanvas, 0, 0);
}

function rasterizePolygon(polygon) {
  if (!polygon?.length) return;
  overlayContext.clearRect(0, 0, canvas.width, canvas.height);
  overlayContext.beginPath();
  polygon.forEach(([x, y], index) => {
    const method = index ? 'lineTo' : 'moveTo';
    overlayContext[method](x * canvas.width, y * canvas.height);
  });
  overlayContext.closePath();
  overlayContext.fillStyle = '#fff';
  overlayContext.fill();
  const pixels = overlayContext.getImageData(0, 0, canvas.width, canvas.height).data;
  mask = new Uint8Array(canvas.width * canvas.height);
  for (let index = 0; index < mask.length; index++) mask[index] = pixels[index * 4 + 3] ? 1 : 0;
}

async function loadSource(source, name, polygon = null, autoSelectCenter = false) {
  const image = await loadImage(source);
  const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = sourceCanvas.width = overlayCanvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = sourceCanvas.height = overlayCanvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  sourceContext.clearRect(0, 0, canvas.width, canvas.height);
  sourceContext.drawImage(image, 0, 0, canvas.width, canvas.height);
  skinDataUrl = sourceCanvas.toDataURL('image/png');
  mask = new Uint8Array(canvas.width * canvas.height);
  history = [];
  if (polygon) rasterizePolygon(polygon);
  else if (autoSelectCenter) {
    const pixels = sourceContext.getImageData(0, 0, canvas.width, canvas.height).data;
    mask = ContainerMask.floodSelect(pixels, canvas.width, canvas.height, canvas.width / 2, canvas.height / 2, 0);
  }
  nameInput.value = name || '自定义容器';
  render();
  setStatus('蓝色区域就是图片可以移动的地方');
}

async function loadBuiltin() {
  try {
    await loadSource('assets/containers/retro-pink-pet.png', '珍珠粉游戏机', null, true);
  } catch (error) {
    setStatus(error.message);
  }
}

function pushHistory() {
  history.push(mask.slice());
  if (history.length > 20) history.shift();
}

function chooseMode(nextMode) {
  mode = nextMode;
  for (const id of ['magic', 'paint', 'erase']) document.querySelector(`#${id}`).classList.toggle('active', id === mode);
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height
  };
}

function paintAt(point) {
  const rect = canvas.getBoundingClientRect();
  const radius = Number(brushInput.value) * canvas.width / rect.width / 2;
  ContainerMask.paintCircle(mask, canvas.width, canvas.height, point.x, point.y, radius, mode === 'paint' ? 1 : 0);
}

function paintStroke(from, to) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / Math.max(2, Number(brushInput.value) / 5)));
  for (let step = 1; step <= steps; step++) paintAt({
    x: from.x + (to.x - from.x) * step / steps,
    y: from.y + (to.y - from.y) * step / steps
  });
}

canvas.addEventListener('pointerdown', event => {
  if (!mask.length) return;
  event.preventDefault();
  const point = pointFromEvent(event);
  pushHistory();
  if (mode === 'magic') {
    const pixels = sourceContext.getImageData(0, 0, canvas.width, canvas.height).data;
    mask = ContainerMask.floodSelect(pixels, canvas.width, canvas.height, point.x, point.y, Number(toleranceInput.value));
    render();
    setStatus('已选择相邻区域，可以用画笔继续修补');
    return;
  }
  drawing = true;
  lastPoint = point;
  paintAt(point);
  render();
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', event => {
  if (!drawing) return;
  const point = pointFromEvent(event);
  paintStroke(lastPoint, point);
  lastPoint = point;
  render();
});

function stopDrawing(event) {
  if (!drawing) return;
  drawing = false;
  lastPoint = null;
  if (event?.pointerId != null && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

canvas.addEventListener('pointerup', stopDrawing);
canvas.addEventListener('pointercancel', stopDrawing);

document.querySelector('#import').addEventListener('click', async () => {
  const [item] = await window.desktopPet.pickImages();
  if (!item) return;
  try {
    await loadSource(item.dataUrl, item.name.replace(/\.[^.]+$/, ''));
    setStatus('请选择魔棒，然后点击容器内部');
  } catch (error) {
    setStatus(error.message);
  }
});
document.querySelector('#builtin').addEventListener('click', loadBuiltin);
document.querySelector('#magic').addEventListener('click', () => chooseMode('magic'));
document.querySelector('#paint').addEventListener('click', () => chooseMode('paint'));
document.querySelector('#erase').addEventListener('click', () => chooseMode('erase'));
document.querySelector('#undo').addEventListener('click', () => {
  if (!history.length) return;
  mask = history.pop();
  render();
});
document.querySelector('#reset').addEventListener('click', () => {
  if (!mask.length) return;
  pushHistory();
  mask.fill(0);
  render();
  setStatus('活动区域已清空');
});
toleranceInput.addEventListener('input', () => { document.querySelector('#tolerance-value').value = toleranceInput.value; });
brushInput.addEventListener('input', () => { document.querySelector('#brush-value').value = brushInput.value; });
document.querySelector('#cancel').addEventListener('click', () => window.desktopPet.cancelCustomContainer());
document.querySelector('#save').addEventListener('click', () => {
  const shape = ContainerMask.buildContainerDefinition(mask, canvas.width, canvas.height);
  const definition = shape && ContainerMask.normalizeDefinition({
    name: nameInput.value,
    skinDataUrl,
    polygon: shape.polygon,
    spawn: shape.spawn
  });
  if (!definition) return setStatus('请先涂出一块足够大的连续活动区域');
  window.desktopPet.submitCustomContainer(definition);
});

window.desktopPet.onCustomContainerInitial(initial => {
  const definition = ContainerMask.normalizeDefinition(initial);
  if (definition) loadSource(definition.skinDataUrl, definition.name, definition.polygon).catch(error => setStatus(error.message));
  else loadBuiltin();
});

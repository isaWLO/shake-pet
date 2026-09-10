const { app, BrowserWindow, ipcMain, dialog, screen, net, globalShortcut, desktopCapturer, session } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { selectionToPixels, withTimeout } = require('./capture-region');
const { ensureAiModel } = require('./ai-model');

let win;
let unlockWin = null;
let unlockShortcutReady = false;
let captureWin = null;
let captureResolve = null;
let captureImage = null;

function positionUnlockWindow() {
  if (!win || win.isDestroyed() || !unlockWin || unlockWin.isDestroyed()) return;
  const bounds = win.getBounds();
  unlockWin.setPosition(bounds.x + bounds.width - 42, bounds.y + 8, false);
}

function showUnlockWindow() {
  if (!win || win.isDestroyed()) return;
  if (unlockWin && !unlockWin.isDestroyed()) return positionUnlockWindow();
  unlockWin = new BrowserWindow({
    width: 38,
    height: 38,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    parent: win,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  unlockWin.setAlwaysOnTop(true, 'floating');
  unlockWin.loadFile('unlock.html');
  unlockWin.on('closed', () => { unlockWin = null; });
  positionUnlockWindow();
}

function setLocked(locked) {
  if (!win || win.isDestroyed()) return;
  if (locked && !unlockShortcutReady) {
    win.webContents.send('lock-state', false);
    return;
  }
  win.setIgnoreMouseEvents(Boolean(locked), { forward: true });
  win.webContents.send('lock-state', Boolean(locked));
  if (locked) showUnlockWindow();
  else if (unlockWin && !unlockWin.isDestroyed()) unlockWin.close();
}

function registerSystemAudioCapture() {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!win || win.isDestroyed()) return callback({});
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 }
      });
      const primaryDisplayId = String(screen.getPrimaryDisplay().id);
      const source = sources.find(item => item.display_id === primaryDisplayId) || sources[0];
      if (!source) return callback({});
      callback({
        video: source,
        ...(process.platform === 'win32' && request.audioRequested ? { audio: 'loopback' } : {})
      });
    } catch (error) {
      console.error('System audio capture failed:', error.message);
      callback({});
    }
  }, { useSystemPicker: process.platform === 'darwin' });
}

function createWindow() {
  const area = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({
    width: 360,
    height: 460,
    x: area.x + area.width - 400,
    y: area.y + area.height - 500,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    minWidth: 280,
    minHeight: 320,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.setAlwaysOnTop(true, 'floating');
  win.loadFile('index.html');

  let last = { ...win.getBounds(), time: performance.now() };
  win.on('move', () => {
    const bounds = win.getBounds();
    const now = performance.now();
    const dt = Math.max(8, now - last.time);
    if (dragTimer) {
      last = { ...bounds, time: now };
      return;
    }
    win.webContents.send('window-motion', {
      vx: (bounds.x - last.x) / dt,
      vy: (bounds.y - last.y) / dt
    });
    last = { ...bounds, time: now };
    positionUnlockWindow();
  });
  win.on('resize', positionUnlockWindow);
}

ipcMain.handle('pick-images', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
  });
  if (result.canceled) return [];
  return Promise.all(result.filePaths.map(async (filePath) => {
    const extension = path.extname(filePath).slice(1).toLowerCase();
    const mime = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : `image/${extension}`;
    const buffer = await fs.readFile(filePath);
    return { name: path.basename(filePath), dataUrl: `data:${mime};base64,${buffer.toString('base64')}` };
  }));
});

function finishCapture(result) {
  const resolve = captureResolve;
  captureResolve = null;
  captureImage = null;
  const windowToClose = captureWin;
  captureWin = null;
  if (windowToClose && !windowToClose.isDestroyed()) windowToClose.close();
  if (win && !win.isDestroyed()) {
    win.show();
    win.setAlwaysOnTop(true, 'floating');
  }
  resolve?.(result);
}

ipcMain.handle('capture-screen', async () => {
  if (!win || win.isDestroyed() || captureResolve) return null;
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  win.hide();
  await new Promise(resolve => setTimeout(resolve, 140));
  try {
    const scale = display.scaleFactor || 1;
    const sources = await withTimeout(desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(display.size.width * scale),
        height: Math.round(display.size.height * scale)
      }
    }), 6000, '读取屏幕超时，请重试');
    const source = sources.find(item => item.display_id === String(display.id)) || sources[0];
    if (!source || source.thumbnail.isEmpty()) throw new Error('无法读取当前屏幕');
    captureImage = source.thumbnail;
    const result = new Promise(resolve => { captureResolve = resolve; });
    captureWin = new BrowserWindow({
      ...display.bounds,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      backgroundColor: '#000000',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    captureWin.setAlwaysOnTop(true, 'screen-saver');
    captureWin.on('closed', () => {
      captureWin = null;
      if (captureResolve) finishCapture(null);
    });
    await captureWin.loadFile('capture.html');
    captureWin.show();
    captureWin.moveTop();
    await captureWin.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(resolve))');
    const preview = `data:image/jpeg;base64,${captureImage.toJPEG(82).toString('base64')}`;
    captureWin.webContents.send('capture-source', preview);
    return await result;
  } catch (error) {
    finishCapture(null);
    throw error;
  }
});

ipcMain.on('capture-selection', (event, selection) => {
  if (!captureWin || event.sender !== captureWin.webContents || !captureImage) return;
  const imageSize = captureImage.getSize();
  const rect = selectionToPixels(
    selection.start,
    selection.end,
    selection.viewportWidth,
    selection.viewportHeight,
    imageSize.width,
    imageSize.height
  );
  if (rect.width < 2 || rect.height < 2) return;
  finishCapture({ name: `截图-${Date.now()}.png`, dataUrl: captureImage.crop(rect).toDataURL() });
});

ipcMain.on('capture-cancel', event => {
  if (captureWin && event.sender === captureWin.webContents) finishCapture(null);
});

ipcMain.on('close-window', () => {
  if (process.platform === 'darwin') app.quit();
  else win?.close();
});
ipcMain.on('set-click-through', (_event, locked) => setLocked(Boolean(locked)));
ipcMain.on('unlock-window', () => setLocked(false));
function sceneLibraryPath() {
  return path.join(app.getPath('userData'), 'shake-pet-library.json');
}

async function readSceneLibrary() {
  try {
    return JSON.parse(await fs.readFile(sceneLibraryPath(), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const legacyPath = path.join(app.getPath('userData'), 'shake-pet-scene.json');
    try {
      const legacyScene = JSON.parse(await fs.readFile(legacyPath, 'utf8'));
      const id = `scene-${Date.now().toString(36)}`;
      const library = { activeId: id, scenes: [{ id, name: '我的瓶子', updatedAt: Date.now(), scene: legacyScene }] };
      await fs.writeFile(sceneLibraryPath(), JSON.stringify(library), 'utf8');
      return library;
    } catch (legacyError) {
      if (legacyError.code === 'ENOENT') return { activeId: null, scenes: [] };
      throw legacyError;
    }
  }
}

async function writeSceneLibrary(library) {
  await fs.writeFile(sceneLibraryPath(), JSON.stringify(library), 'utf8');
}

ipcMain.handle('save-scene', async (_event, payload) => {
  const library = await readSceneLibrary();
  const id = payload.id || `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  const entry = { id, name: String(payload.name || '未命名瓶子').slice(0, 30), updatedAt: Date.now(), scene: payload.scene };
  const index = library.scenes.findIndex(item => item.id === id);
  if (index >= 0) library.scenes[index] = entry;
  else library.scenes.push(entry);
  library.activeId = id;
  await writeSceneLibrary(library);
  return { id, name: entry.name, updatedAt: entry.updatedAt };
});
ipcMain.handle('list-scenes', async () => {
  const library = await readSceneLibrary();
  return { activeId: library.activeId, scenes: library.scenes.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })) };
});
ipcMain.handle('load-scene', async (_event, requestedId) => {
  const library = await readSceneLibrary();
  const id = requestedId || library.activeId;
  const entry = library.scenes.find(item => item.id === id) || null;
  if (entry && library.activeId !== entry.id) {
    library.activeId = entry.id;
    await writeSceneLibrary(library);
  }
  return entry;
});
ipcMain.handle('delete-scene', async (_event, id) => {
  const library = await readSceneLibrary();
  library.scenes = library.scenes.filter(item => item.id !== id);
  if (library.activeId === id) library.activeId = library.scenes[0]?.id || null;
  await writeSceneLibrary(library);
  return { activeId: library.activeId };
});
let resizeTarget = null;
let resizeAnimationTimer = null;

function stopResizeAnimation() {
  if (resizeAnimationTimer) clearInterval(resizeAnimationTimer);
  resizeAnimationTimer = null;
}

ipcMain.on('set-window-size', (_event, size) => {
  if (!win) return;
  const width = Math.max(280, Math.min(800, Math.round(size.width)));
  const height = Math.max(320, Math.min(900, Math.round(size.height)));
  if (!Number.isFinite(width) || !Number.isFinite(height)) return;
  resizeTarget = { width, height };
  if (resizeAnimationTimer) return;
  resizeAnimationTimer = setInterval(() => {
    if (!win || win.isDestroyed() || !resizeTarget) return stopResizeAnimation();
    const bounds = win.getBounds();
    const widthDifference = resizeTarget.width - bounds.width;
    const heightDifference = resizeTarget.height - bounds.height;
    if (Math.abs(widthDifference) < 2 && Math.abs(heightDifference) < 2) {
      win.setBounds({ x: bounds.x, y: bounds.y, width: resizeTarget.width, height: resizeTarget.height }, false);
      resizeTarget = null;
      return stopResizeAnimation();
    }
    const nextWidth = Math.round(bounds.width + widthDifference * .34);
    const nextHeight = Math.round(bounds.height + heightDifference * .34);
    win.setBounds({ x: bounds.x, y: bounds.y, width: nextWidth, height: nextHeight }, false);
  }, 16);
});

ipcMain.handle('load-image-url', async (_event, sourceUrl) => {
  if (typeof sourceUrl !== 'string') throw new Error('无效的图片地址');
  if (sourceUrl.startsWith('data:image/')) return { name: '网页图片', dataUrl: sourceUrl };
  const url = new URL(sourceUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('只支持 http 或 https 图片');
  const response = await net.fetch(url.toString());
  if (!response.ok) throw new Error(`图片下载失败 (${response.status})`);
  const mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (!mime.startsWith('image/')) throw new Error('拖入的地址不是图片');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 25 * 1024 * 1024) throw new Error('图片不能超过 25 MB');
  const name = decodeURIComponent(url.pathname.split('/').pop() || '网页图片');
  return { name, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` };
});

ipcMain.handle('get-ai-cutout-model', () => ensureAiModel(
  path.join(app.getPath('userData'), 'models'),
  url => net.fetch(url)
));

let dragTimer = null;
function stopWindowDrag() {
  if (dragTimer) clearInterval(dragTimer);
  dragTimer = null;
}

ipcMain.on('begin-window-drag', (_event, start) => {
  if (!win || win.isDestroyed()) return;
  stopWindowDrag();
  stopResizeAnimation();
  resizeTarget = null;
  const bounds = win.getBounds();
  const cursor = screen.getCursorScreenPoint();
  const requestedX = Number(start?.screenX);
  const requestedY = Number(start?.screenY);
  const origin = {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
    cursorX: Number.isFinite(requestedX) ? Math.round(requestedX) : cursor.x,
    cursorY: Number.isFinite(requestedY) ? Math.round(requestedY) : cursor.y
  };
  let lastPoint = cursor;
  let lastTime = performance.now();
  dragTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return stopWindowDrag();
    const point = screen.getCursorScreenPoint();
    const nextX = Math.round(origin.x + point.x - origin.cursorX);
    const nextY = Math.round(origin.y + point.y - origin.cursorY);
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) return;
    const now = performance.now();
    const dt = Math.max(8, now - lastTime);
    try {
      win.setBounds({
        x: nextX,
        y: nextY,
        width: origin.width,
        height: origin.height
      }, false);
      win.webContents.send('window-motion', {
        vx: (point.x - lastPoint.x) / dt,
        vy: (point.y - lastPoint.y) / dt,
        direct: true
      });
    } catch (error) {
      console.error('Window drag stopped safely:', error.message);
      stopWindowDrag();
    }
    lastPoint = point;
    lastTime = now;
  }, 16);
});

ipcMain.on('end-window-drag', () => {
  stopWindowDrag();
});

app.on('before-quit', () => {
  captureResolve = null;
  if (captureWin && !captureWin.isDestroyed()) captureWin.close();
  stopWindowDrag();
  stopResizeAnimation();
});

app.whenReady().then(() => {
  registerSystemAudioCapture();
  createWindow();
  unlockShortcutReady = globalShortcut.register('CommandOrControl+Shift+L', () => {
    setLocked(false);
    win?.show();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (!win || win.isDestroyed()) createWindow();
});
app.on('will-quit', () => globalShortcut.unregisterAll());

(function installWebBridge() {
  if (window.desktopPet) return;

  const databaseName = 'shake-pet-web';
  const libraryKey = 'scene-library';
  const motionListeners = new Set();
  const lockListeners = new Set();
  let dragState = null;

  document.documentElement.dataset.platform = 'web';

  function readFiles(files) {
    return Promise.all(Array.from(files).map(file => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, dataUrl: reader.result });
      reader.onerror = () => reject(reader.error || new Error('无法读取图片'));
      reader.readAsDataURL(file);
    })));
  }

  function pickImages() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      let settled = false;
      const finish = async files => {
        if (settled) return;
        settled = true;
        resolve(await readFiles(files || []));
      };
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp,image/gif';
      input.multiple = true;
      input.addEventListener('change', () => finish(input.files), { once: true });
      window.addEventListener('focus', () => setTimeout(() => finish(input.files), 250), { once: true });
      input.click();
    });
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('data');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function databaseOperation(mode, operation) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('data', mode);
      const store = transaction.objectStore('data');
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
    });
  }

  async function readLibrary() {
    return await databaseOperation('readonly', store => store.get(libraryKey)) || { activeId: null, scenes: [] };
  }

  async function writeLibrary(library) {
    await databaseOperation('readwrite', store => store.put(library, libraryKey));
  }

  async function dataUrlFromResponse(response) {
    if (!response.ok) throw new Error(`图片下载失败 (${response.status})`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('拖入的地址不是图片');
    if (blob.size > 25 * 1024 * 1024) throw new Error('图片不能超过 25 MB');
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  window.addEventListener('pointermove', event => {
    if (!dragState) return;
    const now = performance.now();
    const dt = Math.max(8, now - dragState.time);
    const x = Number.isFinite(event.screenX) ? event.screenX : event.clientX;
    const y = Number.isFinite(event.screenY) ? event.screenY : event.clientY;
    const motion = { vx: (x - dragState.x) / dt, vy: (y - dragState.y) / dt, direct: true };
    dragState = { x, y, time: now };
    for (const listener of motionListeners) listener(motion);
  });

  window.desktopPet = {
    platform: 'web',
    isDesktop: false,
    pickImages,
    openContainerEditor: async () => null,
    captureScreen: async () => null,
    close: () => {},
    setWindowSize: () => {},
    loadImageUrl: async sourceUrl => {
      if (typeof sourceUrl !== 'string') throw new Error('无效的图片地址');
      if (sourceUrl.startsWith('data:image/')) return { name: '网页图片', dataUrl: sourceUrl };
      const url = new URL(sourceUrl, location.href);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('只支持 http 或 https 图片');
      return { name: decodeURIComponent(url.pathname.split('/').pop() || '网页图片'), dataUrl: await dataUrlFromResponse(await fetch(url)) };
    },
    setClickThrough: locked => {
      for (const listener of lockListeners) listener(Boolean(locked));
    },
    onLockState: callback => lockListeners.add(callback),
    unlock: () => {
      for (const listener of lockListeners) listener(false);
    },
    saveScene: async payload => {
      const library = await readLibrary();
      const id = payload.id || `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const entry = { id, name: String(payload.name || '未命名瓶子').slice(0, 30), updatedAt: Date.now(), scene: payload.scene };
      const index = library.scenes.findIndex(item => item.id === id);
      if (index >= 0) library.scenes[index] = entry;
      else library.scenes.push(entry);
      library.activeId = id;
      await writeLibrary(library);
      return { id, name: entry.name, updatedAt: entry.updatedAt };
    },
    listScenes: async () => {
      const library = await readLibrary();
      return { activeId: library.activeId, scenes: library.scenes.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })) };
    },
    loadScene: async requestedId => {
      const library = await readLibrary();
      const id = requestedId || library.activeId;
      const entry = library.scenes.find(item => item.id === id) || null;
      if (entry && library.activeId !== id) {
        library.activeId = id;
        await writeLibrary(library);
      }
      return entry;
    },
    deleteScene: async id => {
      const library = await readLibrary();
      library.scenes = library.scenes.filter(item => item.id !== id);
      if (library.activeId === id) library.activeId = library.scenes[0]?.id || null;
      await writeLibrary(library);
      return { activeId: library.activeId };
    },
    beginWindowDrag: (screenX, screenY) => {
      dragState = { x: screenX, y: screenY, time: performance.now() };
    },
    endWindowDrag: () => { dragState = null; },
    onWindowMotion: callback => motionListeners.add(callback)
  };
})();

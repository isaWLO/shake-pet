const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopPet', {
  platform: process.platform,
  isDesktop: true,
  pickImages: () => ipcRenderer.invoke('pick-images'),
  openContainerEditor: initial => ipcRenderer.invoke('open-container-editor', initial),
  onCustomContainerInitial: callback => ipcRenderer.once('custom-container-initial', (_event, initial) => callback(initial)),
  submitCustomContainer: definition => ipcRenderer.send('custom-container-submit', definition),
  cancelCustomContainer: () => ipcRenderer.send('custom-container-cancel'),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  onCaptureSource: callback => ipcRenderer.once('capture-source', (_event, dataUrl) => callback(dataUrl)),
  submitCapture: selection => ipcRenderer.send('capture-selection', selection),
  cancelCapture: () => ipcRenderer.send('capture-cancel'),
  close: () => ipcRenderer.send('close-window'),
  setWindowSize: (width, height) => ipcRenderer.send('set-window-size', { width, height }),
  loadImageUrl: (url) => ipcRenderer.invoke('load-image-url', url),
  getAiCutoutModel: () => ipcRenderer.invoke('get-ai-cutout-model'),
  setClickThrough: (locked) => ipcRenderer.send('set-click-through', locked),
  onLockState: (callback) => ipcRenderer.on('lock-state', (_event, locked) => callback(locked)),
  unlock: () => ipcRenderer.send('unlock-window'),
  saveScene: (payload) => ipcRenderer.invoke('save-scene', payload),
  listScenes: () => ipcRenderer.invoke('list-scenes'),
  loadScene: (id) => ipcRenderer.invoke('load-scene', id),
  deleteScene: (id) => ipcRenderer.invoke('delete-scene', id),
  beginWindowDrag: (screenX, screenY) => ipcRenderer.send('begin-window-drag', { screenX, screenY }),
  endWindowDrag: () => ipcRenderer.send('end-window-drag'),
  onWindowMotion: (callback) => ipcRenderer.on('window-motion', (_event, motion) => callback(motion))
});

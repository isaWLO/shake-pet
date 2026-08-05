const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopPet', {
  pickImages: () => ipcRenderer.invoke('pick-images'),
  close: () => ipcRenderer.send('close-window'),
  setWindowSize: (width, height) => ipcRenderer.send('set-window-size', { width, height }),
  loadImageUrl: (url) => ipcRenderer.invoke('load-image-url', url),
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

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../web-bridge.js'), 'utf8');
const listeners = new Map();
const popupMessages = [];
const popup = {
  closed: false,
  focus() {},
  postMessage(message) { popupMessages.push(message); }
};
const fakeWindow = {
  desktopPet: undefined,
  addEventListener(type, callback) {
    const callbacks = listeners.get(type) || [];
    callbacks.push(callback);
    listeners.set(type, callbacks);
  },
  open() {
    return popup;
  }
};
const context = {
  window: fakeWindow,
  document: { documentElement: { dataset: {} } },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  URL,
  location: { href: 'http://localhost/' },
  fetch: async () => { throw new Error('not used'); },
  FileReader: class {}
};
vm.runInNewContext(source, context);

const definition = {
  name: '网页容器',
  skinDataUrl: 'data:image/png;base64,AA==',
  polygon: [[.2, .2], [.8, .2], [.8, .8], [.2, .8]],
  spawn: [.5, .5]
};
const initial = { ...definition, name: '初始容器' };
const resultPromise = fakeWindow.desktopPet.openContainerEditor(initial);
assert.ok(popupMessages.length === 0, 'the editor should wait for its ready handshake');

for (const callback of listeners.get('message') || []) {
  callback({ source: popup, data: { type: 'shake-pet-custom-container-ready' } });
}
assert.equal(JSON.stringify(popupMessages[0]), JSON.stringify({ type: 'shake-pet-custom-container-init', initial }));

for (const callback of listeners.get('message') || []) {
  callback({ source: popup, data: { type: 'shake-pet-custom-container-submit', definition } });
}

resultPromise.then(result => {
  assert.deepEqual(result, definition);
  console.log('web custom editor bridge: ok');
});

const editorMessages = [];
const editorListeners = new Map();
const editorWindow = {
  opener: { postMessage(message) { editorMessages.push(message); } },
  closed: false,
  close() { this.closed = true; },
  addEventListener(type, callback) {
    const callbacks = editorListeners.get(type) || [];
    callbacks.push(callback);
    editorListeners.set(type, callbacks);
  },
  removeEventListener() {}
};
vm.runInNewContext(source, {
  window: editorWindow,
  document: { documentElement: { dataset: {} } },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  URL,
  location: { href: 'http://localhost/custom-container.html' },
  fetch: async () => { throw new Error('not used'); },
  FileReader: class {}
});
editorWindow.desktopPet.submitCustomContainer(definition);
assert.equal(editorMessages[0].type, 'shake-pet-custom-container-submit');
assert.equal(editorWindow.closed, true, 'saving from the web editor must close its popup');

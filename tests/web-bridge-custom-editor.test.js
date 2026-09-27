const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../web-bridge.js'), 'utf8');
const listeners = new Map();
const editorMessages = [];
const editorWindow = {
  closed: false,
  focus() {},
  postMessage(message) { editorMessages.push(message); }
};
const appended = [];
const fakeDocument = {
  documentElement: { dataset: {} },
  body: {
    append(element) { appended.push(element); }
  },
  createElement(tagName) {
    assert.equal(tagName, 'iframe');
    return {
      contentWindow: editorWindow,
      style: {},
      setAttribute() {},
      remove() { this.removed = true; }
    };
  }
};
const fakeWindow = {
  desktopPet: undefined,
  addEventListener(type, callback) {
    const callbacks = listeners.get(type) || [];
    callbacks.push(callback);
    listeners.set(type, callbacks);
  },
  open() { return null; }
};
const context = {
  window: fakeWindow,
  document: fakeDocument,
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
assert.equal(appended.length, 1, 'the web editor must open inside the page when popups are unavailable');
assert.ok(editorMessages.length === 0, 'the editor should wait for its ready handshake');

for (const callback of listeners.get('message') || []) {
  callback({ source: editorWindow, data: { type: 'shake-pet-custom-container-ready' } });
}
assert.equal(JSON.stringify(editorMessages[0]), JSON.stringify({ type: 'shake-pet-custom-container-init', initial }));

for (const callback of listeners.get('message') || []) {
  callback({ source: editorWindow, data: { type: 'shake-pet-custom-container-submit', definition } });
}

resultPromise.then(result => {
  assert.deepEqual(result, definition);
  assert.equal(appended[0].removed, true, 'saving must close the embedded editor');
  console.log('web custom editor bridge: ok');
});

const parentMessages = [];
const editorListeners = new Map();
const childWindow = {
  opener: { postMessage(message) { parentMessages.push(message); } },
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
  window: childWindow,
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
childWindow.desktopPet.submitCustomContainer(definition);
assert.equal(parentMessages[0].type, 'shake-pet-custom-container-submit');
assert.equal(childWindow.closed, true, 'saving from the web editor must close its popup');

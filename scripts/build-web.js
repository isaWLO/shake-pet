const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist-web');

async function buildWeb() {
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(path.join(output, 'vendor', 'ort'), { recursive: true });
  for (const file of ['styles.css', 'renderer.js', 'web-ai-model.js', 'web-bridge.js', 'world-layout.js', 'ai-cutout.js', 'container-mask.js']) {
    await fs.copyFile(path.join(root, file), path.join(output, file));
  }
  await fs.copyFile(path.join(root, 'custom-container.html'), path.join(output, 'custom-container.html'));
  await fs.copyFile(path.join(root, 'custom-container.js'), path.join(output, 'custom-container.js'));
  await fs.mkdir(path.join(output, 'assets', 'containers'), { recursive: true });
  await fs.copyFile(
    path.join(root, 'assets', 'containers', 'retro-pink-pet.png'),
    path.join(output, 'assets', 'containers', 'retro-pink-pet.png')
  );
  const html = (await fs.readFile(path.join(root, 'index.html'), 'utf8'))
    .replace('node_modules/matter-js/build/matter.min.js', 'vendor/matter.min.js');
  await fs.writeFile(path.join(output, 'index.html'), html, 'utf8');
  await fs.copyFile(
    path.join(root, 'node_modules', 'matter-js', 'build', 'matter.min.js'),
    path.join(output, 'vendor', 'matter.min.js')
  );
  for (const file of ['ort.wasm.min.js', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
    await fs.copyFile(
      path.join(root, 'node_modules', 'onnxruntime-web', 'dist', file),
      path.join(output, 'vendor', 'ort', file)
    );
  }
  await fs.writeFile(path.join(output, '.nojekyll'), '', 'utf8');
  return output;
}

if (require.main === module) {
  buildWeb().then(directory => console.log(`Web build created at ${directory}`)).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = buildWeb;

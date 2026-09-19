const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const MODEL_URLS = [
  'https://hf-mirror.com/Ko033/isnet-general-use-onnx/resolve/5349b61/onnx/model_quantized.onnx?download=true',
  'https://huggingface.co/Ko033/isnet-general-use-onnx/resolve/5349b61/onnx/model_quantized.onnx?download=true'
];
const MODEL_SIZE = 45902969;
const MODEL_SHA256 = '5039225b9a4ac3df55f185d24b7a92d640c86cc4747002d7f23351e394de03a6';
const MODEL_FILE = 'isnet-general-use-q8-5349b61.onnx';

function isValid(buffer, expected) {
  return buffer.length === expected.size
    && crypto.createHash('sha256').update(buffer).digest('hex') === expected.sha256;
}

async function ensureAiModel(directory, fetcher, expected = { size: MODEL_SIZE, sha256: MODEL_SHA256 }) {
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, MODEL_FILE);
  try {
    const cached = await fs.readFile(file);
    if (isValid(cached, expected)) return cached;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let response;
  let downloadError;
  for (const url of MODEL_URLS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetcher(url);
        if (response.ok) break;
        downloadError = new Error(`AI 模型下载失败 (${response.status || '网络错误'})`);
      } catch (error) {
        downloadError = error;
      }
    }
    if (response?.ok) break;
  }
  if (!response?.ok) throw downloadError || new Error('AI 模型下载失败');
  const model = Buffer.from(await response.arrayBuffer());
  if (!isValid(model, expected)) throw new Error('AI 模型校验失败，请重试');

  const temporary = `${file}.download`;
  await fs.writeFile(temporary, model);
  await fs.rm(file, { force: true });
  await fs.rename(temporary, file);
  return model;
}

module.exports = { ensureAiModel, MODEL_URLS, MODEL_SIZE, MODEL_SHA256 };

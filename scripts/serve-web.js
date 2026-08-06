const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const buildWeb = require('./build-web');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

buildWeb().then(output => {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.resolve(output, relativePath);
    if (!filePath.startsWith(`${output}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    fs.createReadStream(filePath)
      .on('error', () => response.writeHead(404).end('Not found'))
      .once('open', () => response.setHeader('Content-Type', mimeTypes[path.extname(filePath)] || 'application/octet-stream'))
      .pipe(response);
  });
  server.listen(4173, '127.0.0.1', () => {
    console.log('Shake Pet Web: http://127.0.0.1:4173');
    console.log('Press Ctrl+C to stop.');
  });
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});

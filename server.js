const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const publicFiles = new Set([
  'index.html',
  'style.css',
  'content.css',
  'script.js',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  '.nojekyll',
  'data/instagram-videos.json'
]);
const publicPrefixes = ['assets/', 'blog/', 'instagram-videos/', 'admin/', 'services/', 'contact/'];
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function createSiteServer({ preview = false } = {}) {
  const root = path.join(__dirname, preview ? 'dist' : '');
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    throw new Error(preview ? 'Production files are missing. Run npm run build first.' : 'index.html is missing.');
  }
  const realRoot = fs.realpathSync(root);

  return http.createServer(async (request, response) => {
    const reply = (status, message, headers = {}) => {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
      response.end(request.method === 'HEAD' ? undefined : message);
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      reply(405, 'Method not allowed', { Allow: 'GET, HEAD' });
      return;
    }

    let requestPath;
    try {
      requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
    } catch {
      reply(400, 'Malformed URL');
      return;
    }
    if (!requestPath.startsWith('/') || /[\\\0]/.test(requestPath)) {
      reply(400, 'Invalid path');
      return;
    }
    const segments = requestPath.split('/').filter(Boolean);
    if (segments.some(segment => segment === '.' || segment === '..' || (segment.startsWith('.') && segment !== '.nojekyll'))) {
      reply(403, 'Forbidden');
      return;
    }
    const requestedRelativePath = requestPath === '/' ? 'index.html' : segments.join('/');
    const isPublicPath = publicFiles.has(requestedRelativePath)
      || publicPrefixes.some(prefix => requestedRelativePath === prefix.slice(0, -1) || requestedRelativePath.startsWith(prefix));
    if (!isPublicPath) {
      reply(404, 'Not found');
      return;
    }

    try {
      let filePath = await fs.promises.realpath(path.resolve(root, requestedRelativePath));
      const initialStats = await fs.promises.stat(filePath);
      // Directory URLs (for example /blog/ and /blog/article-slug/) resolve to
      // their generated index file while keeping the source tree private.
      if (initialStats.isDirectory()) {
        filePath = await fs.promises.realpath(path.join(filePath, 'index.html'));
      }
      const insideRoot = path.relative(realRoot, filePath);
      if (insideRoot.startsWith(`..${path.sep}`) || insideRoot === '..' || path.isAbsolute(insideRoot)) {
        reply(403, 'Forbidden');
        return;
      }
      const stats = await fs.promises.stat(filePath);
      if (!stats.isFile()) {
        reply(404, 'Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stats.size,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => response.destroy());
      stream.pipe(response);
    } catch (error) {
      reply(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500, 'File unavailable');
    }
  });
}

if (require.main === module) {
  const preview = process.argv.includes('--preview');
  const port = Number(process.env.PORT ?? (preview ? 4173 : 5173));
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535.');
  const server = createSiteServer({ preview });
  server.on('error', error => {
    console.error(`Unable to start portfolio server: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Ritesh Singh ${preview ? 'production preview' : 'development site'} running at http://localhost:${server.address().port}`);
  });
}

module.exports = { createSiteServer };

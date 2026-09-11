const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { createSiteServer } = require('../server.js');

const projectRoot = path.resolve(__dirname, '..');
const siteUrl = new URL('https://buildwritesh.github.io/');
const resumePath = 'assets/resume/Ritesh_Singh_Resume.pdf';
const contactEmail = 'buildwritesh@gmail.com';
const legacyEmail = Buffer.from('cml0ZXNoc2luZ2gwMTAxMkBnbWFpbC5jb20=', 'base64').toString('ascii');
const textExtensions = new Set(['.html', '.css', '.js', '.json', '.md', '.txt', '.svg', '.xml', '.yml', '.yaml', '.toml']);
// Encoded legacy identifiers keep obsolete branding out of source and search results.
const legacyIdentifiers = [
  'c2l5YQ==', 'Z3VwdGE=', 'OTMxNTIzMzI0OA==', 'YnV6emJvbGx5d29vZGQ=',
  'VW5pcXN0b3A=',
  'Q29udmVyZ2VY', 'RFUgU09M', 'TklNQw=='
].map(value => Buffer.from(value, 'base64').toString('utf8').toLowerCase());
const standaloneIdentifiers = new Set(legacyIdentifiers.slice(0, 2));
const hasLegacyIdentifier = text => legacyIdentifiers.some(value => {
  if (standaloneIdentifiers.has(value)) return new RegExp(`(^|[^a-z])${value}([^a-z]|$)`, 'i').test(text);
  return text.includes(value);
});

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist', '.qa'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file, files);
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

function assertIdentity() {
  for (const file of walk(projectRoot)) {
    const relative = path.relative(projectRoot, file).replaceAll(path.sep, '/');
    const filename = relative.toLowerCase();
    assert(!hasLegacyIdentifier(filename), `Obsolete identity in filename: ${relative}`);
    if (textExtensions.has(path.extname(file).toLowerCase()) && !relative.startsWith('assets/vendor/')) {
      const contents = fs.readFileSync(file, 'utf8').toLowerCase();
      assert(!hasLegacyIdentifier(contents), `Obsolete identity in file: ${relative}`);
    }
  }
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = (match[2] ?? match[3] ?? match[4]).replaceAll('&amp;', '&');
  }
  return result;
}

function validateSite(root) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  const tags = [...html.matchAll(/<[a-z][^>]*>/gi)].map(match => ({ text: match[0], attrs: attributes(match[0]) }));
  const ids = tags.filter(tag => tag.attrs.id).map(tag => tag.attrs.id);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs found');
  assert.equal((html.match(/<h1(?:\s|>)/gi) || []).length, 1, 'Use exactly one H1');
  assert(/<html[^>]+lang=["']en["']/i.test(html), 'Missing English page language');
  assert(/<title>[^<]*Ritesh Singh[^<]*<\/title>/i.test(html), 'Missing Ritesh Singh page title');
  assert(html.includes(contactEmail), 'New contact email is missing');
  assert(!html.toLowerCase().includes(legacyEmail), 'Legacy contact email remains in page source');
  const newTabHelper = ['opens', 'in', 'a', 'new', 'tab'].join(' ');
  const newTabHelperSingular = ['open', 'in', 'new', 'tab'].join(' ');
  assert(!html.toLowerCase().includes(newTabHelper) && !html.toLowerCase().includes(newTabHelperSingular), 'Unwanted new-tab helper text remains');
  assert.equal((html.match(/id="contact-form"/g) || []).length, 1, 'Contact form is missing or duplicated');
  assert(/<form\b[^>]*id="contact-form"[^>]*action="mailto:buildwritesh@gmail\.com"/i.test(html), 'Contact form destination is incorrect');
  assert(script.includes('contactForm.reportValidity()') && script.includes('mailto:buildwritesh@gmail.com') && script.includes('window.location.href = mailto'), 'Contact form submission handler is incomplete');

  const meta = key => tags.find(tag => /^<meta\b/i.test(tag.text) && (tag.attrs.name === key || tag.attrs.property === key))?.attrs.content;
  assert(meta('description')?.includes('Ritesh Singh'), 'Missing owner-specific meta description');
  assert(meta('viewport')?.includes('width=device-width'), 'Missing responsive viewport');
  for (const key of ['og:title', 'og:description', 'og:image', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    assert(meta(key)?.trim(), `Missing social metadata: ${key}`);
  }
  const canonical = tags.find(tag => /^<link\b/i.test(tag.text) && tag.attrs.rel === 'canonical')?.attrs.href;
  assert.equal(canonical?.toLowerCase(), siteUrl.href, 'Canonical must point to the published portfolio root');
  const portfolioUrls = [
    'https://cmttools.in/', 'https://patnaresort.com/', 'https://www.ojasco.com/', 'https://avadeti.com/',
    'https://matraconsultancy.com/', 'https://spotlighterspost.com/', 'https://vivarya-website-ritesh.vercel.app/',
    'https://lb-expression-nextjs-plum.vercel.app/', 'https://eera-zeta.vercel.app/', 'https://es-internship.vercel.app/',
    'https://innosyte.in/', 'https://www.dleaftech.com/'
  ];
  portfolioUrls.forEach(url => assert(html.includes(url), `Missing portfolio URL: ${url}`));
  assert.equal((html.match(/class="project reveal-up"/g) || []).length, 12, 'Portfolio should contain twelve project cards');
  assert.equal((html.match(/class="portfolio-filter(?:\s|")/g) || []).length, 4, 'Portfolio filter controls are incomplete');

  const resources = new Set(['index.html', 'style.css', 'script.js']);
  for (const optional of ['robots.txt', 'sitemap.xml', '.nojekyll']) {
    if (fs.existsSync(path.join(root, optional))) resources.add(optional);
  }
  const checkReference = (reference, from = 'index.html') => {
    assert(reference?.trim(), `Empty link or asset reference in ${from}`);
    if (/^(?:data:|mailto:|tel:)/i.test(reference)) return;
    assert(!/^javascript:/i.test(reference), `JavaScript URL in ${from}`);
    const url = new URL(reference, new URL(from, siteUrl));
    if (url.origin !== siteUrl.origin) return;
    const relative = decodeURIComponent(url.pathname.replace(/^\/+/, '')) || 'index.html';
    const file = path.resolve(root, relative);
    const inside = path.relative(root, file);
    assert(!inside.startsWith('..') && !path.isAbsolute(inside), `Asset escapes the site root: ${reference}`);
    assert(fs.existsSync(file) && fs.statSync(file).isFile(), `Missing local file: ${reference} (from ${from})`);
    // Check exact casing too: Linux hosts and GitHub Pages are case sensitive.
    let directory = root;
    for (const segment of relative.split('/')) {
      assert(fs.readdirSync(directory).includes(segment), `Incorrect path casing: ${reference}`);
      directory = path.join(directory, segment);
    }
    resources.add(relative);
    if (url.hash && relative === 'index.html') {
      assert(ids.includes(decodeURIComponent(url.hash.slice(1))), `Broken navigation anchor: ${reference}`);
    }
  };

  for (const { text, attrs } of tags) {
    for (const key of ['src', 'href', 'poster', 'action']) {
      if (Object.hasOwn(attrs, key)) checkReference(attrs[key]);
    }
    if (attrs.srcset) {
      for (const candidate of attrs.srcset.split(',')) checkReference(candidate.trim().split(/\s+/)[0]);
    }
    if (/^<img\b/i.test(text)) assert(Object.hasOwn(attrs, 'alt'), `Image is missing alt text: ${attrs.src}`);
    if (attrs.target === '_blank') assert(/(?:noopener|noreferrer)/.test(attrs.rel || ''), 'External tab link needs a safe rel attribute');
  }
  for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) checkReference(match[1], 'style.css');
  checkReference(meta('og:image'));
  checkReference(meta('twitter:image'));

  const schemas = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  assert(schemas.length > 0, 'Missing structured data');
  const structuredObjects = [];
  const collect = object => {
    if (!object || typeof object !== 'object') return;
    structuredObjects.push(object);
    for (const value of Object.values(object)) if (typeof value === 'object') collect(value);
  };
  schemas.forEach(match => collect(JSON.parse(match[1])));
  assert(structuredObjects.some(object => object['@type'] === 'Person' && object.name === 'Ritesh Singh'), 'Missing Ritesh Singh Person schema');
  assert(tags.some(tag => tag.attrs.href === resumePath), 'Missing resume download link');
  const resume = fs.readFileSync(path.join(root, resumePath));
  assert.equal(resume.subarray(0, 5).toString(), '%PDF-', 'Resume is not a valid PDF file');
  assert(resume.length > 1000, 'Resume file appears empty');
  resources.add(resumePath);
  return resources;
}

function request(port, requestPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: requestPath, method }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
      response.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error(`Request timed out: ${requestPath}`)));
    req.end();
  });
}

async function checkServer(preview, resources) {
  const server = createSiteServer({ preview });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  try {
    const home = await request(port, '/');
    assert.equal(home.status, 200);
    assert(home.headers['content-type'].startsWith('text/html'));
    for (const resource of resources) {
      const result = await request(port, `/${resource.split('/').map(encodeURIComponent).join('/')}`, 'HEAD');
      assert.equal(result.status, 200, `HTTP asset failed: ${resource}`);
      if (resource !== '.nojekyll') assert(Number(result.headers['content-length']) > 0, `HTTP asset is empty: ${resource}`);
      if (resource === 'site.webmanifest') assert.equal(result.headers['content-type'], 'application/manifest+json; charset=utf-8', 'Manifest MIME type is incorrect');
      assert.equal(result.body.length, 0, `HEAD returned a response body: ${resource}`);
    }
    const resume = await request(port, `/${resumePath}`);
    assert.equal(resume.headers['content-type'], 'application/pdf', 'Resume MIME type is incorrect');
    assert.equal(resume.body.subarray(0, 5).toString(), '%PDF-');
    for (const [requestPath, status] of [
      ['/missing-file.html', 404], ['/package.json', 404], ['/.git/config', 403],
      ['/%2e%2e/package.json', 403], ['/assets/%2e%2e/package.json', 403],
      ['/assets%5c..%5cpackage.json', 400], ['/%E0%A4%A', 400], ['/%00', 400]
    ]) assert.equal((await request(port, requestPath)).status, status, `Unexpected response for ${requestPath}`);
    assert.equal((await request(port, '/', 'POST')).status, 405);
    assert.equal((await request(port, '/')).status, 200, 'Server did not recover after invalid requests');
    console.log(`${preview ? 'Production preview' : 'Development server'}: ${resources.size} local resources, resume, and error handling passed.`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function main() {
  assertIdentity();
  const resources = validateSite(projectRoot);
  console.log(`Source validation passed: ${resources.size} local resources, anchors, metadata, schema, resume, and identity.`);
  if (process.argv.includes('--http')) {
    const outputRoot = path.join(projectRoot, 'dist');
    assert(fs.existsSync(path.join(outputRoot, 'index.html')), 'Run npm run build before npm test.');
    const productionResources = validateSite(outputRoot);
    for (const resource of productionResources) {
      assert(fs.readFileSync(path.join(projectRoot, resource)).equals(fs.readFileSync(path.join(outputRoot, resource))), `Production file is stale: ${resource}`);
    }
    await checkServer(false, resources);
    await checkServer(true, productionResources);
  }
}

main().catch(error => {
  console.error(`Validation failed: ${error.message}`);
  process.exitCode = 1;
});

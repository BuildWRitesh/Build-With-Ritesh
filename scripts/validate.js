const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { createSiteServer } = require('../server.js');

const projectRoot = path.resolve(__dirname, '..');
const siteUrl = new URL('https://buildwithritesh.com/');
const contactEmail = 'buildwritesh@gmail.com';
const legacyEmail = Buffer.from('cml0ZXNoc2luZ2gwMTAxMkBnbWFpbC5jb20=', 'base64').toString('ascii');
const resumePath = 'assets/resume/Ritesh_Singh_Resume.pdf';
const textExtensions = new Set(['.html', '.css', '.js', '.json', '.md', '.txt', '.svg', '.xml', '.yml', '.yaml', '.toml']);
// Encoded legacy identifiers keep obsolete branding out of source and search results.
const legacyIdentifiers = [
  'c2l5YQ==', 'Z3VwdGE=', 'OTMxNTIzMzI0OA==', 'YnV6emJvbGx5d29vZGQ=',
  'VW5pcXN0b3A=', 'Q29udmVyZ2VY', 'RFUgU09M', 'TklNQw=='
].map(value => Buffer.from(value, 'base64').toString('utf8').toLowerCase());
const standaloneIdentifiers = new Set(legacyIdentifiers.slice(0, 2));
const hasLegacyIdentifier = text => legacyIdentifiers.some(value => {
  if (standaloneIdentifiers.has(value)) return new RegExp(`(^|[^a-z])${value}([^a-z]|$)`, 'i').test(text);
  return text.includes(value);
});

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
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
    assert(!hasLegacyIdentifier(relative.toLowerCase()), `Obsolete identity in filename: ${relative}`);
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

function parseHtml(html) {
  const tags = [...html.matchAll(/<[a-z][^>]*>/gi)].map(match => ({ text: match[0], attrs: attributes(match[0]) }));
  return { tags, ids: tags.filter(tag => tag.attrs.id).map(tag => tag.attrs.id) };
}

function parseSchemas(html, from) {
  const schemas = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  assert(schemas.length > 0, `Missing structured data in ${from}`);
  const objects = [];
  const collect = object => {
    if (!object || typeof object !== 'object') return;
    objects.push(object);
    for (const value of Object.values(object)) if (value && typeof value === 'object') collect(value);
  };
  schemas.forEach(match => {
    try { collect(JSON.parse(match[1])); }
    catch (error) { throw new Error(`Invalid JSON-LD in ${from}: ${error.message}`); }
  });
  return objects;
}

function validateSite(root) {
  const rootIndex = path.join(root, 'index.html');
  const html = fs.readFileSync(rootIndex, 'utf8');
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  const { tags, ids } = parseHtml(html);
  assert.equal(new Set(ids).size, ids.length, `Duplicate HTML IDs found in ${rootIndex}`);
  assert.equal((html.match(/<h1(?:\s|>)/gi) || []).length, 1, 'Use exactly one H1 on the portfolio page');
  assert(/<html[^>]+lang=["']en["']/i.test(html), 'Missing English page language');
  assert(/<title>[^<]*Ritesh Singh[^<]*<\/title>/i.test(html), 'Missing Ritesh Singh page title');
  assert(html.includes(contactEmail), 'New contact email is missing');
  assert(!html.toLowerCase().includes(legacyEmail), 'Legacy contact email remains in page source');
  const newTabHelper = ['opens', 'in', 'a', 'new', 'tab'].join(' ');
  const newTabHelperSingular = ['open', 'in', 'new', 'tab'].join(' ');
  assert(!html.toLowerCase().includes(newTabHelper) && !html.toLowerCase().includes(newTabHelperSingular), 'Unwanted new-tab helper text remains');
  assert.equal((html.match(/id="contact-form"/g) || []).length, 1, 'Contact form is missing or duplicated');
  assert(/<form\b[^>]*id="contact-form"[^>]*action="\/api\/contact"[^>]*method="post"/i.test(html), 'Contact form destination is incorrect');
  assert(script.includes('contactForm.reportValidity()') && script.includes("fetch('/api/contact'") && script.includes('buildwritesh@gmail.com'), 'Contact form submission handler is incomplete');
  const meta = key => tags.find(tag => /^<meta\b/i.test(tag.text) && (tag.attrs.name === key || tag.attrs.property === key))?.attrs.content;
  assert(meta('description')?.includes('Ritesh Singh'), 'Missing owner-specific meta description');
  assert(meta('viewport')?.includes('width=device-width'), 'Missing responsive viewport');
  for (const key of ['og:title', 'og:description', 'og:image', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) assert(meta(key)?.trim(), `Missing social metadata: ${key}`);
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
  for (const optional of ['robots.txt', 'sitemap.xml', '.nojekyll', 'site.webmanifest']) if (fs.existsSync(path.join(root, optional))) resources.add(optional);
  const checkReference = (reference, from = 'index.html') => {
    assert(reference?.trim(), `Empty link or asset reference in ${from}`);
    if (/^(?:data:|mailto:|tel:|javascript:)/i.test(reference)) { assert(!/^javascript:/i.test(reference), `JavaScript URL in ${from}`); return; }
    const url = new URL(reference, new URL(from, siteUrl));
    if (url.origin !== siteUrl.origin) return;
    const relative = decodeURIComponent(url.pathname.replace(/^\/+/, '')) || 'index.html';
    if (relative === 'api' || relative.startsWith('api/')) return;
    const file = path.resolve(root, relative);
    const inside = path.relative(root, file);
    assert(!inside.startsWith('..') && !path.isAbsolute(inside), `Asset escapes the site root: ${reference} from ${from}`);
    assert(fs.existsSync(file), `Missing local file: ${reference} (from ${from})`);
    let actual = file;
    if (fs.statSync(file).isDirectory()) {
      actual = path.join(file, 'index.html');
      assert(fs.existsSync(actual) && fs.statSync(actual).isFile(), `Directory has no index page: ${reference} (from ${from})`);
    } else assert(fs.statSync(file).isFile(), `Local reference is not a file: ${reference} (from ${from})`);
    let directory = root;
    for (const segment of relative.split('/').filter(Boolean)) {
      assert(fs.readdirSync(directory).includes(segment), `Incorrect path casing: ${reference}`);
      directory = path.join(directory, segment);
    }
    const actualRelative = path.relative(root, actual).replaceAll(path.sep, '/');
    resources.add(actualRelative);
    if (url.hash && relative === 'index.html') assert(ids.includes(decodeURIComponent(url.hash.slice(1))), `Broken navigation anchor: ${reference}`);
  };
  for (const { text, attrs } of tags) {
    for (const key of ['src', 'href', 'poster', 'action']) if (Object.hasOwn(attrs, key)) checkReference(attrs[key]);
    if (attrs.srcset) for (const candidate of attrs.srcset.split(',')) checkReference(candidate.trim().split(/\s+/)[0]);
    if (/^<img\b/i.test(text)) assert(Object.hasOwn(attrs, 'alt'), `Image is missing alt text: ${attrs.src}`);
    if (attrs.target === '_blank') assert(/(?:noopener|noreferrer)/.test(attrs.rel || ''), 'External tab link needs a safe rel attribute');
  }
  for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) checkReference(match[1], 'style.css');
  checkReference(meta('og:image')); checkReference(meta('twitter:image'));
  const schemas = parseSchemas(html, 'index.html');
  assert(schemas.some(object => object['@type'] === 'Person' && object.name === 'Ritesh Singh'), 'Missing Ritesh Singh Person schema');
  assert(tags.some(tag => tag.attrs.href === resumePath), 'Missing resume download link');
  const resume = fs.readFileSync(path.join(root, resumePath));
  assert.equal(resume.subarray(0, 5).toString(), '%PDF-', 'Resume is not a valid PDF file');
  assert(resume.length > 1000, 'Resume file appears empty');
  resources.add(resumePath);

  const validatePageRefs = (relativePath, requirements = {}) => {
    const pagePath = path.join(root, relativePath);
    assert(fs.existsSync(pagePath), `Missing required page: ${relativePath}`);
    const pageHtml = fs.readFileSync(pagePath, 'utf8');
    const parsed = parseHtml(pageHtml);
    assert.equal(new Set(parsed.ids).size, parsed.ids.length, `Duplicate HTML IDs found in ${relativePath}`);
    assert.equal((pageHtml.match(/<h1(?:\s|>)/gi) || []).length, 1, `Use exactly one H1 on ${relativePath}`);
    assert(/<html[^>]+lang=["']en["']/i.test(pageHtml), `Missing page language in ${relativePath}`);
    assert(/<title>[^<]*Ritesh Singh[^<]*<\/title>/i.test(pageHtml), `Missing Ritesh title in ${relativePath}`);
    assert(pageHtml.includes('content.css'), `Shared content styles missing in ${relativePath}`);
    for (const id of requirements.ids || []) assert(parsed.ids.includes(id), `Missing ${id} in ${relativePath}`);
    for (const { text, attrs } of parsed.tags) {
      for (const key of ['src', 'href', 'poster', 'action']) if (Object.hasOwn(attrs, key)) checkReference(attrs[key], relativePath);
      if (attrs.srcset) for (const candidate of attrs.srcset.split(',')) checkReference(candidate.trim().split(/\s+/)[0], relativePath);
      if (/^<img\b/i.test(text)) assert(Object.hasOwn(attrs, 'alt'), `Image is missing alt text in ${relativePath}`);
      if (attrs.target === '_blank') assert(/(?:noopener|noreferrer)/.test(attrs.rel || ''), `Unsafe external link in ${relativePath}`);
    }
    if (requirements.schema !== false) parseSchemas(pageHtml, relativePath);
    resources.add(relativePath);
    return pageHtml;
  };

  const blogHtml = validatePageRefs('blog/index.html', { ids: ['blog-search', 'blog-category', 'blog-list', 'blog-loading', 'blog-empty', 'blog-error'] });
  const blogScript = fs.readFileSync(path.join(root, 'blog', 'blog.js'), 'utf8');
  assert(blogHtml.includes('blog.js') && blogScript.includes('/api/posts?status=published'), 'Blog listing data wiring is missing');
  assert(blogHtml.includes('https://www.instagram.com/buildwritesh/'), 'Official Instagram link missing from blog page');
  const instagramHtml = validatePageRefs('instagram-videos/index.html', { ids: ['instagram-grid', 'instagram-loading', 'instagram-empty', 'instagram-error'] });
  const instagramScript = fs.readFileSync(path.join(root, 'instagram-videos', 'instagram.js'), 'utf8');
  assert(instagramHtml.includes('instagram.js') && instagramScript.includes('/api/instagram-videos'), 'Instagram page data wiring is missing');
  assert(instagramHtml.includes('https://www.instagram.com/buildwritesh/'), 'Official Instagram source link missing');
  const adminHtml = validatePageRefs('admin/index.html', { schema: false, ids: ['login-view', 'login-form', 'dashboard-view', 'post-form', 'post-editor', 'post-source-editor'] });
  assert(/noindex, nofollow/i.test(adminHtml), 'Admin page must be noindex');
  assert(adminHtml.includes('admin.js') && adminHtml.includes('data-command="bold"') && adminHtml.includes('data-action="source"'), 'Admin editor controls are incomplete');
  assert(!/ADMIN_PASSWORD(?:_HASH)?\s*[:=]/i.test(adminHtml), 'Admin credentials must not appear in frontend markup');

  const privateDataPath = path.join(root, 'data', 'blog-posts.json');
  const publicDataPath = path.join(root, 'blog', 'posts.json');
  const dataPath = fs.existsSync(privateDataPath) ? privateDataPath : publicDataPath;
  assert(fs.existsSync(dataPath), 'Blog data file is missing');
  const posts = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  assert(Array.isArray(posts) && posts.length >= 1, 'Blog data must contain at least one post');
  const slugs = new Set();
  for (const post of posts) {
    assert(post && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug), `Invalid blog slug: ${post?.slug}`);
    assert(!slugs.has(post.slug), `Duplicate blog slug: ${post.slug}`); slugs.add(post.slug);
    assert(['draft', 'published'].includes(post.status), `Invalid blog status: ${post.slug}`);
    assert(post.title && post.excerpt && post.category, `Incomplete blog post: ${post.slug}`);
    if (fs.existsSync(privateDataPath)) {
      assert(post.contentHtml, `Article content is missing: ${post.slug}`);
      assert(!/<\/?script\b|\son[a-z-]+\s*=|(?:javascript|vbscript):/i.test(post.contentHtml), `Unsafe HTML in blog post: ${post.slug}`);
    }
    assert(post.featuredImage && post.imageAlt, `Featured image metadata missing: ${post.slug}`);
    if (!/^(?:https?:|data:|\/)/i.test(post.featuredImage)) {
      const imagePath = path.join(root, post.featuredImage);
      assert(fs.existsSync(imagePath) && fs.statSync(imagePath).isFile(), `Missing blog image: ${post.featuredImage}`);
      resources.add(path.relative(root, imagePath).replaceAll(path.sep, '/'));
    }
    if (post.status === 'published') {
      const articlePath = `blog/${post.slug}/index.html`;
      const articleHtml = validatePageRefs(articlePath);
      const articleParsed = parseHtml(articleHtml);
      assert.equal(articleParsed.ids.filter(id => id === 'article-title').length, 1, `Article H1 missing: ${post.slug}`);
      assert(articleHtml.includes('BlogPosting'), `BlogPosting schema missing: ${post.slug}`);
      assert(articleHtml.includes(post.canonical || `https://buildwithritesh.com/blog/${post.slug}/`), `Canonical missing: ${post.slug}`);
      assert(/<article[^>]*class="article-shell/.test(articleHtml), `Article layout missing: ${post.slug}`);
    }
  }
  const instagramDataPath = path.join(root, 'data', 'instagram-videos.json');
  assert(fs.existsSync(instagramDataPath), 'Instagram fallback data is missing');
  const instagramData = JSON.parse(fs.readFileSync(instagramDataPath, 'utf8'));
  assert.equal(instagramData.source, 'https://www.instagram.com/buildwritesh/', 'Instagram fallback source is incorrect');
  assert(Array.isArray(instagramData.videos), 'Instagram fallback videos must be an array');
  resources.add('blog/posts.json');

  resources.add('data/instagram-videos.json'); resources.add('content.css'); resources.add('blog/blog.js'); resources.add('blog/article.js'); resources.add('instagram-videos/instagram.js'); resources.add('admin/admin.js'); resources.add('admin/admin.css');
  return resources;
}

function request(port, requestPath, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: requestPath, method, headers }, response => {
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
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  try {
    const home = await request(port, '/');
    assert.equal(home.status, 200); assert(home.headers['content-type'].startsWith('text/html'));
    for (const resource of resources) {
      const result = await request(port, `/${resource.split('/').map(encodeURIComponent).join('/')}`, 'HEAD');
      assert.equal(result.status, 200, `HTTP asset failed: ${resource}`);
      if (resource !== '.nojekyll') assert(Number(result.headers['content-length']) > 0, `HTTP asset is empty: ${resource}`);
      if (resource === 'site.webmanifest') assert.equal(result.headers['content-type'], 'application/manifest+json; charset=utf-8', 'Manifest MIME type is incorrect');
      assert.equal(result.body.length, 0, `HEAD returned a response body: ${resource}`);
    }
    const resume = await request(port, `/${resumePath}`);
    assert.equal(resume.headers['content-type'], 'application/pdf'); assert.equal(resume.body.subarray(0, 5).toString(), '%PDF-');
    for (const route of ['/blog/', '/instagram-videos/', '/admin/', '/blog/wordpress-launch-checklist/']) assert.equal((await request(port, route)).status, 200, `Public route failed: ${route}`);
    for (const [requestPath, status] of [
      ['/missing-file.html', 404], ['/package.json', 404], ['/admin-server.js', 404], ['/.git/config', 403],
      ['/%2e%2e/package.json', 403], ['/assets/%2e%2e/package.json', 403], ['/assets%5c..%5cpackage.json', 400], ['/%E0%A4%A', 400], ['/%00', 400]
    ]) assert.equal((await request(port, requestPath)).status, status, `Unexpected response for ${requestPath}`);
    assert.equal((await request(port, '/', 'POST')).status, 405); assert.equal((await request(port, '/')).status, 200, 'Server did not recover after invalid requests');
    console.log(`${preview ? 'Production preview' : 'Development server'}: ${resources.size} local resources, content routes, resume, and error handling passed.`);
  } finally { await new Promise(resolve => server.close(resolve)); }
}

async function main() {
  assertIdentity();
  const resources = validateSite(projectRoot);
  console.log(`Source validation passed: ${resources.size} local resources, anchors, metadata, schemas, content and identity.`);
  if (process.argv.includes('--http')) {
    const outputRoot = path.join(projectRoot, 'dist');
    assert(fs.existsSync(path.join(outputRoot, 'index.html')), 'Run npm run build before npm test.');
    const productionResources = validateSite(outputRoot);
    for (const resource of productionResources) {
      assert(fs.existsSync(path.join(projectRoot, resource)), `Source resource disappeared: ${resource}`);
      assert(fs.readFileSync(path.join(projectRoot, resource)).equals(fs.readFileSync(path.join(outputRoot, resource))), `Production file is stale: ${resource}`);
    }
    await checkServer(false, resources); await checkServer(true, productionResources);
  }
}

main().catch(error => { console.error(`Validation failed: ${error.message}`); process.exitCode = 1; });

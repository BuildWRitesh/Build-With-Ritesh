'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { createSiteServer } = require('./server');

const projectRoot = __dirname;
const defaultBlogDataFile = path.join(projectRoot, 'data', 'blog-posts.json');
const siteBaseUrl = 'https://buildwritesh.github.io';
const sessionCookieName = 'admin_session';
const sessionMaxAgeSeconds = 60 * 60 * 8;
const maxJsonBodyBytes = 8 * 1024 * 1024;
const maxContentHtmlLength = 400_000;
const maxImageBytes = 5 * 1024 * 1024;
const allowedImageTypes = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif']
]);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sendJson(request, response, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  if (request.method === 'HEAD') response.end();
  else response.end(body);
  return true;
}

function sendError(request, response, status, message) {
  return sendJson(request, response, status, { error: message });
}

function parseCookies(header = '') {
  const cookies = {};
  for (const piece of header.split(';')) {
    const separator = piece.indexOf('=');
    if (separator < 0) continue;
    const key = piece.slice(0, separator).trim();
    if (!key) continue;
    const value = piece.slice(separator + 1).trim();
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }
  return cookies;
}

function setSessionCookie(response, token, secure = false) {
  const flags = [
    `${sessionCookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${sessionMaxAgeSeconds}`,
    'HttpOnly',
    'SameSite=Strict'
  ];
  if (secure) flags.push('Secure');
  response.setHeader('Set-Cookie', flags.join('; '));
}

function clearSessionCookie(response, secure = false) {
  const flags = [`${sessionCookieName}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Strict'];
  if (secure) flags.push('Secure');
  response.setHeader('Set-Cookie', flags.join('; '));
}

function readRequestBody(request, maxBytes = maxJsonBodyBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(value);
    };
    request.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        finish(Object.assign(new Error('Request body is too large.'), { code: 'PAYLOAD_TOO_LARGE' }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => finish(null, Buffer.concat(chunks).toString('utf8')));
    request.on('error', error => finish(error));
    request.on('aborted', () => finish(new Error('Request was aborted.')));
  });
}

async function readJson(request, maxBytes = maxJsonBodyBytes) {
  const body = await readRequestBody(request, maxBytes);
  if (!body.trim()) return {};
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected a JSON object.');
    return parsed;
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.code = 'INVALID_JSON';
    throw error;
  }
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function text(value, maxLength = 1000) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, maxLength);
}

function dateValue(value, fallback = today()) {
  const candidate = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : fallback;
}

function safeHttpUrl(value, fallback = '') {
  const candidate = text(value, 2000);
  if (!candidate) return fallback;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function imageReference(value, fallback = '') {
  const candidate = text(value, 1000);
  if (!candidate) return fallback;
  if (/^https?:\/\//i.test(candidate)) return safeHttpUrl(candidate, fallback);
  const normalized = candidate.replace(/^\/+/, '');
  if (!normalized.startsWith('assets/blog/') || normalized.includes('..') || /[\\\0]/.test(normalized)) return fallback;
  return normalized;
}

const sanitizeContentHtml = require('./scripts/sanitize-content');

function normalizeTags(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return [...new Set(source.map(item => text(item, 40)).filter(Boolean))].slice(0, 12);
}

function normalizePost(input, existing = null) {
  const source = input && typeof input === 'object' ? input : {};
  const title = text(source.title ?? existing?.title, 180);
  if (!title) throw Object.assign(new Error('A post title is required.'), { code: 'INVALID_POST' });
  const slug = slugify(source.slug ?? existing?.slug ?? title);
  if (!slug) throw Object.assign(new Error('A valid post slug is required.'), { code: 'INVALID_POST' });
  const status = source.status === 'draft' || source.status === 'published'
    ? source.status
    : (existing?.status === 'draft' ? 'draft' : 'published');
  const existingDate = existing?.date || existing?.publishedAt || existing?.published_at;
  const date = dateValue(source.date ?? source.publishedAt ?? source.published_at ?? existingDate);
  const updated = dateValue(source.updated ?? source.updatedAt ?? source.updated_at, today());
  const featuredImage = imageReference(source.featuredImage ?? source.featured_image ?? existing?.featuredImage ?? existing?.featured_image);
  const canonical = safeHttpUrl(
    source.canonical ?? source.canonicalUrl ?? source.canonical_url ?? existing?.canonical ?? existing?.canonicalUrl,
    `${siteBaseUrl}/blog/${slug}/`
  );
  const contentHtml = sanitizeContentHtml(source.contentHtml ?? source.content_html ?? existing?.contentHtml ?? existing?.content_html ?? '');
  if (!contentHtml) throw Object.assign(new Error('Article content is required.'), { code: 'INVALID_POST' });
  return {
    id: text(source.id ?? existing?.id, 80) || crypto.randomUUID(),
    slug,
    title,
    excerpt: text(source.excerpt ?? existing?.excerpt, 500),
    category: text(source.category ?? existing?.category, 80) || 'Journal',
    date,
    updated,
    publishedAt: status === 'published' ? (existing?.publishedAt || date) : (existing?.publishedAt || null),
    author: text(source.author ?? existing?.author, 100) || 'Ritesh Singh',
    featuredImage,
    imageAlt: text(source.imageAlt ?? source.image_alt ?? existing?.imageAlt ?? existing?.image_alt, 180),
    seoTitle: text(source.seoTitle ?? source.seo_title ?? existing?.seoTitle ?? existing?.seo_title ?? title, 180),
    metaDescription: text(source.metaDescription ?? source.meta_description ?? existing?.metaDescription ?? existing?.meta_description ?? source.excerpt ?? existing?.excerpt, 320),
    focusKeyword: text(source.focusKeyword ?? source.focus_keyword ?? existing?.focusKeyword ?? existing?.focus_keyword, 100),
    canonical,
    status,
    tags: normalizeTags(source.tags, existing?.tags || []),
    contentHtml
  };
}

function readHash(value) {
  const pieces = String(value || '').split('$');
  if (pieces.length !== 6 || pieces[0] !== 'scrypt') return null;
  const [, nValue, rValue, pValue, saltHex, hashHex] = pieces;
  const N = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);
  if (!Number.isSafeInteger(N) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p) || N < 1024 || (N & (N - 1)) !== 0 || r < 1 || p < 1) return null;
  if (!/^[\da-f]{16,128}$/i.test(saltHex) || !/^[\da-f]{64,256}$/i.test(hashHex)) return null;
  return { N, r, p, salt: Buffer.from(saltHex, 'hex'), hash: Buffer.from(hashHex, 'hex') };
}

function hashPassword(password, { N = 16384, r = 8, p = 1, salt = crypto.randomBytes(16) } = {}) {
  const derived = crypto.scryptSync(String(password), salt, 64, { N, r, p, maxmem: Math.max(32 * 1024 * 1024, 128 * N * r + 1024) });
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verifyPassword(password, encodedHash) {
  const parsed = readHash(encodedHash);
  if (!parsed) return false;
  try {
    const derived = crypto.scryptSync(String(password), parsed.salt, parsed.hash.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
      maxmem: Math.max(32 * 1024 * 1024, 128 * parsed.N * parsed.r + 1024)
    });
    return derived.length === parsed.hash.length && crypto.timingSafeEqual(derived, parsed.hash);
  } catch {
    return false;
  }
}

function requestPath(request) {
  try {
    return new URL(request.url || '/', 'http://localhost').pathname;
  } catch {
    return '/';
  }
}

function decodePathPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

function getClientIp(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || request.socket.remoteAddress || 'unknown';
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return parsed.host === request.headers.host;
  } catch {
    return false;
  }
}

function publicPost(post, includeContent = true) {
  if (includeContent) return { ...post };
  const { contentHtml, ...withoutContent } = post;
  return withoutContent;
}

async function readPosts(dataFile) {
  const source = await fs.promises.readFile(dataFile, 'utf8');
  const parsed = JSON.parse(source);
  const posts = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.posts) ? parsed.posts : null;
  if (!posts) throw new Error('Blog data must contain an array of posts.');
  return posts;
}

async function writePosts(dataFile, posts) {
  await fs.promises.mkdir(path.dirname(dataFile), { recursive: true });
  const temporaryFile = path.join(path.dirname(dataFile), `.${path.basename(dataFile)}.${process.pid}.${Date.now()}.tmp`);
  await fs.promises.writeFile(temporaryFile, `${JSON.stringify(posts, null, 2)}\n`, 'utf8');
  try {
    await fs.promises.rename(temporaryFile, dataFile);
  } catch (error) {
    if (error.code !== 'EEXIST' && error.code !== 'EPERM') throw error;
    await fs.promises.rm(dataFile, { force: true });
    await fs.promises.rename(temporaryFile, dataFile);
  }
}

async function regeneratePublicBlog({ dataFile, root, previousPosts, nextPosts }) {
  // A custom data file is useful for tests and previews. It must never rewrite
  // the checked-in public pages unexpectedly.
  if (path.resolve(dataFile) !== path.resolve(defaultBlogDataFile)) return;
  const generatorPath = path.join(projectRoot, 'scripts', 'generate-blog.js');
  try {
    if (!fs.existsSync(generatorPath)) return;
    const generator = require(generatorPath);
    if (typeof generator.generateBlogPages === 'function') {
      await generator.generateBlogPages({ root: root || projectRoot });
    }
    // Generated article folders are safe to prune by slug. Keep the listing
    // page and any explicitly named non-article files intact.
    const currentSlugs = new Set(nextPosts.filter(post => post.status === 'published').map(post => post.slug));
    const oldSlugs = new Set(previousPosts.map(post => post.slug));
    for (const slug of oldSlugs) {
      if (currentSlugs.has(slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) continue;
      const articleDirectory = path.join(root || projectRoot, 'blog', slug);
      const articleIndex = path.join(articleDirectory, 'index.html');
      if (fs.existsSync(articleIndex)) await fs.promises.rm(articleDirectory, { recursive: true, force: true });
    }
  } catch (error) {
    // The JSON mutation is still valid; a later build will regenerate static
    // pages. Keep the API response useful while logging the server-side issue.
    console.error(`Unable to regenerate blog pages: ${error.message}`);
  }
}

function imageBufferMatchesType(buffer, mimeType) {
  if (mimeType === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/gif') return buffer.length >= 6 && (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a');
  if (mimeType === 'image/webp') return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

function uploadFilename(value, mimeType) {
  const extension = allowedImageTypes.get(mimeType);
  const original = path.basename(text(value, 160)).replace(/\.[^.]*$/, '');
  const stem = slugify(original) || 'article-image';
  return `${stem}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}${extension}`;
}

function clearExpiredSessions(sessions) {
  const now = Date.now();
  for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token);
}

function createAdminServer({ preview = false, blogDataFile, contentRoot = projectRoot } = {}) {
  const staticServer = createSiteServer({ preview });
  const dataFile = path.resolve(blogDataFile || process.env.BLOG_DATA_FILE || path.join(contentRoot, 'data', 'blog-posts.json'));
  const sessions = new Map();
  const loginAttempts = new Map();
  let instagramCache = { expiresAt: 0, payload: null };

  const authConfig = () => ({
    email: text(process.env.ADMIN_EMAIL, 320).toLowerCase(),
    passwordHash: process.env.ADMIN_PASSWORD_HASH || ''
  });

  const authenticatedUser = request => {
    clearExpiredSessions(sessions);
    const token = parseCookies(request.headers.cookie || '')[sessionCookieName];
    const session = token ? sessions.get(token) : null;
    if (!session || session.expiresAt <= Date.now()) {
      if (token) sessions.delete(token);
      return null;
    }
    return session.user;
  };

  const loginAllowed = request => {
    const ip = getClientIp(request);
    const now = Date.now();
    const record = loginAttempts.get(ip) || { failures: [], blockedUntil: 0 };
    record.failures = record.failures.filter(timestamp => timestamp > now - 15 * 60 * 1000);
    if (record.blockedUntil > now) return false;
    loginAttempts.set(ip, record);
    return record.failures.length < 5;
  };

  const recordLoginFailure = request => {
    const ip = getClientIp(request);
    const record = loginAttempts.get(ip) || { failures: [], blockedUntil: 0 };
    record.failures.push(Date.now());
    if (record.failures.length >= 5) record.blockedUntil = Date.now() + 15 * 60 * 1000;
    loginAttempts.set(ip, record);
  };

  const clearLoginFailures = request => loginAttempts.delete(getClientIp(request));

  const requireUser = (request, response) => {
    const user = authenticatedUser(request);
    if (!user) {
      sendError(request, response, 401, 'Authentication required.');
      return null;
    }
    return user;
  };

  const getInstagramVideos = async () => {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const userId = process.env.INSTAGRAM_USER_ID;
    if (!token || !userId) return { source: 'https://www.instagram.com/buildwritesh/', configured: false, updatedAt: null, videos: [] };
    if (instagramCache.payload && instagramCache.expiresAt > Date.now()) return instagramCache.payload;
    const fields = 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp';
    const endpoint = `https://graph.facebook.com/v20.0/${encodeURIComponent(userId)}/media?${new URLSearchParams({ fields, limit: '50', access_token: token })}`;
    const upstream = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!upstream.ok) throw new Error(`Instagram API returned ${upstream.status}.`);
    const payload = await upstream.json();
    const videos = (Array.isArray(payload.data) ? payload.data : [])
      .filter(item => item && (item.media_type === 'VIDEO' || item.media_product_type === 'REELS'))
      .map(item => ({
        id: text(item.id, 120),
        caption: text(item.caption, 300),
        permalink: safeHttpUrl(item.permalink),
        thumbnailUrl: safeHttpUrl(item.thumbnail_url),
        mediaUrl: safeHttpUrl(item.media_url),
        timestamp: text(item.timestamp, 80),
        mediaType: text(item.media_type, 30),
        mediaProductType: text(item.media_product_type, 30)
      }))
      .filter(item => item.id && item.permalink);
    const result = { source: 'https://www.instagram.com/buildwritesh/', configured: true, updatedAt: new Date().toISOString(), videos };
    instagramCache = { payload: result, expiresAt: Date.now() + 5 * 60 * 1000 };
    return result;
  };

  const handleApi = async (request, response) => {
    const pathname = requestPath(request);
    if (!pathname.startsWith('/api/')) return false;
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end();
      return true;
    }

    if (pathname === '/api/admin/login' && request.method === 'POST') {
      if (!sameOrigin(request)) return sendError(request, response, 403, 'Invalid request origin.');
      if (!loginAllowed(request)) return sendError(request, response, 429, 'Too many login attempts. Try again later.');
      let body;
      try {
        body = await readJson(request, 32 * 1024);
      } catch (error) {
        return sendError(request, response, error.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400, error.code === 'PAYLOAD_TOO_LARGE' ? 'Request body is too large.' : 'Invalid login request.');
      }
      const config = authConfig();
      const email = text(body.email, 320).toLowerCase();
      const password = String(body.password ?? '');
      const valid = Boolean(config.email && config.passwordHash && email === config.email && verifyPassword(password, config.passwordHash));
      if (!valid) {
        recordLoginFailure(request);
        return sendError(request, response, 401, 'Invalid email or password.');
      }
      clearLoginFailures(request);
      const token = crypto.randomBytes(32).toString('base64url');
      const user = { email: config.email };
      sessions.set(token, { user, createdAt: Date.now(), expiresAt: Date.now() + sessionMaxAgeSeconds * 1000 });
      setSessionCookie(response, token, process.env.NODE_ENV === 'production');
      return sendJson(request, response, 200, { ok: true, user });
    }

    if (pathname === '/api/admin/logout' && request.method === 'POST') {
      if (!sameOrigin(request)) return sendError(request, response, 403, 'Invalid request origin.');
      const token = parseCookies(request.headers.cookie || '')[sessionCookieName];
      if (token) sessions.delete(token);
      clearSessionCookie(response, process.env.NODE_ENV === 'production');
      return sendJson(request, response, 200, { ok: true });
    }

    if (pathname === '/api/admin/session' && request.method === 'GET') {
      const user = authenticatedUser(request);
      return sendJson(request, response, 200, user ? { authenticated: true, user } : { authenticated: false });
    }

    if (pathname === '/api/instagram-videos' && request.method === 'GET') {
      try {
        return sendJson(request, response, 200, await getInstagramVideos());
      } catch (error) {
        console.error(`Unable to load Instagram videos: ${error.message}`);
        return sendError(request, response, 502, 'Instagram videos are temporarily unavailable.');
      }
    }

    const publicPostsMatch = pathname.match(/^\/api\/posts(?:\/([^/]+))?$/);
    if (publicPostsMatch && request.method === 'GET') {
      try {
        const posts = (await readPosts(dataFile)).filter(post => post && post.status === 'published');
        const encodedSlug = publicPostsMatch[1];
        if (encodedSlug) {
          const slug = decodePathPart(encodedSlug);
          const post = posts.find(item => item.slug === slug);
          if (!post) return sendError(request, response, 404, 'Post not found.');
          return sendJson(request, response, 200, publicPost(post, true));
        }
        return sendJson(request, response, 200, { posts: posts.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).map(post => publicPost(post, false)) });
      } catch (error) {
        console.error(`Unable to read blog data: ${error.message}`);
        return sendError(request, response, 500, 'Blog content is temporarily unavailable.');
      }
    }

    const adminPostsMatch = pathname.match(/^\/api\/admin\/posts(?:\/([^/]+))?$/);
    if (adminPostsMatch && (request.method === 'GET' || request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE')) {
      if (!requireUser(request, response)) return true;
      if (!sameOrigin(request) && request.method !== 'GET') return sendError(request, response, 403, 'Invalid request origin.');
      try {
        const posts = await readPosts(dataFile);
        const encodedSlug = adminPostsMatch[1];
        const slug = encodedSlug ? decodePathPart(encodedSlug) : '';
        if (request.method === 'GET') {
          const query = new URL(request.url || '/', 'http://localhost').searchParams;
          const status = query.get('status');
          const search = text(query.get('search'), 120).toLowerCase();
          const result = posts
            .filter(post => !status || status === 'all' || post.status === status)
            .filter(post => !search || `${post.title || ''} ${post.excerpt || ''} ${post.category || ''}`.toLowerCase().includes(search))
            .sort((a, b) => String(b.updated || b.date || '').localeCompare(String(a.updated || a.date || '')));
          return sendJson(request, response, 200, { posts: result.map(post => publicPost(post, true)) });
        }
        if (request.method === 'DELETE') {
          if (!slug) return sendError(request, response, 400, 'A post slug is required.');
          const nextPosts = posts.filter(post => post.slug !== slug);
          if (nextPosts.length === posts.length) return sendError(request, response, 404, 'Post not found.');
          await writePosts(dataFile, nextPosts);
          await regeneratePublicBlog({ dataFile, contentRoot, previousPosts: posts, nextPosts });
          return sendJson(request, response, 200, { ok: true });
        }
        const body = await readJson(request);
        if (request.method === 'POST') {
          const normalized = normalizePost(body);
          if (posts.some(post => post.slug === normalized.slug)) return sendError(request, response, 409, 'A post with this slug already exists.');
          const nextPosts = [...posts, normalized];
          await writePosts(dataFile, nextPosts);
          await regeneratePublicBlog({ dataFile, contentRoot, previousPosts: posts, nextPosts });
          return sendJson(request, response, 201, { post: publicPost(normalized, true) });
        }
        if (!slug) return sendError(request, response, 400, 'A post slug is required.');
        const index = posts.findIndex(post => post.slug === slug);
        if (index < 0) return sendError(request, response, 404, 'Post not found.');
        const normalized = normalizePost(body, posts[index]);
        if (posts.some((post, postIndex) => postIndex !== index && post.slug === normalized.slug)) return sendError(request, response, 409, 'A post with this slug already exists.');
        const nextPosts = posts.slice();
        nextPosts[index] = normalized;
        await writePosts(dataFile, nextPosts);
        await regeneratePublicBlog({ dataFile, contentRoot, previousPosts: posts, nextPosts });
        return sendJson(request, response, 200, { post: publicPost(normalized, true) });
      } catch (error) {
        if (error.code === 'INVALID_POST') return sendError(request, response, 400, error.message);
        if (error.code === 'INVALID_JSON') return sendError(request, response, 400, error.message);
        if (error.code === 'PAYLOAD_TOO_LARGE') return sendError(request, response, 413, 'Request body is too large.');
        console.error(`Unable to mutate blog data: ${error.message}`);
        return sendError(request, response, 500, 'Unable to save blog content.');
      }
    }

    if (pathname === '/api/admin/upload' && request.method === 'POST') {
      if (!requireUser(request, response)) return true;
      if (!sameOrigin(request)) return sendError(request, response, 403, 'Invalid request origin.');
      try {
        const body = await readJson(request, maxImageBytes + 512 * 1024);
        const mimeType = text(body.mime, 80).toLowerCase();
        if (!allowedImageTypes.has(mimeType)) return sendError(request, response, 415, 'Only PNG, JPEG, WebP and GIF images are supported.');
        const encoded = String(body.data || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
        if (!encoded || encoded.length > Math.ceil(maxImageBytes / 3) * 4 + 16 || !/^[a-z\d+/]+={0,2}$/i.test(encoded)) return sendError(request, response, 413, 'Image is too large or invalid.');
        const buffer = Buffer.from(encoded, 'base64');
        if (buffer.length === 0 || buffer.length > maxImageBytes || !imageBufferMatchesType(buffer, mimeType)) return sendError(request, response, 400, 'Image data is invalid.');
        const filename = uploadFilename(body.filename, mimeType);
        const destinationDirectory = path.join(contentRoot, 'assets', 'blog');
        await fs.promises.mkdir(destinationDirectory, { recursive: true });
        await fs.promises.writeFile(path.join(destinationDirectory, filename), buffer, { flag: 'wx' });
        return sendJson(request, response, 201, { url: `/assets/blog/${filename}`, filename });
      } catch (error) {
        if (error.code === 'INVALID_JSON') return sendError(request, response, 400, error.message);
        if (error.code === 'PAYLOAD_TOO_LARGE') return sendError(request, response, 413, 'Image is too large.');
        if (error.code === 'EEXIST') return sendError(request, response, 409, 'An image with this name already exists.');
        console.error(`Unable to upload blog image: ${error.message}`);
        return sendError(request, response, 500, 'Unable to upload image.');
      }
    }

    return sendError(request, response, 404, 'API route not found.');
  };

  const server = http.createServer(async (request, response) => {
    try {
      const handled = await handleApi(request, response);
      if (handled) return;
      staticServer.emit('request', request, response);
    } catch (error) {
      console.error(`Admin server request failed: ${error.message}`);
      if (!response.headersSent) sendError(request, response, 500, 'Request failed.');
      else response.destroy();
    }
  });
  return server;
}

if (require.main === module) {
  const port = Number(process.env.ADMIN_PORT ?? 8787);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('ADMIN_PORT must be an integer from 0 to 65535.');
  const server = createAdminServer({ preview: process.argv.includes('--preview') });
  server.on('error', error => {
    console.error(`Unable to start admin server: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Ritesh Singh content server running at http://localhost:${server.address().port}`);
  });
}

module.exports = {
  createAdminServer,
  hashPassword,
  normalizePost,
  sanitizeContentHtml,
  slugify,
  imageReference
};

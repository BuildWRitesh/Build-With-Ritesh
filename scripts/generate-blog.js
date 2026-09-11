const fs = require('node:fs');
const path = require('node:path');

const defaultRoot = path.resolve(__dirname, '..');
const siteOrigin = 'https://buildwritesh.github.io';

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

// Content is authored in JSON and can later be edited through the dashboard.
// Keep the renderer defensive so unsafe markup never becomes part of a page.
const sanitizeContentHtml = require('./sanitize-content');
const readingMinutes = html => Math.max(1, Math.ceil(String(html || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length / 220));

const imageUrl = (value, origin = siteOrigin) => {
  if (!value) return `${origin}/assets/branding/social-preview.png`;
  return /^(?:https?:|data:)/i.test(value) ? value : `${origin}/${String(value).replace(/^\/+/, '')}`;
};

const assetSrc = (value, prefix = '') => {
  if (!value) return `${prefix}assets/branding/social-preview.png`;
  return /^(?:https?:|data:|\/)/i.test(String(value)) ? String(value) : `${prefix}${String(value).replace(/^\.\//, '')}`;
};

function renderHeader(prefix, current = 'Blog') {
  const links = [
    ['About', `${prefix}#about`], ['Experience', `${prefix}#experience`], ['Expertise', `${prefix}#expertise`],
    ['Services', `${prefix}services/`], ['Portfolio', `${prefix}#work`], ['Blog', `${prefix}blog/`], ['Instagram', `${prefix}instagram-videos/`], ['Contact', `${prefix}contact/`]
  ];
  const desktop = links.map(([label, href]) => `<a href="${href}"${label === current ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const mobile = links.map(([label, href], index) => `<a href="${href}"${label === current ? ' aria-current="page"' : ''}><span>${String(index + 1).padStart(2, '0')}</span>${label}</a>`).join('');
  return `<header class="site-header"><div class="header-inner"><a class="brand" href="${prefix}" aria-label="Ritesh Singh home"><img class="brand__logo" src="${prefix}assets/branding/ritesh-singh-logo.png" alt="" width="48" height="48" decoding="async"><span class="brand__copy">Ritesh Singh<small>Build With Ritesh</small></span></a><nav class="desktop-nav" aria-label="Primary navigation">${desktop}</nav><div class="header-actions"><a class="subtle-admin-link" href="${prefix}admin/" aria-label="Admin Login" title="Admin">/admin</a><a class="header-contact" href="${prefix}contact/">Start a Project →</a></div><button class="menu-toggle" type="button" aria-label="Open menu" aria-controls="mobile-menu" aria-expanded="false" hidden><span></span><span></span></button></div></header><dialog class="mobile-menu" id="mobile-menu" aria-label="Navigation menu"><div class="mobile-menu__top"><span class="mobile-menu__brand"><img src="${prefix}assets/branding/ritesh-singh-logo.png" alt="" width="42" height="42" decoding="async"><span>Build With Ritesh</span></span><button class="menu-close" type="button" aria-label="Close menu">Close <span aria-hidden="true">×</span></button></div><nav aria-label="Mobile navigation">${mobile}</nav><div class="mobile-menu-footer"><a class="subtle-admin-link" href="${prefix}admin/" aria-label="Admin Login">/admin</a><a class="text-link" href="${prefix}assets/resume/Ritesh_Singh_Resume.pdf" download="Ritesh_Singh_Resume.pdf">Download Resume <span aria-hidden="true">↓</span></a></div></dialog><div class="custom-cursor" aria-hidden="true"><span class="custom-cursor__ring"></span><span class="custom-cursor__dot"></span></div>`;
}

function renderFooter(prefix) {
  return `<footer class="content-footer section-dark"><div class="content-shell"><div class="site-footer"><a class="footer-brand" href="${prefix}"><img src="${prefix}assets/branding/ritesh-singh-logo.png" alt="" width="42" height="42" decoding="async"><span>Ritesh Singh<b aria-hidden="true">.</b></span></a><p>© <span id="year">2026</span> Ritesh Singh</p><a href="${prefix}#contact">Start a conversation <span aria-hidden="true">↗</span></a></div></div></footer>`;
}

function renderRelated(posts, current, prefix) {
  const related = posts.filter(post => post.slug !== current.slug && post.status === 'published' && post.category === current.category).slice(0, 3);
  const fallback = related.length ? related : posts.filter(post => post.slug !== current.slug && post.status === 'published').slice(0, 3);
  if (!fallback.length) return '';
  const cards = fallback.map(post => `<article class="article-card"><a class="article-card__link" data-cursor="project" href="${prefix}blog/${encodeURIComponent(post.slug)}/"><div class="article-card__image-wrap"><img class="article-card__image" src="${escapeHtml(assetSrc(post.featuredImage, prefix))}" alt="${escapeHtml(post.imageAlt || post.title)}" width="800" height="500" loading="lazy" decoding="async"></div><div class="article-card__body"><div class="article-card__meta"><strong>${escapeHtml(post.category || 'Journal')}</strong><span>${escapeHtml(post.date)}</span></div><h3>${escapeHtml(post.title)}</h3><span class="article-card__read">Read article <span aria-hidden="true">↗</span></span></div></a></article>`).join('');
  return `<section class="related" aria-labelledby="related-title"><h2 id="related-title">Keep reading<span class="title-dot">.</span></h2><div class="article-grid">${cards}</div></section>`;
}

function renderArticle(post, posts, { prefix = '../../', sanitize = sanitizeContentHtml, origin = siteOrigin } = {}) {
  const featured = imageUrl(post.featuredImage, origin);
  const canonical = post.canonical || `${origin}/blog/${post.slug}/`;
  const title = post.seoTitle || `${post.title} | Ritesh Singh`;
  const description = post.metaDescription || post.excerpt;
  const tags = (post.tags || []).map(tag => `<span class="article-tag">${escapeHtml(tag)}</span>`).join('');
  const shareUrl = encodeURIComponent(canonical);
  const content = sanitize(post.contentHtml);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="author" content="Ritesh Singh">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#0c192c">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Build With Ritesh">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(featured)}">
  <meta property="og:image:alt" content="${escapeHtml(post.imageAlt || post.title)}">
  <meta property="article:published_time" content="${escapeHtml(post.date)}">
  <meta property="article:modified_time" content="${escapeHtml(post.updated || post.date)}">
  <meta property="article:section" content="${escapeHtml(post.category || 'Journal')}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(featured)}">
  <meta name="twitter:image:alt" content="${escapeHtml(post.imageAlt || post.title)}">
  <link rel="icon" href="${prefix}assets/branding/ritesh-singh-favicon.png" type="image/png" sizes="64x64">
  <link rel="apple-touch-icon" href="${prefix}assets/branding/ritesh-singh-logo.png" sizes="500x500">
  <link rel="manifest" href="${prefix}site.webmanifest">
  <link rel="preload" href="${prefix}assets/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="${prefix}assets/fonts/syne-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${prefix}style.css">
  <link rel="stylesheet" href="${prefix}content.css">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title,
    description, image: [featured], datePublished: post.date, dateModified: post.updated || post.date,
    author: { '@type': 'Person', name: post.author || 'Ritesh Singh', url: origin + '/' },
    publisher: { '@type': 'Person', name: 'Ritesh Singh', url: origin + '/' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical }, url: canonical,
    articleSection: post.category || 'Journal', keywords: (post.tags || []).join(', ')
  }).replaceAll('<', '\\u003c')}</script>
  <script src="${prefix}assets/vendor/gsap.min.js" defer></script>
  <script src="${prefix}assets/vendor/ScrollTrigger.min.js" defer></script>
  <script src="${prefix}script.js" defer></script>
  <script src="${prefix}blog/article.js" defer></script>
</head>
<body class="content-page article-page" data-article-url="${escapeHtml(canonical)}">
  <a class="skip-link" href="#main-content">Skip to content</a>
  ${renderHeader(prefix, 'Blog')}
  <main id="main-content" tabindex="-1">
    <article class="article-shell content-shell">
      <header class="article-hero"><span class="article-hero__category">${escapeHtml(post.category || 'Journal')}</span><h1 id="article-title">${escapeHtml(post.title)}</h1><p class="article-hero__excerpt">${escapeHtml(post.excerpt)}</p><div class="article-hero__byline"><span>By ${escapeHtml(post.author || 'Ritesh Singh')}</span><time datetime="${escapeHtml(post.date)}">${escapeHtml(post.date)}</time>${post.updated && post.updated !== post.date ? `<span>Updated ${escapeHtml(post.updated)}</span>` : ''}<span>${readingMinutes(content)} min read</span></div><figure class="article-featured"><img src="${escapeHtml(assetSrc(post.featuredImage, prefix))}" alt="${escapeHtml(post.imageAlt || post.title)}" width="1200" height="600" decoding="async"><figcaption>${escapeHtml(post.imageAlt || 'Featured article image')}</figcaption></figure></header>
      <div class="article-layout"><div class="article-body">${content}</div><aside class="article-aside" aria-label="Article tools"><div><p class="article-aside__label">Topics</p><div class="article-tags">${tags || '<span class="article-tag">Journal</span>'}</div></div><div><p class="article-aside__label">Share</p><div class="share-links"><a href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn">in</a><a href="https://twitter.com/intent/tweet?url=${shareUrl}&text=${encodeURIComponent(post.title)}" target="_blank" rel="noopener noreferrer" aria-label="Share on X">X</a><button type="button" data-share-copy aria-label="Copy article link">Copy</button></div><p class="form-status" data-share-status role="status" aria-live="polite"></p></div><a class="text-link" href="${prefix}#contact">Discuss a project <span aria-hidden="true">↗</span></a></aside></div>
    </article>
    <div class="content-shell">${renderRelated(posts, post, prefix)}</div>
  </main>
  ${renderFooter(prefix)}
</body>
</html>`;
}

function generateBlogPages({ root = defaultRoot } = {}) {
  const dataPath = path.join(root, 'data', 'blog-posts.json');
  const outputRoot = path.join(root, 'blog');
  const posts = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  if (!Array.isArray(posts)) throw new Error('Blog data must be an array.');
  const published = posts.filter(post => post && post.status === 'published' && post.slug);
  fs.mkdirSync(outputRoot, { recursive: true });
  const publishedSlugs = new Set(published.map(post => post.slug));
  // Remove generated article folders for posts that were unpublished or
  // deleted. The listing page and its script stay intact.
  for (const entry of fs.readdirSync(outputRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name) || publishedSlugs.has(entry.name)) continue;
    fs.rmSync(path.join(outputRoot, entry.name), { recursive: true, force: true });
  }
  for (const post of published) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) throw new Error(`Invalid blog slug: ${post.slug}`);
    const directory = path.join(outputRoot, post.slug);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'index.html'), renderArticle(post, posts), 'utf8');
  }
  const publicPosts = published.map(({ contentHtml, ...post }) => ({ ...post, readingMinutes: readingMinutes(contentHtml) }));
  fs.writeFileSync(path.join(outputRoot, 'posts.json'), `${JSON.stringify(publicPosts, null, 2)}\n`, 'utf8');
  
  const sitemapUrls = [
    `${siteOrigin}/`,
    `${siteOrigin}/blog/`,
    `${siteOrigin}/instagram-videos/`,
    `${siteOrigin}/services/`,
    `${siteOrigin}/contact/`,
    ...published.map(post => `${siteOrigin}/blog/${post.slug}/`)
  ];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map(url => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(root, 'sitemap.xml'), sitemapXml, 'utf8');

  return published.map(post => post.slug);
}

if (require.main === module) {
  const slugs = generateBlogPages();
  console.log(`Generated ${slugs.length} blog article page${slugs.length === 1 ? '' : 's'}.`);
}

module.exports = { escapeHtml, sanitizeContentHtml, renderArticle, generateBlogPages, renderHeader, renderFooter, siteOrigin };

'use strict';

const { ensureSchema, sqlClient, mapPost } = require('./lib/db');
const { SITE_URL, sanitizeContent } = require('./lib/core');
const { renderArticle } = require('../scripts/generate-blog');

// Use the same editorial template for generated and database-backed articles.
module.exports = async (req, res) => {
  try {
    await ensureSchema();
    const sql = sqlClient();
    const rows = await sql.query("SELECT * FROM blog_posts WHERE slug=$1 AND status='published' LIMIT 1", [String(req.query?.slug || '')]);
    if (!rows[0]) {
      res.statusCode = 404;
      return res.end('Article not found');
    }
    const post = mapPost(rows[0]);
    const related = await sql.query("SELECT * FROM blog_posts WHERE status='published' AND id<>$1 ORDER BY (category=$2) DESC, published_at DESC NULLS LAST LIMIT 3", [post.id, post.category]);
    const html = renderArticle(post, related.map(mapPost), { prefix: '/', sanitize: sanitizeContent, origin: SITE_URL });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.end(html);
  } catch {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Article service is temporarily unavailable.');
  }
};

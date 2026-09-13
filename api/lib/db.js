'use strict';

const { Pool } = require('pg');
const crypto = require('node:crypto');
const seedPosts = require('../../data/blog-posts.json');
let schemaReady;
let pool;
function sqlClient() { 
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('Database is not configured.'), { status: 503 }); 
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  return { query: async (text, params) => (await pool.query(text, params)).rows };
}
async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const sql = sqlClient();
    await sql.query(`CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await sql.query(`CREATE TABLE IF NOT EXISTS blog_posts (id UUID PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, excerpt TEXT NOT NULL DEFAULT '', content_html TEXT NOT NULL, featured_image TEXT NOT NULL DEFAULT '', image_alt TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'Journal', tags JSONB NOT NULL DEFAULT '[]', author TEXT NOT NULL DEFAULT 'Ritesh Singh', status TEXT NOT NULL CHECK (status IN ('draft','published')), seo_title TEXT NOT NULL DEFAULT '', meta_description TEXT NOT NULL DEFAULT '', focus_keyword TEXT NOT NULL DEFAULT '', canonical_url TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), published_at TIMESTAMPTZ)`);
    await sql.query(`CREATE TABLE IF NOT EXISTS media (id UUID PRIMARY KEY, url TEXT UNIQUE NOT NULL, pathname TEXT, filename TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, alt_text TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await sql.query(`CREATE TABLE IF NOT EXISTS contact_events (id UUID PRIMARY KEY, ip_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await sql.query(`CREATE TABLE IF NOT EXISTS login_events (id UUID PRIMARY KEY, ip_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    for (const post of seedPosts) await sql.query(`INSERT INTO blog_posts (id,title,slug,excerpt,content_html,featured_image,image_alt,category,tags,author,status,seo_title,meta_description,focus_keyword,canonical_url,created_at,updated_at,published_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT (slug) DO NOTHING`, [post.id||crypto.randomUUID(),post.title,post.slug,post.excerpt,post.contentHtml,post.featuredImage,post.imageAlt,post.category,JSON.stringify(post.tags||[]),post.author||'Ritesh Singh',post.status,post.seoTitle||post.title,post.metaDescription||post.excerpt,post.focusKeyword||'',post.canonical||'',post.date,post.updated||post.date,post.status==='published'?(post.publishedAt||post.date):null]);
    return true;
  })().catch(error => { schemaReady = null; throw error; });
  return schemaReady;
}
const mapPost = row => row && ({ id:row.id,title:row.title,slug:row.slug,excerpt:row.excerpt,contentHtml:row.content_html,featuredImage:row.featured_image,imageAlt:row.image_alt,category:row.category,tags:row.tags||[],author:row.author,status:row.status,seoTitle:row.seo_title,metaDescription:row.meta_description,focusKeyword:row.focus_keyword,canonical:row.canonical_url,date:(row.published_at||row.created_at)?.toISOString?.().slice(0,10)||'',updated:row.updated_at?.toISOString?.().slice(0,10)||'',publishedAt:row.published_at});
module.exports = { sqlClient, ensureSchema, mapPost };

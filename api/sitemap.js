'use strict';
const { ensureSchema,sqlClient }=require('./lib/db');
const { SITE_URL }=require('./lib/core');
module.exports=async(req,res)=>{ try{await ensureSchema();const rows=await sqlClient().query(`SELECT slug,updated_at FROM blog_posts WHERE status='published' ORDER BY updated_at DESC`);const urls=['','blog/','instagram-videos/',...rows.map(row=>`blog/${row.slug}`)].map((path,index)=>`<url><loc>${SITE_URL}/${path}</loc><lastmod>${index<3?new Date().toISOString().slice(0,10):rowDate(rows[index-3])}</lastmod></url>`).join('');res.setHeader('Content-Type','application/xml; charset=utf-8');res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=3600');res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);}catch{res.statusCode=503;res.end('Sitemap unavailable');}};
function rowDate(row){return row?.updated_at?.toISOString?.().slice(0,10)||new Date().toISOString().slice(0,10);}

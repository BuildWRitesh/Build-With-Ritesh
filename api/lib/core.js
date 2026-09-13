'use strict';

const sanitizeHtml = require('sanitize-html');

const SITE_URL = String(process.env.APP_URL || 'https://buildwithritesh.com').replace(/\/$/, '');
const allowedOrigins = () => new Set([SITE_URL, 'http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000']);
const text = (value, max = 1000) => String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
const slugify = value => text(value, 180).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
const safeUrl = (value, fallback = '') => { try { const url = new URL(text(value, 2000)); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : fallback; } catch { return fallback; } };
const sanitizeContent = html => sanitizeHtml(String(html || ''), {
  allowedTags: ['p','h2','h3','h4','strong','b','em','i','u','s','ul','ol','li','blockquote','a','img','figure','figcaption','table','thead','tbody','tr','th','td','pre','code','br','hr','div','span'],
  allowedAttributes: { a: ['href','target','rel','title'], img: ['src','alt','width','height','loading'], '*': ['class','style'] },
  allowedStyles: { '*': { 'text-align': [/^(left|right|center|justify)$/], 'float': [/^(left|right|none)$/] } },
  allowedSchemes: ['http','https','mailto'], transformTags: { a: (tag, attrs) => ({ tagName: tag, attribs: attrs.target === '_blank' ? { ...attrs, rel: 'noopener noreferrer' } : attrs }) }
});
function json(res, status, payload, headers = {}) { res.statusCode = status; for (const [key,value] of Object.entries({ 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers })) res.setHeader(key,value); res.end(JSON.stringify(payload)); }
function sameOrigin(req) { const origin = req.headers.origin; if (!origin) return true; const hostOrigin=`https://${req.headers.host||''}`; return allowedOrigins().has(origin)||origin===hostOrigin||origin===`http://${req.headers.host||''}`; }
function body(req) { return req.body && typeof req.body === 'object' ? req.body : {}; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
module.exports = { SITE_URL, text, slugify, safeUrl, sanitizeContent, json, sameOrigin, body, escapeHtml };

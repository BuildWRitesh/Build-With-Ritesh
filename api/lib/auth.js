'use strict';

const crypto = require('node:crypto');
const { sqlClient, ensureSchema } = require('./db');
const COOKIE = 'portfolio_admin';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const secret = () => { if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw Object.assign(new Error('Authentication is not configured.'), { status:503 }); return process.env.AUTH_SECRET; };
const sign = value => crypto.createHmac('sha256', secret()).update(value).digest('base64url');
function hashPassword(password, { N = 16384, r = 8, p = 1, salt = crypto.randomBytes(16) } = {}) {
  const derived = crypto.scryptSync(String(password), salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${derived.toString('hex')}`;
}
function parseCookies(req) { return Object.fromEntries(String(req.headers.cookie||'').split(';').map(item=>item.trim().split(/=(.*)/s)).filter(parts=>parts[0]).map(([k,v])=>[k,decodeURIComponent(v||'')])); }
function issueSession(res, user) { const payload=encode({sub:user.id,email:user.email,csrf:crypto.randomBytes(24).toString('base64url'),exp:Date.now()+8*60*60*1000}); const token=`${payload}.${sign(payload)}`; res.setHeader('Set-Cookie',`${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`); return JSON.parse(Buffer.from(payload,'base64url')); }
function clearSession(res) { res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`); }
function session(req) { const token=parseCookies(req)[COOKIE]; if (!token) return null; const [payload,signature]=token.split('.'); if (!payload||!signature) return null; const expected=sign(payload); if (signature.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) return null; try { const data=JSON.parse(Buffer.from(payload,'base64url')); return data.exp>Date.now()?data:null; } catch { return null; } }
function requireAdmin(req, {csrf=false}={}) { const current=session(req); if(!current) throw Object.assign(new Error('Authentication required.'),{status:401}); if(csrf && req.headers['x-csrf-token']!==current.csrf) throw Object.assign(new Error('Invalid security token.'),{status:403}); return current; }
async function bootstrapAdmin() { await ensureSchema(); const email=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase(); const hash=String(process.env.ADMIN_PASSWORD_HASH||''); if(!email||!hash) return; const sql=sqlClient(); const rows=await sql.query('SELECT COUNT(*)::int AS count FROM users'); if(rows[0]?.count) return; await sql.query(`INSERT INTO users (id,email,password_hash) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING`,[crypto.randomUUID(),email,hash]); }
function verifyPassword(password, encoded) { const parts=String(encoded||'').split('$'); if(parts.length!==6||parts[0]!=='scrypt') return false; try { const N=Number(parts[1]),r=Number(parts[2]),p=Number(parts[3]),salt=Buffer.from(parts[4],'hex'),expected=Buffer.from(parts[5],'hex'); const actual=crypto.scryptSync(String(password),salt,expected.length,{N,r,p,maxmem:64*1024*1024}); return crypto.timingSafeEqual(actual,expected); } catch { return false; } }
module.exports = { issueSession, clearSession, session, requireAdmin, bootstrapAdmin, verifyPassword, hashPassword };

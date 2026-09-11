'use strict';
const crypto = require('node:crypto');
const { Resend } = require('resend');
const { ensureSchema, sqlClient } = require('./lib/db');
const { json, sameOrigin, body, text } = require('./lib/core');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' }, { Allow: 'POST' });
    if (!sameOrigin(req)) return json(res, 403, { error: 'Origin rejected.' });
    if (!process.env.RESEND_API_KEY || !process.env.CONTACT_FROM_EMAIL) return json(res, 503, { error: 'Contact delivery is not configured.' });
    const input = body(req);
    if (input.website) return json(res, 200, { ok: true });
    const name = text(input.name, 100);
    const email = text(input.email, 200);
    const project = text(input.project, 100);
    const message = text(input.message, 5000);
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || message.length < 10) return json(res, 400, { error: 'Please provide a valid name, email and message.' });
    await ensureSchema();
    const sql = sqlClient();
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0];
    const hash = crypto.createHash('sha256').update(`${process.env.AUTH_SECRET || 'contact'}:${ip}`).digest('hex');
    const recent = await sql.query(`SELECT COUNT(*)::int AS count FROM contact_events WHERE ip_hash=$1 AND created_at>NOW()-INTERVAL '1 hour'`, [hash]);
    if (recent[0].count >= 5) return json(res, 429, { error: 'Too many messages. Please try again later.' });
    await sql.query('INSERT INTO contact_events (id,ip_hash) VALUES ($1,$2)', [crypto.randomUUID(), hash]);
    const resend = new Resend(process.env.RESEND_API_KEY);
    const delivery = await resend.emails.send({
      from: process.env.CONTACT_FROM_EMAIL,
      to: process.env.CONTACT_TO_EMAIL || 'buildwritesh@gmail.com',
      replyTo: email,
      subject: `Portfolio enquiry from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nProject: ${project || 'Not specified'}\n\n${message}`
    });
    if (delivery.error) throw new Error(delivery.error.message || 'Email delivery failed.');
    return json(res, 200, { ok: true, message: 'Thanks — your message has been sent.' });
  } catch (error) {
    return json(res, error.status || 500, { error: error.status ? error.message : 'Your message could not be sent. Please email buildwritesh@gmail.com.' });
  }
};

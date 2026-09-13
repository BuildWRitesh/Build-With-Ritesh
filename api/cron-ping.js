'use strict';
const { sqlClient } = require('./lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Method not allowed');
  }

  // Security: If Vercel CRON_SECRET is set, require it.
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.statusCode = 401;
    return res.end('Unauthorized');
  }

  try {
    const sql = sqlClient();
    // A lightweight query to wake up the database
    await sql.query('SELECT 1');
    res.statusCode = 200;
    res.end('Database pinged successfully.');
  } catch (error) {
    res.statusCode = 500;
    res.end('Ping failed.');
  }
};

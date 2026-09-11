'use strict';

const readline = require('node:readline');
const { hashPassword } = require('../admin-server');

function promptForPassword() {
  if (process.env.ADMIN_PASSWORD) return Promise.resolve(process.env.ADMIN_PASSWORD);
  if (!process.stdin.isTTY) {
    return new Promise((resolve, reject) => {
      let input = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', chunk => { input += chunk; });
      process.stdin.on('end', () => resolve(input.trimEnd()));
      process.stdin.on('error', reject);
    });
  }
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve, reject) => {
    terminal.question('Admin password: ', answer => {
      terminal.close();
      process.stdout.write('\n');
      if (!answer) reject(new Error('A password is required.'));
      else resolve(answer);
    });
  });
}

promptForPassword()
  .then(password => {
    if (String(password).length < 12) throw new Error('Use an admin password with at least 12 characters.');
    process.stdout.write(`${hashPassword(password)}\n`);
  })
  .catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });

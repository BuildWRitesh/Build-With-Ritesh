const fs = require('node:fs');
const path = require('node:path');

const projectRoot = __dirname;
const outputDirectory = path.join(projectRoot, 'dist');
const productionFiles = [
  'index.html',
  'style.css',
  'script.js',
  'resume.html',
  'assets'
];

if (path.dirname(outputDirectory) !== projectRoot || path.basename(outputDirectory) !== 'dist') {
  throw new Error('Refusing to build outside the project dist directory.');
}

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });

for (const relativePath of productionFiles) {
  const source = path.join(projectRoot, relativePath);
  const destination = path.join(outputDirectory, relativePath);
  fs.cpSync(source, destination, { recursive: true });
}

console.log(`Production site built at ${outputDirectory}`);

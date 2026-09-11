const fs = require('node:fs');
const path = require('node:path');

const projectRoot = __dirname;
const outputDirectory = path.join(projectRoot, 'dist');
const productionFiles = [
  'index.html',
  'style.css',
  'script.js',
  'assets/branding',
  'assets/fonts',
  'assets/profile',
  'assets/projects/cmt-tools.jpg',
  'assets/projects/patna-resort.jpg',
  'assets/projects/ojas.svg',
  'assets/projects/avadeti.svg',
  'assets/projects/matra-consultancy.svg',
  'assets/projects/spotlighters-post.svg',
  'assets/projects/vivarya.svg',
  'assets/projects/lb-expression.svg',
  'assets/projects/eera.svg',
  'assets/projects/es-internship.svg',
  'assets/projects/innosyte.png',
  'assets/projects/dleaftech.jpg',
  'assets/resume',
  'assets/vendor'
];
const optionalFiles = ['robots.txt', 'sitemap.xml', '.nojekyll', 'site.webmanifest'];

if (path.dirname(outputDirectory) !== projectRoot || path.basename(outputDirectory) !== 'dist') {
  throw new Error('Refusing to build outside the project dist directory.');
}

for (const relativePath of productionFiles) {
  const source = path.join(projectRoot, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Required production file is missing: ${relativePath}`);
  }
}

// The generated dist folder is the only directory this build may replace.
fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });

for (const relativePath of [...productionFiles, ...optionalFiles]) {
  const source = path.join(projectRoot, relativePath);
  if (!fs.existsSync(source)) continue;
  const destination = path.join(outputDirectory, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

console.log(`Production site built at ${outputDirectory}`);

const fs = require('node:fs');
const path = require('node:path');
const { generateBlogPages } = require('./scripts/generate-blog');

const projectRoot = __dirname;
const outputDirectory = path.join(projectRoot, 'dist');
const productionFiles = [
  'index.html',
  'style.css',
  'content.css',
  'script.js',
  'blog',
  'instagram-videos',
  'admin',
  'services',
  'contact',
  'data/instagram-videos.json',
  'assets/blog',
  'assets/branding',
  'assets/fonts',
  'assets/profile',
  'assets/projects/cmt-tools.svg',
  'assets/projects/patna-resort.svg',
  'assets/projects/ojas.svg',
  'assets/projects/avadeti.svg',
  'assets/projects/matra-consultancy.svg',
  'assets/projects/spotlighters-post.svg',
  'assets/projects/vivarya.svg',
  'assets/projects/lb-expression.svg',
  'assets/projects/eera.svg',
  'assets/projects/es-internship.svg',
  'assets/projects/innosyte.svg',
  'assets/projects/dleaftech.svg',
  'assets/resume',
  'assets/vendor'
];
const optionalFiles = ['robots.txt', 'sitemap.xml', '.nojekyll', 'site.webmanifest'];

// Article pages are generated from the editable JSON content before the
// production allowlist is copied. This keeps static hosting and the admin API
// on the same deterministic content source.
generateBlogPages({ root: projectRoot });
require('./scripts/generate-services').generateServicePages();

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

// Keep local source URLs stable while allowing Vercel production metadata to
// follow the assigned custom or project domain.
const configuredSiteUrl = String(process.env.APP_URL || '').replace(/\/$/, '');
if (configuredSiteUrl && /^https:\/\//.test(configuredSiteUrl) && configuredSiteUrl !== 'https://buildwritesh.github.io') {
  const replaceOrigin = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) replaceOrigin(file);
      else if (entry.isFile() && ['.html', '.xml', '.json', '.webmanifest'].includes(path.extname(entry.name))) {
        const source = fs.readFileSync(file, 'utf8');
        fs.writeFileSync(file, source.replaceAll('https://buildwritesh.github.io', configuredSiteUrl), 'utf8');
      }
    }
  };
  replaceOrigin(outputDirectory);
}

console.log(`Production site built at ${outputDirectory}`);

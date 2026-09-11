# Ritesh Singh — Personal Portfolio

The professional portfolio of **Ritesh Singh**, a web developer and digital marketer with **4+ years of professional experience**. The website connects his background in WordPress development with Google Ads, Meta Ads, SEO, social media marketing, landing page optimisation and performance reporting.

Live address: [buildwritesh.github.io](https://buildwritesh.github.io/)

## Stack

Semantic HTML, responsive CSS and plain JavaScript, with locally hosted GSAP and ScrollTrigger for subtle scroll animation. Manrope, Syne and DM Mono are self-hosted with their font licenses. Node.js built-ins provide development, validation and production build tools; the server uses sanitize-html to validate rich article markup. No additional browser library is loaded.

## Brand system

The supplied Build With Ritesh logo is the source of the visual system and is used directly in the header, mobile navigation, professional-presence section, footer, favicon, manifest icon and social preview. Its measured palette is documented in the CSS tokens:

- `--brand-primary: #0c192c` (deep navy)
- `--brand-secondary: #202c3b` (navy support)
- `--brand-accent: #03a099` (teal mark)
- `--brand-highlight: #64b9b6` (pale teal mark)
- `--brand-background: #f5f7f4` and `--brand-surface: #e7f0ee`
- `--brand-text`, `--brand-muted` and `--brand-border` for readable supporting states

The primary text/background pairing measures 16.37:1, while navy with the pale teal highlight measures 7.69:1. The brighter teal is reserved for large highlights, rules and actions; `--brand-accent-ink` is used for small text where a darker accessible shade is needed.

## Local development

Use Node.js 20 or newer and run commands from the repository root:

```sh
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173). Public routes include `/blog/`, `/blog/<article-slug>/` and `/instagram-videos/`. The page also works as a static document with JavaScript disabled. The development server intentionally serves website files only.

## Journal and content dashboard

The journal is driven by `data/blog-posts.json`. Five experience-led articles are generated into `blog/<slug>/index.html` during a build, so the public articles work on static hosting and keep their canonical, Open Graph and `BlogPosting` metadata. The listing fetches published content from `/api/posts` when the content server is present and falls back to the generated published-only blog/posts.json for static hosting. Drafts never appear in the public listing.

The protected editor runs with the Node content server:

```sh
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD_HASH="scrypt$..."
npm run admin
```

Create a scrypt hash without putting a password in source control:

```sh
"a long password of at least 12 characters" | npm run admin:hash
```

The dashboard is available at [localhost:8787/admin/](http://localhost:8787/admin/). It supports login/logout, draft and published states, post search, categories, featured-image uploads, a semantic rich-text editor, source HTML mode and SEO fields. Credentials, sessions and uploads are handled server-side; the browser never receives the password or a password hash. Set `BLOG_DATA_FILE` when running an isolated content store for a preview or test.

The Instagram page uses `/api/instagram-videos` when `INSTAGRAM_ACCESS_TOKEN` and `INSTAGRAM_USER_ID` are supplied to the Node server. The token stays in the server environment. Without an approved Instagram Graph API configuration, the page shows an honest empty state linked to [@buildwritesh](https://www.instagram.com/buildwritesh/) and never invents media.

## Build and verify

```sh
npm run check
npm run build
npm test
npm run preview
```

The build writes deployable files to `dist/`. Production preview serves that directory at [localhost:4173](http://localhost:4173). `PORT` can override either server’s default port.

Validation covers asset paths and filename casing, internal anchors, previous identity removal, SEO metadata, JSON-LD, article schemas and content, the resume PDF, production output freshness and HTTP behaviour of the source and production servers. The HTTP checks cover public blog/Instagram/admin shells, PDF downloads, HEAD requests, unknown files, malformed URLs and traversal attempts. Use the Node admin server smoke tests for session, CRUD, upload and Instagram proxy behaviour.

## Deployment

- **GitHub Pages:** the portfolio, generated journal and Instagram empty state are static and can continue using the existing Pages publishing source; root assets and `.nojekyll` support branch-based deployment. GitHub Pages cannot execute the secure Node admin API or proxy an Instagram token, so run `npm run admin` on a Node host (or deploy the server/API separately) and provide its environment variables. An Actions workflow can alternatively publish `dist/`.
- **Vercel:** retain an empty Root Directory. The existing `vercel.json` runs `npm run build` and publishes `dist/`.
- The canonical URL, sitemap and social metadata target `https://buildwritesh.github.io/`. Update them together if the public domain changes.

## Content and maintenance

The page includes an introduction, professional background, career timeline, education and certifications, services and skills, a filterable portfolio of twelve supplied project links, professional profiles, resume download, direct contact links and a responsive contact form. The form prepares a prefilled email to `buildwritesh@gmail.com`; no contact data is stored by this static site.

The downloadable resume is served as `assets/resume/Ritesh_Singh_Resume.pdf`. Replace that file whenever a new approved PDF is supplied, then rebuild and validate. Website social links use the owner’s supplied current handles; an older resume may contain a different LinkedIn handle.

Career dates and education follow the resume. Historical portfolio projects are attributed only to their documented scope. Source priority, exclusions and unresolved differences are recorded in [the content provenance document](docs/content-sources.md).

## File map

| Path | Purpose |
| --- | --- |
| `index.html` | Portfolio content, metadata and structured data |
| `style.css` | Typography, responsive layout and accessibility styles |
| `script.js` | Accessible mobile navigation and optional GSAP animation |
| `content.css` | Shared editorial, article and social-page layout styles |
| `blog/index.html`, `blog/blog.js` | Journal listing, search and category filters |
| `blog/<slug>/index.html` | Generated SEO article pages with related reading and sharing |
| `blog/article.js` | Article link-sharing interaction |
| `data/blog-posts.json` | Editable article records and semantic HTML content |
| `data/instagram-videos.json` | Verified Instagram feed fallback (empty until configured) |
| `instagram-videos/` | Public verified Instagram video grid and states |
| `admin/` | Protected login, post dashboard and rich editor shell |
| `admin-server.js` | Node auth, post CRUD, upload and Instagram proxy API |
| `scripts/generate-blog.js` | Deterministic article-page generator and HTML sanitizer |
| `scripts/create-admin-hash.js` | Password hash utility; reads password from stdin |
| `admin/admin.css`, `admin/admin.js` | Dashboard layout and editor behaviour |
| `assets/branding/` | Supplied logo, favicon derivative and social preview |
| `assets/profile/` | Profile photography |
| `assets/resume/Ritesh_Singh_Resume.pdf` | Downloadable source resume |
| `assets/projects/` | Verified project previews, live-page captures and branded SVG project covers |
| `assets/fonts/` | Local fonts and licenses |
| `assets/vendor/` | Existing GSAP and ScrollTrigger distributions |
| `scripts/validate.js` | Static and HTTP validation |
| `build.js`, `server.js` | Build, development and preview tooling |
| `robots.txt`, `sitemap.xml`, `.nojekyll`, `site.webmanifest` | Search, installable icon and static hosting support |

## Official profiles

[LinkedIn](https://in.linkedin.com/in/buildwithritesh) · [Build With Ritesh on LinkedIn](https://in.linkedin.com/company/buildwithritesh) · [Instagram](https://www.instagram.com/buildwritesh/) · [Facebook](https://www.facebook.com/buildwithritesh/)

The homepage includes an accessible command panel (whoami, skills, projects, contact and help). Alt+T focuses the command input; the optional source command reveals a short implementation note. Motion respects reduced-motion preferences.

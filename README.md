# Ritesh Singh — Personal Portfolio

The professional portfolio of **Ritesh Singh**, a web developer and digital marketer with **4+ years of professional experience**. The website connects his background in WordPress development with Google Ads, Meta Ads, SEO, social media marketing, landing page optimisation and performance reporting.

Production target: Vercel. Set `APP_URL` to the assigned Vercel domain or custom domain before launch.

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

## Full-stack journal and content dashboard

In Vercel production, Neon-compatible Postgres is the source of truth. The schema is created on first server request and the five reviewed articles in `data/blog-posts.json` seed an empty database. Public queries filter for published posts, dynamic article responses generate canonical/Open Graph/Twitter metadata and `BlogPosting` schema, and `/api/sitemap` includes published slugs only. Static generated articles remain as a local/offline fallback.

Generate the initial scrypt credential hash locally:

```sh
"a long password of at least 12 characters" | npm run admin:hash
```

The dashboard at `/admin/` uses signed, expiring HTTP-only cookies, SameSite protection, origin checks and a per-session CSRF token. Every mutation verifies the session server-side. Passwords remain scrypt hashes. The editor supports draft/publish states, CRUD, search, categories, Blob-backed image uploads, semantic rich text, source mode and SEO fields. Article HTML is sanitized on the server before Postgres storage.

The Instagram page uses `/api/instagram-videos` when `INSTAGRAM_ACCESS_TOKEN` and `INSTAGRAM_USER_ID` are supplied to the Vercel environment. The token stays in the server function and is sent to Meta in an authorization header. Without an approved Instagram Graph API configuration, the page shows an honest empty state linked to [@buildwritesh](https://www.instagram.com/buildwritesh/) and never invents media.

## Build and verify

```sh
npm run check
npm run build
npm test
npm run preview
```

The build writes deployable files to `dist/`. Production preview serves that directory at [localhost:4173](http://localhost:4173). `PORT` can override either server’s default port.

Validation covers asset paths and filename casing, internal anchors, previous identity removal, SEO metadata, JSON-LD, article schemas and content, the resume PDF, production output freshness and HTTP behaviour of the source and production servers. The HTTP checks cover public blog/Instagram/admin shells, PDF downloads, HEAD requests, unknown files, malformed URLs and traversal attempts. Use the Node admin server smoke tests for session, CRUD, upload and Instagram proxy behaviour.

## Vercel deployment

Import this repository into Vercel with an empty Root Directory. `vercel.json` builds the unchanged public frontend into `dist/`, deploys the Node functions in `api/`, and rewrites dynamic blog articles, the sitemap and protected admin routes.

Create a Neon database and Vercel Blob store, verify a sending domain in Resend, and add every value listed in `.env.example` to the Vercel Production environment. Generate `AUTH_SECRET` with at least 32 cryptographically random characters. `ADMIN_PASSWORD_HASH` must be produced by `npm run admin:hash`; never enter the plain password in Vercel or source control. The Instagram variables require an approved professional Instagram account and a valid long-lived Graph API token.

After variables are configured, redeploy and verify `/api/posts`, `/api/sitemap`, `/admin/`, a dashboard publish flow, an image upload, Instagram media and a real contact submission. Missing database, Blob, Instagram or Resend credentials return explicit service states; the implementation does not pretend an integration is live.

## Content and maintenance

The page includes an introduction, professional background, career timeline, education and certifications, services and skills, a filterable portfolio of twelve supplied project links, professional profiles, resume download, direct contact links and a responsive contact form. In production the form validates server-side, applies an IP-based hourly limit and sends through Resend to `buildwritesh@gmail.com`.

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
| `api/` | Vercel functions for Postgres content, authentication, Blob media, Instagram, contact delivery, articles and sitemap |
| `.env.example` | Required production configuration placeholders; contains no credentials |
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

Shared page styling lives in `style.css`, with editorial layouts in `content.css` and dashboard layouts in `admin/admin.css`. The static generator and Vercel article endpoint share the same article template, including navigation, metadata, related reading and interaction hooks. The runtime passes its configured application origin into the renderer.

Pointer spotlights, magnetic buttons and the custom cursor run only with a fine pointer above 980px and without reduced motion. Internal public-page transitions last 300ms; modified clicks, downloads, external links and admin editing retain normal browser behaviour. Scroll reveals supplement the existing GSAP system, and the header and progress indicator use scheduled scroll updates.

The visual refinement was checked across 12 page/layout states at 13 widths from 320px to 1680px, including tablet widths 768/820/834/1024px. Browser checks covered overflow, rendered images, terminal commands, project filters, mobile navigation, Back navigation, reduced motion and touch cursor behaviour. Dashboard and populated Instagram layouts used local test fixtures; contact success/error tests used mocked delivery. These checks do not establish live database, Instagram, storage or email connectivity. `npm run build` and `npm test` validate the source and both development and production-preview resources.

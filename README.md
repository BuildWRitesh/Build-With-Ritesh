# Siya Gupta — Portfolio Website

A responsive, single-page portfolio built with plain HTML, CSS, JavaScript, GSAP and ScrollTrigger.

## Preview

Open `index.html` directly in a modern browser. No installation or build command is required.

For a local development server, run this command from the `website` folder:

```powershell
npm run dev
```

Then visit `http://localhost:5173`.

## Production build

```powershell
npm run build
```

The deployable static website is written to `dist/`. Vercel is configured through `vercel.json` to run this command and serve that directory.

For a Vercel Git deployment, keep the project **Root Directory empty** because `index.html`, `package.json`, and `vercel.json` are already at the repository root. The committed configuration supplies the build command and output directory automatically.

## Files

- `index.html` — page structure and portfolio copy
- `style.css` — visual system and responsive layout
- `script.js` — GSAP animation and interactions
- `assets/` — analytics screenshots, local GSAP files and favicon

# Land Master

A 100% static, client-only React GIS SPA. Enter a U.S. property address, select it from Google Places Autocomplete, and see:

- The property on Google Maps
- Its U.S. Census tract boundary
- FEMA flood-zone attributes and polygon
- A survey-instrument-styled readout panel with independent per-source loading/error states

No backend, no proxy, no serverless functions — every API call (Google Maps/Places, Census Geocoder via JSONP, TIGERweb, FEMA NFHL) is made directly from the browser.

## Project structure

```
Land-Master/
├── .github/workflows/deploy.yml   # GitHub Actions → GitHub Pages
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── AddressSearch.jsx      # Google Places Autocomplete input
│   │   ├── MapView.jsx            # Map, marker, tract/flood layers, FEMA tile overlay
│   │   ├── LayerControls.jsx      # Independent layer toggles
│   │   ├── MapLegend.jsx          # Flood zone color legend
│   │   └── ReadoutPanel.jsx       # Property / Flood / Census tract readout
│   ├── services/
│   │   ├── jsonp.js               # Reusable JSONP helper
│   │   ├── censusGeocoder.js      # Census Geocoder (JSONP)
│   │   ├── tigerweb.js            # TIGERweb tract polygon (fetch)
│   │   └── fema.js                # FEMA NFHL Layer 28 (fetch, GET only)
│   ├── utils/
│   │   └── addressParser.js       # Google Places → street/city/state/zip
│   ├── styles/
│   │   └── app.css
│   ├── App.jsx
│   └── main.jsx
├── .env.example
├── index.html
├── package.json
└── vite.config.js
```

## Local setup

```bash
npm install
cp .env.example .env
# edit .env and set VITE_GOOGLE_MAPS_API_KEY=your_key
npm run dev
```

Open `http://localhost:5173/Land-Master/`.

- Type a partial address → Places Autocomplete suggestions should appear.
- Select a suggestion → the readout panel's Census/TIGERweb/FEMA rows go Loading → Complete. In DevTools Network tab, the Census request is a `<script>` GET to `geocoding.geo.census.gov` (JSONP, not fetch/XHR) — no proxy, no backend involved.
- TIGERweb and FEMA calls appear as normal `fetch` requests.

```bash
npm run build
npm run preview   # serve dist/ locally at http://localhost:4173/Land-Master/
```

## Google Maps API key

In Google Cloud Console → APIs & Services → Credentials:

1. Create/select an API key.
2. Enable **Maps JavaScript API** and **Places API**.
3. Under **Application restrictions → HTTP referrers**, allow:
   - `http://localhost:*`
   - `https://sridevikovvuri.github.io/*`
4. Never commit the key. `.env` is git-ignored; only `.env.example` (placeholder) is committed. Vite embeds `VITE_`-prefixed variables into the client bundle **at build time** — this is expected for a static SPA, which is why the key must be referrer-restricted.

## GitHub repository secret

Repo → **Settings → Secrets and variables → Actions → New repository secret**

- Name: `VITE_GOOGLE_MAPS_API_KEY`
- Value: your key

## GitHub Pages deployment

1. Repo → **Settings → Pages → Source = GitHub Actions** (one-time setup).
2. Push to `main` — `.github/workflows/deploy.yml` builds and deploys `dist/` automatically via `actions/deploy-pages`.
3. Monitor the run under the **Actions** tab. Once green, the app is live at `https://sridevikovvuri.github.io/Land-Master/`.

Note: this workflow uses `npm install` rather than `npm ci` because `package-lock.json` isn't committed.

## Testing/verification checklist

- [ ] High flood-risk address (e.g. a New Orleans riverfront address in Zone AE) → FEMA polygon renders, `SFHA_TF` populated, status chip shows **In SFHA**.
- [ ] Minimal-risk inland address → no FEMA polygon, no crash, chip shows **Outside mapped SFHA**.
- [ ] Any valid U.S. address → Census GEOID, tract name, state/county populate; tract boundary renders.
- [ ] Partial address text does **not** trigger a lookup; only selecting an Autocomplete suggestion does.
- [ ] Census request is JSONP (`<script>` tag), not `fetch`/XHR — confirm in Network tab.
- [ ] Simulate one source failing (e.g. block a domain) → the other two sources still populate; no crash.
- [ ] ~375px viewport → no horizontal scroll, readout becomes a bottom sheet, controls stay usable.
- [ ] `https://sridevikovvuri.github.io/Land-Master/` loads with working CSS/JS/map, and a hard refresh doesn't break asset paths (thanks to `404.html`).

## Architecture constraints (all satisfied)

No backend · no Express · no proxy · no serverless functions · static `dist/` build · React 18 · Vite · plain JavaScript (no TypeScript) · `@vis.gl/react-google-maps` · plain CSS · Census Geocoder via JSONP · TIGERweb via `fetch` · FEMA via GET requests, Layer 28, `x=longitude`/`y=latitude` · independent per-source loading/error states · API key never committed and referrer-restricted · key injected at GitHub Actions build time from a repo secret · Vite `base: '/Land-Master/'` · deployment via `actions/deploy-pages`.

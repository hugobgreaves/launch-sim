# Launch Speed Simulator

Static, self-contained educational web app (no build step, no CDN — all assets in `vendor/`).

- `index.html`, `style.css` — UI (dark theme, desktop sidebar / phone bottom sheet)
- `sim.js` — vehicle presets + simplified flight-profile models (great-circle maths, cruise profiles,
  2-D point-mass ballistic arc, kinematic orbital ascent + circular-orbit coast)
- `catalog.js` — named-vehicle catalogue (54 entries, rounded public figures), operator countries, alliance groupings, enforced max ranges, rated speed/apogee scaling
- `bases.js` — 81 widely publicised major bases/test ranges (12 countries, incl. overseas bases)
- `app.js` — globe.gl rendering, searchable vehicle picker, controls, playback loop, Starship booster trail
- `vendor/` — globe.gl 2.46.2 (bundles three.js), Natural Earth 110m country outlines, Earth textures

Run: `python3 -m http.server 8090` in this folder, open http://localhost:8090/

URL parameters (shareable state): `from`, `to` (place id or `lat,lng`), `a`, `b` (preset id),
`compare=0|1`, `speed`, `exag`, `t` (start time, s), `autoplay=1`.

Figures are approximate public values for generic vehicle classes; physics is simplified
(non-rotating spherical Earth, no drag/weather). For education only.

URL `from` also accepts base ids, e.g. `from=base:faslane`. Keys: Space, R, 1–4, C, V, F.

## Space missions mode (v5)
Toggle **🪐 Space missions** in the top bar (or open `?mode=space&target=mars|moon`). Starship only for now.
- `vendor/astronomy.browser.min.js` – astronomy-engine 2.1.19 (MIT), real Earth/Moon/Mars ephemerides, offline.
- `space-core.js` – Lambert solver (universal variables), Kepler propagation, Mars porkchop search (Type I/II), Moon TLI/LOI profile, orbital-refuelling estimate (rocket equation).
- `space.js` – heliocentric (Mars) / geocentric (Moon) canvas views, close-up insets, playback, windows UI, share URL (`dep`, `tof`).
- Validated at dev time against NASA JPL Horizons (positions) and NASA/TM-2010-216764 (Mars window C3/dates).
- Simplifications: patched conics, no planetary gravity during transfer, no DSMs; refuelling, EDL and lunar descent are labelled estimates.

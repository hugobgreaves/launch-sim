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

## v6 polish ("v3" release)

- **Earth:** Blue Marble day texture, city lights on the night side, and a live day/night terminator from the current UTC sun position. Also a starfield, glowing trails, a launch burst and arrival pulses.
- **Launch:** a big LAUNCH button (`L`) with a skippable T-minus countdown, a cinematic fly-to camera and a liftoff plume. Optional WebAudio sound effects are off by default.
- **UX:** first-time guide (❔ Guide), collapsible sidebar sections, loading screen, Random scenario, and a results card with Copy share link. Space mode is lazy-loaded.
- **🛰 Starship cam (`C`):** a procedural three.js Super Heavy + Starship you can orbit and zoom. It's synced to the simulation's time, phase, altitude and speed.
  - **Pad and launch:** Starbase pad (tower with chopsticks), Raptor plumes with Mach diamonds, liftoff steam, and the plume expanding as the air thins.
  - **Climb and staging:** the sky darkens to space over the curved Earth. Hot staging, then the booster flips back, boosts back and is caught by the chopsticks.
  - **Space missions:** the ship's vacuum Raptors glow, and you see orbital refuelling with a tanker, Mars entry plasma and landings on Mars and the Moon.
  - **Loading and performance:** three.js is bundled in `vendor/three-bundle.min.js` and only loads when the cam is opened. Resolution adapts to keep the frame rate up.

## v7 upgrade ("v4" release)
- **3D rocket cam** (was the Starship cam; `starship-cam.js` + `cam-vehicles.js`, lazy-loaded): pick **Starship, Falcon 9, Saturn V or Electron** in the cam panel (it sets vehicle A and a matching launch site). Civilian space rockets only.
  - Falcon 9: 9 Merlins, grid fins, deployable landing legs, MVac with glowing nozzle, fairing separation, LC-39A pad with transporter-erector, and the **booster landing on a drone ship** (entry burn, landing burn, legs, animated ocean).
  - Saturn V: 5 F-1s with centre-engine cutoff, S-II (5 J-2) and S-IVB stages, LES jettison, mobile launcher + red umbilical tower with swing arms.
  - Electron: 9 Rutherfords, carbon-black stages, Mahia LC-1 strongback.
  - Starship: frost bands on the tanks that fade after liftoff, soot streaks, softer weld seams, landing legs for the Moon and Mars.
- **Plumes and effects:** fuel-specific exhaust colours (methalox, kerolox, hydrolox), sea-level → vacuum colour change and plume expansion, Mach diamonds, screen-space **heat haze** around the exhaust, HTML **lens flare** with an occlusion check, camera shake at liftoff, and sun-lit volumetric-looking steam puffs.
- **Real sun:** lighting matches the real sun position over the launch pad right now (low-precision solar ephemeris). Presets: Morning, Midday, Sunset and Night launch.
- **Moon and Mars landings:** cratered displaced terrain with rocks, plus engine dust kicked up below ~170 m (a fast grey sheet on the Moon, billowing red dust on Mars). The legs swing down and the ship lands standing on them.
- **Mission control** (📈 button or `M`): live altitude, speed and acceleration (g) graphs for runs A and B, a flight-director panel with status lights and the next event, and a clickable event timeline (space mode: distance and speed graphs).
- **Globe:** optional day/night-shaded cloud layer, smoother path rendering.
- **Quality setting:** Low, Medium or High, shared by the globe and the cam. It controls pixel ratio, bloom, haze, flare and particle budgets, on top of adaptive resolution.
- **Booster descent:** booster landings follow a physically shaped profile: free fall from apogee, an entry burn (≈70→40 km), a drag-limited fall, and a ~20 s landing burn down to 0 m/s.
- **Focus / clean view** (⛶ button or `H`): hides every panel, readout and label, leaving just the globe (or the 3D cam / space view) with the flight paths and moving vehicles. A tiny HUD shows speed, mission time and play/pause. Leave with `H`, `Esc` or ✕.
- **Phones** (`focus-mobile.js` plus the phone CSS block):
  - The globe fills the screen and is framed for portrait screens. Readouts become compact chips; tap one for full detail.
  - The controls live in a draggable bottom sheet (peek, half, full) that the globe resizes around, so it never covers the flight.
  - The launch bar rides above the sheet. Buttons are 40–48 px icon touch targets.
  - Pinch-zoom and drag work on the globe, the space view (new two-finger pinch) and the 3D cam.
  - The cam has a collapsible ⚙ Controls sheet that shifts the picture up so the rocket stays in view.
  - Phones default to Medium graphics quality.
  - Tested at 390×844 and 360×800.

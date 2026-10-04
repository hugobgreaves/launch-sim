/* 3D rocket cam (v7; started as the v6 Starship cam): procedurally-built PBR civilian launch vehicles – Starship,
   Falcon 9 (drone-ship landing), Saturn V and Electron – you can orbit and zoom, synced to the simulation's
   time / phase / altitude / speed, with the real sun position at the pad, heat haze, lens flare and Moon/Mars landings.
   Lazy-loaded ES module (three.js bundled in vendor/). Educational visual only – speed, altitude and flight phases. */
import * as THREE from './vendor/three-bundle.min.js';
import { buildFalcon9, buildSaturnV, buildElectron, buildPadLC39, buildPadLC1, buildDroneShip, buildTerrain, buildDust } from './cam-vehicles.js';
const { OrbitControls, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass } = THREE;

const G = window.__launchSim, Sim = window.LaunchSim;
const $ = id => document.getElementById(id);
const R_E = 6371000, R_MARS = 3389500, R_MOON = 1737400;
const PAD_H = 20;            // top of the orbital launch mount (m)
const BOOST_H = 69, RING_H = 2.2, SHIP_BASE = BOOST_H + RING_H, SHIP_LEN = 50.3;
const STACK_MID = 60, SHIP_MID = SHIP_BASE + 24, BOOST_MID = 36;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- procedural textures
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  if (opts.srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; return t;
}
let seed = 1234567; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function steelTextures() {
  // albedo variation + roughness + bump: horizontal weld rings every ~1.8 m, faint vertical seams, mottling
  const W = 512, H = 1024, rings = 18; // texture covers ~ 33 m of height (repeat set per mesh)
  const draw = (mode) => (x, w, h) => {
    x.fillStyle = mode === 'bump' ? '#808080' : mode === 'rough' ? '#5a5a5a' : '#d4d8dc'; x.fillRect(0, 0, w, h);
    seed = 99;
    for (let i = 0; i < 2600; i++) { // mottling / heat tint patches
      const px = rnd() * w, py = rnd() * h, r = 4 + rnd() * 30, a = rnd() * 0.06;
      x.fillStyle = mode === 'albedo' ? (rnd() < 0.5 ? `rgba(120,110,95,${a})` : `rgba(255,255,255,${a})`) : mode === 'rough' ? `rgba(${rnd() < .5 ? 0 : 255},${rnd() < .5 ? 0 : 255},${rnd() < .5 ? 0 : 255},${a * 1.5})` : `rgba(128,128,128,0)`;
      x.beginPath(); x.ellipse(px, py, r * 2.5, r * 0.6, 0, 0, 7); x.fill();
    }
    for (let i = 0; i < 400; i++) { // vertical brushed streaks
      const px = rnd() * w; x.fillStyle = mode === 'rough' ? `rgba(255,255,255,${rnd() * 0.08})` : `rgba(255,255,255,${rnd() * 0.04})`;
      x.fillRect(px, 0, 1 + rnd() * 2, h);
    }
    for (let k = 0; k <= rings; k++) { // weld rings
      const y = k * h / rings;
      if (mode === 'bump') { x.fillStyle = '#a0a0a0'; x.fillRect(0, y - 1.5, w, 3); x.fillStyle = '#707070'; x.fillRect(0, y + 1.5, w, 2); }
      else if (mode === 'rough') { x.fillStyle = '#7a7a7a'; x.fillRect(0, y - 1.5, w, 3); }
      else { x.fillStyle = 'rgba(90,80,70,.22)'; x.fillRect(0, y - 1, w, 2); x.fillStyle = 'rgba(160,120,80,.10)'; x.fillRect(0, y + 1, w, 4); }
    }
    for (let s = 0; s < 4; s++) { // vertical seams per ring segment (staggered)
      for (let k = 0; k < rings; k++) {
        const px = ((s + (k % 2) * 0.5) / 4) * w, y = k * h / rings;
        x.fillStyle = mode === 'bump' ? '#999' : mode === 'rough' ? '#7a7a7a' : 'rgba(90,80,70,.16)'; x.fillRect(px - 1, y, 2, h / rings);
      }
    }
  };
  return { map: canvasTex(W, H, draw('albedo'), { srgb: true }), rough: canvasTex(W, H, draw('rough')), bump: canvasTex(W, H, draw('bump')) };
}
function tileTexture() {
  // hexagonal heat-shield tiles (≈ 1 m), charcoal with subtle variation and fine gaps
  return canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#0c0c0e'; x.fillRect(0, 0, w, h); seed = 7;
    const s = 16, hx = s * Math.sqrt(3);
    for (let row = -1; row < h / (s * 1.5) + 1; row++) for (let col = -1; col < w / hx + 1; col++) {
      const cx = col * hx + (row % 2 ? hx / 2 : 0), cy = row * s * 1.5, g = 22 + rnd() * 16 | 0;
      x.fillStyle = `rgb(${g},${g},${g + 2})`; x.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; x.lineTo(cx + Math.cos(a) * (s - 1.4), cy + Math.sin(a) * (s - 1.4)); }
      x.fill(); if (rnd() < 0.004) { x.fillStyle = 'rgba(200,200,195,.22)'; x.fill(); } // the odd lighter replacement tile
    }
  }, { srgb: true });
}
function gridFinTex() { // lattice for grid fins (alpha cut-out)
  return canvasTex(128, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 7; x.save(); x.translate(w / 2, h / 2); x.rotate(Math.PI / 4); x.translate(-w, -h);
    for (let i = 0; i <= 16; i++) { x.beginPath(); x.moveTo(i * w / 4, 0); x.lineTo(i * w / 4, h * 2); x.stroke(); x.beginPath(); x.moveTo(0, i * h / 4); x.lineTo(w * 2, i * h / 4); x.stroke(); }
    x.restore(); x.lineWidth = 10; x.strokeRect(0, 0, w, h);
  }, { clamp: true });
}
function latticeTex() { // tower bracing
  return canvasTex(256, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 9;
    x.strokeRect(4, 4, w - 8, h - 8); x.beginPath(); x.moveTo(0, 0); x.lineTo(w, h); x.moveTo(w, 0); x.lineTo(0, h); x.stroke();
    x.lineWidth = 6; x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
  });
}
function ventTex() { // hot-staging ring vents
  return canvasTex(512, 64, (x, w, h) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = '#000';
    for (let i = 0; i < 24; i++) { const px = (i + 0.5) * w / 24; x.fillRect(px - 6, h * 0.18, 12, h * 0.64); }
  });
}
function noiseGround(kind) {
  // local ground disc around the pad / landing site (fades out at the edge into the planet sphere)
  return canvasTex(2048, 2048, (x, w, h) => {
    const cx = w / 2, cy = h / 2; seed = kind === 'earth' ? 3 : kind === 'mars' ? 5 : 11;
    const base = kind === 'earth' ? '#8c8463' : kind === 'mars' ? '#a0583a' : '#77777a';
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const px = rnd() * w, py = rnd() * h, r = 3 + rnd() * rnd() * 70, a = 0.05 + rnd() * 0.12;
      let col;
      if (kind === 'earth') col = rnd() < 0.55 ? `rgba(92,104,60,${a})` : rnd() < 0.5 ? `rgba(196,182,140,${a})` : `rgba(70,74,50,${a})`;
      else if (kind === 'mars') col = rnd() < 0.5 ? `rgba(120,55,30,${a})` : rnd() < 0.6 ? `rgba(190,120,80,${a})` : `rgba(60,35,25,${a})`;
      else col = rnd() < 0.5 ? `rgba(60,60,62,${a})` : `rgba(160,160,160,${a})`;
      x.fillStyle = col; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
    }
    if (kind !== 'earth') { // craters
      for (let i = 0; i < 260; i++) {
        const px = rnd() * w, py = rnd() * h, r = 3 + Math.pow(rnd(), 3) * 90;
        x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = r * 0.14; x.beginPath(); x.arc(px - r * .08, py - r * .08, r, 0, 7); x.stroke();
        x.fillStyle = 'rgba(0,0,0,.08)'; x.beginPath(); x.arc(px + r * .08, py + r * .08, r * 0.85, 0, 7); x.fill();
      }
    }
    if (kind === 'earth') {
      // Gulf of Mexico to the east (+x) with surf + beach, Rio Grande lagoon to the south
      const px = m => cx + m / 20000 * cx; // disc radius 20 km
      const g = x.createLinearGradient(px(2600), 0, px(20000), 0); g.addColorStop(0, '#2f6f86'); g.addColorStop(0.15, '#1d5a78'); g.addColorStop(1, '#0f3e5e');
      x.fillStyle = g; x.beginPath(); x.moveTo(px(2600), 0);
      for (let y = 0; y <= h; y += 32) x.lineTo(px(2600 + Math.sin(y * 0.004) * 260 + (y - cy) * 0.6), y);
      x.lineTo(w, h); x.lineTo(w, 0); x.fill();
      x.strokeStyle = '#e8dcc0'; x.lineWidth = 7; x.beginPath();
      for (let y = 0; y <= h; y += 32) x.lineTo(px(2560 + Math.sin(y * 0.004) * 260 + (y - cy) * 0.6), y); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 3; x.beginPath();
      for (let y = 0; y <= h; y += 32) x.lineTo(px(2680 + Math.sin(y * 0.004) * 260 + (y - cy) * 0.6), y); x.stroke();
      x.fillStyle = '#3b6f74'; x.beginPath(); x.ellipse(px(-2500), cy + 520, 900, 160, 0.15, 0, 7); x.fill(); // lagoon
      x.fillStyle = '#6d6a5e'; x.fillRect(0, cy - 3, px(2500), 6); // highway to the site
    }
    // radial alpha fade at the edge
    const id = x.getImageData(0, 0, w, h), d = id.data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const r = Math.hypot(i - cx, j - cy) / cx; d[(j * w + i) * 4 + 3] = 255 * (1 - sstep(0.55, 1.0, r)); }
    x.putImageData(id, 0, 0);
  }, { srgb: true, clamp: true });
}
function planetTex(kind) { // equirect procedural textures for Mars / Moon spheres
  return canvasTex(2048, 1024, (x, w, h) => {
    seed = kind === 'mars' ? 21 : 31;
    x.fillStyle = kind === 'mars' ? '#b0603c' : '#8a8a8c'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 7000; i++) {
      const px = rnd() * w, py = rnd() * h, r = 2 + Math.pow(rnd(), 2) * 120, a = 0.05 + rnd() * 0.1;
      x.fillStyle = kind === 'mars' ? (rnd() < 0.5 ? `rgba(90,40,25,${a})` : `rgba(210,140,90,${a})`) : (rnd() < 0.5 ? `rgba(50,50,52,${a})` : `rgba(190,190,190,${a})`);
      x.beginPath(); x.ellipse(px, py, r * 1.6, r, 0, 0, 7); x.fill();
    }
    for (let i = 0; i < 500; i++) {
      const px = rnd() * w, py = rnd() * h, r = 2 + Math.pow(rnd(), 3) * 40;
      x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = Math.max(1, r * .2); x.beginPath(); x.arc(px, py, r, 0, 7); x.stroke();
    }
    if (kind === 'mars') { x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(0, 0, w, 40); x.fillRect(0, h - 30, w, 30); }
  }, { srgb: true });
}

// ---------------------------------------------------------------- shader helpers (log-depth aware)
const VS_HEAD = '#include <common>\n#include <logdepthbuf_pars_vertex>\n';
const FS_HEAD = '#include <common>\n#include <logdepthbuf_pars_fragment>\n';
function smat(o) {
  return new THREE.ShaderMaterial(Object.assign({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }, o, {
    vertexShader: VS_HEAD + o.vertexShader, fragmentShader: FS_HEAD + o.fragmentShader }));
}
const scaleUV = (g, su, sv) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; };

// ---------------------------------------------------------------- vehicle model
const ENG_B = []; // booster engine positions, inner → outer (so "first N" = centre engines)
[[3, 1.05, 0.3], [10, 2.5, 0.1], [20, 3.85, 0]].forEach(([n, r, o]) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + o; ENG_B.push([Math.sin(a) * r, Math.cos(a) * r]); } });
const ENG_S = [];
for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; ENG_S.push([Math.sin(a) * 1.3, Math.cos(a) * 1.3, 0]); }       // sea-level Raptors
for (let i = 0; i < 3; i++) { const a = (i + 0.5) / 3 * Math.PI * 2; ENG_S.push([Math.sin(a) * 3.05, Math.cos(a) * 3.05, 1]); } // Raptor Vacuum
const bellPts = (rt, re, top, bot) => { const p = []; for (let i = 0; i <= 12; i++) { const f = i / 12, y = top + (bot - top) * f, r = f < 0.12 ? rt * (1 - f * 1.2) + rt * 0.15 : rt + (re - rt) * Math.pow((f - 0.12) / 0.88, 0.75); p.push(new THREE.Vector2(r, y)); } return p; };

function buildModel(env) {
  const tex = steelTextures(), tileT = tileTexture();
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9ced3, map: tex.map, metalness: 0.88, roughness: 0.36, roughnessMap: tex.rough, bumpMap: tex.bump, bumpScale: 0.7, envMapIntensity: 1.0 });
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x8f949a, map: tex.map, metalness: 0.85, roughness: 0.45, roughnessMap: tex.rough, envMapIntensity: 1.0 });
  const sooty = new THREE.MeshStandardMaterial({ color: 0x2a2725, metalness: 0.6, roughness: 0.7 });
  const tiles = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tileT, metalness: 0.0, roughness: 0.82, envMapIntensity: 0.6, side: THREE.DoubleSide });
  const bellMat = new THREE.MeshStandardMaterial({ color: 0x7a6656, metalness: 0.9, roughness: 0.42, side: THREE.DoubleSide, envMapIntensity: 1.1 });
  const rvacMat = new THREE.MeshStandardMaterial({ color: 0x84705e, metalness: 0.9, roughness: 0.38, side: THREE.DoubleSide, emissive: new THREE.Color(0, 0, 0) });
  const mats = { steel, steelDark, sooty, tiles, bellMat, rvacMat };

  // ---------- Super Heavy booster (origin at the aft end, +Y up)
  const booster = new THREE.Group(); booster.name = 'booster';
  const tube = new THREE.Mesh(scaleUV(new THREE.CylinderGeometry(4.5, 4.5, BOOST_H - 4, 72, 1, true), 1, (BOOST_H - 4) / 33), steel);
  tube.position.y = 4 + (BOOST_H - 4) / 2; booster.add(tube);
  const skirt = new THREE.Mesh(scaleUV(new THREE.CylinderGeometry(4.52, 4.6, 4, 72, 1, true), 1, 4 / 33), steelDark); skirt.position.y = 2; booster.add(skirt);
  const plate = new THREE.Mesh(new THREE.CircleGeometry(4.55, 48), sooty); plate.rotation.x = Math.PI / 2; plate.position.y = 0.5; booster.add(plate);
  // hot-staging ring: vented shell + glowing interior
  const ventA = ventTex();
  const ringShell = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, RING_H, 72, 1, true), new THREE.MeshStandardMaterial({ color: 0x8e9398, metalness: 1, roughness: 0.45, alphaMap: ventA, alphaTest: 0.5, side: THREE.DoubleSide }));
  ringShell.position.y = BOOST_H + RING_H / 2; booster.add(ringShell);
  const ringGlowMat = new THREE.MeshBasicMaterial({ color: 0x050403, side: THREE.DoubleSide, toneMapped: false });
  const ringIn = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.1, RING_H, 48, 1, false), ringGlowMat); ringIn.position.y = BOOST_H + RING_H / 2; booster.add(ringIn);
  // chines + raceway
  [-1, 1].forEach(s => { const c = new THREE.Mesh(new THREE.BoxGeometry(1.5, 44, 0.32), steelDark); c.position.set(s * 4.95, 30, 0); booster.add(c); });
  const race = new THREE.Mesh(new THREE.BoxGeometry(0.7, 60, 1.0), steelDark); race.position.set(-1.6, 36, -4.3); booster.add(race);
  // grid fins (4): horizontal lattice boxes sticking straight out near the top
  const gT = gridFinTex();
  const latMat = new THREE.MeshStandardMaterial({ color: 0x5f6266, metalness: 1, roughness: 0.5, alphaMap: gT, alphaTest: 0.5, side: THREE.DoubleSide });
  for (let k = 0; k < 4; k++) {
    const fin = new THREE.Group(), a = Math.PI / 4 + k * Math.PI / 2;
    const L = 3.6, W = 5.4, T = 0.9;
    [[-T / 2], [0], [T / 2]].forEach(([y]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(L, W), latMat); p.rotation.x = -Math.PI / 2; p.position.set(4.6 + L / 2, y, 0); fin.add(p); });
    const fr = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), steelDark); b.position.set(x, y, z); fin.add(b); };
    fr(L, T, 0.18, 4.6 + L / 2, 0, W / 2); fr(L, T, 0.18, 4.6 + L / 2, 0, -W / 2); fr(0.2, T, W, 4.6 + L, 0, 0); fr(0.35, T + 0.2, W, 4.7, 0, 0);
    fr(1.2, 1.8, 2.2, 4.7, 0.2, 0); // actuator housing
    fin.rotation.y = a - Math.PI / 2; fin.position.y = BOOST_H - 3.2; fin.rotation.z = 0; booster.add(fin);
  }
  // 33 Raptors (instanced bells + glowing interiors)
  const bellG = new THREE.LatheGeometry(bellPts(0.3, 0.66, 1.2, -1.15), 28);
  const bOuter = new THREE.InstancedMesh(bellG, bellMat, ENG_B.length);
  const bInner = new THREE.InstancedMesh(bellG.clone().scale(0.96, 1, 0.96), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false }), ENG_B.length);
  const m4 = new THREE.Matrix4();
  ENG_B.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); bOuter.setMatrixAt(i, m4); bInner.setMatrixAt(i, m4); bInner.setColorAt(i, new THREE.Color(0.04, 0.035, 0.03)); });
  booster.add(bOuter, bInner); booster.userData = { inner: bInner, ringGlow: ringGlowMat };

  // ---------- Starship upper stage (origin at the aft end)
  const ship = new THREE.Group(); ship.name = 'ship';
  const BAR = 31.5, NOSE = SHIP_LEN - BAR;
  const barrel = new THREE.Mesh(scaleUV(new THREE.CylinderGeometry(4.5, 4.5, BAR - 2.5, 72, 1, true), 1, (BAR - 2.5) / 33), steel); barrel.position.y = 2.5 + (BAR - 2.5) / 2; ship.add(barrel);
  const sk = new THREE.Mesh(scaleUV(new THREE.CylinderGeometry(4.5, 4.55, 2.5, 72, 1, true), 1, 2.5 / 33), steelDark); sk.position.y = 1.25; ship.add(sk);
  const sp = new THREE.Mesh(new THREE.CircleGeometry(4.5, 48), sooty); sp.rotation.x = Math.PI / 2; sp.position.y = 0.6; ship.add(sp);
  const rho = (4.5 * 4.5 + NOSE * NOSE) / (2 * 4.5), noseP = [];
  for (let i = 0; i <= 40; i++) { const y = NOSE * i / 40; noseP.push(new THREE.Vector2(Math.max(0.02, Math.sqrt(rho * rho - y * y) + 4.5 - rho) * (i === 40 ? 0 : 1), y)); }
  noseP[39].x = Math.max(noseP[39].x, 0.55);
  const noseG = new THREE.LatheGeometry(noseP, 72); scaleUV(noseG, 1, NOSE / 33);
  const nose = new THREE.Mesh(noseG, steel); nose.position.y = BAR; ship.add(nose);
  // heat-shield tiles on the windward (+Z) side
  const TH0 = -(Math.PI / 2 + 0.22), THL = Math.PI + 0.44, TW = 16, TH = 19; // texture covers 16 m × 19 m
  const tb = new THREE.Mesh(scaleUV(new THREE.CylinderGeometry(4.54, 4.54, BAR - 0.6, 64, 1, true, TH0, THL), 4.54 * THL / TW, (BAR - 0.6) / TH), tiles); tb.position.y = (BAR - 0.6) / 2 + 0.6; ship.add(tb);
  const tnG = new THREE.LatheGeometry(noseP.map(p => new THREE.Vector2(p.x * 1.008 + 0.02, p.y)), 48, TH0, THL); scaleUV(tnG, 4.54 * THL / TW, NOSE / TH);
  const tn = new THREE.Mesh(tnG, tiles); tn.position.y = BAR; ship.add(tn);
  // flaps (aft: large; forward: small, swept) at the tile/steel boundary on both sides
  const flaps = [];
  const mkFlap = (pts, depth, side, y, r, fwd) => {
    const sh = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2 }); g.translate(0, 0, -depth / 2);
    const pivot = new THREE.Group(), f = new THREE.Mesh(g, steel); pivot.add(f);
    const tp = new THREE.Mesh(new THREE.ShapeGeometry(sh), tiles); tp.position.z = depth / 2 + 0.14; pivot.add(tp); // windward face tiled
    const th = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    const holder = new THREE.Group(); holder.rotation.y = th - Math.PI / 2; holder.position.y = y;
    pivot.position.x = r; if (side < 0) tp.position.z = -(depth / 2 + 0.14);
    holder.add(pivot); ship.add(holder); flaps.push({ pivot, fwd, side });
  };
  [-1, 1].forEach(s => mkFlap([[0, 0], [4.4, 1.6], [4.4, 7.2], [0, 10.5]], 0.55, s, 1.2, 4.35, false));
  [-1, 1].forEach(s => mkFlap([[0, 0], [2.6, 2.2], [2.6, 4.2], [0, 6.8]], 0.4, s, BAR + 2.2, 3.85, true));
  // Raptors: 3 sea-level + 3 vacuum
  const slG = new THREE.LatheGeometry(bellPts(0.3, 0.65, 0.8, -1.4), 28), rvG = new THREE.LatheGeometry(bellPts(0.36, 1.17, 0.8, -2.0), 36);
  const sOuter = [], sInner = [];
  ENG_S.forEach(([x, z, vac], i) => {
    const o = new THREE.Mesh(vac ? rvG : slG, vac ? rvacMat : bellMat); o.position.set(x, 0, z); ship.add(o);
    const inn = new THREE.Mesh((vac ? rvG : slG).clone().scale(0.96, 1, 0.96), new THREE.MeshBasicMaterial({ color: 0x0a0908, side: THREE.DoubleSide, toneMapped: false })); inn.position.set(x, 0, z); ship.add(inn);
    sOuter.push(o); sInner.push(inn);
  });
  // cryogenic frost on the propellant tanks (fades away after liftoff) and soot streaks on the booster's aft end
  const frostT = canvasTex(512, 1024, (x, w, h) => {
    seed = 41; x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) { const l = rnd() < 0.5 ? 40 + rnd() * 60 | 0 : 200 + rnd() * 55 | 0; x.fillStyle = `rgba(${l},${l},${l},${0.08 + rnd() * 0.2})`; x.beginPath(); x.ellipse(rnd() * w, rnd() * h, 4 + rnd() * 40, 2 + rnd() * 12, 0, 0, 7); x.fill(); }
    for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(30,30,30,${0.1 + rnd() * 0.25})`; x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 20 + rnd() * 160); } // condensation drips
    for (let k = 0; k <= 18; k++) { x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(0, k * h / 18 - 2, w, 4); } // weld lines stay clearer
    const g = x.createLinearGradient(0, 0, 0, h * 0.08); g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h * 0.08); // ragged top edge
  });
  const frost = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.92, metalness: 0, alphaMap: frostT, transparent: true, opacity: 0.85, depthWrite: false, envMapIntensity: 0.7 });
  const bf = new THREE.Mesh(new THREE.CylinderGeometry(4.535, 4.535, 40, 72, 1, true), frost); bf.position.y = 6 + 20; booster.add(bf);
  const sf = new THREE.Mesh(new THREE.CylinderGeometry(4.56, 4.56, 15, 72, 1, true), frost); sf.position.y = 3 + 7.5; ship.add(sf);
  const sootT = canvasTex(512, 256, (x, w, h) => {
    seed = 43; x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 320; i++) { const px = rnd() * w, len = h * (0.2 + rnd() * 0.8), g = x.createLinearGradient(0, h, 0, h - len), a = 0.1 + rnd() * 0.35;
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px, h - len, 2 + rnd() * 14, len); }
    const g2 = x.createLinearGradient(0, h, 0, h * 0.55); g2.addColorStop(0, 'rgba(255,255,255,.75)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g2; x.fillRect(0, h * 0.55, w, h * 0.45);
  });
  const soot = new THREE.MeshStandardMaterial({ color: 0x1c1915, roughness: 0.9, metalness: 0.2, alphaMap: sootT, transparent: true, depthWrite: false });
  const bs = new THREE.Mesh(new THREE.CylinderGeometry(4.54, 4.62, 18, 72, 1, true), soot); bs.position.y = 9.1; booster.add(bs);
  // landing legs for Moon / Mars (stowed flush; swing down below ~3 km)
  const legs = [], legM = new THREE.MeshStandardMaterial({ color: 0x9a9fa5, metalness: 0.85, roughness: 0.4 });
  for (let i = 0; i < 6; i++) {
    const hold = new THREE.Group(); hold.rotation.y = i / 6 * Math.PI * 2 + Math.PI / 6; ship.add(hold);
    const piv = new THREE.Group(); piv.position.set(0, 6.2, 4.62); hold.add(piv);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9.2, 0.45), legM); leg.position.y = 4.6; piv.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.3, 16), legM); foot.position.y = 9.2; piv.add(foot);
    legs.push(piv);
  }
  Object.assign(mats, { frost, soot });
  ship.userData = { inner: sInner, flaps, legs };
  [booster, ship].forEach(g => g.traverse(o => { if (o.isMesh) o.frustumCulled = false; }));
  return { booster, ship, mats };
}

// ---------------------------------------------------------------- exhaust, smoke, staging & plasma effects
const FLAME_VS = `
attribute float aOn; varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vOn; varying float vSeed;
void main() {
  vUv = uv; vOn = aOn; vSeed = float(gl_InstanceID) * 1.37;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;
const FLAME_FS = `
uniform float uTime, uInt, uDia, uLen, uVac, uFuel, uThin; varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vOn; varying float vSeed;
void main() {
  #include <logdepthbuf_fragment>
  if (vOn < 0.01) discard;
  float y = 1.0 - vUv.y;                       // 0 at the nozzle → 1 at the tail
  float rim = pow(abs(dot(normalize(vN), normalize(vV))), 1.3);
  float core = exp(-y * 4.0);
  float sp = mix(1.7, 3.2, y);                // Mach-diamond spacing grows downstream
  float dia = pow(abs(cos(y * uLen / sp * 3.14159)), 10.0) * exp(-y * 2.2) * uDia;
  float flick = 0.86 + 0.14 * sin(uTime * 53.0 + vSeed + y * 17.0) * sin(uTime * 31.0 + vSeed * 2.1);
  vec3 sl, vac; float fa = 1.0;
  if (uFuel < 0.5) {        // methalox (Raptor): yellow-white core, orange tail; violet-blue in vacuum
    sl = mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.86, 0.7), core) * mix(2.6, 1.0, uVac);
    vac = mix(vec3(0.35, 0.45, 1.0), vec3(0.9, 0.85, 1.0), core);
  } else if (uFuel < 1.5) { // kerolox (Merlin, F-1, Rutherford): bright, sooty-orange, stays orange in vacuum
    sl = mix(vec3(1.0, 0.5, 0.12), vec3(1.0, 0.93, 0.78), core) * 2.9;
    vac = mix(vec3(1.0, 0.55, 0.25), vec3(1.0, 0.9, 0.8), core) * 1.25;
  } else {                  // hydrolox (J-2): nearly transparent, pale blue with pinkish diamonds
    sl = mix(vec3(0.5, 0.58, 1.0), vec3(0.95, 0.92, 1.0), core) * 1.3;
    vac = mix(vec3(0.45, 0.5, 1.0), vec3(0.9, 0.88, 1.0), core) * 0.9; fa = 0.5;
  }
  vec3 dcol = uFuel > 1.5 ? vec3(1.0, 0.7, 0.85) : vec3(1.0, 0.95, 0.85);
  vec3 col = mix(sl, vac, max(uVac, uThin * 0.55)) + dcol * dia * 1.6;
  float a = (core * 1.1 + 0.35 * exp(-y * 1.6) + dia) * rim * flick * uInt * vOn * smoothstep(1.0, 0.6, y) * fa;
  gl_FragColor = vec4(col * a * 1.05, a);
}`;
function flameMesh(engines, len, rTop, rBot) {
  const g = new THREE.CylinderGeometry(rTop, rBot, 1, 20, 24, true); g.translate(0, -0.5, 0);
  const on = new Float32Array(engines.length).fill(1);
  g.setAttribute('aOn', new THREE.InstancedBufferAttribute(on, 1));
  const m = smat({ uniforms: { uTime: { value: 0 }, uInt: { value: 0 }, uDia: { value: 1 }, uLen: { value: len }, uVac: { value: 0 }, uFuel: { value: 0 }, uThin: { value: 0 } }, vertexShader: FLAME_VS, fragmentShader: FLAME_FS, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(g, m, engines.length), mm = new THREE.Matrix4();
  engines.forEach((e, i) => { mm.compose(new THREE.Vector3(e[0], e[3] || -1.1, e[1]), new THREE.Quaternion(), new THREE.Vector3(1, len, 1)); mesh.setMatrixAt(i, mm); });
  mesh.frustumCulled = false; mesh.userData = { on, len, engines }; return mesh;
}
function setFlameLen(mesh, len, widen) {
  const mm = new THREE.Matrix4(); mesh.userData.engines.forEach((e, i) => { mm.compose(new THREE.Vector3(e[0], e[3] || -1.1, e[1]), new THREE.Quaternion(), new THREE.Vector3(widen, len, widen)); mesh.setMatrixAt(i, mm); });
  mesh.instanceMatrix.needsUpdate = true; mesh.material.uniforms.uLen.value = len;
}
// one big, soft plume envelope around the whole cluster that balloons as the air thins
const PLUME_VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;
const PLUME_FS = `uniform float uTime, uInt, uVac, uThin, uFuel; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + 1.0), f.x), f.y); }
void main() {
  #include <logdepthbuf_fragment>
  float y = 1.0 - vUv.y; float rim = abs(dot(normalize(vN), normalize(vV)));
  float body = pow(rim, mix(1.6, 2.4, uThin)); // soft centre-weighted glow, no hard outline
  float turb = 0.65 + 0.7 * n2(vec2(vUv.x * 18.0, y * 10.0 - uTime * 9.0));
  vec3 col = mix(mix(vec3(1.0, 0.62, 0.22), vec3(1.0, 0.34, 0.08), y) * mix(2.2, 1.0, uThin), vec3(0.45, 0.5, 1.0), uVac * 0.7);
  float fa = 1.0;
  if (uFuel > 0.5 && uFuel < 1.5) col = mix(vec3(1.0, 0.72, 0.32), vec3(1.0, 0.42, 0.1), y) * mix(2.5, 1.1, uThin) * mix(1.0, 0.8, uVac);
  else if (uFuel > 1.5) { col = vec3(0.55, 0.6, 1.0) * 0.8; fa = 0.35; }
  // expanding vacuum plume: brighter rim (the plume boundary) once the air is gone
  col *= 1.0 + uThin * 0.6 * (1.0 - rim);
  float a = fa * body * turb * exp(-y * mix(1.9, 1.6, uThin)) * smoothstep(1.0, 0.75, y) * smoothstep(0.0, 0.04, y) * uInt;
  gl_FragColor = vec4(col * a, a);
}`;
function plumeMesh() {
  const g = new THREE.CylinderGeometry(1, 1, 1, 40, 20, true); g.translate(0, -0.5, 0);
  // reshape: radius grows from 1 at the nozzle plane to "bottom" (set by scale) – stored as a profile on y
  const m = smat({ uniforms: { uTime: { value: 0 }, uInt: { value: 0 }, uVac: { value: 0 }, uThin: { value: 0 }, uFuel: { value: 0 } }, vertexShader: PLUME_VS, fragmentShader: PLUME_FS, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; return mesh;
}
// GPU-animated exhaust sparks (positions computed in the shader, no per-frame CPU work)
function sparks(engines, n, size) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), sd = new Float32Array(n * 4), ei = new Float32Array(n);
  for (let i = 0; i < n; i++) { const e = engines[i % engines.length]; pos.set([e[0], -1.2, e[1]], i * 3); sd.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4); ei[i] = i % engines.length; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4)); g.setAttribute('aEng', new THREE.BufferAttribute(ei, 1));
  const m = smat({
    uniforms: { uTime: { value: 0 }, uInt: { value: 0 }, uActive: { value: 33 }, uSpeed: { value: 70 }, uSpread: { value: 0.12 }, uScale: { value: 800 }, uSize: { value: size }, uVac: { value: 0 }, uFuel: { value: 0 } },
    vertexShader: `uniform float uTime, uInt, uActive, uSpeed, uSpread, uScale, uSize; attribute vec4 aSeed; attribute float aEng; varying float vA; varying float vF;
      void main() {
        float life = 0.5 + aSeed.x * 0.7; float age = mod(uTime * (0.8 + aSeed.y * 0.4) + aSeed.z * 9.0, life); float f = age / life;
        vec3 p = position; float sp = uSpeed * (0.6 + aSeed.w * 0.8);
        p.y -= sp * age; vec2 dir = normalize(vec2(aSeed.y - 0.5, aSeed.w - 0.5) + 1e-3); p.xz += dir * sp * age * uSpread * (0.3 + aSeed.x);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        float on = step(aEng + 0.5, uActive) * uInt; vA = on * (1.0 - f); vF = f;
        gl_PointSize = on > 0.0 ? uSize * (0.6 + f * 1.8) * uScale / max(1.0, -mv.z) : 0.0;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform float uVac, uFuel; varying float vA; varying float vF;
      void main() { 
        #include <logdepthbuf_fragment>
        float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA * vA * 0.5 * (uFuel > 1.5 ? 0.3 : 1.0);
        vec3 c = mix(mix(vec3(1.0, 0.85, 0.6), vec3(1.0, 0.35, 0.08), vF), vec3(0.5, 0.55, 1.0), uVac * 0.6); gl_FragColor = vec4(c * a, a); }` });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; return pts;
}
// soft lumpy puff (rgb = pseudo normal-ish detail, alpha = density), safe to rotate (zero at the rim)
function puffTexture() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); seed = 77;
  for (let i = 0; i < 70; i++) {
    const r = S * (0.06 + rnd() * 0.14), a = rnd() * 6.283, d = Math.pow(rnd(), 0.8) * S * 0.28, px = S / 2 + Math.cos(a) * d, py = S / 2 + Math.sin(a) * d;
    const g = x.createRadialGradient(px - r * 0.3, py - r * 0.3, 0, px, py, r), l = 150 + rnd() * 105 | 0;
    g.addColorStop(0, `rgba(${l},${l},${l},0.55)`); g.addColorStop(1, `rgba(${l},${l},${l},0)`); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  const id = x.getImageData(0, 0, S, S), d = id.data;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const r = Math.hypot(i - S / 2, j - S / 2) / (S / 2), k = (j * S + i) * 4; d[k + 3] = Math.min(255, d[k + 3] * 1.6) * (1 - sstep(0.62, 0.98, r)); }
  x.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
// liftoff steam / dust cloud – deterministic from sim time, so scrubbing back and forth just works
function smokeCloud(n) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), sd = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) sd.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
  const m = smat({
    blending: THREE.NormalBlending,
    uniforms: { uT: { value: -10 }, uScale: { value: 800 }, uGlow: { value: 0 }, uSunV: { value: new THREE.Vector3(0.5, 0.6, 0.3) }, uLight: { value: 1 }, uK: { value: 1 }, uTex: { value: puffTexture() } },
    vertexShader: `uniform float uT, uScale, uK; attribute vec4 aSeed; varying float vA; varying float vAge; varying float vSeed;
      void main() {
        float ts = -2.6 + pow(aSeed.x, 1.7) * 22.0; float age = uT - ts; vSeed = aSeed.y;
        float ang = aSeed.y * 6.2832, V = 20.0 + aSeed.z * aSeed.z * 110.0, tau = 5.0 + aSeed.w * 4.0;
        float r = (12.0 + V * tau * (1.0 - exp(-max(age, 0.0) / tau))) * pow(uK, 0.75);
        float up = aSeed.w < 0.22 ? 1.0 : 0.0;   // some of it boils straight up around the mount
        vec3 p = vec3(cos(ang) * r * (1.0 - up * 0.7), 4.0 + (6.0 + aSeed.w * 30.0) * (1.0 - exp(-max(age, 0.0) / 9.0)) + max(age, 0.0) * (0.6 + up * 3.0) * (0.5 + aSeed.z), sin(ang) * r * (1.0 - up * 0.7));
        p.y *= pow(uK, 0.75);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vA = smoothstep(0.0, 1.2, age) * (1.0 - smoothstep(30.0, 85.0, age)); vAge = age;
        float sz = (26.0 + min(age, 60.0) * (2.6 + aSeed.z * 1.8)) * pow(uK, 0.8);
        gl_PointSize = vA > 0.0 ? min(sz * uScale / max(1.0, -mv.z), 640.0) : 0.0;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform float uGlow, uLight; uniform vec3 uSunV; uniform sampler2D uTex; varying float vA; varying float vAge; varying float vSeed;
      void main() {
        #include <logdepthbuf_fragment>
        vec2 q = gl_PointCoord - 0.5; float cs = cos(vSeed * 6.2832), sn = sin(vSeed * 6.2832);
        vec4 tx = texture2D(uTex, mat2(cs, -sn, sn, cs) * q + 0.5);
        float a = tx.a * vA * 0.42; if (a < 0.003) discard;
        // pseudo-volumetric lighting: treat each puff as a lumpy sphere lit by the real sun direction (view space)
        vec3 n = normalize(vec3(q.x * 2.0, -q.y * 2.0, sqrt(max(0.0, 1.0 - 4.0 * dot(q, q))) + 0.15) + (tx.rgb - 0.5) * 0.9);
        float lam = 0.38 + 0.62 * max(dot(n, normalize(uSunV)), 0.0);
        vec3 c = vec3(0.84, 0.84, 0.86) * lam * (0.7 + 0.3 * tx.r) * uLight + vec3(1.0, 0.5, 0.18) * uGlow * exp(-vAge / 12.0) * (0.6 + 0.4 * (q.y + 0.5));
        gl_FragColor = vec4(c, a);
      }` });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 2; return pts;
}
// hot-staging: flame jets venting radially out of the ring
function ventFlames() {
  const g = new THREE.CylinderGeometry(9, 4.6, 3.2, 96, 1, true);
  const m = smat({ uniforms: { uInt: { value: 0 }, uTime: { value: 0 } }, side: THREE.DoubleSide, vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
    fragmentShader: `uniform float uInt, uTime; varying vec2 vUv; void main() {
      #include <logdepthbuf_fragment>
      float v = pow(abs(cos(vUv.x * 24.0 * 3.14159)), 6.0); float r = 1.0 - vUv.y; // r: 0 at ring → 1 outward
      float a = v * exp(-r * 2.4) * (0.8 + 0.2 * sin(uTime * 70.0 + vUv.x * 50.0)) * uInt; gl_FragColor = vec4(vec3(1.0, 0.55, 0.2) * a * 2.0, a); }` });
  const mesh = new THREE.Mesh(g, m); mesh.position.y = BOOST_H + RING_H / 2; mesh.frustumCulled = false; return mesh;
}
// reentry plasma sheath on the windward side + a glowing wake
function plasma() {
  const grp = new THREE.Group();
  const g = new THREE.CylinderGeometry(6.8, 6.8, SHIP_LEN + 6, 48, 1, true, -(Math.PI / 2 + 0.5), Math.PI + 1.0); g.translate(0, SHIP_LEN / 2, 0);
  const m = smat({ uniforms: { uInt: { value: 0 }, uTime: { value: 0 } }, side: THREE.DoubleSide, vertexShader: PLUME_VS,
    fragmentShader: `uniform float uInt, uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main() {
      #include <logdepthbuf_fragment>
      float rim = 1.0 - abs(dot(normalize(vN), normalize(vV))); float edge = sin(vUv.x * 3.14159);
      float fl = 0.8 + 0.2 * sin(uTime * 25.0 + vUv.y * 30.0);
      float a = (0.4 + pow(rim, 2.0)) * edge * fl * uInt * 1.8; gl_FragColor = vec4(mix(vec3(1.0, 0.45, 0.6), vec3(1.0, 0.75, 0.4), rim) * a * 1.5, a); }` });
  const sheath = new THREE.Mesh(g, m); grp.add(sheath);
  const wg = new THREE.ConeGeometry(14, 160, 32, 8, true); wg.translate(0, -80, 0);
  const wm = smat({ uniforms: { uInt: { value: 0 }, uTime: { value: 0 } }, side: THREE.DoubleSide, vertexShader: PLUME_VS,
    fragmentShader: `uniform float uInt, uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main() {
      #include <logdepthbuf_fragment>
      float y = 1.0 - vUv.y; float rim = abs(dot(normalize(vN), normalize(vV)));
      float a = pow(rim, 1.5) * exp(-y * 3.0) * (0.7 + 0.3 * sin(uTime * 18.0 + y * 40.0)) * uInt * 0.6; gl_FragColor = vec4(vec3(1.0, 0.5, 0.55) * a, a); }` });
  const wake = new THREE.Mesh(wg, wm); grp.add(wake);
  grp.userData = { sheath, wake }; grp.traverse(o => { o.frustumCulled = false; }); return grp;
}

// ---------------------------------------------------------------- Starbase pad, sky, planets, environment maps
function buildPad(mats) {
  const pad = new THREE.Group();
  const conc = new THREE.MeshStandardMaterial({ color: 0x86837c, roughness: 0.92, metalness: 0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b3d40, roughness: 0.6, metalness: 0.8 });
  const steelT = new THREE.MeshStandardMaterial({ color: 0x6d7178, roughness: 0.68, metalness: 0.35 });
  const slab = new THREE.Mesh(new THREE.CircleGeometry(75, 64), conc); slab.rotation.x = -Math.PI / 2; slab.position.y = 0.15; pad.add(slab);
  // orbital launch mount: ring table on six legs, steel flame deflector underneath
  const ringG = new THREE.LatheGeometry([new THREE.Vector2(4.9, PAD_H - 3), new THREE.Vector2(8.5, PAD_H - 3), new THREE.Vector2(8.5, PAD_H), new THREE.Vector2(4.9, PAD_H), new THREE.Vector2(4.9, PAD_H - 3)], 48);
  pad.add(new THREE.Mesh(ringG, steelT));
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, l = new THREE.Mesh(new THREE.BoxGeometry(2.2, PAD_H - 3, 2.2), steelT); l.position.set(Math.sin(a) * 8.6, (PAD_H - 3) / 2, Math.cos(a) * 8.6); pad.add(l); }
  const defl = new THREE.Mesh(new THREE.CylinderGeometry(8, 9.5, 2, 48), dark); defl.position.y = 1; pad.add(defl);
  // integration tower with chopsticks
  const lat = latticeTex();
  const latM = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.7, metalness: 0.3, alphaMap: lat, alphaTest: 0.5, side: THREE.DoubleSide });
  lat.repeat.set(1, 14);
  const TW = 12, THt = 146, tower = new THREE.Group(); tower.position.set(0, 0, -26);
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, THt, 1.4), steelT); c.position.set(a * TW / 2, THt / 2, b * TW / 2); tower.add(c); });
  for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(TW, THt), latM); p.rotation.y = k * Math.PI / 2; p.position.set(Math.sin(k * Math.PI / 2) * TW / 2, THt / 2, Math.cos(k * Math.PI / 2) * TW / 2); tower.add(p); }
  const crane = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 26), steelT); crane.position.set(0, THt + 3, 6); tower.add(crane);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 14, 8), steelT); mast.position.set(0, THt + 9, -3); tower.add(mast);
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(TW + 3, 6, 4), dark); carriage.position.set(0, 88, TW / 2 + 1.5); tower.add(carriage);
  const arms = [];
  [-1, 1].forEach(s => {
    const piv = new THREE.Group(); piv.position.set(s * 6.3, 83.6, TW / 2 + 2.5);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, 30), steelT); arm.position.z = 15; piv.add(arm);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 26), dark); rail.position.set(-s * 0.9, 1.8, 16); piv.add(rail);
    tower.add(piv); arms.push({ piv, s });
  });
  const qd = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 12), dark); qd.position.set(0, SHIP_BASE + PAD_H + 6, TW / 2 + 6); tower.add(qd); // ship quick-disconnect arm
  pad.add(tower);
  // tank farm + buildings
  for (let i = 0; i < 8; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 22 + (i % 3) * 6, 24), mats.steel); t.position.set(-150 - (i % 4) * 12, (22 + (i % 3) * 6) / 2, 70 + Math.floor(i / 4) * 14); pad.add(t); }
  const shed = new THREE.MeshStandardMaterial({ color: 0x6f7780, roughness: 0.7, metalness: 0.3 });
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(18 + i * 3, 8 + (i % 3) * 5, 22), shed); b.position.set(-260 - i * 40, (8 + (i % 3) * 5) / 2, -120 + (i % 2) * 70); pad.add(b); }
  pad.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  pad.userData = { arms, tower };
  return pad;
}
const SKY_FS = `uniform vec3 uSun, uZen, uHor, uSunCol; uniform float uDip, uAlt, uBright; varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir); float e = asin(clamp(d.y, -1.0, 1.0)) + uDip;
  float hw = mix(0.32, 0.025, clamp(uAlt / 70000.0, 0.0, 1.0));
  float hz = exp(-max(e, 0.0) / hw);
  vec3 col = mix(uZen, uHor, hz);
  if (e < 0.0) col = uHor * mix(0.75, 0.25, clamp(-e * 3.0, 0.0, 1.0));
  float sd = max(dot(d, normalize(uSun)), 0.0);
  col += uSunCol * (pow(sd, 1600.0) * 40.0 + pow(sd, 90.0) * (0.5 + 0.6 * (1.0 - uBright)) + pow(sd, 10.0) * 0.28 * uBright + pow(sd, 3.0) * 0.07 * uBright);
  gl_FragColor = vec4(col, 1.0);
}`;
function buildSky() {
  const m = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, side: THREE.BackSide,
    uniforms: { uSun: { value: new THREE.Vector3(0.5, 0.6, 0.3) }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color(1, 0.95, 0.85) }, uDip: { value: 0 }, uAlt: { value: 0 }, uBright: { value: 1 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: SKY_FS });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), m); sky.renderOrder = -100; sky.frustumCulled = false;
  const n = 3500, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.2832, s = Math.sqrt(1 - u * u); pos.set([s * Math.cos(a) * 90, u * 90, s * Math.sin(a) * 90], i * 3); const b = Math.pow(Math.random(), 3) * 0.9 + 0.1, t = Math.random(); col.set([b * (0.85 + t * 0.15), b * 0.9, b * (1.0 - t * 0.12)], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const sm = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: false, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, opacity: 1 });
  const stars = new THREE.Points(g, sm); stars.renderOrder = -99; stars.frustumCulled = false;
  return { sky, stars };
}
function atmosphereShell(R, color) {
  const m = smat({ side: THREE.BackSide, uniforms: { uCol: { value: new THREE.Color(color) }, uInt: { value: 1 } }, vertexShader: `varying vec3 vN; varying vec3 vV;
    void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp;
      #include <logdepthbuf_vertex>
    }`,
    fragmentShader: `uniform vec3 uCol; uniform float uInt; varying vec3 vN; varying vec3 vV; void main(){
      #include <logdepthbuf_fragment>
      float f = dot(normalize(vN), normalize(vV)); float a = pow(clamp(f, 0.0, 1.0), 5.0) * uInt * 1.2; gl_FragColor = vec4(uCol * a, a); }` });
  const s = new THREE.Mesh(new THREE.SphereGeometry(R * 1.018, 180, 90), m); s.frustumCulled = false; return s;
}
function envScene(kind) {
  const sc = new THREE.Scene();
  const pal = { ground: [[0.22, 0.38, 0.75], [0.80, 0.85, 0.92], [0.30, 0.28, 0.23], 1.0], space: [[0, 0, 0.004], [0.35, 0.55, 1.0], [0.30, 0.45, 0.75], 1.3],
    mars: [[0.55, 0.40, 0.30], [0.85, 0.66, 0.48], [0.45, 0.24, 0.14], 1.2], moon: [[0, 0, 0], [0.05, 0.05, 0.06], [0.32, 0.32, 0.33], 1.0] }[kind];
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { a: { value: new THREE.Color(...pal[0]) }, b: { value: new THREE.Color(...pal[1]) }, c: { value: new THREE.Color(...pal[2]) }, k: { value: pal[3] } },
    vertexShader: 'varying vec3 d; void main(){ d = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 a, b, c; uniform float k; varying vec3 d; void main(){ vec3 n = normalize(d); float y = n.y;
      vec3 col = y > 0.0 ? mix(b, a, pow(y, 0.5)) : mix(b * 0.6, c, pow(-y, 0.35));
      float s = max(dot(n, normalize(vec3(0.55, 0.62, 0.35))), 0.0); col += vec3(1.0, 0.95, 0.85) * (pow(s, 600.0) * 18.0 + pow(s, 30.0) * 0.4);
      // a couple of bright "panels" give the steel some crisp reflections
      col += vec3(0.28) * smoothstep(0.985, 0.995, max(dot(n, normalize(vec3(-0.7, 0.2, 0.6))), 0.0));
      gl_FragColor = vec4(col * k, 1.0); }` });
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32), m)); return sc;
}

// ---------------------------------------------------------------- runtime
let R = null;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const SUN_L = V3(0.55, 0.62, 0.35).normalize(); // local "morning sun from the south-east" for a nice look
const phaseCache = new WeakMap();
function phaseStarts(run) { // first time each named phase appears in a sample list
  if (phaseCache.has(run)) return phaseCache.get(run);
  const o = {}; run.samples.forEach(q => { if (o[q.phase] == null) o[q.phase] = q.t; }); o.__end = run.samples[run.samples.length - 1].t;
  phaseCache.set(run, o); return o;
}
function posSH(sKm, hKm, Rp = R_E) { const th = sKm * 1000 / Rp, r = Rp + Math.max(0, hKm) * 1000; return V3(r * Math.sin(th), r * Math.cos(th) - Rp, 0); }
const upAt = p => V3(p.x, p.y + R_E, 0).normalize();
const quatAxis = d => new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
function quatBasis(nose, belly) { // local +Y = nose, local +Z = belly (heat-shield side)
  const y = nose.clone().normalize(), z = belly.clone().sub(y.clone().multiplyScalar(belly.dot(y))).normalize(), x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
function earthOrientation(latDeg, lonDeg) { // rotate the textured sphere so (lat, lon) is at +Y and local east is +X
  const u = (lonDeg + 180) / 360, v = (90 - latDeg) / 180;
  const p = V3(-Math.cos(2 * Math.PI * u) * Math.sin(Math.PI * v), Math.cos(Math.PI * v), Math.sin(2 * Math.PI * u) * Math.sin(Math.PI * v)).normalize();
  const e = V3(Math.sin(2 * Math.PI * u), 0, Math.cos(2 * Math.PI * u)).normalize(), s = new THREE.Vector3().crossVectors(e, p);
  const m = new THREE.Matrix4().makeBasis(e, p, s).transpose(); return new THREE.Quaternion().setFromRotationMatrix(m);
}

// ---------------------------------------------------------------- real sun position (low-precision solar ephemeris, ~0.5°)
function sunLocal(latDeg, lonDeg, date) { // returns pad-frame vector: +X east, +Y up, +Z south
  const rad = Math.PI / 180, d = date.getTime() / 864e5 - 10957.5;
  const g = (357.529 + 0.98560028 * d) * rad, q0 = 280.459 + 0.98564736 * d, L = (q0 + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad, e = (23.439 - 3.6e-7 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) * 15, H = ((gmst + lonDeg) * rad - ra), la = latDeg * rad;
  const east = -Math.cos(dec) * Math.sin(H), north = Math.sin(dec) * Math.cos(la) - Math.cos(dec) * Math.cos(H) * Math.sin(la), up = Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H);
  return V3(east, up, -north).normalize();
}
const TOD = { // presets: [elevation°, azimuth° from north]
  morning: [22, 105], midday: [62, 170], sunset: [3, 285], night: [-28, 300] };
function sunFromPreset(k, lat) { const [el, az0] = TOD[k], az = lat < 0 ? 180 - az0 : az0, r = Math.PI / 180; return V3(Math.cos(el * r) * Math.sin(az * r), Math.sin(el * r), -Math.cos(el * r) * Math.cos(az * r)).normalize(); }

// ---------------------------------------------------------------- quality presets
const QUALITY = {
  low: { pr: 0.75, bloom: false, haze: false, flare: false, part: 0.5 },
  medium: { pr: 1.25, bloom: true, haze: true, flare: true, part: 0.75 },
  high: { pr: 2, bloom: true, haze: true, flare: true, part: 1 } };
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

// heat haze: screen-space refraction confined to a capsule around the projected exhaust
const HazeShader = {
  uniforms: { tDiffuse: { value: null }, uA: { value: new THREE.Vector2() }, uB: { value: new THREE.Vector2() }, uW: { value: 0.1 }, uStr: { value: 0 }, uTime: { value: 0 }, uAsp: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uA, uB; uniform float uW, uStr, uTime, uAsp; varying vec2 vUv;
    void main(){
      vec2 sc = vec2(uAsp, 1.0), pa = (vUv - uA) * sc, ba = (uB - uA) * sc;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0), d = length(pa - ba * h);
      float w = uW * (0.6 + 0.8 * h), m = smoothstep(w, w * 0.25, d) * uStr * (0.35 + 0.65 * smoothstep(0.0, 0.2, h));
      vec2 p = vUv * vec2(uAsp, 1.0) * 90.0;
      vec2 off = vec2(sin(p.y * 1.7 + uTime * 23.0) + sin(p.y * 0.9 - uTime * 15.0 + p.x * 0.6), cos(p.x * 1.3 + uTime * 19.0) + sin(p.x * 0.7 + p.y * 0.5 - uTime * 11.0)) * 0.0018 * m;
      gl_FragColor = texture2D(tDiffuse, vUv + off);
    }` };

function hudHtml() {
  return `<canvas></canvas>
  <div class="scam-flare" data-k="flare"><i></i><i></i><i></i><i></i><i></i><i></i><b></b></div>
  <div class="scam-top"><div class="scam-title">🚀 3D rocket cam · <span data-k="vname">Starship</span> <span class="scam-tip">drag to orbit · scroll to zoom · right-drag to pan</span></div>
    <div class="scam-topbtns"><button class="scam-tbtn scam-focus" data-act="focus" title="Clean view: hide the panels (H)">⛶<span class="scam-btxt"> Focus</span></button><button class="scam-close" data-act="close" title="Back to the globe (C)">✕<span class="scam-btxt"> Back to globe</span></button></div></div>
  <button class="scam-ctl" data-act="ctl" aria-expanded="false" title="Camera, rocket and quality controls">⚙ Controls</button>
  <div class="scam-ro"><div class="scam-met">T+00:00</div><div class="scam-phase">On the pad</div>
    <div class="scam-kv"><span>Altitude</span><b data-k="alt">0 m</b></div><div class="scam-kv"><span>Speed</span><b data-k="spd">0 km/h</b></div><div class="scam-kv" data-k="machrow"><span>Mach</span><b data-k="mach">0.0</b></div>
    <div class="scam-kv" data-k="grow"><span>Acceleration</span><b data-k="g">0.0 g</b></div>
    <div class="scam-note" data-k="note"></div></div>
  <div class="scam-panel">
    <div class="scam-row" data-only="launch"><span class="scam-lab">Rocket</span><div class="seg" data-grp="veh"><button data-veh="starship">Starship</button><button data-veh="falcon9">Falcon 9</button><button data-veh="saturnv">Saturn V</button><button data-veh="electron">Electron</button></div></div>
    <div class="scam-row"><span class="scam-lab">View</span><div class="seg" data-grp="view"><button data-view="chase" class="on">Orbit</button><button data-view="engines">Engines</button><button data-view="nose">Nose</button><button data-view="wide">Wide</button><button data-view="ground" data-only="launch">Ground cam</button></div></div>
    <div class="scam-row" data-only="launch" data-k="trackrow"><span class="scam-lab">Follow</span><div class="seg" data-grp="track"><button data-track="ship" class="on" data-k="trackU">Ship</button><button data-track="booster" data-k="trackL">Booster</button></div></div>
    <div class="scam-row" data-only="launch"><span class="scam-lab">Jump</span><div class="scam-jumps" data-grp="jump"><button data-jump="pad">Pad</button><button data-jump="maxq">Max-Q</button><button data-jump="stage" data-k="jstage">Hot staging</button><button data-jump="space">Space</button><button data-jump="seco">Engine cut-off</button><button data-jump="catch" data-k="jland">Booster catch</button></div></div>
    <div class="scam-row" data-only="launch"><span class="scam-lab">Speed</span><div class="seg" data-grp="speed"><button data-speed="1">1× real time</button><button data-speed="10">10×</button><button data-speed="100">100×</button></div></div>
    <div class="scam-row" data-only="space"><span class="scam-lab">Phase</span><select class="scam-sel" data-k="phases"></select></div>
    <div class="scam-row" data-only="space"><span class="scam-lab">Time</span><div class="seg"><button data-act="splay">▶ Play</button></div></div>
    <div class="scam-row" data-only="launch"><span class="scam-lab">Sun</span><select class="scam-sel" data-k="tod" title="Lighting: the real sun position over the launch site right now, or a preset time of day"><option value="live">Live – real sun over the pad now</option><option value="morning">Morning</option><option value="midday">Midday</option><option value="sunset">Sunset</option><option value="night">Night launch</option></select></div>
    <div class="scam-row"><span class="scam-lab">Quality</span><div class="seg" data-grp="quality"><button data-q="low">Low</button><button data-q="medium">Medium</button><button data-q="high">High</button></div></div>
    <div class="scam-row"><label class="scam-chk"><input type="checkbox" data-k="bloom" checked> Glow (bloom)</label><span class="scam-fps" data-k="fps"></span></div>
  </div>
  <div class="scam-msg" data-k="msg" hidden></div>`;
}

const CAM_IDS = ['starship', 'falcon9', 'saturnv', 'electron'];
const SITE_FOR = { starship: 'starbase', falcon9: 'ksc', saturnv: 'ksc', electron: 'mahia' };
function starshipVeh(M, o) {
  const inner = M.ship.userData.inner;
  return {
    id: 'starship', name: 'Starship', pad: 'starbase', padH: PAD_H, k: 1, gap: SHIP_BASE, Htot: SHIP_BASE + SHIP_LEN, stackMid: 46, smokeK: 1, star: true,
    lower: { g: M.booster, H: BOOST_H, mid: BOOST_MID, aft: 2, top: 64, k: 1, sets: [{ fl: o.bFl, bells: M.booster.userData.inner, n: 33, lenA: 22, lenB: 38 }], pl: o.bPl, sp: o.bSp, fire: o.fire },
    upper: { g: M.ship, H: SHIP_LEN, mid: 24, aft: 1, top: 44, k: 1, sets: [{ fl: o.sSL, bells: inner.slice(0, 3), n: 3, lenA: 11, lenB: 22 }, { fl: o.sVac, bells: inner.slice(3), n: 3, vac: true, lenA: 16, lenB: 30 }], pl: o.sPl, sp: o.sSp, fire: o.sFire },
    labels: { lower: 'Super Heavy', upper: 'Starship', stack: 'Super Heavy: 33 Raptors', land: 'Booster catch', stage: 'Hot staging', trackU: 'Ship', trackL: 'Booster' },
    sched(t, c) {
      const { tSep, tSeco } = c, ps = c.ps || {}, tCoast = ps['Coast & descent'] || tSep + 60, tLand = ps['Landing burn'] || tSep + 220, tDone = ps['Back at launch site'] || tLand + 30;
      const f = { bN: 0, bI: 0 };
      if (t > -3 && t < 0) { f.bN = 33; f.bI = sstep(-3, -1.2, t) * 0.9; }
      else if (t >= 0 && t < tSep - 6) { f.bN = 33; f.bI = 1; } else if (t < tSep - 3) { f.bN = 13; f.bI = 1; } else if (t < tSep + 0.4) { f.bN = 3; f.bI = 1; }
      else if (t < tCoast) { if (t - tSep > 9) { f.bN = 13; f.bI = sstep(9, 11, t - tSep); } }
      else if (t >= tLand && t < tDone) { f.bN = (t - tLand) < 0.45 * (tDone - tLand) ? 13 : 3; f.bI = 1; }
      f.sI = t >= tSep - 1.4 && t < tSeco ? sstep(tSep - 1.4, tSep - 0.6, t) : 0; f.sN = [3, 3];
      f.heat = t < tSep ? 0 : t < tSeco ? sstep(tSep, tSep + 90, t) : Math.max(0, 1 - (t - tSeco) / 150);
      f.vent = sstep(tSep - 1.5, tSep - 0.7, t) * (1 - sstep(tSep + 0.4, tSep + 2.5, t)) * 1.5;
      f.ring = sstep(tSep - 1.5, tSep, t) * (1 - sstep(tSep, tSep + 45, t));
      f.arms = t >= tLand ? 1 - sstep(tLand + 0.55 * (tDone - tLand), tDone, t) : 1;
      f.frost = t < 0 ? 0.85 : 0.85 * (1 - sstep(0, 75, t));
      return f;
    },
    update(f) {
      M.mats.rvacMat.emissive.setRGB(1.0, 0.32, 0.08).multiplyScalar((f.heat || 0) * 1.4);
      M.mats.frost.opacity = f.frost || 0; M.mats.frost.visible = (f.frost || 0) > 0.01;
      R.vent.material.uniforms.uInt.value = f.vent || 0; R.vent.visible = (f.vent || 0) > 0.01;
      const ring = f.ring || 0; M.booster.userData.ringGlow.color.setRGB(0.04 + 2.4 * ring, 0.03 + 0.9 * ring * ring, 0.025 + 0.25 * ring * ring);
    },
  };
}

function init() {
  const root = document.createElement('div'); root.id = 'scam'; root.className = 'scam'; root.hidden = true; root.innerHTML = hudHtml(); document.body.appendChild(root);
  const canvas = root.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 3e9);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 9, maxDistance: 40000, zoomSpeed: 1.15, rotateSpeed: 0.7 });
  camera.position.set(175, -12, 205);
  const world = new THREE.Group(); scene.add(world);
  const { sky, stars } = buildSky(); scene.add(sky, stars);
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.0); scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x6a5c48, 0.7); scene.add(hemi);
  scene.fog = new THREE.FogExp2(0xc8d8ee, 0.00004);

  const M = buildModel(); world.add(M.booster, M.ship);
  M.mats.steel.fog = M.mats.steelDark.fog = M.mats.tiles.fog = false;
  // Starship engines & plumes
  const bFl = flameMesh(ENG_B, 14, 0.62, 1.45); M.booster.add(bFl);
  const bPl = plumeMesh(); bPl.position.y = -1.2; M.booster.add(bPl);
  const bSp = sparks(ENG_B, 700, 1.1); M.booster.add(bSp);
  const sSL = flameMesh(ENG_S.slice(0, 3).map(e => [e[0], e[1], 0, -1.4]), 11, 0.6, 1.3); M.ship.add(sSL);
  const sVac = flameMesh(ENG_S.slice(3).map(e => [e[0], e[1], 0, -2.0]), 16, 1.1, 2.6); sVac.material.uniforms.uVac.value = 1; M.ship.add(sVac);
  const sPl = plumeMesh(); sPl.position.y = -2.0; sPl.material.uniforms.uVac.value = 1; M.ship.add(sPl);
  const sSp = sparks(ENG_S, 200, 0.9); sSp.material.uniforms.uVac.value = 1; M.ship.add(sSp);
  const vent = ventFlames(); M.booster.add(vent);
  const pl = plasma(); M.ship.add(pl);
  const fire = new THREE.PointLight(0xff9a4a, 0, 1500, 1.4); fire.position.y = -14; M.booster.add(fire);
  const sFire = new THREE.PointLight(0x9fa8ff, 0, 400, 1.6); sFire.position.y = -10; M.ship.add(sFire);
  // tanker for orbital refuelling scenes (a second Starship docked aft-to-aft)
  const udS = M.ship.userData; M.ship.userData = {}; const tanker = M.ship.clone(true); M.ship.userData = udS; tanker.traverse(o => { if (o.isPoints || (o.material && o.material.isShaderMaterial) || o.isLight) o.visible = false; });
  tanker.visible = false; world.add(tanker);
  // pad + smoke + ground + planet
  const pad = buildPad(M.mats); world.add(pad);
  const smoke = smokeCloud(1100); world.add(smoke);
  const groundM = new THREE.MeshStandardMaterial({ map: noiseGround('earth'), transparent: true, roughness: 1, metalness: 0, envMapIntensity: 0.35, depthWrite: false });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(20000, 128), groundM); ground.rotation.x = -Math.PI / 2; ground.renderOrder = -1; world.add(ground);
  const planetM = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, envMapIntensity: 0.25 });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 360, 180), planetM); planet.frustumCulled = false; world.add(planet);
  const atm = atmosphereShell(1, 0x6fa8ff); world.add(atm);
  const texL = new THREE.TextureLoader(), planetTexs = {};
  texL.load('vendor/earth-blue-marble.jpg', t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; planetTexs.earth = t; if (R && R.planetKind === 'earth') { planetM.map = t; planetM.color.set(0xffffff); planetM.needsUpdate = true; } });
  const groundTexs = { earth: groundM.map };
  const pmrem = new THREE.PMREMGenerator(renderer), envs = {};
  const envFor = k => envs[k] || (envs[k] = pmrem.fromScene(envScene(k), 0.02).texture);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const haze = new ShaderPass(HazeShader); haze.enabled = false; composer.addPass(haze);
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.45, 0.95); composer.addPass(bloom);
  composer.addPass(new OutputPass());

  R = { root, canvas, renderer, scene, camera, controls, world, sky, stars, sun, hemi, M, vent, pl, tanker, pad, smoke, ground, groundM, groundTexs,
    planet, planetM, planetTexs, atm, qEarth: earthOrientation(25.99, -97.15), envFor, composer, bloom, haze, maxPR: 1, pr: 1, open: false, view: 'chase', track: 'ship', clock: 0, last: 0, fpsT: 0, fpsN: 0, frameMs: 16,
    anchorY: STACK_MID, trackBlend: 1, prevTrackObj: null, curTrackObj: null, planetKind: '', camAnim: null, prevSpeed: null,
    vehs: {}, pads: { starbase: pad }, V: null, camScale: 1, shake: V3(), tod: lsGet('ls_cam_tod') || 'live', quality: lsGet('ls_quality') || (document.getElementById('qualitySel') || {}).value || 'high', flareN: 0, occluded: false, terrains: {} };
  R.vehs.starship = starshipVeh(M, { bFl, bPl, bSp, sSL, sVac, sPl, sSp, fire, sFire });
  R.V = R.vehs.starship;
  q('[data-k="tod"]').value = TOD[R.tod] || R.tod === 'live' ? R.tod : 'live';
  applyQuality(R.quality, true);
  wireUi();
  window.addEventListener('resize', resize);
  window.addEventListener('ls-quality', e => { if (R && e.detail && e.detail !== R.quality) applyQuality(e.detail, true); });
}
function camHelpers() {
  return { THREE, canvasTex, scaleUV, bellPts, flameMesh, plumeMesh, sparks, gridFinTex, latticeTex, smat };
}
function vehicle(id) {
  if (R.vehs[id]) return R.vehs[id];
  const H = camHelpers(), V = id === 'falcon9' ? buildFalcon9(H) : id === 'saturnv' ? buildSaturnV(H) : buildElectron(H);
  V.lower.g.visible = V.upper.g.visible = false; R.world.add(V.lower.g, V.upper.g);
  scalePart(V); R.vehs[id] = V; return V;
}
function padFor(kind) {
  if (R.pads[kind]) return R.pads[kind];
  const H = camHelpers(), p = kind === 'lc1' ? buildPadLC1(H) : buildPadLC39(H, kind); p.visible = false; R.world.add(p); return (R.pads[kind] = p);
}
function scalePart(V) { // particle budgets follow the quality preset
  const k = QUALITY[R.quality].part;
  [V.lower.sp, V.upper.sp].forEach(p => { if (p) { const n = p.geometry.attributes.position.count; p.geometry.setDrawRange(0, Math.max(8, Math.round(n * k))); } });
}
function applyQuality(qk, fromEvent) {
  if (!QUALITY[qk]) qk = 'high';
  R.quality = qk; const Q = QUALITY[qk]; lsSet('ls_quality', qk);
  R.maxPR = Math.min(window.devicePixelRatio || 1, Q.pr); R.pr = Math.min(R.pr || R.maxPR, R.maxPR); if (qk === 'high') R.pr = R.maxPR;
  R.bloom.enabled = Q.bloom; q('[data-k="bloom"]').checked = Q.bloom;
  Object.values(R.vehs).forEach(scalePart);
  const n = R.smoke.geometry.attributes.position.count; R.smoke.geometry.setDrawRange(0, Math.round(n * Q.part));
  if (R.dust) R.dust.geometry.setDrawRange(0, Math.round(R.dust.geometry.attributes.position.count * Q.part));
  R.root.querySelectorAll('[data-q]').forEach(b => b.classList.toggle('on', b.dataset.q === qk));
  if (!fromEvent) window.dispatchEvent(new CustomEvent('ls-quality', { detail: qk }));
  resize();
}
function resize() {
  if (!R || !R.open) return;
  const w = window.innerWidth, h = window.innerHeight;
  R.renderer.setPixelRatio(R.pr); R.renderer.setSize(w, h, false); R.composer.setPixelRatio(R.pr); R.composer.setSize(w, h);
  R.camera.aspect = w / h;
  // phone: when the controls sheet is open, shift the picture up so the rocket stays visible above it
  const pnl = R.root.classList.contains('ctl-open') && w <= 820 && R.root.querySelector('.scam-panel');
  const off = pnl ? Math.min(h * 0.3, (h - pnl.getBoundingClientRect().top) * 0.5) : 0;
  if (off > 4) R.camera.setViewOffset(w, h, 0, off, w, h); else R.camera.clearViewOffset();
  R.camera.updateProjectionMatrix();
}
const q = sel => R.root.querySelector(sel);
function wireUi() {
  R.root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'close') return close();
    if (b.dataset.act === 'focus') { if (window.__focus) window.__focus.toggle(); return; }
    if (b.dataset.act === 'ctl') { const o = R.root.classList.toggle('ctl-open'); b.setAttribute('aria-expanded', o); resize(); return; }
    if (b.dataset.act === 'splay') { const S = window.__space; if (S) S.setPlaying(!S.playing); return; }
    if (b.dataset.view) setView(b.dataset.view);
    if (b.dataset.track) setTrack(b.dataset.track);
    if (b.dataset.speed) { const sb = document.querySelector(`#speedSeg button[data-speed="${b.dataset.speed}"]`); if (sb) sb.click(); syncSeg(); }
    if (b.dataset.jump) jump(b.dataset.jump);
    if (b.dataset.veh) selectVehicle(b.dataset.veh);
    if (b.dataset.q) applyQuality(b.dataset.q);
  });
  q('[data-k="phases"]').onchange = e => { const S = window.__space; if (S && S.mission) { S.t = S.mission.phases[+e.target.value].t + 1; } };
  q('[data-k="bloom"]').onchange = e => { R.bloom.enabled = e.target.checked; };
  q('[data-k="tod"]').onchange = e => { R.tod = e.target.value; lsSet('ls_cam_tod', R.tod); };
  window.addEventListener('keydown', e => {
    if (!R.open || e.target.closest('input,select,textarea')) return;
    if (e.key === 'Escape' && $('countdown').hidden) { if (R.root.classList.contains('ctl-open')) { R.root.classList.remove('ctl-open'); resize(); return; } close(); }
    else if (e.key >= '1' && e.key <= '5') { const v = ['chase', 'engines', 'nose', 'wide', 'ground'][+e.key - 1]; if (v !== 'ground' || R.mode === 'launch') setView(v); }
  });
}
function syncSeg() {
  R.root.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === R.view));
  R.root.querySelectorAll('[data-track]').forEach(b => b.classList.toggle('on', b.dataset.track === R.track));
  R.root.querySelectorAll('[data-veh]').forEach(b => b.classList.toggle('on', R.V && b.dataset.veh === R.V.id));
  if (G) R.root.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === G.state.speed));
}
const VIEWS = { // camera offset (relative to the anchor, scaled to the vehicle's size) and anchor position along the vehicle axis
  chase: { cam: [175, -12, 205], anchor: 'mid' }, engines: { cam: [42, -9, 50], anchor: 'aft' }, nose: { cam: [-30, 16, 48], anchor: 'top' },
  wide: { cam: [900, 120, 1300], anchor: 'mid' }, ground: { anchor: 'mid' } };
function setView(v) {
  const prev = R.view; R.view = v; syncSeg();
  R.controls.enabled = v !== 'ground';
  if (v === 'ground') return;
  if (prev === 'ground') { R.camera.fov = 40; R.camera.updateProjectionMatrix(); }
  const c = VIEWS[v].cam, scale = (R.mode === 'space' || R.attached === false ? 0.62 : 1) * R.camScale;
  R.camAnim = { from: R.camera.position.clone(), to: V3(c[0] * scale, c[1] * scale, c[2] * scale), t: 0, dur: prev === 'ground' ? 0.01 : 1.1 };
}
function setTrack(t) {
  if (t === R.track) return;
  if (t === 'booster' && R.V && R.V.expendable) return;
  R.track = t; R.trackBlend = 0; syncSeg();
}
function camRun() { const runs = G.state.runs; return runs[0] && CAM_IDS.includes(runs[0].preset.id) ? runs[0] : runs.find(x => CAM_IDS.includes(x.preset.id)); }
function jump(k) {
  const st = G.state, r = camRun(); if (!r) return;
  const V = R.V, tSep = r.booster ? r.booster.samples[0].t : (r.preset.tSep || 160), ps = r.booster ? phaseStarts(r.booster) : {};
  const T = { pad: 0, maxq: V.id === 'electron' ? 62 : 70, stage: tSep - 9, space: tSep + 80, seco: (r.preset.ascentTime || 510) - 12, catch: (ps['Landing burn'] || 380) - 22 }[k];
  if (k === 'catch') { if (!r.booster) return; setTrack('booster'); } else if (k !== 'pad') setTrack('ship');
  if (k === 'pad') { G.setPlaying(false); st.t = 0; G.draw(true); return; }
  st.t = Math.min(T, st.maxEnd - 1); G.draw(true);
  if (!st.playing) G.setPlaying(true);
}
// pick a rocket for the cam: sets vehicle A (and a matching launch site) in the main simulator
function selectVehicle(id) {
  if (!CAM_IDS.includes(id)) return false;
  const st = G.state, a = st.runs[0];
  if (a && a.preset.id === id) return true;
  try {
    G.setPlaying(false);
    const fs = $('fromSel'), site = SITE_FOR[id];
    if (st.from && st.from.id !== site && [...fs.options].some(o => o.value === site)) { fs.value = site; fs.dispatchEvent(new Event('change')); }
    G.openPicker('a');
    const it = document.querySelector(`#vpopList .vpop-item[data-id="${id}"]`);
    if (it) it.click(); else if (G.closePicker) G.closePicker();
  } catch (e) { console.warn(e); }
  R.track = 'ship'; R.curTrackObj = null; syncSeg();
  return st.runs.some(r => r.preset.id === id);
}

// ---------------------------------------------------------------- per-frame state from the simulation
function setEngines(mesh, count, int) {
  const on = mesh.userData.on; for (let i = 0; i < on.length; i++) on[i] = i < count ? 1 : 0;
  mesh.geometry.attributes.aOn.needsUpdate = true; mesh.material.uniforms.uInt.value = int; mesh.visible = int > 0.01 && count > 0;
}
const cOff = new THREE.Color(0.035, 0.03, 0.026), cTmp = new THREE.Color();
function setBells(inner, count, int, vac, fuel) {
  const hot = fuel === 2 ? cTmp.setRGB(0.7, 0.75, 1.0).multiplyScalar(0.4 + 1.4 * int) : cTmp.setRGB(vac ? 0.75 : 1.0, vac ? 0.7 : 0.62, vac ? 1.0 : 0.38).multiplyScalar(0.6 + 2.2 * int);
  if (fuel === 1) hot.setRGB(1.0, 0.7, 0.35).multiplyScalar(0.6 + 2.4 * int);
  if (inner.isInstancedMesh) { for (let i = 0; i < inner.count; i++) inner.setColorAt(i, i < count && int > 0.01 ? hot : cOff); inner.instanceColor.needsUpdate = true; }
  else inner.forEach((m, i) => m.material.color.copy(i < count && int > 0.01 ? hot : cOff));
}
function plumeShape(pl, k, hM, int, vac) {
  const thin = sstep(4000, 50000, hM), u = pl.material.uniforms;
  u.uInt.value = int * (vac ? 0.45 : 0.75) * (1 - 0.7 * thin); u.uThin.value = thin; pl.visible = int > 0.01;
  const L = (vac ? lerp(60, 260, thin) : lerp(140, 360, thin)) * k, r0 = 4.6 * k, r1 = (vac ? lerp(14, 150, thin) : lerp(19, 170, Math.pow(thin, 1.2))) * k;
  // stretch a unit-radius envelope: radius r0 at the nozzle plane growing to r1 at the tail
  const p = pl.geometry.attributes.position, base = pl.userData.base || (pl.userData.base = Float32Array.from(p.array));
  const key = Math.round(L * 4) + ':' + Math.round(r1 * 4);
  if (pl.userData.key !== key) {
    pl.userData.key = key;
    for (let i = 0; i < p.count; i++) { const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2], y = -by, r = r0 + (r1 - r0) * Math.pow(y, 0.6); p.setXYZ(i, bx * r, by * L, bz * r); }
    p.needsUpdate = true; pl.geometry.computeVertexNormals();
  }
  pl.userData.L = L; pl.userData.r = r0 + (r1 - r0) * 0.5;
}
function applyRig(rig, ns, I, hM, upper) {
  const thin = sstep(4000, 50000, hM); let tot = 0, anyVac = false;
  rig.sets.forEach((s, i) => {
    const n = ns[i] || 0; tot += n; if (n > 0 && s.vac) anyVac = true;
    setEngines(s.fl, n, I); setBells(s.bells, n, I, s.vac, s.fuel);
    const a = s.lenA || (s.vac ? s.len : s.len * 1.5), b = s.lenB || (s.vac ? s.len * 1.9 : s.len * 2.6);
    setFlameLen(s.fl, lerp(a, b, thin), lerp(1, s.vac ? 1.8 : 2.6, thin));
    const fu = s.fl.material.uniforms; fu.uDia.value = (1 - sstep(2500, 16000, hM)) * (s.vac ? 0.4 : 1); fu.uThin.value = thin;
  });
  const maxN = rig.sets.reduce((m, s) => m + s.n, 0), frac = tot / Math.max(1, maxN);
  const vac = upper && (anyVac || hM > 30000);
  plumeShape(rig.pl, rig.k, hM, I * Math.min(1, frac * 2.5 + 0.25) * (upper && !anyVac ? 0.6 : 1), vac);
  const su = rig.sp.material.uniforms, ks = Math.max(0.25, Math.sqrt(rig.k));
  su.uInt.value = I; su.uActive.value = upper ? tot : (ns[0] || 0);
  su.uSpeed.value = (upper ? 140 : lerp(70, 160, sstep(3000, 40000, hM))) * ks; su.uSpread.value = upper ? 0.45 : lerp(0.12, 0.5, sstep(3000, 40000, hM)); rig.sp.visible = I > 0.01 && tot > 0;
  rig.fire.intensity = upper ? I * 250 * rig.k * rig.k : (I * (frac * 0.8 + 0.2) * 1600 * (1 - sstep(500, 6000, hM)) + I * 120) * Math.max(0.05, rig.k * rig.k);
}
function launchFrame(dt) {
  const st = G.state, r = camRun();
  if (!r) return null;
  const V = vehicleFor(r.preset.id), L = V.lower, U = V.upper;
  const cd = (G.countdownLeft && G.countdownLeft()) || 0;
  let t = st.t; if (t <= 0.001 && cd > 0) t = -cd;
  const tc = Math.max(0, t), B = r.booster, tSep = B ? B.samples[0].t : (r.preset.tSep || 160), tSeco = r.preset.ascentTime || 510;
  const ps = B ? phaseStarts(B) : null;
  const P = tt => { const qq = Sim.stateAt(r, Math.max(0, tt)); return posSH(qq.s, qq.h); };
  const axisAt = tt => { const a = P(tt - 0.5), u = upAt(a); if (tt < 2) return u; const d = P(tt + 0.5).sub(a); if (d.length() < 1e-3) return u; return u.lerp(d.normalize(), sstep(3, 24, tt)).normalize(); };
  const s0 = Sim.stateAt(r, tc), axisS = axisAt(tc), p0 = P(tc), u0 = upAt(p0);
  const f = { mode: 'launch', t, tSep, attached: t < tSep, planet: 'earth', V };
  const ROLL = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI); // Starship: heat shield away from the default camera
  const qS = quatAxis(axisS).multiply(ROLL), padH = V.padH;
  const stackBase = p0.clone().add(u0.clone().multiplyScalar(padH));
  if (f.attached) {
    f.bPos = stackBase; f.bQ = qS; f.sPos = stackBase.clone().add(axisS.clone().multiplyScalar(V.gap)); f.sQ = qS;
    f.sH = s0.h * 1000; f.bH = f.sH; f.sV = s0.v; f.bV = s0.v; f.sPhase = f.bPhase = s0.phase;
  } else {
    const tau = t - tSep, sep = 0.5 * (V.star ? 14 : 8) * Math.min(tau, 25) ** 2;
    f.sPos = stackBase.clone().add(axisS.clone().multiplyScalar(V.gap + sep)); f.sQ = qS; f.sH = s0.h * 1000; f.sV = s0.v; f.sPhase = s0.phase;
    const near = stackBase.clone().sub(axisS.clone().multiplyScalar(0.5 * 5 * tau * tau)).sub(u0.clone().multiplyScalar(0.5 * 4 * tau * tau));
    const qStage = quatAxis(axisAt(tSep)).multiply(ROLL);
    if (B && V.star) {
      const tCoast = ps['Coast & descent'] || tSep + 60, tLand = ps['Landing burn'] || tSep + 220, tDone = ps['Back at launch site'] || tLand + 30;
      const bs = Sim.stateAt(B, t), bp = posSH(bs.s, bs.h), ub = upAt(bp), db = V3(ub.y, -ub.x, 0);
      f.bPos = near.lerp(bp.clone().add(ub.clone().multiplyScalar(PAD_H)), sstep(10, 50, tau)); f.bH = bs.h * 1000; f.bV = bs.v; f.bPhase = bs.phase;
      const qBack = quatAxis(db.clone().multiplyScalar(-Math.cos(0.25)).add(ub.clone().multiplyScalar(Math.sin(0.25)))), qUp = quatAxis(ub);
      let qb = tau < 2 ? qStage : qStage.clone().slerp(qBack, sstep(2, 14, tau));
      if (t >= tCoast) qb = qBack.clone().slerp(qUp, sstep(tCoast, tCoast + 30, t));
      f.bQ = qb;
      if (t >= tDone) { f.bPos = V3(0, PAD_H, 0); f.bQ = new THREE.Quaternion(); }
    } else if (B && B.drone) {
      // Falcon 9: flip to engines-first (retrograde), entry burn, landing burn, legs out, touchdown on the drone ship
      const DECK = R.drone ? R.drone.userData.DECK + 6.95 : 9;
      const bs = Sim.stateAt(B, t), bp = posSH(bs.s, bs.h), ub = upAt(bp);
      const vA = Sim.stateAt(B, t - 0.5), vB = Sim.stateAt(B, t + 0.5), dv = posSH(vB.s, vB.h).sub(posSH(vA.s, vA.h));
      const retro = dv.length() > 1 ? dv.normalize().negate() : ub.clone();
      f.bPos = near.lerp(bp.clone().add(ub.clone().multiplyScalar(DECK)), sstep(10, 50, tau)); f.bH = bs.h * 1000; f.bV = bs.v; f.bPhase = bs.phase;
      const tDone = ps['Landed on the drone ship'] || 1e9, qUp = quatAxis(ub);
      let qb = tau < 2 ? qStage : qStage.clone().slerp(quatAxis(retro), sstep(2, 22, tau));
      qb = qb.slerp(qUp, sstep(tDone - 14, tDone - 2, t));
      f.bQ = qb;
      if (t >= tDone) { f.bPos = posSH(B.length || bs.s, 0).add(ub.clone().multiplyScalar(DECK)); f.bQ = qUp; }
    } else {
      // expendable lower stage: falls away behind and slowly tumbles
      f.bPos = near; f.bQ = qStage.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), 0.012 * tau * tau / (1 + tau * 0.05)));
      f.bH = Math.max(0, f.sH - 0.5 * 9 * tau * tau); f.bV = s0.v; f.bPhase = 'Spent stage falling away';
      f.bGone = tau > 240;
    }
  }
  const o = V.sched(t, { tSep, tSeco, ps });
  Object.assign(f, o);
  f.smokeT = t; f.plasma = 0; f.tank = false;
  f.met = (t < 0 ? 'T−' : 'T+') + fmtMet(Math.abs(t));
  if (t < 0) f.phaseTxt = cd > 3 ? 'Final countdown' : V.id === 'saturnv' ? 'Ignition sequence start' : 'Engine ignition sequence';
  else if (t === 0 && !st.playing) f.phaseTxt = 'On the pad – press LAUNCH';
  f.note = f.attached ? (t > 0 ? V.labels.stack : '') : '';
  f.gAcc = accelG(r, tc);
  return f;
}
function accelG(r, t) { // acceleration along the path (dv/dt) in g – the same measure as the mission-control graph
  const a = Sim.stateAt(r, Math.max(0, t - 1)), b = Sim.stateAt(r, t + 1);
  return Math.abs((b.v - a.v) / 3.6 / ((b.t - a.t) || 2)) / 9.81;
}
function vehicleFor(id) {
  const V = id === 'starship' ? R.vehs.starship : vehicle(id);
  if (R.V !== V) {
    if (R.V) { R.V.lower.g.visible = false; R.V.upper.g.visible = false; }
    R.V = V; R.camScale = V.Htot / 121.5; R.controls.minDistance = Math.max(2, 9 * R.camScale);
    R.curTrackObj = null; if (V.expendable) R.track = 'ship';
    q('[data-k="vname"]').textContent = V.name;
    q('[data-k="jstage"]').textContent = V.labels.stage || 'Stage separation';
    const jl = q('[data-k="jland"]'); jl.textContent = V.labels.land || ''; jl.hidden = !V.labels.land;
    q('[data-k="trackrow"]').hidden = !!V.expendable || R.mode === 'space';
    q('[data-k="trackU"]').textContent = V.labels.trackU || 'Upper stage'; q('[data-k="trackL"]').textContent = V.labels.trackL || 'Booster';
    syncSeg(); setView(R.view === 'ground' ? 'ground' : R.view);
  }
  return V;
}
function fmtMet(s) { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0'); }
function spaceFrame() {
  const S = window.__space; if (!S || !S.mission) return null;
  const m = S.mission, st = m.at(S.t), ph = st.phase, n = ph.name, L = st.local, mars = m.kind === 'mars', T = S.t;
  const f = { mode: 'space', t: T, attached: false, bN: 0, bI: 0, sI: 0, sN: [3, 3], heat: 0, vent: 0, ring: 0, plasma: 0, tank: false, arms: 1, smokeT: -99, legs: 0, V: R.vehs.starship };
  const horiz = quatBasis(V3(1, 0, 0), V3(0, -1, 0)), vert = quatBasis(V3(0, 1, 0), V3(0, 0, -1)), retro = quatBasis(V3(-1, 0, 0), V3(0, -1, 0));
  let planet = 'earth', alt = 250e3, q = horiz, spd = st.speed * 3600, spdLab = 'Speed vs Sun';
  const altE = (mars ? st.dEarth - 6371 : st.dEarth) * 1000;
  if (T < 0) {
    if (m.dock && m.plan && m.plan.n) for (let k = 0; k < m.plan.n; k++) if (Math.abs(T - m.dock(k)) < 4 * 3600) f.tank = true;
    f.note = f.tank ? 'Tanker docked – transferring propellant ship-to-ship' : 'Waiting in low Earth orbit for the next tanker';
    spd = 7.75 * 3600; spdLab = 'Orbital speed';
  } else if (/injection burn/.test(n)) {
    alt = Math.max(250e3, altE); f.sI = (T - ph.t) < (mars ? 330 : 250) ? 1 : 0; f.heat = f.sI ? sstep(0, 120, T - ph.t) : 0.6;
    spd = (mars ? null : st.speedGeo * 3600) || (7.75 + 3.6 * sstep(0, 330, T)) * 3600; spdLab = 'Speed vs Earth';
    f.note = f.sI ? 'All six Raptors firing – departure burn' : 'Burn complete – coasting away from Earth';
  } else if (L && (ph.edl || ph.lunar)) {
    planet = mars ? 'mars' : 'moon'; alt = Math.max(0, L.h * 1000); spd = L.v * 3600; spdLab = mars ? 'Speed vs Mars' : 'Speed vs Moon';
    const st2 = m.at(S.t + 1), dh = st2.local ? (st2.local.h - L.h) * 1000 : 0, v = Math.max(1, L.v * 1000), gam = Math.asin(clamp(dh / v, -1, 1));
    const vel = V3(Math.cos(gam), Math.sin(gam), 0);
    if (mars) {
      const te = L.te, aoa = lerp(70, 88, sstep(60, 300, te)) * Math.PI / 180;
      const flop = quatBasis(V3(Math.cos(gam + aoa), Math.sin(gam + aoa), 0), vel);
      q = flop;
      if (/Flip/.test(n)) { q = flop.clone().slerp(vert, sstep(0, 7, te - 420)); f.sI = 1; f.sN = [3, 0]; }
      if (ph.done) { q = vert; f.sI = 0; alt = 0; }
      f.plasma = clamp(Math.exp(-(L.h - 62) / 13) * Math.pow(L.v / 5, 3), 0, 1.1) * sstep(0.9, 2.2, L.v) * (1 - sstep(105, 125, L.h));
      f.note = f.plasma > 0.2 ? 'Entry plasma: the heat shield takes the heat' : /Flip/.test(n) ? 'Flip manoeuvre & landing burn (sea-level Raptors)' : ph.done ? 'Landed on Mars – standing on its legs' : 'Belly-flop descent: flaps steer like a skydiver';
    } else {
      if (/insertion/.test(n)) { q = retro; f.sI = (T - ph.t) < 220 ? 1 : 0; f.note = f.sI ? 'Braking burn into lunar orbit' : ''; }
      else if (/Low lunar/.test(n)) { q = horiz; f.note = '100 km above the Moon'; }
      else if (/Powered descent/.test(n)) { q = retro.clone().slerp(vert, sstep(12, 0.8, L.h)); f.sI = 1; f.sN = [3, 0]; f.note = 'Powered descent – braking towards the surface'; }
      else if (/Terminal/.test(n)) { q = vert; f.sI = 1; f.sN = [3, 0]; f.note = 'Terminal descent – engines blasting the regolith'; }
      else if (ph.done) { q = vert; alt = 0; f.note = 'Landed on the Moon – standing on its legs'; }
    }
    f.legs = ph.done ? 1 : sstep(3000, 1200, alt) * (f.sN[1] === 0 ? 1 : 0);
    if (f.sI > 0 && alt < 200 && f.sN[1] === 0) f.note = mars ? 'Landing burn – kicking up red Martian dust' : 'Landing burn – a sheet of lunar dust races outwards';
  } else {
    // coasting: show whichever body is reasonably near, otherwise deep space
    const dT = mars ? (st.dTarget - 3389.5) * 1000 : st.dTarget * 1000;
    if (/approach/i.test(n) && dT < 4e8) { planet = mars ? 'mars' : 'moon'; alt = dT; }
    else if (altE < 4e8) { planet = 'earth'; alt = altE; } else planet = 'none';
    if (planet === 'none') { alt = 1e9; f.altLab = 'From Earth'; f.altVal = (st.dEarth / 1e6).toLocaleString('en-GB', { maximumFractionDigits: 1 }) + ' million km'; }
    if (!mars) { spd = st.speedGeo * 3600; spdLab = 'Speed vs Earth'; }
    f.note = planet === 'none' ? 'Interplanetary cruise – coasting, engines off' : 'Coasting';
  }
  const lift = 2.8 * (f.legs || 0) * (1 - sstep(30, 300, alt)); // stands on its legs after touchdown
  f.planet = planet; f.alt = alt; f.sPos = V3(0, alt + lift, 0); f.sQ = q; f.sH = alt; f.sV = spd; f.spdLab = spdLab;
  f.sPhase = n; f.met = S.met ? S.met(T) : fmtMet(T); f.phaseTxt = n;
  return f;
}

// ---------------------------------------------------------------- apply a frame & render
const PLANETS = { earth: { R: R_E, atm: 0x6fa8ff, atmI: 1 }, mars: { R: R_MARS, atm: 0xe0a070, atmI: 0.55 }, moon: { R: R_MOON, atm: 0x000000, atmI: 0 } };
function setPlanet(kind) {
  if (R.planetKind === kind) return; R.planetKind = kind;
  const P = PLANETS[kind];
  R.planet.visible = R.atm.visible = !!P; if (!P) return;
  if (kind === 'earth') { R.planetM.map = R.planetTexs.earth || null; R.planetM.color.set(R.planetTexs.earth ? 0xffffff : 0x3a6ea8); R.planet.quaternion.copy(R.qEarth); }
  else { R.planetTexs[kind] = R.planetTexs[kind] || planetTex(kind); R.planetM.map = R.planetTexs[kind]; R.planetM.color.set(0xffffff); R.planet.quaternion.setFromAxisAngle(V3(1, 0, 0), Math.PI / 2); } // equator (not the polar cap) below
  R.planetM.needsUpdate = true;
  R.planet.scale.setScalar(P.R); R.planet.position.set(0, -P.R - (kind === 'earth' ? 4 : 160), 0); // Moon/Mars: room for crater floors in the local terrain
  R.atm.scale.setScalar(P.R); R.atm.position.copy(R.planet.position); R.atm.material.uniforms.uCol.value.set(P.atm); R.atm.material.uniforms.uInt.value = P.atmI; R.atm.visible = P.atmI > 0;
  if (kind !== 'earth' || R.mode === 'space') {
    const gk = kind === 'earth' ? 'earth' : kind; R.groundTexs[gk] = R.groundTexs[gk] || noiseGround(gk); R.groundM.map = R.groundTexs[gk]; R.groundM.needsUpdate = true;
  } else { R.groundM.map = R.groundTexs.earth; R.groundM.needsUpdate = true; }
}
function anchorOf(obj, f) {
  const k = VIEWS[R.view].anchor, V = f.V, L = V.lower, U = V.upper;
  if (obj !== 'ship' && !f.bPos) obj = 'ship';
  const ay = U.aftY || 0;
  const spec = obj === 'stack' ? { pos: f.bPos, q: f.bQ, mid: V.stackMid || V.Htot * 0.4, aft: L.aft, top: V.gap + U.top } : obj === 'booster' ? { pos: f.bPos, q: f.bQ, mid: L.mid, aft: L.aft, top: L.top }
    : { pos: f.sPos, q: f.sQ, mid: ay ? ay + (U.top - ay) * 0.45 : U.mid, aft: ay + U.aft, top: U.top };
  return spec.pos.clone().add(UP.clone().applyQuaternion(spec.q).multiplyScalar(spec[k]));
}
function terrainFor(kind) {
  if (!R.terrains[kind]) {
    R.groundTexs[kind] = R.groundTexs[kind] || noiseGround(kind);
    const t = buildTerrain(camHelpers(), kind, R.groundTexs[kind]); t.visible = false; R.world.add(t); R.terrains[kind] = t;
  }
  return R.terrains[kind];
}
function tick(now) {
  if (!R.open) return;
  requestAnimationFrame(tick);
  const dt = Math.min(0.1, (now - (R.last || now)) / 1000); R.last = now;
  // adaptive resolution keeps the frame rate up on slower GPUs (within the chosen quality preset)
  R.fpsT += dt; R.fpsN++; R.frameMs = R.frameMs * 0.95 + dt * 1000 * 0.05;
  if (R.fpsT > 1.5) {
    const fps = R.fpsN / R.fpsT; R.fpsT = 0; R.fpsN = 0; q('[data-k="fps"]').textContent = Math.round(fps) + ' fps · ' + R.pr.toFixed(2) + '×';
    if (R.lockPR) {} else if (fps < 45 && R.pr > 0.5) { R.pr = Math.max(0.5, R.pr - 0.15); resize(); } else if (fps > 58 && R.pr < R.maxPR) { R.pr = Math.min(R.maxPR, R.pr + 0.1); resize(); }
  }
  const S = window.__space;
  R.mode = S && S.active ? 'space' : 'launch';
  if (R.mode !== R.lastMode) { R.lastMode = R.mode; R.curTrackObj = null; R.prevTrackObj = null; if (R.mode === 'space') vehicleFor('starship'); modeUi(); }
  const f = R.mode === 'space' ? spaceFrame() : launchFrame(dt);
  const msg = q('[data-k="msg"]');
  if (!f) {
    msg.hidden = false; msg.innerHTML = 'None of the 3D-cam rockets is in this scenario. Pick one:<div class="scam-msg-btns">' + CAM_IDS.map(id => `<button data-veh="${id}">${{ starship: 'Starship', falcon9: 'Falcon 9', saturnv: 'Saturn V', electron: 'Electron' }[id]}</button>`).join('') + '</div>';
    R.renderer.render(R.scene, R.camera); return;
  }
  msg.hidden = true;
  const playing = R.mode === 'space' ? S.playing : (G.state.playing || ((G.countdownLeft && G.countdownLeft()) || 0) > 0);
  R.clock += playing ? dt : 0;
  const V = f.V, Lr = V.lower, Ur = V.upper, M = R.M, launch = f.mode === 'launch';
  // place vehicles (pad frame: origin at the launch mount, +Y up, +X downrange/east)
  Ur.g.visible = true; Ur.g.position.copy(f.sPos); Ur.g.quaternion.copy(f.sQ);
  Lr.g.visible = launch && !f.bGone;
  if (Lr.g.visible) { Lr.g.position.copy(f.bPos); Lr.g.quaternion.copy(f.bQ); }
  R.tanker.visible = !!f.tank;
  if (f.tank) { R.tanker.position.copy(f.sPos).add(V3(-2.2, 0, 0).applyQuaternion(f.sQ)); R.tanker.quaternion.copy(f.sQ).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), Math.PI)); }
  // engines, plumes, glows
  const tm = R.clock;
  [Lr, Ur].forEach(rig => { rig.sets.forEach(s => { s.fl.material.uniforms.uTime.value = tm; }); rig.pl.material.uniforms.uTime.value = tm; rig.sp.material.uniforms.uTime.value = tm; });
  [R.vent, R.pl.userData.sheath, R.pl.userData.wake].forEach(m => { m.material.uniforms.uTime.value = tm; });
  const pxScale = R.renderer.domElement.height / (2 * Math.tan(R.camera.fov * Math.PI / 360));
  [Lr.sp, Ur.sp, R.smoke].forEach(p => { p.material.uniforms.uScale.value = pxScale; });
  if (Lr.g.visible) applyRig(Lr, [f.bN], f.bI, f.bH, false);
  applyRig(Ur, f.sN, f.sI, f.sH, true);
  if (V.update) V.update(f);
  if (V.star) {
    const pu = R.pl.userData; pu.sheath.material.uniforms.uInt.value = f.plasma; pu.wake.material.uniforms.uInt.value = f.plasma; R.pl.visible = f.plasma > 0.01;
    if (R.pl.visible && f.mode === 'space') { // wake trails opposite to the velocity: point it back along -X in the local frame
      const inv = f.sQ.clone().invert(); pu.wake.quaternion.copy(inv.clone().multiply(quatAxis(V3(1, 0.15, 0)))); pu.wake.position.copy(V3(0, 22, 0));
    }
    M.ship.userData.flaps.forEach((fl, i) => { const a = f.mode === 'space' && f.planet === 'mars' && f.alt < 60000 && f.alt > 0 ? Math.sin(tm * 1.3 + i) * 0.12 : 0; fl.pivot.rotation.x = a; });
    const legs = f.legs || 0; M.ship.userData.legs.forEach(p => { p.visible = !launch && (f.planet === 'mars' || f.planet === 'moon'); p.rotation.x = legs * 2.78; });
    R.pad.userData.arms.forEach(a => { a.piv.rotation.y = a.s * 0.95 * f.arms; });
  }
  // world: pad / drone ship / smoke / ground / planet / terrain
  if (launch) {
    const fr = G.state.from, key = fr ? fr.lat + ',' + fr.lng : '';
    if (key && R.earthKey !== key) { R.earthKey = key; R.qEarth = earthOrientation(fr.lat, fr.lng); if (R.planetKind === 'earth') R.planet.quaternion.copy(R.qEarth); }
  }
  setPlanet(launch ? 'earth' : f.planet === 'none' ? 'none' : f.planet);
  const padNow = launch ? padFor(V.pad) : null;
  Object.values(R.pads).forEach(p => { p.visible = p === padNow; });
  if (padNow && padNow.userData.anim) padNow.userData.anim(f.t);
  const r = launch && camRun(), B = r && r.booster;
  if (launch && V.drone && B && B.drone) {
    if (!R.drone) { R.drone = buildDroneShip(camHelpers()); R.world.add(R.drone); }
    const sD = B.length || 610, th = sD * 1000 / R_E; R.drone.position.copy(posSH(sD, 0)); R.drone.quaternion.setFromAxisAngle(V3(0, 0, 1), -th);
    R.drone.visible = true; R.drone.position.add(upAt(R.drone.position).multiplyScalar(Math.sin(tm * 0.7) * 0.25));
    const wu = R.drone.userData.water.material.uniforms; wu.uTime.value = tm; wu.uFoam.value = f.bN > 0 && f.bH < 400 ? f.bI : 0;
  } else if (R.drone) R.drone.visible = false;
  R.smoke.visible = launch && f.smokeT > -3 && f.smokeT < 120 && (f.smokeT !== 0 || playing);
  const su2 = R.smoke.material.uniforms; su2.uT.value = f.smokeT; su2.uGlow.value = f.bI * (1 - sstep(200, 2500, f.bH)) * 0.9; su2.uK.value = V.smokeK || 1;
  const landKind = !launch && (f.planet === 'mars' || f.planet === 'moon') && (f.alt || 0) < 60000 ? f.planet : null;
  Object.entries(R.terrains).forEach(([k, t]) => { t.visible = k === landKind; });
  if (landKind) terrainFor(landKind).visible = true;
  if (landKind) {
    if (!R.dust) { R.dust = buildDust(camHelpers()); R.world.add(R.dust); R.dust.geometry.setDrawRange(0, Math.round(R.dust.geometry.attributes.position.count * QUALITY[R.quality].part)); }
    const du = R.dust.material.uniforms, mars = landKind === 'mars';
    du.uTime.value = tm; du.uMars.value = mars ? 1 : 0; du.uScale.value = pxScale; du.uCol.value.setRGB(mars ? 0.74 : 0.58, mars ? 0.45 : 0.57, mars ? 0.3 : 0.56);
    du.uInt.value = f.sI * (1 - sstep(25, 170, f.alt)); R.dust.visible = du.uInt.value > 0.01;
  } else if (R.dust) R.dust.visible = false;
  // tracked object + smooth hand-over (stack → ship/booster, ship ↔ booster)
  const obj = f.attached ? 'stack' : R.mode === 'space' || V.expendable ? 'ship' : R.track;
  if (obj !== R.curTrackObj) { R.prevTrackObj = R.curTrackObj || obj; R.curTrackObj = obj; R.trackBlend = R.prevTrackObj === obj ? 1 : 0; }
  if (R.lastT != null && Math.abs(f.t - R.lastT) > 3) { R.trackBlend = 1; } // time jump: snap, don't glide between far-apart anchors
  R.lastT = f.t;
  R.trackBlend = Math.min(1, R.trackBlend + dt / (R.prevTrackObj === 'stack' ? 1.0 : 1.8));
  let A = anchorOf(obj, f);
  if (R.trackBlend < 1 && R.prevTrackObj !== obj) { const A0 = anchorOf(R.prevTrackObj, f); if (A0.distanceTo(A) > 3000) R.trackBlend = 1; else A = A0.lerp(A, sstep(0, 1, R.trackBlend)); }
  // camera-relative world: tracked point at the origin, local vertical = +Y (keeps precision at 1000s of km)
  const th = launch ? Math.atan2(A.x, A.y + R_E) : 0;
  R.world.quaternion.setFromAxisAngle(V3(0, 0, 1), th);
  R.world.position.copy(A).applyQuaternion(R.world.quaternion).negate();
  R.world.updateMatrixWorld(true);
  const hc = launch ? (V3(A.x, A.y + R_E, 0).length() - R_E) : Math.max(0, (f.alt || 0) + (A.y - f.sPos.y));
  // camera (+ liftoff shake: strongest close to the pad while the first stage is roaring)
  R.camera.position.sub(R.shake); R.shake.set(0, 0, 0);
  const hStack = f.attached ? f.sH : f.bH;
  const shakeAmp = launch && f.bI > 0.05 && f.t > -1.5 ? f.bI * (1 - sstep(400, 4000, hStack || 0)) : 0;
  if (R.view === 'ground' && launch) {
    const cg = R.world.localToWorld(V3(-1450, 6, 1250)); R.camera.position.copy(cg); R.camera.lookAt(0, 0, 0);
    R.camera.fov = clamp(2 * Math.atan(80 * R.camScale / Math.max(1, cg.length())) * 180 / Math.PI, 0.15, 45); R.camera.updateProjectionMatrix();
    if (shakeAmp > 0) { const a = shakeAmp * 0.00025 * (1 - sstep(4, 30, f.t)); R.camera.rotateX(Math.sin(tm * 47) * a); R.camera.rotateY(Math.sin(tm * 39 + 1) * a); }
  } else {
    if (R.view === 'ground') setView('chase');
    if (R.camAnim) { const a = R.camAnim; a.t += dt; const k = sstep(0, 1, a.t / a.dur); R.camera.position.lerpVectors(a.from, a.to, k); if (a.t >= a.dur) R.camAnim = null; }
    R.controls.target.set(0, 0, 0); R.controls.update();
    // never dip below the ground near the pad
    if (launch && hc < 3000) { const gy = -hc + 2; if (R.camera.position.y < gy) R.camera.position.y = gy; }
    if (shakeAmp > 0) {
      const d = R.camera.position.length(), a = shakeAmp * 0.9 * R.camScale / (1 + d / (400 * R.camScale)) * (0.4 + 0.6 * (1 - sstep(5, 25, f.t)));
      R.shake.set(Math.sin(tm * 51) + Math.sin(tm * 23 + 2) * 0.6, Math.sin(tm * 43 + 1) * 0.8, Math.sin(tm * 37 + 4) + Math.sin(tm * 19) * 0.5).multiplyScalar(a);
      R.camera.position.add(R.shake);
    }
  }
  R.camera.near = clamp(R.camera.position.length() * 0.004, 0.05, 50); R.camera.updateProjectionMatrix();
  // ---- sun, sky, fog, light vs altitude and time of day
  const P = PLANETS[R.planetKind];
  const kind = R.planetKind;
  let sunDir = SUN_L.clone();
  if (launch) {
    const fr = G.state.from || { lat: 25.99, lng: -97.15 };
    if (R.tod === 'live') { if (!R.sunT || now - R.sunT > 20000) { R.sunT = now; R.sunLive = sunLocal(fr.lat, fr.lng, new Date()); } sunDir = R.sunLive.clone(); }
    else sunDir = sunFromPreset(R.tod, fr.lat);
    // the world group is tilted by th (tracked point's local vertical); the sun stays fixed in the pad frame
    sunDir.applyQuaternion(R.world.quaternion);
  }
  const dip = P ? Math.acos(clamp(P.R / (P.R + Math.max(0, hc)), -1, 1)) : 0;
  const sunUp = sunDir.y + Math.sin(dip);   // effective elevation incl. the horizon dip at altitude
  const day = launch ? sstep(-0.12, 0.18, sunUp) : 1, warm = launch ? (1 - sstep(0.04, 0.38, sunUp)) * sstep(-0.12, 0.02, sunUp) : 0;
  const Hs = kind === 'mars' ? 11000 : 8500, bright = kind === 'moon' || kind === 'none' || kind === '' ? 0 : clamp(Math.exp(-hc / Hs) * (kind === 'mars' ? 0.8 : 1), 0, 1) * day;
  const su = R.sky.material.uniforms;
  if (kind === 'mars') { su.uZen.value.setRGB(0.42, 0.30, 0.22).multiplyScalar(Math.pow(bright, 0.7)); su.uHor.value.setRGB(0.80, 0.62, 0.45).lerp(new THREE.Color(0.5, 0.35, 0.25), 1 - bright).multiplyScalar(0.25 + 0.75 * bright); }
  else if (kind === 'earth') {
    const b0 = clamp(Math.exp(-hc / Hs), 0, 1);
    su.uZen.value.setRGB(0.10, 0.28, 0.70).multiplyScalar(Math.pow(b0, 0.55) * (0.04 + 0.96 * day));
    su.uHor.value.setRGB(0.74, 0.84, 0.98).lerp(new THREE.Color(0.25, 0.50, 1.0), 1 - b0).multiplyScalar(0.35 + 0.65 * Math.pow(b0, 0.3)).lerp(new THREE.Color(1.0, 0.52, 0.26), warm * 0.75).multiplyScalar(0.05 + 0.95 * day);
    if (day < 0.3) su.uHor.value.lerp(new THREE.Color(0.03, 0.045, 0.09), (0.3 - day) / 0.3 * b0);
  }
  else { su.uZen.value.setRGB(0, 0, 0); su.uHor.value.setRGB(0, 0, 0); }
  su.uDip.value = dip; su.uAlt.value = hc; su.uBright.value = bright;
  su.uSun.value.copy(sunDir); su.uSunCol.value.setRGB(1, 0.95 - warm * 0.35, 0.85 - warm * 0.55);
  R.sky.position.copy(R.camera.position); R.stars.position.copy(R.camera.position);
  R.stars.material.opacity = clamp(1 - bright * 1.6, 0, 1); R.stars.visible = R.stars.material.opacity > 0.02;
  R.sun.position.copy(sunDir).multiplyScalar(1000); R.sun.target.position.set(0, 0, 0);
  const sunVis = launch ? sstep(-0.03, 0.06, sunUp) : 1;
  R.sun.intensity = 3.0 * sunVis; R.sun.color.setRGB(1, 0.945 - warm * 0.3, 0.86 - warm * 0.5);
  R.hemi.intensity = (kind === 'earth' ? lerp(0.12, 0.75, bright) : kind === 'mars' ? lerp(0.12, 0.5, bright) : 0.06) * (launch ? 0.15 + 0.85 * day : 1);
  R.hemi.color.set(kind === 'mars' ? 0xe0b090 : 0xbcd4ff); R.hemi.groundColor.set(kind === 'mars' ? 0x6a3a22 : kind === 'moon' ? 0x555555 : 0x5c5040);
  R.scene.environmentIntensity = launch ? 0.1 + 0.9 * day : 1;
  R.scene.fog.density = kind === 'earth' ? 0.00003 * Math.exp(-hc / 6000) : kind === 'mars' ? 0.00006 * Math.exp(-hc / 9000) : 0;
  R.scene.fog.color.copy(su.uHor.value);
  R.groundM.opacity = 1 - sstep(25000, 60000, hc); R.ground.visible = R.groundM.opacity > 0.01 && R.planetKind !== 'none' && (launch || (f.alt || 0) < 60000);
  const envK = kind === 'earth' ? (hc < 20000 ? 'ground' : 'space') : kind === 'mars' ? (hc < 50000 ? 'mars' : 'space') : kind === 'moon' ? 'moon' : 'space';
  if (R.envK !== envK) { R.envK = envK; R.scene.environment = R.envFor(envK); }
  su2.uLight.value = launch ? 0.12 + 0.88 * day : 1;
  R.smoke.material.uniforms.uSunV.value.copy(sunDir).transformDirection(R.camera.matrixWorldInverse);
  if (R.drone && R.drone.visible) { const wu = R.drone.userData.water.material.uniforms; wu.uSun.value.copy(sunDir); wu.uDay.value = 0.08 + 0.92 * day; }
  if (R.dust && R.dust.visible) R.dust.material.uniforms.uLight.value = 1;
  postFx(f, sunDir, sunVis, launch, Lr, Ur);
  hud(f, hc);
  render();
}
// heat haze around the active exhaust + a lens flare when looking towards the sun
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _ray = new THREE.Raycaster();
function postFx(f, sunDir, sunVis, launch, Lr, Ur) {
  const Q = QUALITY[R.quality], cam = R.camera;
  cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  // ---- haze
  let hz = 0; const rig = Lr.g.visible && f.bI > 0.05 ? Lr : f.sI > 0.05 && f.mode === 'launch' ? Ur : null;
  const hM = rig === Lr ? f.bH : f.sH, I = rig === Lr ? f.bI : f.sI;
  if (Q.haze && rig && (hM || 0) < 20000) {
    const pl = rig.pl; pl.updateMatrixWorld();
    const a = _v.set(0, 0, 0).applyMatrix4(pl.matrixWorld), b = _w.set(0, -(pl.userData.L || 100) * 1.25, 0).applyMatrix4(pl.matrixWorld);
    const da = a.clone().project(cam), db = b.clone().project(cam);
    const rad = (pl.userData.r || 10) * 1.8, dist = Math.max(1, a.distanceTo(cam.position));
    const w = rad / (dist * Math.tan(cam.fov * Math.PI / 360)) * 0.5;
    if (da.z < 1 && w > 0.004) {
      const u = R.haze.uniforms; u.uA.value.set(da.x * 0.5 + 0.5, da.y * 0.5 + 0.5); u.uB.value.set(db.x * 0.5 + 0.5, db.y * 0.5 + 0.5);
      u.uW.value = Math.min(0.6, w); u.uAsp.value = cam.aspect; u.uTime.value = R.clock; hz = I * (1 - sstep(6000, 20000, hM || 0)) * (rig.sets[0].fuel === 2 ? 1.4 : 1);
    }
  }
  R.haze.uniforms.uStr.value = hz; R.haze.enabled = hz > 0.02;
  // ---- lens flare (HTML overlay, occlusion-tested against the vehicle and the pad)
  const fl = q('[data-k="flare"]');
  let fi = 0;
  if (Q.flare && sunVis > 0.05) {
    _v.copy(sunDir).multiplyScalar(1e6).add(cam.position); const p = _v.clone().project(cam);
    const inView = p.z < 1 && Math.abs(p.x) < 1.15 && Math.abs(p.y) < 1.15 && _w.set(0, 0, -1).applyQuaternion(cam.quaternion).dot(sunDir) > 0;
    if (inView) {
      if ((R.flareN++ % 4) === 0) {
        _ray.set(cam.position, sunDir); _ray.far = 5e4;
        const targets = [Lr.g, Ur.g].filter(o => o.visible); Object.values(R.pads).forEach(o => o.visible && targets.push(o));
        const hits = _ray.intersectObjects(targets, true).filter(h => h.object.isMesh && h.object.material && !h.object.material.isShaderMaterial && h.object.visible);
        R.occluded = hits.length > 0;
      }
      if (!R.occluded) {
        fi = sunVis * (1 - Math.max(Math.abs(p.x), Math.abs(p.y)) / 1.15 * 0.5);
        const W = window.innerWidth, H = window.innerHeight, sx = (p.x * 0.5 + 0.5) * W, sy = (1 - (p.y * 0.5 + 0.5)) * H, cx = W / 2, cy = H / 2;
        const els = fl.children, ks = [0, 0.32, 0.55, 0.8, 1.25, 1.6], sz = [210, 46, 90, 30, 140, 64];
        for (let i = 0; i < 6; i++) { const x = sx + (cx - sx) * ks[i] * 2, y = sy + (cy - sy) * ks[i] * 2; els[i].style.transform = `translate(${x - sz[i] / 2}px, ${y - sz[i] / 2}px)`; els[i].style.width = els[i].style.height = sz[i] + 'px'; }
        els[6].style.transform = `translate(${sx - 300}px, ${sy - 2}px)`;
      }
    }
  }
  fl.style.opacity = fi.toFixed(3); fl.hidden = fi < 0.01;
}
function render() { if (R.bloom.enabled || R.haze.enabled) R.composer.render(); else R.renderer.render(R.scene, R.camera); }
function hud(f, hc) {
  const fmt = (x, d = 0) => x.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d });
  const V = f.V, trackB = f.mode === 'launch' && !f.attached && R.track === 'booster' && !V.expendable;
  const hM = trackB ? f.bH : f.sH, v = trackB ? f.bV : f.sV;
  const phase = f.phaseTxt || (trackB ? V.labels.lower + ': ' + f.bPhase : (f.attached || !V.star ? '' : V.labels.upper + ': ') + f.sPhase);
  q('.scam-met').textContent = f.met; q('.scam-phase').textContent = phase;
  q('[data-k="alt"]').previousElementSibling.textContent = f.altLab || 'Altitude';
  if (f.altVal) q('[data-k="alt"]').textContent = f.altVal; else q('[data-k="alt"]').textContent = hM < 1000 ? fmt(Math.max(0, hM)) + ' m' : hM < 1e7 ? fmt(hM / 1000, hM < 1e5 ? 1 : 0) + ' km' : fmt(hM / 1000) + ' km';
  q('[data-k="spd"]').textContent = fmt(v || 0) + ' km/h';
  q('[data-k="spd"]').previousElementSibling.textContent = f.spdLab || 'Speed';
  const mr = q('[data-k="machrow"]'); mr.hidden = f.mode !== 'launch';
  if (f.mode === 'launch') q('[data-k="mach"]').textContent = (Sim.speedOfSound ? (v || 0) / Sim.speedOfSound(hM / 1000) : (v || 0) / 1235).toFixed(1);
  const gr = q('[data-k="grow"]'); gr.hidden = f.mode !== 'launch' || trackB;
  if (!gr.hidden) q('[data-k="g"]').textContent = (f.gAcc || 0).toFixed(1) + ' g';
  q('[data-k="note"]').textContent = f.note || '';
  if (f.mode === 'space') {
    const S = window.__space, sel = q('[data-k="phases"]'), i = S.mission.phases.indexOf(S.mission.at(S.t).phase);
    if (document.activeElement !== sel && i >= 0 && sel.selectedIndex !== i) sel.selectedIndex = i;
    const pb = q('[data-act="splay"]'), lab = S.playing ? '❚❚ Pause' : '▶ Play'; if (pb.textContent !== lab) pb.textContent = lab;
  }
}
function modeUi() {
  const sp = R.mode === 'space';
  R.root.querySelectorAll('[data-only]').forEach(el => { el.hidden = el.dataset.only !== R.mode; });
  q('[data-k="trackrow"]').hidden = sp || !!(R.V && R.V.expendable);
  if (sp) q('[data-k="vname"]').textContent = 'Starship';
  if (sp && R.view === 'ground') setView('chase');
  if (sp) {
    const S = window.__space, sel = q('[data-k="phases"]');
    sel.innerHTML = S && S.mission ? S.mission.phases.map((p, i) => `<option value="${i}">${p.name.replace(/</g, '&lt;')}</option>`).join('') : '';
  }
  setView(R.view);
}
// ---------------------------------------------------------------- open / close
function ensureCamRocket() {
  const st = G.state; if (st.runs.some(r => CAM_IDS.includes(r.preset.id))) return true;
  return selectVehicle('starship');
}
export function open(vehId) {
  if (!R) init();
  const space = window.__space && window.__space.active;
  if (!space) {
    if (vehId) selectVehicle(vehId); else ensureCamRocket();
  }
  if (R.open) return;
  if (!space) {
    R.prevSpeed = G.state.speed;
    if (G.state.speed > 10) { const sb = document.querySelector('#speedSeg button[data-speed="1"]'); if (sb) sb.click(); }
  }
  R.open = true; R.root.hidden = false; document.body.classList.add('scam-open'); R.lastMode = null; R.last = 0;
  try { G.globe.pauseAnimation(); } catch (e) {}
  resize(); syncSeg(); requestAnimationFrame(tick);
}
export function close() {
  if (!R || !R.open) return;
  R.open = false; R.root.hidden = true; document.body.classList.remove('scam-open');
  try { G.globe.resumeAnimation(); } catch (e) {}
  if (R.prevSpeed && R.prevSpeed !== G.state.speed && R.prevSpeed > 10) { const sb = document.querySelector(`#speedSeg button[data-speed="${R.prevSpeed}"]`); if (sb) sb.click(); }
  R.prevSpeed = null;
  if (window.__launchSim.hooks.onCamClose) window.__launchSim.hooks.onCamClose();
}
window.__starshipCam = window.__rocketCam = { open, close, setView: v => R && setView(v), setTrack: t => R && setTrack(t), selectVehicle: id => R && selectVehicle(id), setQuality: k => R && applyQuality(k), setTod: k => { if (R) { R.tod = k; q('[data-k="tod"]').value = k; } }, get R() { return R; }, isOpen: () => !!(R && R.open) };

/* 3D rocket cam (v7): extra civilian launch vehicles, pads, the drone ship, landing terrain & dust.
   Builders receive the shared helpers from starship-cam.js so everything uses the same shaders. */
let seed = 4242; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------- shared bits
function livery(H, o) {
  // painted / composite stage skin: base colour, panel lines, optional vertical lettering, soot & streaks
  const { THREE, canvasTex } = H;
  return canvasTex(o.w || 512, o.h || 2048, (x, w, h) => {
    seed = o.seed || 9;
    x.fillStyle = o.base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { const a = rnd() * 0.035; x.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`; x.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 40, 2 + rnd() * 90); }
    if (o.panels) for (let k = 1; k < o.panels; k++) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, k * h / o.panels, w, 2); }
    (o.bands || []).forEach(([y0, y1, col, pat]) => { // [fraction from top, fraction, colour, 'solid'|'quad'|'stripes']
      const Y0 = y0 * h, Y1 = y1 * h; x.fillStyle = col;
      if (pat === 'quad') { for (let q = 0; q < 4; q += 2) x.fillRect(q * w / 4, Y0, w / 4, Y1 - Y0); }
      else if (pat === 'stripes') { for (let q = 0; q < 4; q++) x.fillRect((q + 0.5) * w / 4 - w / 32, Y0, w / 16, Y1 - Y0); }
      else x.fillRect(0, Y0, w, Y1 - Y0);
    });
    if (o.text) o.text.forEach(t => {
      x.save(); x.translate(t.u * w, t.v * h); x.rotate(Math.PI / 2); x.fillStyle = t.col; x.font = `${t.bold ? '900' : '700'} ${t.size}px Arial, Helvetica, sans-serif`;
      x.textAlign = 'center'; x.textBaseline = 'middle'; if (t.spacing) x.letterSpacing = t.spacing + 'px'; x.fillText(t.s, 0, 0); x.restore();
    });
    if (o.soot) { // flight-proven booster: grey soot streaks running down from the top & heavy soot at the base
      for (let i = 0; i < 260; i++) { const px = rnd() * w, len = h * (0.15 + rnd() * 0.8), g = x.createLinearGradient(0, 0, 0, len); const a = 0.04 + rnd() * o.soot * 0.16;
        g.addColorStop(0, `rgba(40,36,32,${a})`); g.addColorStop(1, 'rgba(40,36,32,0)'); x.fillStyle = g; x.fillRect(px, 0, 2 + rnd() * 16, len); }
      const g2 = x.createLinearGradient(0, h, 0, h * 0.8); g2.addColorStop(0, `rgba(30,26,22,${0.6 * o.soot})`); g2.addColorStop(1, 'rgba(30,26,22,0)'); x.fillStyle = g2; x.fillRect(0, h * 0.8, w, h * 0.2);
    }
  }, { srgb: true });
}
const mat = (THREE, o) => new THREE.MeshStandardMaterial(Object.assign({ metalness: 0, roughness: 0.55 }, o));
function cyl(H, g, r0, r1, y0, y1, m, seg = 48, open = true) { const { THREE } = H; const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg, 1, open), m); c.position.y = (y0 + y1) / 2; g.add(c); return c; }
function ogive(H, R, L, segs = 48, phi0 = 0, phiL = Math.PI * 2) {
  const { THREE } = H, rho = (R * R + L * L) / (2 * R), p = [];
  for (let i = 0; i <= 32; i++) { const y = L * i / 32; p.push(new THREE.Vector2(i === 32 ? 0.001 : Math.max(0.02, Math.sqrt(rho * rho - y * y) + R - rho), y)); }
  return new THREE.LatheGeometry(p, segs, phi0, phiL);
}
function bells(H, g, list, pts, matO, segs = 24) {
  // engine bells (outer, lit) + inner glowing surfaces; returns the inner meshes in engine order
  const { THREE } = H, G = new THREE.LatheGeometry(pts, segs), Gi = G.clone().scale(0.95, 1, 0.95), inner = [];
  list.forEach(e => { const o = new THREE.Mesh(G, matO); o.position.set(e[0], e[3] || 0, e[1]); g.add(o);
    const i = new THREE.Mesh(Gi, new THREE.MeshBasicMaterial({ color: 0x0a0908, side: THREE.DoubleSide, toneMapped: false })); i.position.copy(o.position); g.add(i); inner.push(i); });
  return inner;
}
function engineSet(H, g, list, o) {
  const fl = H.flameMesh(list.map(e => [e[0], e[1], 0, (e[3] || 0) + o.exitY]), o.len, o.rTop, o.rBot);
  fl.material.uniforms.uFuel.value = o.fuel; if (o.vac) fl.material.uniforms.uVac.value = 1; g.add(fl);
  return { fl, bells: o.inner, n: list.length, vac: !!o.vac, len: o.len, fuel: o.fuel };
}
function rigFx(H, g, o) { // plume envelope + sparks + fire light for one stage
  const { THREE } = H, pl = H.plumeMesh(); pl.position.y = o.plY; pl.material.uniforms.uFuel.value = o.fuel; if (o.vac) pl.material.uniforms.uVac.value = 1; g.add(pl);
  const sp = H.sparks(o.eng, o.sparks, o.spSize); sp.position.y = o.plY + 1.2 * o.k; sp.material.uniforms.uFuel.value = o.fuel; if (o.vac) sp.material.uniforms.uVac.value = 1; g.add(sp);
  const fire = new THREE.PointLight(o.fuel === 2 ? 0xbfc8ff : 0xffa050, 0, 1500 * o.k + 200, 1.4); fire.position.y = o.plY - 12 * o.k; g.add(fire);
  return { pl, sp, fire };
}
function gridFin(H, m, L, W, T) {
  const { THREE } = H, f = new THREE.Group(), lat = new THREE.MeshStandardMaterial({ color: 0x6b6e72, metalness: 1, roughness: 0.45, alphaMap: H.gridFinTex(), alphaTest: 0.5, side: THREE.DoubleSide });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(L, W), lat); p.rotation.x = -Math.PI / 2; p.position.x = L / 2; f.add(p);
  const fr = (w, h, d, x, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, 0, z); f.add(b); };
  fr(L, T, 0.06, L / 2, W / 2); fr(L, T, 0.06, L / 2, -W / 2); fr(0.06, T, W, L, 0); fr(0.1, T, W, 0.02, 0);
  return f;
}
function finish(g) { g.traverse(o => { if (o.isMesh || o.isPoints) o.frustumCulled = false; }); return g; }

// ------------------------------------------------------------- Falcon 9 Block 5 (+ drone-ship landing)
export function buildFalcon9(H) {
  const { THREE } = H, k = 3.66 / 9, R = 1.83;
  const white1 = mat(THREE, { map: livery(H, { base: '#e9eaec', seed: 3, panels: 6, soot: 1, text: [{ s: 'SPACEX', u: 0.11, v: 0.42, size: 150, col: '#1b1d22', bold: 1, spacing: 18 }] }), roughness: 0.6, color: 0xc4c6c9 });
  const white2 = mat(THREE, { map: livery(H, { base: '#eeeff1', seed: 4, panels: 3, w: 512, h: 1024 }), roughness: 0.5, color: 0xc8cacd });
  const carbon = mat(THREE, { color: 0x17181b, roughness: 0.42, metalness: 0.2 });
  const grey = mat(THREE, { color: 0x6d7076, roughness: 0.5, metalness: 0.7 });
  const bellM = mat(THREE, { color: 0x4f4a45, roughness: 0.4, metalness: 0.9, side: THREE.DoubleSide });
  const mvacM = mat(THREE, { color: 0x3c3b3d, roughness: 0.35, metalness: 0.9, side: THREE.DoubleSide, emissive: new THREE.Color(0, 0, 0) });
  // ---- first stage (origin at the octaweb)
  const lo = new THREE.Group(); lo.name = 'f9-booster';
  cyl(H, lo, R, R, 0.6, 41.2, white1, 56); cyl(H, lo, R, R, 41.2, 47.9, carbon, 56);
  const plate = new THREE.Mesh(new THREE.CircleGeometry(R, 40), mat(THREE, { color: 0x262422, roughness: 0.8 })); plate.rotation.x = Math.PI / 2; plate.position.y = 0.6; lo.add(plate);
  cyl(H, lo, R + 0.03, R + 0.03, 0.2, 1.4, grey, 56); // octaweb skirt
  const E9 = [[0, 0]]; [0, 4, 2, 6, 1, 3, 5, 7].forEach(i => { const a = i / 8 * Math.PI * 2 + Math.PI / 8; E9.push([Math.sin(a) * 1.25, Math.cos(a) * 1.25]); }); // centre first, then pairs (3-engine burns)
  const inner = bells(H, lo, E9, H.bellPts(0.17, 0.46, 0.6, -1.0), bellM, 20);
  const set = engineSet(H, lo, E9, { inner, exitY: -1.0, len: 9, rTop: 0.42, rBot: 0.85, fuel: 1 });
  // landing legs (stowed flush along the body, deploy just before touchdown)
  const legM = mat(THREE, { color: 0x1d1e21, roughness: 0.5, metalness: 0.3 }), legs = [];
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + Math.PI / 4, hold = new THREE.Group(); hold.rotation.y = a; lo.add(hold);
    const piv = new THREE.Group(); piv.position.set(0, 1.0, R + 0.12); hold.add(piv);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9.6, 0.32), legM); leg.position.y = 4.8; piv.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.25, 16), grey); foot.position.y = 9.6; piv.add(foot);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6.5, 8), grey); strut.position.set(0, 3.2, -0.25); piv.add(strut);
    legs.push(piv);
  }
  // grid fins (titanium) under the interstage
  const fins = [];
  for (let i = 0; i < 4; i++) { const hold = new THREE.Group(); hold.rotation.y = i * Math.PI / 2; hold.position.y = 40.6; lo.add(hold);
    const piv = new THREE.Group(); piv.position.set(R, 0, 0); hold.add(piv); const gf = gridFin(H, grey, 1.5, 1.2, 0.3); piv.add(gf); fins.push(piv); }
  const fxL = rigFx(H, lo, { plY: -1.0, fuel: 1, eng: E9, sparks: 360, spSize: 0.6, k });
  // ---- second stage (origin at the MVac nozzle exit)
  const up = new THREE.Group(); up.name = 'f9-s2';
  const mvacI = bells(H, up, [[0, 0]], H.bellPts(0.3, 1.6, 3.4, 0.0), mvacM, 40);
  cyl(H, up, R, R, 3.4, 15.4, white2, 56); cyl(H, up, R, R * 0.6, 2.9, 3.4, grey, 40, false);
  cyl(H, up, R, R, 15.4, 16.0, carbon, 56);
  const setS = engineSet(H, up, [[0, 0]], { inner: mvacI, exitY: 0, len: 14, rTop: 1.5, rBot: 3.2, fuel: 1, vac: true });
  const fxU = rigFx(H, up, { plY: 0, fuel: 1, eng: [[0, 0]], sparks: 120, spSize: 0.5, k, vac: true });
  // payload (a flat-packed satellite stack) + fairing halves
  const pay = new THREE.Group(); pay.position.y = 16.0; up.add(pay);
  const satM = mat(THREE, { color: 0x9aa0a8, metalness: 0.6, roughness: 0.4 }), goldM = mat(THREE, { color: 0xc8a050, metalness: 0.9, roughness: 0.3 });
  for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.32, 1.4), i % 2 ? satM : goldM); b.position.y = 0.6 + i * 0.36; pay.add(b); const b2 = b.clone(); b2.position.z = 0; pay.add(b2); }
  const fairM = mat(THREE, { map: livery(H, { base: '#f1f2f4', seed: 6, w: 256, h: 512 }), roughness: 0.45, color: 0xcacccf });
  const halves = [];
  [0, 1].forEach(s => {
    const piv = new THREE.Group(); piv.position.set(s ? -2.6 : 2.6, 16.0, 0); up.add(piv);
    const fg = new THREE.Group(); fg.position.x = s ? 2.6 : -2.6; piv.add(fg);
    const geo = ogive(H, 2.6, 7.0, 40, s ? Math.PI : 0, Math.PI); const o = new THREE.Mesh(geo, fairM); o.position.y = 6.2; fg.add(o);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.3, 6.2, 40, 1, true, s ? Math.PI : 0, Math.PI), fairM); c.position.y = 3.1; fg.add(c);
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), fairM); fg.add(cap);
    halves.push({ piv, s });
  });
  const veh = {
    id: 'falcon9', name: 'Falcon 9', pad: 'lc39a', padH: 6, k, gap: 44.6, Htot: 44.6 + 29.2, smokeK: 0.45, drone: true,
    lower: Object.assign({ g: finish(lo), H: 47.9, mid: 24, aft: 1, top: 45, sets: [set], k, legs, fins }, fxL),
    upper: Object.assign({ g: finish(up), H: 29.2, mid: 12, aft: 1, top: 27, sets: [setS], k, mvacM }, fxU),
    labels: { lower: 'Falcon 9 booster', upper: 'Second stage', stack: '9 Merlin 1D engines', land: 'Drone-ship landing' },
    sched(t, c) {
      const o = { bN: 0, bI: 0, sN: [1], sI: 0, heat: 0 };
      if (t > -2.5 && t < 0) { o.bN = 9; o.bI = sstep(-2.5, -0.8, t) * 0.9; } else if (t >= 0 && t < c.tSep - 3) { o.bN = 9; o.bI = 1; }
      else if (t >= c.tSep - 3 && c.ps) {
        const pe = c.ps['Entry burn'], pc = c.ps['Coast & descent'], pl = c.ps['Landing burn'], pd = c.ps['Landed on the drone ship'];
        if (pe != null && t >= pe && t < (pc || pe + 20)) { o.bN = 3; o.bI = 1; }
        if (pl != null && t >= pl && t < (pd || 1e9)) { o.bN = 1; o.bI = 1; }
      }
      o.sI = t >= c.tSep + 7 && t < c.tSeco ? sstep(c.tSep + 7, c.tSep + 8.5, t) : 0;
      o.heat = t < c.tSep + 7 ? 0 : t < c.tSeco ? sstep(c.tSep + 7, c.tSep + 60, t) : Math.max(0, 1 - (t - c.tSeco) / 120);
      const pd = c.ps && c.ps['Landed on the drone ship'];
      o.legs = pd ? sstep(pd - 9, pd - 6, t) : 0; o.fins = sstep(c.tSep + 4, c.tSep + 8, t);
      o.fair = t - (c.tSep + 35); return o;
    },
    update(o) {
      this.lower.legs.forEach(p => { p.rotation.x = o.legs * 2.55; });
      this.lower.fins.forEach(p => { p.rotation.z = (1 - o.fins) * 1.45; });
      halves.forEach(h => { const tf = o.fair; h.piv.visible = tf < 30; h.piv.rotation.z = tf > 0 ? (h.s ? 1 : -1) * Math.min(1.4, 0.04 * tf * tf) : 0; h.piv.position.x = (h.s ? -2.6 : 2.6) + (tf > 0 ? (h.s ? -1 : 1) * tf * tf * 0.6 : 0); });
      pay.visible = o.fair > -1;
      mvacM.emissive.setRGB(1.0, 0.3, 0.06).multiplyScalar(o.heat * 1.6);
    },
  };
  return veh;
}

// ------------------------------------------------------------- Saturn V (S-IC / S-II / S-IVB + Apollo CSM & LES)
export function buildSaturnV(H) {
  const { THREE } = H, k = 10.1 / 9, R = 5.05;
  const sic = mat(THREE, { map: livery(H, { base: '#f2f2ef', seed: 11, panels: 8, bands: [[0, 0.07, '#141414', 'quad'], [0.42, 0.5, '#141414', 'quad'], [0.66, 0.95, '#141414', 'stripes']],
    text: [{ s: 'UNITED  STATES', u: 0.11, v: 0.3, size: 70, col: '#b01c22', bold: 1, spacing: 6 }] }), roughness: 0.55, color: 0xc6c6c2 });
  const sii = mat(THREE, { map: livery(H, { base: '#f2f2ef', seed: 12, panels: 5, w: 512, h: 1024, bands: [[0, 0.04, '#141414', 'solid']] }), roughness: 0.55, color: 0xc6c6c2 });
  const sivb = mat(THREE, { map: livery(H, { base: '#f2f2ef', seed: 13, panels: 3, w: 512, h: 1024, bands: [[0.72, 1, '#141414', 'quad']] }), roughness: 0.55, color: 0xc6c6c2 });
  const white = mat(THREE, { color: 0xc4c4c0, roughness: 0.6 }), black = mat(THREE, { color: 0x151515, roughness: 0.6 });
  const silver = mat(THREE, { color: 0xc8ccd2, metalness: 0.9, roughness: 0.3 }), red = mat(THREE, { color: 0xb8321e, roughness: 0.55, metalness: 0.2 });
  const bellM = mat(THREE, { color: 0x3e3a36, roughness: 0.45, metalness: 0.85, side: THREE.DoubleSide });
  // ---- S-IC (origin at the thrust structure)
  const lo = new THREE.Group(); lo.name = 'saturn-sic';
  cyl(H, lo, R, R, 0.6, 42.0, sic, 72);
  const plate = new THREE.Mesh(new THREE.CircleGeometry(R, 48), black); plate.rotation.x = Math.PI / 2; plate.position.y = 0.6; lo.add(plate);
  const F1 = []; for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; F1.push([Math.sin(a) * 3.2, Math.cos(a) * 3.2]); } F1.push([0, 0]); // outboard first (centre engine cuts off early)
  const inner = bells(H, lo, F1, H.bellPts(0.6, 1.85, 1.0, -4.8), bellM, 28);
  for (let i = 0; i < 4; i++) { // engine fairings + fins
    const a = Math.PI / 4 + i * Math.PI / 2, s = Math.sin(a), c = Math.cos(a);
    const fa = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.1, 7, 24), white); fa.position.set(s * 4.6, 2.4, c * 4.6); lo.add(fa);
    const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(3.4, -1.2), new THREE.Vector2(3.4, 2.4), new THREE.Vector2(0, 7.5)]);
    const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: false }), black); fin.geometry.translate(0, 0, -0.175);
    const hold = new THREE.Group(); hold.rotation.y = a - Math.PI / 2; hold.position.y = 0.2; fin.position.x = 5.7; hold.add(fin); lo.add(hold);
  }
  const set = engineSet(H, lo, F1, { inner, exitY: -4.8, len: 30, rTop: 1.7, rBot: 3.4, fuel: 1 });
  const fxL = rigFx(H, lo, { plY: -4.8, fuel: 1, eng: F1, sparks: 600, spSize: 1.4, k: k * 1.3 });
  // ---- upper: S-II (with interstages) + S-IVB/CSM sub-group (origin at the J-2 exits)
  const up = new THREE.Group(); up.name = 'saturn-upper';
  const s2 = new THREE.Group(); up.add(s2);
  cyl(H, s2, R, R, 1.8, 7.0, white, 72); cyl(H, s2, R, R, 7.0, 28.6, sii, 72);
  cyl(H, s2, R, 3.32, 28.6, 31.4, white, 72);
  const J5 = [[0, 0]]; for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; J5.push([Math.sin(a) * 1.8, Math.cos(a) * 1.8]); } J5.reverse(); // outboard first, centre last
  const inner2 = bells(H, s2, J5, H.bellPts(0.35, 1.0, 3.4, 0.0), bellM, 24);
  const set2 = engineSet(H, s2, J5, { inner: inner2, exitY: 0, len: 16, rTop: 0.95, rBot: 2.0, fuel: 2, vac: true });
  const s4 = new THREE.Group(); s4.position.y = 28.8; up.add(s4);
  const inner4 = bells(H, s4, [[0, 0]], H.bellPts(0.35, 1.0, 3.2, 0.0), bellM, 24);
  const set4 = engineSet(H, s4, [[0, 0]], { inner: inner4, exitY: 0, len: 16, rTop: 0.95, rBot: 2.0, fuel: 2, vac: true });
  cyl(H, s4, 3.32, 3.32, 3.0, 20.0, sivb, 64); cyl(H, s4, 3.32, 3.32, 20.0, 20.9, silver, 64); // + instrument unit
  cyl(H, s4, 3.32, 1.96, 20.9, 29.4, white, 64);  // spacecraft-lunar module adapter
  cyl(H, s4, 1.96, 1.96, 29.4, 33.4, silver, 48);  // service module
  const cm = new THREE.Mesh(new THREE.ConeGeometry(1.96, 3.4, 48), silver); cm.position.y = 35.1; s4.add(cm);
  const les = new THREE.Group(); les.position.y = 36.8; s4.add(les);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 6), red); l.position.set(Math.sin(a) * 0.45, 2.1, Math.cos(a) * 0.45); l.rotation.set(Math.cos(a) * 0.1, 0, -Math.sin(a) * 0.1); les.add(l); }
  cyl(H, les, 0.33, 0.33, 4.0, 8.4, red, 20, false); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.33, 1.4, 20), red); tip.position.y = 9.1; les.add(tip);
  const fxU = rigFx(H, up, { plY: 0, fuel: 2, eng: J5, sparks: 160, spSize: 0.9, k, vac: true });
  const veh = {
    id: 'saturnv', name: 'Saturn V', pad: 'ml39', padH: 13, k, gap: 43.0, Htot: 43 + 28.8 + 46.5, smokeK: 0.85, expendable: true,
    lower: Object.assign({ g: finish(lo), H: 42, mid: 21, aft: 1, top: 40, sets: [set], k: k * 1.3 }, fxL),
    upper: Object.assign({ g: finish(up), H: 75, mid: 30, aft: 1, top: 74, sets: [set2, set4], k }, fxU),
    labels: { lower: 'S-IC first stage', upper: 'Saturn V upper stages', stack: '5 F-1 engines' },
    sched(t, c) {
      const tDrop = 551, o = { bN: 0, bI: 0, sN: [0, 0], sI: 0, heat: 0 };
      if (t > -8.9 && t < 0) { o.bN = 5; o.bI = sstep(-8.9, -2, t) * 0.95; } else if (t >= 0 && t < 135) { o.bN = 5; o.bI = 1; } else if (t < c.tSep - 0.5) { o.bN = 4; o.bI = 1; }
      if (t >= c.tSep + 1.5 && t < tDrop) { o.sN = [t < 460 ? 5 : 4, 0]; o.sI = sstep(c.tSep + 1.5, c.tSep + 3.5, t); }
      else if (t >= tDrop + 4 && t < c.tSeco) { o.sN = [0, 1]; o.sI = sstep(tDrop + 4, tDrop + 6, t); }
      o.drop = t - tDrop; o.les = t - (c.tSep + 30); return o;
    },
    update(o) {
      // S-II falls away behind the S-IVB; the launch escape tower is jettisoned ~30 s after staging
      const d = o.drop; s2.position.y = d > 0 ? -0.5 * 3 * d * d : 0; s2.visible = d < 60;
      les.visible = o.les < 6; les.position.y = 36.8 + (o.les > 0 ? 0.5 * 25 * o.les * o.les : 0);
      veh.upper.pl.position.y = d > 0 ? 28.8 : 0; veh.upper.sp.position.y = veh.upper.pl.position.y + 1.2;
      veh.upper.aftY = d > 0 ? 28.8 : 0;
    },
  };
  return veh;
}

// ------------------------------------------------------------- Rocket Lab Electron
export function buildElectron(H) {
  const { THREE } = H, k = 1.2 / 9, R = 0.6;
  const cf = mat(THREE, { map: livery(H, { base: '#16171a', seed: 21, panels: 4, w: 256, h: 1024, text: [{ s: 'ROCKET LAB', u: 0.11, v: 0.5, size: 44, col: '#e8e8ea', bold: 1, spacing: 6 }] }), roughness: 0.42, metalness: 0.25 });
  const cf2 = mat(THREE, { color: 0x17181b, roughness: 0.42, metalness: 0.25 }), grey = mat(THREE, { color: 0x6d7076, roughness: 0.5, metalness: 0.7 });
  const bellM = mat(THREE, { color: 0x4a4744, roughness: 0.4, metalness: 0.9, side: THREE.DoubleSide });
  const lo = new THREE.Group(); lo.name = 'electron-s1';
  cyl(H, lo, R, R, 0.25, 12.1, cf, 40); cyl(H, lo, R, R, 12.1, 13.0, cf2, 40);
  const plate = new THREE.Mesh(new THREE.CircleGeometry(R, 32), grey); plate.rotation.x = Math.PI / 2; plate.position.y = 0.25; lo.add(plate);
  const E = [[0, 0]]; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; E.push([Math.sin(a) * 0.4, Math.cos(a) * 0.4]); }
  const inner = bells(H, lo, E, H.bellPts(0.04, 0.11, 0.25, -0.3), bellM, 14);
  const set = engineSet(H, lo, E, { inner, exitY: -0.3, len: 3.2, rTop: 0.1, rBot: 0.22, fuel: 1 });
  const fxL = rigFx(H, lo, { plY: -0.3, fuel: 1, eng: E, sparks: 200, spSize: 0.18, k });
  const up = new THREE.Group(); up.name = 'electron-s2';
  const vi = bells(H, up, [[0, 0]], H.bellPts(0.06, 0.27, 0.65, 0.0), bellM, 20);
  cyl(H, up, R, R, 0.65, 2.7, cf2, 40);
  const fairM = mat(THREE, { color: 0x1a1b1e, roughness: 0.4, metalness: 0.25 }), halves = [];
  [0, 1].forEach(s => { const piv = new THREE.Group(); piv.position.set(s ? -R : R, 2.7, 0); up.add(piv); const fg = new THREE.Group(); fg.position.x = s ? R : -R; piv.add(fg);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.1, 32, 1, true, s ? Math.PI : 0, Math.PI), fairM); c.position.y = 0.55; fg.add(c);
    const o = new THREE.Mesh(ogive(H, R, 1.5, 32, s ? Math.PI : 0, Math.PI), fairM); o.position.y = 1.1; fg.add(o); halves.push({ piv, s }); });
  const sat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), mat(THREE, { color: 0xc8a050, metalness: 0.9, roughness: 0.3 })); sat.position.y = 3.2; up.add(sat);
  const set2 = engineSet(H, up, [[0, 0]], { inner: vi, exitY: 0, len: 3.0, rTop: 0.25, rBot: 0.55, fuel: 1, vac: true });
  const fxU = rigFx(H, up, { plY: 0, fuel: 1, eng: [[0, 0]], sparks: 60, spSize: 0.12, k, vac: true });
  const veh = {
    id: 'electron', name: 'Electron', pad: 'lc1', padH: 2.5, k, gap: 12.5, Htot: 12.5 + 5.3, smokeK: 0.14, expendable: true,
    lower: Object.assign({ g: finish(lo), H: 13, mid: 6.5, aft: 0.3, top: 12.5, sets: [set], k }, fxL),
    upper: Object.assign({ g: finish(up), H: 5.3, mid: 2.4, aft: 0.2, top: 5.2, sets: [set2], k }, fxU),
    labels: { lower: 'Electron first stage', upper: 'Second stage', stack: '9 Rutherford engines' },
    sched(t, c) {
      const o = { bN: 0, bI: 0, sN: [1], sI: 0 };
      if (t > -2 && t < 0) { o.bN = 9; o.bI = sstep(-2, -0.5, t) * 0.9; } else if (t >= 0 && t < c.tSep - 2) { o.bN = 9; o.bI = 1; }
      o.sI = t >= c.tSep + 3 && t < c.tSeco ? sstep(c.tSep + 3, c.tSep + 4, t) : 0; o.fair = t - (c.tSep + 30); return o;
    },
    update(o) { halves.forEach(h => { const tf = o.fair; h.piv.visible = tf < 25; h.piv.rotation.z = tf > 0 ? (h.s ? 1 : -1) * Math.min(1.4, 0.05 * tf * tf) : 0; h.piv.position.x = (h.s ? -R : R) + (tf > 0 ? (h.s ? -1 : 1) * tf * tf * 0.15 : 0); }); sat.visible = o.fair > -1; },
  };
  return veh;
}

// ------------------------------------------------------------- launch pads
export function buildPadLC39(H, kind) {
  // kind 'lc39a': Falcon 9 era (fixed service structure + crew access arm + transporter-erector, water tower)
  // kind 'ml39' : Apollo era (mobile launcher platform + red launch umbilical tower with swing arms)
  const { THREE } = H, pad = new THREE.Group();
  const conc = mat(THREE, { color: 0x8b8880, roughness: 0.95 }), dark = mat(THREE, { color: 0x3b3d40, roughness: 0.6, metalness: 0.8 });
  const steelG = mat(THREE, { color: 0x7a7e84, roughness: 0.6, metalness: 0.5 }), redT = mat(THREE, { color: 0xa8402a, roughness: 0.65, metalness: 0.3 });
  const lat = H.latticeTex(); lat.repeat.set(1, 12);
  const latM = col => new THREE.MeshStandardMaterial({ color: col, roughness: 0.7, metalness: 0.3, alphaMap: lat, alphaTest: 0.5, side: THREE.DoubleSide });
  const slab = new THREE.Mesh(new THREE.CircleGeometry(150, 64), conc); slab.rotation.x = -Math.PI / 2; slab.position.y = 0.15; pad.add(slab);
  const trench = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 120), dark); trench.position.set(0, 0.2, 40); pad.add(trench);
  const tower = (x, z, w, h, m) => { const g = new THREE.Group(); g.position.set(x, 0, z);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, h, 0.9), steelG); c.position.set(a * w / 2, h / 2, b * w / 2); g.add(c); });
    for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.rotation.y = i * Math.PI / 2; p.position.set(Math.sin(i * Math.PI / 2) * w / 2, h / 2, Math.cos(i * Math.PI / 2) * w / 2); g.add(p); }
    pad.add(g); return g; };
  const arms = [], anim = [];
  if (kind === 'lc39a') {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(9, 6, 9), dark); mount.position.y = 3; pad.add(mount);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 6.2, 24), mat(THREE, { color: 0x111111 })); hole.position.y = 3; pad.add(hole);
    const fss = tower(0, -24, 12, 82, latM(0x8a8e94)); const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.9, 40, 8), steelG); mast.position.y = 102; fss.add(mast);
    const caa = new THREE.Group(); caa.position.set(0, 66, 6); fss.add(caa); const tube = new THREE.Mesh(new THREE.BoxGeometry(3, 3.2, 16), mat(THREE, { color: 0xd9dadc, roughness: 0.6 })); tube.position.z = 8; caa.add(tube);
    // transporter-erector strongback (rotates back ~1.5° just before liftoff)
    const te = new THREE.Group(); te.position.set(0, 6, -4.6); pad.add(te);
    const sb = new THREE.Mesh(new THREE.BoxGeometry(2.6, 66, 1.8), latM(0x2c2e31)); sb.position.y = 33; te.add(sb);
    [-1, 1].forEach(s => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.4, 66, 0.4), dark); r.position.set(s * 1.2, 33, 0); te.add(r); });
    for (let y = 8; y < 66; y += 14) { const cl = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.6, 1.2), dark); cl.position.set(0, y, 1.6); te.add(cl); }
    caa.rotation.y = 1.3; // crew access arm already swung away for an uncrewed launch
    anim.push(t => { te.rotation.x = -0.026 * sstep(-300, -200, t); });
    // water tower (sound suppression), lightning towers
    const wt = new THREE.Group(); wt.position.set(-170, 0, -120); pad.add(wt);
    const sph = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 16), mat(THREE, { color: 0xe6e6e2, roughness: 0.6 })); sph.position.y = 88; wt.add(sph);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, l = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 82, 8), steelG); l.position.set(Math.sin(a) * 6, 41, Math.cos(a) * 6); wt.add(l); }
  } else {
    const ml = new THREE.Mesh(new THREE.BoxGeometry(49, 7.6, 41), mat(THREE, { color: 0x77797c, roughness: 0.8, metalness: 0.3 })); ml.position.set(0, 3.8 + 5.4, -6); pad.add(ml);
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(20, 5.4, 20), conc); pedestal.position.y = 2.7; pad.add(pedestal);
    const hole = new THREE.Mesh(new THREE.BoxGeometry(14, 0.2, 14), mat(THREE, { color: 0x101010 })); hole.position.y = 13.05; pad.add(hole);
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2, hd = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), dark); hd.position.set(Math.sin(a) * 4.6, 13.6, Math.cos(a) * 4.6); pad.add(hd); }
    const lut = tower(0, -19, 12, 136, latM(0xa8402a)); lut.position.y = 13;
    const crane = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 22), redT); crane.position.set(0, 137, 6); lut.add(crane);
    [[20, 13], [38, 13], [56, 13], [74, 14], [88, 14], [96, 15], [108, 15], [118, 16]].forEach(([y, L], i) => {
      const piv = new THREE.Group(); piv.position.set(5.5, y, 6); lut.add(piv);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, L - 4), redT); arm.position.set(0, 0, (L - 4) / 2); piv.add(arm);
      arms.push({ piv, i }); });
    anim.push(t => arms.forEach(a => { a.piv.rotation.y = -1.45 * (a.i === 7 ? sstep(-500, -440, t) : sstep(-0.5 + a.i * 0.05, 4 + a.i * 0.1, t)); }));
  }
  // flat Florida scrub + a couple of buildings in the distance
  const shed = mat(THREE, { color: 0x7d838a, roughness: 0.7, metalness: 0.3 });
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(16 + i * 4, 6 + (i % 3) * 4, 20), shed); b.position.set(-240 - i * 35, (6 + (i % 3) * 4) / 2, 90 - (i % 2) * 160); pad.add(b); }
  pad.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  pad.userData = { arms: [], anim: t => anim.forEach(f => f(t)) };
  return pad;
}
export function buildPadLC1(H) {
  const { THREE } = H, pad = new THREE.Group();
  const conc = mat(THREE, { color: 0x8d8a83, roughness: 0.95 }), dark = mat(THREE, { color: 0x2f3133, roughness: 0.6, metalness: 0.7 }), grass = mat(THREE, { color: 0x4e6a34, roughness: 1 });
  const g = new THREE.Mesh(new THREE.CircleGeometry(400, 48), grass); g.rotation.x = -Math.PI / 2; g.position.y = 0.05; pad.add(g);
  const slab = new THREE.Mesh(new THREE.CircleGeometry(22, 48), conc); slab.rotation.x = -Math.PI / 2; slab.position.y = 0.12; pad.add(slab);
  const mount = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 3), dark); mount.position.y = 1.25; pad.add(mount);
  const sbG = new THREE.Group(); sbG.position.set(0, 2.5, -1.6); pad.add(sbG);
  const sb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 18, 0.7), dark); sb.position.y = 9; sbG.add(sb);
  for (let y = 3; y < 18; y += 5) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.6), dark); c.position.set(0, y, 0.6); sbG.add(c); }
  const hangar = new THREE.Mesh(new THREE.BoxGeometry(24, 9, 14), mat(THREE, { color: 0xd9d9d6, roughness: 0.6 })); hangar.position.set(-55, 4.5, -10); pad.add(hangar);
  pad.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  pad.userData = { arms: [], anim: t => { sbG.rotation.x = -0.35 * sstep(-120, -60, t); } };
  return pad;
}

// ------------------------------------------------------------- drone ship + local ocean
export function buildDroneShip(H) {
  const { THREE, canvasTex } = H, g = new THREE.Group();
  const deckT = canvasTex(1024, 512, (x, w, h) => {
    x.fillStyle = '#3a3c3f'; x.fillRect(0, 0, w, h); seed = 5;
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${rnd() < .5 ? 0 : 255},${rnd() < .5 ? 0 : 255},${rnd() < .5 ? 0 : 255},${rnd() * 0.04})`; x.fillRect(rnd() * w, rnd() * h, rnd() * 60, rnd() * 20); }
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(10,10,10,${0.05 + rnd() * 0.15})`; x.beginPath(); x.arc(w / 2 + (rnd() - .5) * 200, h / 2 + (rnd() - .5) * 200, 10 + rnd() * 60, 0, 7); x.fill(); } // scorch
    x.strokeStyle = '#f2f2f2'; x.lineWidth = 12; x.beginPath(); x.arc(w / 2, h / 2, 170, 0, 7); x.stroke();
    x.lineWidth = 30; x.beginPath(); x.moveTo(w / 2 - 95, h / 2 - 95); x.lineTo(w / 2 + 95, h / 2 + 95); x.moveTo(w / 2 + 95, h / 2 - 95); x.lineTo(w / 2 - 95, h / 2 + 95); x.stroke();
    x.fillStyle = '#e8c520'; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10);
  }, { srgb: true, clamp: true });
  const hull = mat(THREE, { color: 0x2e3033, roughness: 0.7, metalness: 0.4 }), yel = mat(THREE, { color: 0xd6b21e, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(91, 7, 52), hull); body.position.y = -1.6; g.add(body);
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(91, 52), mat(THREE, { map: deckT, roughness: 0.8 })); deck.rotation.x = -Math.PI / 2; deck.position.y = 1.95; g.add(deck);
  [-1, 1].forEach(s => { const wall = new THREE.Mesh(new THREE.BoxGeometry(91, 2.2, 0.6), yel); wall.position.set(0, 3, s * 25.7); g.add(wall); });
  const bw = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 52), hull); bw.position.set(-45, 4, 0); g.add(bw);
  for (let i = 0; i < 4; i++) { const th = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), hull); th.position.set(i < 2 ? -38 : 38, 4, i % 2 ? 20 : -20); g.add(th); }
  const water = new THREE.Mesh(new THREE.CircleGeometry(30000, 96), new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0.5, 0.6, 0.3) }, uDay: { value: 1 }, uFoam: { value: 0 } },
    vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec3 vW; varying vec2 vP; void main(){ vP = position.xy; vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp;\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime, uDay, uFoam; uniform vec3 uSun; varying vec3 vW; varying vec2 vP;
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hh(i), hh(i+vec2(1,0)), f.x), mix(hh(i+vec2(0,1)), hh(i+1.0), f.x), f.y); }
void main(){
  #include <logdepthbuf_fragment>
  vec2 p = vP * 0.08; float t = uTime * 0.6;
  vec2 gr = vec2(nn(p + vec2(t, 0.0)) - nn(p + vec2(t, 0.0) + vec2(0.3, 0.0)), nn(p * 1.7 - vec2(0.0, t)) - nn(p * 1.7 - vec2(0.0, t) + vec2(0.0, 0.3)));
  vec3 n = normalize(vec3(gr.x * 0.6, 1.0, gr.y * 0.6));
  vec3 v = normalize(cameraPosition - vW); float fr = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  vec3 deep = vec3(0.02, 0.10, 0.18), sky = vec3(0.55, 0.70, 0.90);
  vec3 col = mix(deep, sky, 0.15 + 0.75 * fr) * uDay;
  vec3 r = reflect(-v, n); col += vec3(1.0, 0.92, 0.8) * pow(max(dot(r, normalize(uSun)), 0.0), 180.0) * 3.0 * uDay;
  float d = length(vP); col += vec3(0.85) * uFoam * 0.4 * smoothstep(110.0, 35.0, d) * smoothstep(0.35, 0.8, nn(vP * 0.25 + t * 3.0));
  gl_FragColor = vec4(col, smoothstep(30000.0, 20000.0, d));
}` }));
  water.rotation.x = -Math.PI / 2; water.position.y = -0.3; water.renderOrder = -1; g.add(water);
  g.traverse(o => { o.frustumCulled = false; });
  g.userData = { water, DECK: 1.95 };
  return g;
}

// ------------------------------------------------------------- Moon / Mars landing terrain, rocks & engine dust
export function buildTerrain(H, kind, groundTex) {
  const { THREE } = H, S = 5000, N = 200;
  const g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  seed = kind === 'mars' ? 77 : 99;
  const craters = []; for (let i = 0; i < (kind === 'moon' ? 70 : 28); i++) { const r = 8 + Math.pow(rnd(), 2.6) * 420; let x = (rnd() - 0.5) * S, z = (rnd() - 0.5) * S; if (Math.hypot(x, z) < r + 260) { x += Math.sign(x || 1) * (r + 260); } craters.push([x, z, r]); }
  const P = g.attributes.position, nz = (x, z) => Math.sin(x * 0.011) * Math.cos(z * 0.013) * 3 + Math.sin(x * 0.031 + z * 0.02) * 1.4 + Math.sin(x * 0.0021 - z * 0.0017) * (kind === 'mars' ? 26 : 12);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i), d0 = Math.hypot(x, z);
    let y = nz(x, z);
    craters.forEach(([cx, cz, r]) => { const d = Math.hypot(x - cx, z - cz) / r; if (d < 1.6) y += d < 1 ? (d * d - 1) * r * 0.22 + r * 0.06 : r * 0.06 * Math.exp(-(d - 1) * (d - 1) * 14) * (1.6 - d) / 0.6; });
    y *= sstep(60, 320, d0);                 // flat landing zone
    y *= 1 - sstep(S * 0.38, S * 0.5, Math.max(Math.abs(x), Math.abs(z))); // blend into the big ground disc at the edges
    P.setY(i, y);
  }
  g.computeVertexNormals();
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (uv.getX(i) - 0.5) * S / 40000, 0.5 + (uv.getY(i) - 0.5) * S / 40000); // match the 20 km ground disc texture scale
  const m = new THREE.MeshStandardMaterial({ map: groundTex, color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity: 0.3 });
  const mesh = new THREE.Mesh(g, m), grp = new THREE.Group(); grp.add(mesh);
  // instanced rocks
  const rockG = new THREE.DodecahedronGeometry(1, 0); const rp = rockG.attributes.position; for (let i = 0; i < rp.count; i++) rp.setXYZ(i, rp.getX(i) * (0.8 + rnd() * 0.5), rp.getY(i) * (0.5 + rnd() * 0.3), rp.getZ(i) * (0.8 + rnd() * 0.5)); rockG.computeVertexNormals();
  const n = 700, rocks = new THREE.InstancedMesh(rockG, new THREE.MeshStandardMaterial({ color: kind === 'mars' ? 0x7a4430 : 0x6c6c6e, roughness: 0.95 }), n), mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) { const a = rnd() * 6.283, d = 25 + Math.pow(rnd(), 0.7) * 1500, s = 0.2 + Math.pow(rnd(), 4) * 3.5, x = Math.cos(a) * d, z = Math.sin(a) * d;
    q.setFromEuler(e.set(rnd() * 3, rnd() * 3, rnd() * 3)); mm.compose(new THREE.Vector3(x, s * 0.25, z), q, new THREE.Vector3(s, s, s)); rocks.setMatrixAt(i, mm); }
  grp.add(rocks); grp.traverse(o => { o.frustumCulled = false; });
  return grp;
}
export function buildDust(H) {
  // GPU dust sheet blown out radially by the landing engines (Moon: fast ballistic sheet; Mars: slower billowing cloud)
  const { THREE } = H, n = 2200, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), sd = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) sd.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
  const m = H.smat({ blending: THREE.NormalBlending,
    uniforms: { uTime: { value: 0 }, uInt: { value: 0 }, uMars: { value: 0 }, uScale: { value: 800 }, uCol: { value: new THREE.Color(0.6, 0.6, 0.6) }, uLight: { value: 1 } },
    vertexShader: `uniform float uTime, uInt, uMars, uScale; attribute vec4 aSeed; varying float vA; varying float vF;
      void main(){
        float life = mix(1.6, 5.0, uMars) * (0.6 + aSeed.x * 0.8); float age = mod(uTime + aSeed.z * 17.0, life); float f = age / life;
        float ang = aSeed.y * 6.2832, V = mix(90.0, 26.0, uMars) * (0.5 + aSeed.w);
        float r = 4.0 + V * age * mix(1.0, 0.75, uMars * f);
        float up = mix(0.4 + aSeed.x * 1.5, 1.0 + aSeed.x * 10.0 * f, uMars) * age;
        vec3 p = vec3(cos(ang) * r, up, sin(ang) * r);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vA = uInt * (1.0 - f) * smoothstep(0.0, 0.08, f); vF = f;
        gl_PointSize = vA > 0.001 ? min((mix(3.0, 10.0, uMars) + f * mix(10.0, 34.0, uMars)) * uScale / max(1.0, -mv.z), 500.0) : 0.0;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform vec3 uCol; uniform float uLight; varying float vA; varying float vF;
      void main(){
        #include <logdepthbuf_fragment>
        vec2 q = gl_PointCoord - 0.5; float d = length(q); float a = smoothstep(0.5, 0.05, d) * vA * 0.35; if (a < 0.004) discard;
        gl_FragColor = vec4(uCol * (0.75 + 0.5 * (0.5 - q.y)) * uLight, a); }` });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 3; return pts;
}

// Launch Speed Simulator – simplified flight-profile models (educational only).
// Units: km, s, km/h for display. Earth treated as a non-rotating sphere.
(function (root) {
  'use strict';
  const R = 6371;          // mean Earth radius, km
  const MU = 398600.4418;  // Earth GM, km^3/s^2
  const DEG = Math.PI / 180;

  // ---------- Vehicle presets (ballpark public, encyclopedia-level figures) ----------
  const PRESETS = [
    {
      id: 'airliner', name: 'Commercial airliner', group: 'Aircraft (comparison)', color: '#7dd3fc',
      kind: 'cruise', typicalSpeed: '≈ 850–930 km/h (Mach ≈ 0.85)', typicalAlt: '≈ 10–12 km',
      range: [0, 15000],
      profile: 'Take-off and climb to cruise altitude, long constant-speed cruise, then descent.',
      segments: [
        { name: 'Climb', dist: 200, h0: 0, h1: 11, v0: 300, v1: 850 },
        { name: 'Cruise', dist: 'rest', h0: 11, h1: 11, v0: 900, v1: 900 },
        { name: 'Descent', dist: 200, h0: 11, h1: 0, v0: 850, v1: 280 },
      ],
    },
    {
      id: 'concorde', name: 'Supersonic airliner (Concorde-class)', group: 'Aircraft (comparison)', color: '#c4b5fd',
      kind: 'cruise', typicalSpeed: '≈ 2,150 km/h (Mach ≈ 2.0)', typicalAlt: '≈ 15–18 km',
      range: [0, 7200],
      profile: 'Subsonic climb, acceleration to supersonic cruise high in the stratosphere, then descent.',
      segments: [
        { name: 'Climb', dist: 400, h0: 0, h1: 17, v0: 400, v1: 2100 },
        { name: 'Cruise', dist: 'rest', h0: 17, h1: 18, v0: 2170, v1: 2170 },
        { name: 'Descent', dist: 350, h0: 18, h1: 0, v0: 2100, v1: 300 },
      ],
    },
    {
      id: 'cm-sub', name: 'Subsonic cruise missile (generic)', group: 'Cruise missiles', color: '#86efac',
      kind: 'cruise', typicalSpeed: '≈ 800–900 km/h (Mach ≈ 0.7–0.8)', typicalAlt: 'Very low, tens of metres',
      range: [0, 2500],
      profile: 'Short rocket boost, then a jet-powered, low-altitude, roughly constant-speed cruise (like a small, fast aircraft).',
      segments: [
        { name: 'Boost', dist: 5, h0: 0, h1: 0.3, v0: 100, v1: 800 },
        { name: 'Cruise', dist: 'rest', h0: 0.05, h1: 0.05, v0: 880, v1: 880 },
        { name: 'Terminal', dist: 5, h0: 0.05, h1: 0, v0: 880, v1: 880 },
      ],
    },
    {
      id: 'cm-super', name: 'Supersonic cruise missile (generic)', group: 'Cruise missiles', color: '#fde047',
      kind: 'cruise', typicalSpeed: '≈ 3,000 km/h (Mach ≈ 2.5–3)', typicalAlt: '≈ 10–15 km cruise',
      range: [0, 800],
      profile: 'Rocket boost to supersonic speed, ramjet-powered high-altitude cruise, then descent.',
      segments: [
        { name: 'Boost', dist: 30, h0: 0, h1: 14, v0: 300, v1: 3000 },
        { name: 'Cruise', dist: 'rest', h0: 14, h1: 14, v0: 3000, v1: 3000 },
        { name: 'Terminal', dist: 30, h0: 14, h1: 0, v0: 3000, v1: 2500 },
      ],
    },
    {
      id: 'srbm', name: 'Short-range ballistic missile (generic)', group: 'Ballistic missiles', color: '#fdba74',
      kind: 'ballistic', boostTime: 70, typicalSpeed: '≈ 5,000–7,000 km/h (Mach ≈ 5–6)', typicalAlt: 'Apogee ≈ 50–150 km',
      range: [0, 1000],
      profile: 'Rocket boost, then an unpowered arc (like a thrown ball) back down. Short flight of a few minutes.',
    },
    {
      id: 'mrbm', name: 'Medium-range ballistic missile (generic)', group: 'Ballistic missiles', color: '#fb923c',
      kind: 'ballistic', boostTime: 110, typicalSpeed: '≈ 10,000–15,000 km/h', typicalAlt: 'Apogee ≈ 300–600 km',
      range: [1000, 3000],
      profile: 'Rocket boost, coast through space on a high arc, re-enter the atmosphere.',
    },
    {
      id: 'irbm', name: 'Intermediate-range ballistic missile (generic)', group: 'Ballistic missiles', color: '#f87171',
      kind: 'ballistic', boostTime: 150, typicalSpeed: '≈ 15,000–22,000 km/h', typicalAlt: 'Apogee ≈ 600–1,000 km',
      range: [3000, 5500],
      profile: 'Multi-stage rocket boost, long coast through space, re-entry.',
    },
    {
      id: 'icbm', name: 'ICBM (generic)', group: 'Ballistic missiles', color: '#ef4444',
      kind: 'ballistic', boostTime: 200, typicalSpeed: 'Up to ≈ 25,000 km/h (≈ 7 km/s)', typicalAlt: 'Apogee ≈ 1,000–1,300 km',
      range: [5500, 16000],
      profile: 'Multi-stage boost lasting a few minutes, then most of the ~30-minute flight is an unpowered coast through space, followed by re-entry.',
    },
    {
      id: 'hgv', name: 'Hypersonic glide vehicle (generic)', group: 'Hypersonic', color: '#f0abfc',
      kind: 'cruise', typicalSpeed: 'Mach 5 to ≈ 20 (slowing as it glides)', typicalAlt: 'Glide ≈ 30–70 km',
      range: [0, 0],
      profile: 'Rocket boost to very high speed, then an unpowered glide in the upper atmosphere, gradually losing speed.',
      segments: [
        { name: 'Boost', dist: 300, h0: 0, h1: 80, v0: 500, v1: 21000 },
        { name: 'Pull-down', dist: 300, h0: 80, h1: 55, v0: 21000, v1: 20000 },
        { name: 'Glide', dist: 'rest', h0: 55, h1: 35, v0: 20000, v1: 7500 },
        { name: 'Terminal', dist: 150, h0: 35, h1: 0, v0: 7500, v1: 4000 },
      ],
    },
    {
      id: 'orbital', name: 'Orbital rocket (Falcon 9-class)', group: 'Space launch', color: '#38bdf8',
      kind: 'orbital', ascentTime: 540, orbitAlt: 200, typicalSpeed: '≈ 27,000–28,000 km/h in orbit (≈ 7.8 km/s)', typicalAlt: 'Low Earth orbit ≈ 200–400 km',
      range: [0, 0],
      profile: 'Vertical lift-off, pitch over, first-stage burn (~2.5 min), second stage to orbit (~8.5 min total), then coasts in orbit. The route sets the ground-track direction; the readout shows when it passes over the destination.',
    },
  ];

  // ---------- Geometry ----------
  function toVec(lat, lng) {
    const la = lat * DEG, lo = lng * DEG;
    return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  }
  function toLatLng(v) {
    const n = Math.hypot(v[0], v[1], v[2]);
    return { lat: Math.asin(v[2] / n) / DEG, lng: Math.atan2(v[1], v[0]) / DEG };
  }
  function centralAngle(a, b) {
    const p1 = a.lat * DEG, p2 = b.lat * DEG, dl = (b.lng - a.lng) * DEG;
    const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function greatCircleKm(a, b) { return centralAngle(a, b) * R; }
  // Point at ground distance s (km) along the great circle from a towards b (works beyond b too).
  function makeGreatCircle(a, b) {
    const A = toVec(a.lat, a.lng);
    let B = toVec(b.lat, b.lng);
    let omega = centralAngle(a, b);
    // direction vector: component of B orthogonal to A
    let dot = A[0] * B[0] + A[1] * B[1] + A[2] * B[2];
    let D = [B[0] - dot * A[0], B[1] - dot * A[1], B[2] - dot * A[2]];
    let dn = Math.hypot(...D);
    if (dn < 1e-9) { // identical or antipodal: pick an arbitrary eastward direction
      D = [-Math.sin(a.lng * DEG), Math.cos(a.lng * DEG), 0]; dn = 1;
    }
    D = D.map(x => x / dn);
    return function (s) {
      const th = s / R;
      const c = Math.cos(th), sn = Math.sin(th);
      return toLatLng([A[0] * c + D[0] * sn, A[1] * c + D[1] * sn, A[2] * c + D[2] * sn]);
    };
  }

  // ---------- Atmosphere (US Standard Atmosphere 1976 temperature, for Mach) ----------
  function speedOfSound(hKm) {
    const h = Math.max(0, hKm);
    let T;
    if (h < 11) T = 288.15 - 6.5 * h;
    else if (h < 20) T = 216.65;
    else if (h < 32) T = 216.65 + (h - 20);
    else if (h < 47) T = 228.65 + 2.8 * (h - 32);
    else if (h < 51) T = 270.65;
    else if (h < 71) T = 270.65 - 2.8 * (h - 51);
    else if (h < 86) T = 214.65 - 2 * (h - 71);
    else T = 186.87; // above ~86 km Mach is only nominal
    return Math.sqrt(1.4 * 287.05 * T) * 3.6; // km/h
  }

  // ---------- Profile models ----------
  const smooth = x => x * x * (3 - 2 * x);

  // Cruise-type (aircraft, cruise missiles, glide vehicles): piecewise in ground distance.
  function simulateCruise(p, L) {
    const fixed = p.segments.filter(s => s.dist !== 'rest').reduce((a, s) => a + s.dist, 0);
    const scale = fixed > L * 0.9 ? (L * 0.9) / fixed : 1; // compress climb/descent on short routes
    const segs = [];
    let s0 = 0;
    for (const seg of p.segments) {
      const len = seg.dist === 'rest' ? Math.max(0, L - fixed * scale) : seg.dist * scale;
      segs.push({ ...seg, s0, s1: s0 + len });
      s0 += len;
    }
    const at = s => {
      let seg = segs[segs.length - 1];
      for (const g of segs) if (s <= g.s1) { seg = g; break; }
      const f = seg.s1 > seg.s0 ? Math.min(1, Math.max(0, (s - seg.s0) / (seg.s1 - seg.s0))) : 1;
      const hScale = scale < 1 && seg.dist !== 'rest' ? 1 : 1;
      return { h: (seg.h0 + (seg.h1 - seg.h0) * smooth(f)) * hScale, v: seg.v0 + (seg.v1 - seg.v0) * f, phase: seg.name };
    };
    const N = 3000, ds = L / N;
    const out = [];
    let t = 0;
    let prev = at(0);
    out.push({ t: 0, s: 0, h: prev.h, v: prev.v, phase: prev.phase });
    for (let i = 1; i <= N; i++) {
      const s = i * ds, cur = at(s);
      t += ds / ((prev.v + cur.v) / 2 / 3600);
      out.push({ t, s, h: cur.h, v: cur.v, phase: cur.phase });
      prev = cur;
    }
    return { samples: out, arrival: t, length: L };
  }

  // Ballistic: 2-D point-mass flight in a central gravity field (no drag, non-rotating Earth).
  // Boost with a simple pitch program, then an unpowered Keplerian coast. A textbook
  // "minimum-energy" style arc, rescaled to the route length. Visualisation only.
  function flyBallistic(A, tb, gamma, record) {
    let x = 0, y = R, vx = 0, vy = 0, t = 0;
    const dt = 0.5;
    const out = record ? [] : null;
    let maxR = R;
    const acc = (px, py, vxx, vyy, tt) => {
      const r = Math.hypot(px, py), ux = px / r, uy = py / r;
      const g = MU / (r * r);
      let ax = -g * ux, ay = -g * uy;
      if (tt < tb) {
        const f = tt / tb;
        const pitch = f < 0.05 ? Math.PI / 2 : (f < 0.3 ? Math.PI / 2 + (gamma - Math.PI / 2) * ((f - 0.05) / 0.25) : gamma);
        const ex = uy, ey = -ux; // local downrange horizontal
        ax += A * (Math.cos(pitch) * ex + Math.sin(pitch) * ux);
        ay += A * (Math.cos(pitch) * ey + Math.sin(pitch) * uy);
      }
      return [ax, ay];
    };
    const push = () => out && out.push({ t, phi: Math.atan2(x, y), h: Math.hypot(x, y) - R, v: Math.hypot(vx, vy) * 3600, boost: t < tb });
    push();
    while (t < 3 * 3600) {
      // RK4
      const a1 = acc(x, y, vx, vy, t);
      const a2 = acc(x + vx * dt / 2, y + vy * dt / 2, vx + a1[0] * dt / 2, vy + a1[1] * dt / 2, t + dt / 2);
      const v2x = vx + a1[0] * dt / 2, v2y = vy + a1[1] * dt / 2;
      const a3 = acc(x + v2x * dt / 2, y + v2y * dt / 2, vx + a2[0] * dt / 2, vy + a2[1] * dt / 2, t + dt / 2);
      const v3x = vx + a2[0] * dt / 2, v3y = vy + a2[1] * dt / 2;
      const a4 = acc(x + v3x * dt, y + v3y * dt, vx + a3[0] * dt, vy + a3[1] * dt, t + dt);
      const v4x = vx + a3[0] * dt, v4y = vy + a3[1] * dt;
      x += dt / 6 * (vx + 2 * v2x + 2 * v3x + v4x);
      y += dt / 6 * (vy + 2 * v2y + 2 * v3y + v4y);
      vx += dt / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]);
      vy += dt / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]);
      t += dt;
      const r = Math.hypot(x, y);
      maxR = Math.max(maxR, r);
      if (r < R - 0.01 && t > 5) { // landed (or never lifted off)
        if (out) { const p = out[out.length - 1]; out.push({ t, phi: Math.atan2(x, y), h: 0, v: Math.hypot(vx, vy) * 3600, boost: false }); }
        let phi = Math.atan2(x, y); if (phi < 0) phi += 2 * Math.PI;
        return { phi, t, out };
      }
      if (out && Math.round(t / dt) % 2 === 0) push();
      if (Math.hypot(vx, vy) > Math.sqrt(2 * MU / r)) return { phi: Infinity, t, out };
    }
    return { phi: Infinity, t, out };
  }

  function simulateBallistic(p, L) {
    const psi = Math.min(L / R, Math.PI * 0.97);
    const gamma = 0.8 * (Math.PI - psi) / 4; // a little flatter than the minimum-energy angle (burnout happens high up)
    const tb = p.boostTime;
    let lo = 0.0105, hi = 0.25;
    for (let i = 0; i < 45; i++) {
      const mid = (lo + hi) / 2;
      const r = flyBallistic(mid, tb, gamma, false);
      if (r.phi > psi) hi = mid; else lo = mid;
    }
    const res = flyBallistic(lo, tb, gamma, true);
    const raw = res.out;
    const endPhi = raw[raw.length - 1].phi > 0 ? raw[raw.length - 1].phi : 1e-9;
    const k = L / R / endPhi; // small rescale so the arc lands exactly on the route end
    let apo = 0; raw.forEach(q => { apo = Math.max(apo, q.h); });
    const samples = raw.map((q, i) => {
      const descending = i > 0 && q.h < raw[i - 1].h;
      let phase;
      if (q.boost) phase = 'Boost';
      else if (apo > 100 && q.h > 100) phase = descending ? 'Midcourse (descending)' : 'Midcourse (space)';
      else phase = descending ? (apo > 100 ? 'Re-entry' : 'Terminal') : 'Coast';
      return { t: q.t, s: Math.max(0, q.phi) * k * R, h: Math.max(0, q.h), v: q.v, phase };
    });
    samples[samples.length - 1].s = L;
    return { samples, arrival: samples[samples.length - 1].t, length: L, apogee: apo };
  }

  // Orbital launch: kinematic ascent (speed + pitch programme), then coast at (near-)orbital speed.
  // Optional per-rocket params: tSep/vSep/hSep (first staging), sepDur, vFinal, phases [[untilSec, name]...],
  // coastName, secoName, booster {tLand, apo} for a returning first stage.
  function simulateOrbital(p, L) {
    const T = p.ascentTime, H = p.orbitAlt;
    const vOrb = p.vFinal || Math.sqrt(MU / (R + H)) * 3600; // km/h
    const tSep = p.tSep || 160, vSep = p.vSep || 7500, sepDur = p.sepDur != null ? p.sepDur : 10;
    const e1 = p.speedExp1 || 2;
    const speedAt = t => {
      if (t <= tSep) return 30 + (vSep - 30) * (t / tSep) ** e1;
      if (t <= tSep + sepDur) return vSep;
      return vSep + (vOrb - vSep) * Math.min(1, (t - tSep - sepDur) / (T - tSep - sepDur)) ** 1.6;
    };
    const pitchAt = t => t < 10 ? Math.PI / 2 : (Math.PI / 2) * (1 - Math.min(1, (t - 10) / (T - 10)) ** 0.4);
    const phases = p.phases || [[tSep, 'First-stage ascent'], [tSep + sepDur, 'Stage separation'], [T, 'Second-stage burn']];
    const phaseAt = t => { for (const [u, n] of phases) if (t < u) return n; return phases[phases.length - 1][1]; };
    const dt = 0.5, raw = [];
    let t = 0, hRaw = 0, sRaw = 0, hRawSep = 0, sRawSep = 0;
    raw.push({ t, h: 0, s: 0, v: speedAt(0) });
    while (t < T) {
      const v = speedAt(t) / 3600, pch = pitchAt(t);
      hRaw += v * Math.sin(pch) * dt;
      sRaw += v * Math.cos(pch) * dt * R / (R + hRaw);
      t += dt;
      if (t <= tSep) { hRawSep = hRaw; sRawSep = sRaw; }
      raw.push({ t, h: hRaw, s: sRaw, v: speedAt(t) });
    }
    // piecewise-linear altitude map so staging happens near a realistic altitude and burnout at H
    const hSep = p.hSep || 65;
    const mapH = h => h <= hRawSep ? h * hSep / hRawSep : hSep + (h - hRawSep) * (H - hSep) / (hRaw - hRawSep);
    const samples = raw.map(q => ({ t: q.t, s: q.s, h: mapH(q.h), v: q.v, phase: phaseAt(q.t) }));
    const sAsc = sRaw;
    const groundV = vOrb * R / (R + H); // km/h along ground track
    const length = Math.max(L, sAsc + 1500);
    const coastLen = length - sAsc;
    const steps = 600;
    const coastName = p.coastName || 'Orbit (coasting)';
    for (let i = 1; i <= steps; i++) {
      const s = sAsc + coastLen * i / steps, tt = T + (s - sAsc) / groundV * 3600;
      samples.push({ t: tt, s, h: H, v: vOrb, phase: p.secoName && tt < T + 20 ? p.secoName : coastName });
    }
    const overDest = L >= sAsc ? T + (L - sAsc) / groundV * 3600 : interpTime(samples, L);
    const res = { samples, arrival: overDest, end: samples[samples.length - 1].t, length, ascentRange: sAsc, orbitalSpeed: vOrb };
    if (p.booster) res.booster = simulateBooster(p.booster, tSep, sRawSep, hSep, vSep);
    return res;
  }

  // Returning first stage (illustrative): boostback (or a drone-ship arc), coast to apogee, then a physically-shaped descent
  // worked out backwards from touchdown: free fall from apogee, an entry burn (70 → 40 km), a drag-limited fall and a
  // ~20 s landing burn from ~2.5 km that brings it to 0 m/s exactly at touchdown.
  function simulateBooster(b, tSep, sSep, hSep, vSep) {
    const tLand = b.tLand, apo = b.apo, N = 300, pts = [], Tt = tLand - tSep, g = 9.81, A = apo * 1000;
    const vFree = h => Math.max(25, Math.sqrt(2 * g * Math.max(0, A - h)));
    const vSink = h => { // descent speed (m/s) as a function of altitude (m)
      if (h < 2500) return Math.max(0.5, Math.sqrt(2 * 12.5 * h));         // landing burn ~1.3 g net
      const vTerm = 250 + (Math.min(h, 40000) - 2500) / 37500 * 400;         // thickening air slows it down
      if (h < 40000) return vTerm;
      if (h < 70000) { const k = (h - 40000) / 30000; return 650 + (vFree(Math.min(A, 70000)) - 650) * k * k; } // entry burn
      return vFree(h);
    };
    const fall = [{ t: 0, h: A }]; // integrate the fall from apogee down to the ground
    for (let h = A, t = 0; h > 0;) { const dh = Math.min(h, h < 3000 ? 10 : 200); t += dh / ((vSink(h) + vSink(h - dh)) / 2); h -= dh; fall.push({ t, h }); }
    const Tf = fall[fall.length - 1].t, tA = Math.max(Tt * 0.15, Tt - Tf), kF = (Tt - tA) / Tf; // apogee time (stretch the fall slightly if needed)
    const hAt = tau => {
      if (tau <= tA) return hSep * 1000 + (A - hSep * 1000) * Math.sin((Math.PI / 2) * Math.min(1, tau / tA));
      const tf = (tau - tA) / kF; let lo = 0, hi = fall.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (fall[m].t < tf) lo = m; else hi = m; }
      const a = fall[lo], c = fall[hi], f = (tf - a.t) / ((c.t - a.t) || 1); return a.h + (c.h - a.h) * Math.min(1, Math.max(0, f));
    };
    for (let i = 0; i <= N; i++) {
      const u = i / N, t = tSep + u * Tt;
      const s = b.drone ? sSep + (b.drone - sSep) * (1 - (1 - Math.min(1, u * 1.04)) ** 1.6) // ballistic arc out to a drone ship downrange
        : sSep * (1 + 0.18 * Math.sin(Math.PI * Math.min(1, u / 0.4))) * (1 - smooth(Math.min(1, u * 1.05)));
      pts.push({ t, s: Math.max(0, s), h: Math.max(0, hAt(u * Tt) / 1000) });
    }
    for (let i = 0; i <= N; i++) {
      const a = pts[Math.max(0, i - 1)], c = pts[Math.min(N, i + 1)];
      const dts = c.t - a.t || 1;
      let v = Math.hypot((c.s - a.s) / dts, (c.h - a.h) / dts) * 3600;
      const u = i / N, tau = u * Tt, hm = pts[i].h * 1000, down = tau > tA;
      if (u < 0.05) v = vSep * (1 - u / 0.05) + v * (u / 0.05); // blend from separation speed
      pts[i].v = v;
      pts[i].phase = b.drone ? (u < 0.12 ? 'Flip & coast' : !down || hm > 70000 ? 'Coast (apogee)' : hm > 40000 ? 'Entry burn' : hm > 2500 ? 'Coast & descent' : 'Landing burn')
        : (u < 0.14 ? 'Boostback burn' : (!down || hm > 2500 ? 'Coast & descent' : 'Landing burn'));
    }
    pts[N].v = 0; pts[N].h = 0; pts[N].phase = b.drone ? 'Landed on the drone ship' : 'Back at launch site';
    return { samples: pts, arrival: tLand, end: tLand, length: b.drone ? b.drone : sSep, drone: !!b.drone };
  }
  function interpTime(samples, s) {
    for (let i = 1; i < samples.length; i++) if (samples[i].s >= s) {
      const a = samples[i - 1], b = samples[i], f = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
      return a.t + (b.t - a.t) * f;
    }
    return samples[samples.length - 1].t;
  }

  function simulate(preset, L) {
    let r;
    if (preset.kind === 'ballistic') r = simulateBallistic(preset, L);
    else if (preset.kind === 'orbital') r = simulateOrbital(preset, L);
    else r = simulateCruise(preset, L);
    if (r.end == null) r.end = r.arrival;
    let maxV = 0, maxH = 0;
    r.samples.forEach(q => { maxV = Math.max(maxV, q.v); maxH = Math.max(maxH, q.h); });
    r.maxV = maxV; r.maxH = maxH;
    return r;
  }
  // State at time t (linear interpolation, binary search).
  function stateAt(r, t) {
    const S = r.samples;
    if (t <= 0) return { ...S[0] };
    if (t >= S[S.length - 1].t) return { ...S[S.length - 1], done: true };
    let lo = 0, hi = S.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m].t <= t) lo = m; else hi = m; }
    const a = S[lo], b = S[hi], f = (t - a.t) / (b.t - a.t || 1);
    return { t, s: a.s + (b.s - a.s) * f, h: a.h + (b.h - a.h) * f, v: a.v + (b.v - a.v) * f, phase: a.phase, idx: lo };
  }

  const api = { R, PRESETS, toVec, toLatLng, centralAngle, greatCircleKm, makeGreatCircle, speedOfSound, simulate, stateAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LaunchSim = api;
})(typeof window !== 'undefined' ? window : globalThis);

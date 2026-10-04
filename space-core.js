/* Space missions core: real ephemerides (astronomy-engine), Lambert solver, Kepler propagation,
   Mars porkchop window search and simplified Starship Moon/Mars mission profiles.
   Units: km, s, km/s unless noted. Frame: J2000 mean ecliptic (x toward vernal equinox). */
(function (root) {
  'use strict';
  const A = root.Astronomy || (typeof require !== 'undefined' ? require('./vendor/astronomy.browser.min.js') : null);
  const AU = 149597870.7, DAY = 86400;
  const MU_SUN = 1.32712440018e11, MU_E = 398600.4418, MU_MOON = 4902.800, MU_MARS = 42828.37;
  const R_E = 6378.137, R_MOON = 1737.4, R_MARS = 3389.5;
  const ROT = A.Rotation_EQJ_ECL();
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => Math.sqrt(dot(a, a));
  const unit = a => mul(a, 1 / norm(a));

  // ---------- Ephemerides ----------
  const toKm = s => { const e = A.RotateState(ROT, s); return { r: [e.x * AU, e.y * AU, e.z * AU], v: [e.vx * AU / DAY, e.vy * AU / DAY, e.vz * AU / DAY] }; };
  const BODY = { earth: 'Earth', mars: 'Mars', moon: 'Moon', venus: 'Venus', mercury: 'Mercury' };
  function helio(body, date) { return toKm(A.HelioState(A.Body[BODY[body]], date)); }
  function moonGeo(date) { return toKm(A.GeoMoonState(date)); }
  function moonHelio(date) { const e = helio('earth', date), m = moonGeo(date); return { r: add(e.r, m.r), v: add(e.v, m.v) }; }

  // ---------- Stumpff functions ----------
  function stumpC(z) { if (z > 1e-8) return (1 - Math.cos(Math.sqrt(z))) / z; if (z < -1e-8) return (Math.cosh(Math.sqrt(-z)) - 1) / -z; return 0.5 - z / 24; }
  function stumpS(z) { if (z > 1e-8) { const s = Math.sqrt(z); return (s - Math.sin(s)) / (s * s * s); } if (z < -1e-8) { const s = Math.sqrt(-z); return (Math.sinh(s) - s) / (s * s * s); } return 1 / 6 - z / 120; }

  // ---------- Lambert (universal variables, bisection; single revolution) ----------
  function lambert(r1v, r2v, dt, mu, prograde = true) {
    const r1 = norm(r1v), r2 = norm(r2v);
    const c = cross(r1v, r2v);
    let cosd = dot(r1v, r2v) / (r1 * r2); cosd = Math.max(-1, Math.min(1, cosd));
    let dnu = Math.acos(cosd);
    if ((prograde && c[2] < 0) || (!prograde && c[2] >= 0)) dnu = 2 * Math.PI - dnu;
    const Ac = Math.sin(dnu) * Math.sqrt(r1 * r2 / (1 - cosd));
    if (Math.abs(Ac) < 1e-9) return null;
    let lo = -4 * Math.PI, hi = 4 * Math.PI * Math.PI, z = 0, y = 0;
    for (let i = 0; i < 200; i++) {
      z = (lo + hi) / 2;
      const C = stumpC(z), S = stumpS(z);
      y = r1 + r2 + Ac * (z * S - 1) / Math.sqrt(C);
      if (Ac > 0 && y < 0) { lo = z; continue; }
      const x = Math.sqrt(y / C);
      const t = (x * x * x * S + Ac * Math.sqrt(y)) / Math.sqrt(mu);
      if (Math.abs(t - dt) < 1e-7 * dt) break;
      if (t <= dt) lo = z; else hi = z;
    }
    if (!(y > 0)) return null;
    const f = 1 - y / r1, g = Ac * Math.sqrt(y / mu), gd = 1 - y / r2;
    return { v1: mul(sub(r2v, mul(r1v, f)), 1 / g), v2: mul(sub(mul(r2v, gd), r1v), 1 / g), dnu };
  }

  // ---------- Kepler propagation (universal anomaly) ----------
  function propagate(r0v, v0v, dt, mu) {
    const r0 = norm(r0v), vr0 = dot(r0v, v0v) / r0, alpha = 2 / r0 - dot(v0v, v0v) / mu;
    let x = Math.sqrt(mu) * Math.abs(alpha) * dt;
    if (!isFinite(x) || x === 0) x = Math.sqrt(mu) * dt / r0;
    for (let i = 0; i < 100; i++) {
      const z = alpha * x * x, C = stumpC(z), S = stumpS(z);
      const F = r0 * vr0 / Math.sqrt(mu) * x * x * C + (1 - alpha * r0) * x * x * x * S + r0 * x - Math.sqrt(mu) * dt;
      const dF = r0 * vr0 / Math.sqrt(mu) * x * (1 - alpha * x * x * S) + (1 - alpha * r0) * x * x * C + r0;
      const step = F / dF; x -= step;
      if (Math.abs(step) < 1e-9) break;
    }
    const z = alpha * x * x, C = stumpC(z), S = stumpS(z);
    const f = 1 - x * x / r0 * C, g = dt - x * x * x / Math.sqrt(mu) * S;
    const r = add(mul(r0v, f), mul(v0v, g)), rn = norm(r);
    const fd = Math.sqrt(mu) / (rn * r0) * (alpha * x * x * x * S - x), gd = 1 - x * x / rn * C;
    return { r, v: add(mul(r0v, fd), mul(v0v, gd)) };
  }

  // ---------- Earth -> Mars transfer for a given departure & time of flight ----------
  const LEO_R = R_E + 250;
  const dvFromLEO = c3 => Math.sqrt(c3 + 2 * MU_E / LEO_R) - Math.sqrt(MU_E / LEO_R);
  const entrySpeed = (vinf, mu, rEntry) => Math.sqrt(vinf * vinf + 2 * mu / rEntry);
  function marsTransfer(depDate, tofDays, E, M) {
    E = E || helio('earth', depDate);
    M = M || helio('mars', new Date(depDate.getTime() + tofDays * DAY * 1000));
    const L = lambert(E.r, M.r, tofDays * DAY, MU_SUN);
    if (!L) return null;
    const vinfD = sub(L.v1, E.v), vinfA = sub(L.v2, M.v);
    const c3 = dot(vinfD, vinfD), vArr = norm(vinfA);
    return { dep: depDate, arr: new Date(depDate.getTime() + tofDays * DAY * 1000), tof: tofDays, c3, vinfDep: Math.sqrt(c3), vinfArr: vArr,
      dvLEO: dvFromLEO(c3), vEntry: entrySpeed(vArr, MU_MARS, R_MARS + 125), r1: E.r, v1: L.v1, r2: M.r, v2: L.v2, dnu: L.dnu };
  }

  // ---------- Porkchop search over a span of departure dates ----------
  // Grid: departure step depStep days, TOF tofMin..tofMax step tofStep. Ephemerides cached per day.
  function porkchop(start, years, opt = {}) {
    const SING = 2.5 * Math.PI / 180; // skip the ill-conditioned ~180° transfer band
    const ok = opt.type === 1 ? tr => tr.dnu < Math.PI - SING : opt.type === 2 ? tr => tr.dnu > Math.PI + SING : tr => Math.abs(tr.dnu - Math.PI) > SING;
    const depStep = opt.depStep || 2, tofMin = opt.tofMin || 110, tofMax = opt.tofMax || 330, tofStep = opt.tofStep || 3;
    const t0 = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const nDep = Math.ceil(years * 365.25 / depStep);
    const eC = new Map(), mC = new Map();
    const eAt = d => { if (!eC.has(d)) eC.set(d, helio('earth', new Date(t0 + d * DAY * 1000))); return eC.get(d); };
    const mAt = d => { if (!mC.has(d)) mC.set(d, helio('mars', new Date(t0 + d * DAY * 1000))); return mC.get(d); };
    const best = []; // per departure: min C3 and its TOF
    for (let i = 0; i < nDep; i++) {
      const d = i * depStep; let b = null;
      for (let tof = tofMin; tof <= tofMax; tof += tofStep) {
        const tr = marsTransfer(new Date(t0 + d * DAY * 1000), tof, eAt(d), mAt(d + tof));
        if (tr && ok(tr) && (!b || tr.c3 < b.c3)) b = tr;
      }
      best.push({ d, tr: b });
    }
    // Local minima of min-C3 vs departure, one per synodic period (~780 d)
    const wins = [];
    for (let i = 1; i < best.length - 1; i++) {
      const c = best[i].tr && best[i].tr.c3; if (!c) continue;
      const lo = Math.max(0, i - 60), hi = Math.min(best.length - 1, i + 60);
      let isMin = true; for (let j = lo; j <= hi; j++) if (best[j].tr && best[j].tr.c3 < c) { isMin = false; break; }
      if (isMin && c < 60) wins.push(i);
    }
    return wins.map(i => {
      // refine on a 1-day grid around the coarse optimum
      const c = best[i].tr; let b = c;
      for (let dd = -depStep * 2; dd <= depStep * 2; dd++) for (let tt = -tofStep * 2; tt <= tofStep * 2; tt++) {
        const d = best[i].d + dd, tof = c.tof + tt; if (d < 0) continue;
        const tr = marsTransfer(new Date(t0 + d * DAY * 1000), tof, eAt(d), mAt(d + tof));
        if (tr && ok(tr) && tr.c3 < b.c3) b = tr;
      }
      // window span: departure dates whose best C3 is within +5 km²/s² of the optimum
      let a = i, z = i; const lim = b.c3 + 5;
      while (a > 0 && best[a - 1].tr && best[a - 1].tr.c3 <= lim) a--;
      while (z < best.length - 1 && best[z + 1].tr && best[z + 1].tr.c3 <= lim) z++;
      return { ...b, type: b.dnu < Math.PI ? 1 : 2, open: new Date(t0 + best[a].d * DAY * 1000), close: new Date(t0 + best[z].d * DAY * 1000), atEdge: i < 3 || i > best.length - 4 };
    }).filter(w => !w.atEdge || w.open.getTime() > t0);
  }
  // Best TOF for a given departure date (custom date)
  function bestForDate(dep, tofMin = 90, tofMax = 330) {
    const E = helio('earth', dep); let b = null;
    for (let tof = tofMin; tof <= tofMax; tof += 2) { const tr = marsTransfer(dep, tof, E); if (tr && Math.abs(tr.dnu - Math.PI) > 0.0436 && (!b || tr.c3 < b.c3)) b = tr; }
    if (b) for (let tof = b.tof - 2; tof <= b.tof + 2; tof += 0.25) { const tr = marsTransfer(dep, tof, E); if (tr && Math.abs(tr.dnu - Math.PI) > 0.0436 && tr.c3 < b.c3) b = tr; }
    return b;
  }

  root.SpaceCore = { A, AU, DAY, MU_SUN, MU_E, MU_MOON, MU_MARS, R_E, R_MOON, R_MARS, LEO_R,
    add, sub, mul, dot, cross, norm, unit, helio, moonGeo, moonHelio, lambert, propagate, marsTransfer, porkchop, bestForDate, dvFromLEO, entrySpeed };

  // ================= Mission profiles (simplified, patched conics) =================
  const H = 3600, MIN = 60;
  const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const lerp = (a, b, f) => a + (b - a) * f;
  function phaseAt(phases, t) { let p = phases[0]; for (const q of phases) if (t >= q.t) p = q; return p; }

  // ---- Mars: TMI from LEO, heliocentric Lambert arc, direct entry + EDL ----
  function marsMission(tr) {
    const tof = tr.tof * DAY, t0 = tr.dep.getTime();
    const EDL = [ // seconds after entry interface (illustrative Starship-style profile)
      { t: 0, h: 125, v: tr.vEntry }, { t: 90, h: 60, v: tr.vEntry * 0.93 }, { t: 240, h: 32, v: 1.2 },
      { t: 420, h: 2.5, v: 0.11 }, { t: 445, h: 0.6, v: 0.09 }, { t: 470, h: 0, v: 0 } ];
    const phases = [
      { t: 0, name: 'Trans-Mars injection burn', note: `Δv ≈ ${tr.dvLEO.toFixed(2)} km/s from a 250 km Earth orbit (C3 ≈ ${tr.c3.toFixed(1)} km²/s²)` },
      { t: 30 * MIN, name: 'Earth departure (escaping Earth)' },
      { t: 3 * DAY, name: 'Interplanetary cruise (coasting)' },
      { t: tof - 3 * DAY, name: 'Mars approach' },
      { t: tof, name: 'Atmospheric entry (peak heating)', note: `Entry ≈ ${tr.vEntry.toFixed(2)} km/s (${Math.round(tr.vEntry * 3600).toLocaleString('en-GB')} km/h)`, edl: true },
      { t: tof + 240, name: 'Supersonic belly-flop descent', edl: true },
      { t: tof + 420, name: 'Flip & landing burn', edl: true },
      { t: tof + 470, name: 'Landed on Mars', edl: true, done: true } ];
    const arc = []; for (let i = 0; i <= 400; i++) arc.push(propagate(tr.r1, tr.v1, tof * i / 400, MU_SUN).r);
    function at(t) {
      t = Math.max(0, Math.min(t, tof + 900));
      const date = new Date(t0 + t * 1000), E = helio('earth', date), M = helio('mars', date);
      let r, v, local = null;
      if (t < tof) { const s = propagate(tr.r1, tr.v1, t, MU_SUN); r = s.r; v = s.v; }
      else {
        const te = t - tof; let k = 0; while (k < EDL.length - 2 && te > EDL[k + 1].t) k++;
        const a = EDL[k], b = EDL[k + 1], f = Math.min(1, Math.max(0, (te - a.t) / (b.t - a.t)));
        local = { h: lerp(a.h, b.h, smooth(f)), v: lerp(a.v, b.v, f), te };
        r = M.r; v = M.v;
      }
      const rel = sub(r, M.r);
      return { t, date, r, v, E, M, speed: norm(v), dEarth: norm(sub(r, E.r)), dTarget: Math.max(0, norm(rel) - (local ? 0 : 0)), local, phase: phaseAt(phases, t) };
    }
    return { kind: 'mars', tr, t0, end: tof + 900, arrival: tof, phases, arc, at,
      stops: [0, 30 * MIN, 3 * DAY, tof - 3 * DAY, tof, tof + 470] };
  }

  // ---- Moon: TLI from LEO, geocentric Lambert arc to the Moon's real arrival position, LOI, LLO, landing ----
  const LLO_R = R_MOON + 100;
  function moonTransfer(depDate, tofDays) {
    const arr = new Date(depDate.getTime() + tofDays * DAY * 1000), M = moonGeo(arr);
    const r2h = unit(M.r), hh = unit(cross(M.r, M.v)), th = unit(cross(hh, r2h));
    const th0 = -172 * Math.PI / 180; // depart ~172° before the arrival point, in the Moon's orbital plane
    const r1 = mul(add(mul(r2h, Math.cos(th0)), mul(th, Math.sin(th0))), LEO_R);
    const L = lambert(r1, M.r, tofDays * DAY, MU_E); if (!L) return null;
    const vc = mul(unit(cross(hh, r1)), Math.sqrt(MU_E / LEO_R));
    const dvTLI = norm(sub(L.v1, vc)), vinf = norm(sub(L.v2, M.v));
    const dvLOI = Math.sqrt(vinf * vinf + 2 * MU_MOON / LLO_R) - Math.sqrt(MU_MOON / LLO_R);
    return { dep: depDate, arr, tof: tofDays, r1, v1: L.v1, r2: M.r, dvTLI, vinf, dvLOI, moonDist: norm(M.r) };
  }
  function bestMoon(depDate) {
    let b = null;
    for (let tof = 3.0; tof <= 4.001; tof += 0.1) { const m = moonTransfer(depDate, tof); if (m && (!b || m.dvTLI + m.dvLOI < b.dvTLI + b.dvLOI)) b = m; }
    return b;
  }
  function moonMission(tr) {
    const tof = tr.tof * DAY, t0 = tr.dep.getTime();
    const Tllo = 2 * Math.PI * Math.sqrt(LLO_R ** 3 / MU_MOON);
    const tLOI = tof, tLLO = tof + 15 * MIN, tPD = tLLO + 2 * Tllo, tTD = tPD + 10 * MIN, tLand = tTD + 2 * MIN;
    const phases = [
      { t: 0, name: 'Trans-lunar injection burn', note: `Δv ≈ ${tr.dvTLI.toFixed(2)} km/s from a 250 km Earth orbit` },
      { t: 8 * MIN, name: 'Translunar coast' },
      { t: tof - 12 * H, name: 'Lunar approach' },
      { t: tLOI, name: 'Lunar orbit insertion burn', note: `Δv ≈ ${tr.dvLOI.toFixed(2)} km/s into a 100 km lunar orbit`, lunar: true },
      { t: tLLO, name: 'Low lunar orbit (100 km)', lunar: true },
      { t: tPD, name: 'Powered descent', lunar: true },
      { t: tTD, name: 'Terminal descent & touchdown', lunar: true },
      { t: tLand, name: 'Landed on the Moon', lunar: true, done: true } ];
    const arc = []; for (let i = 0; i <= 300; i++) arc.push(propagate(tr.r1, tr.v1, tof * i / 300, MU_E).r);
    function at(t) {
      t = Math.max(0, Math.min(t, tLand + 30 * MIN));
      const date = new Date(t0 + t * 1000), Mo = moonGeo(date), Eh = helio('earth', date);
      let r, v, local = null;
      if (t < tof) { const s = propagate(tr.r1, tr.v1, t, MU_E); r = s.r; v = s.v; }
      else {
        // selenocentric: LOI then circular LLO, then descent (illustrative)
        const vLLO = Math.sqrt(MU_MOON / LLO_R); let h = 100, vs = vLLO, ang = (t - tof) / Tllo * 2 * Math.PI;
        if (t < tLLO) vs = lerp(vLLO + tr.dvLOI, vLLO, (t - tof) / (tLLO - tof));
        else if (t >= tPD && t < tTD) { const f = (t - tPD) / (tTD - tPD); h = lerp(100, 2, smooth(f)); vs = lerp(vLLO, 0.08, f); }
        else if (t >= tTD) { const f = Math.min(1, (t - tTD) / (tLand - tTD)); h = lerp(2, 0, smooth(f)); vs = lerp(0.08, 0, f); }
        if (t >= tPD) ang = (tPD - tof) / Tllo * 2 * Math.PI + Math.min(t - tPD, 12 * MIN) / Tllo * Math.PI * 0.6;
        const rad = R_MOON + h;
        local = { h, v: vs, ang, rad };
        r = add(Mo.r, [rad * Math.cos(ang), rad * Math.sin(ang), 0]); v = Mo.v;
      }
      const vh = add(Eh.v, v);
      return { t, date, r, v, Mo, E: Eh, speedGeo: norm(v), speed: norm(vh), dEarth: Math.max(0, norm(r) - R_E), dTarget: Math.max(0, norm(sub(r, Mo.r)) - R_MOON), local, phase: phaseAt(phases, t) };
    }
    return { kind: 'moon', tr, t0, end: tLand + 30 * MIN, arrival: tof, phases, arc, at, stops: [0, 8 * MIN, tof - 12 * H, tLOI, tLLO, tPD, tTD, tLand] };
  }
  // Monthly lunar windows: arrive near lunar perigee (lowest TLI+LOI cost in that month)
  function moonWindows(start, n = 6) {
    const out = []; let ap = A.SearchLunarApsis(start);
    while (out.length < n) {
      if (ap.kind === 0) { // perigee
        const dep = new Date(ap.time.date.getTime() - 3.2 * DAY * 1000);
        if (dep > start) { const b = bestMoon(dep); if (b) out.push({ ...b, perigee: ap.time.date, phase: A.MoonPhase(b.arr) }); }
      }
      ap = A.NextLunarApsis(ap);
    }
    return out;
  }
  Object.assign(root.SpaceCore, { marsMission, moonMission, moonTransfer, bestMoon, moonWindows, LLO_R });

  // ================= Orbital refuelling estimate (public ballpark figures) =================
  const REFUEL = { isp: 380, dry: 120, cap: 1500, tanker: 125, tankerLo: 100, tankerHi: 150, resid: 50, loss: 0.05, interval: 4 * DAY };
  function refuelPlan(kind, tr) {
    const K = REFUEL, ve = K.isp * 9.80665 / 1000;
    const items = kind === 'mars'
      ? [['Trans-Mars injection', tr.dvLEO], ['Course corrections', 0.1], ['Mars landing burn (after aerobraking)', 0.7]]
      : [['Trans-lunar injection', tr.dvTLI], ['Course corrections', 0.05], ['Lunar orbit insertion', tr.dvLOI], ['Powered descent & landing', 1.9], ['Ascent back to lunar orbit (crew return, HLS-style)', 1.9]];
    const dv = items.reduce((a, b) => a + b[1], 0), ratio = Math.exp(dv / ve);
    let payload = kind === 'mars' ? 100 : 50;
    const payload0 = payload, singleDv = ve * Math.log((K.dry + payload + K.resid) / (K.dry + payload));
    let prop = (K.dry + payload) * (ratio - 1), feasible = true, limited = false;
    if (prop > K.cap) { const maxPay = K.cap / (ratio - 1) - K.dry; if (maxPay >= 5) { payload = maxPay; limited = true; } else feasible = false; prop = K.cap; }
    const transfer = Math.max(0, prop - K.resid) / (1 - K.loss);
    const n = Math.ceil(transfer / K.tanker), nLo = Math.ceil(transfer / K.tankerHi), nHi = Math.ceil(transfer / K.tankerLo);
    const campaign = n ? 1 * DAY + n * K.interval + 1 * DAY : 0;
    return { ...K, ve, items, dv, ratio, payload, payload0, limited, feasible, prop, transfer, n, nLo, nHi, singleDv, required: dv > singleDv, campaign,
      needRaw: (K.dry + payload0) * (ratio - 1) };
  }
  Object.assign(root.SpaceCore, { refuelPlan, REFUEL });
})(typeof window !== 'undefined' ? window : globalThis);

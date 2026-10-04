/* Space missions mode: UI, planning, playback and canvas rendering (heliocentric Mars / geocentric Moon). */
(function () {
  'use strict';
  const C = window.SpaceCore, A = window.Astronomy;
  const $ = id => document.getElementById(id);
  const DAY = 86400, H = 3600;
  const qs = new URLSearchParams(window.__initialSearch != null ? window.__initialSearch : location.search);
  const fmt = (n, d = 0) => Number(n).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
  const dShort = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const dUTC = d => d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const dLon = d => d.toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' London';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function met(t) {
    if (t < 0) return met(-t).replace('T+', 'T−');
    const d = Math.floor(t / DAY), h = Math.floor(t % DAY / H), m = Math.floor(t % H / 60), s = Math.floor(t % 60);
    return `T+${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }
  const kmStr = km => km >= 1e6 ? fmt(km / 1e6, 2) + ' million km' : fmt(km) + ' km';

  const S = {
    active: false, target: qs.get('target') === 'moon' ? 'moon' : 'mars',
    windows: { mars: null, moon: null }, sel: null, mission: null,
    t: 0, playing: false, rate: 86400, follow: false,
    view: { cx: 0, cy: 0, scale: 1, fitted: false }, orbits: null
  };

  // ---------- planning ----------
  function marsWindows() {
    if (S.windows.mars) return S.windows.mars;
    const start = new Date(), t1 = C.porkchop(start, 10.5, { type: 1, tofMin: 100 }), t2 = C.porkchop(start, 10.5, { type: 2, tofMin: 100 });
    // pair Type I / Type II optima belonging to the same opportunity (within ~150 days)
    const opps = [];
    t1.concat(t2).sort((a, b) => a.dep - b.dep).forEach(w => {
      const o = opps.find(o => Math.abs(o.ref - w.dep) < 150 * DAY * 1000);
      if (o) o[w.type === 1 ? 'fast' : 'eco'] = o[w.type === 1 ? 'fast' : 'eco'] || w; else opps.push({ ref: w.dep, [w.type === 1 ? 'fast' : 'eco']: w });
    });
    opps.forEach(o => {
      const ws = [o.fast, o.eco].filter(Boolean);
      o.best = ws.reduce((a, b) => (a.c3 < b.c3 ? a : b));
      o.open = new Date(Math.min(...ws.map(w => w.open))); o.close = new Date(Math.max(...ws.map(w => w.close)));
      o.year = o.best.dep.getUTCFullYear();
    });
    return (S.windows.mars = opps.filter(o => o.close > start));
  }
  function moonWindows() {
    if (!S.windows.moon) S.windows.moon = C.moonWindows(new Date(), 6);
    return S.windows.moon;
  }
  function ratingFor(tr) {
    if (S.target === 'moon') return { cls: 'good', text: `✅ Any day works for the Moon: TLI ≈ ${tr.dvTLI.toFixed(2)} km/s, LOI ≈ ${tr.dvLOI.toFixed(2)} km/s, ${tr.tof.toFixed(1)}-day coast. (The real constraint is daily: the parking orbit must line up with the Moon's arrival point.)` };
    const opp = marsWindows().find(o => tr.dep >= new Date(o.open - 20 * DAY * 1000) && tr.dep <= new Date(+o.close + 20 * DAY * 1000));
    const minC3 = opp ? opp.best.c3 : 8.5;
    if (tr.c3 <= minC3 + 5) return { cls: 'good', text: `✅ Inside a launch window – C3 ${tr.c3.toFixed(1)} km²/s² (window best ${minC3.toFixed(1)}).` };
    if (tr.c3 <= 25) return { cls: 'ok', text: `⚠️ Marginal – C3 ${tr.c3.toFixed(1)} km²/s² needs ≈ ${tr.dvLEO.toFixed(2)} km/s from LEO (window best ≈ ${minC3.toFixed(1)}).` };
    return { cls: 'bad', text: `⛔ Bad window – Earth and Mars are badly aligned: best transfer needs C3 ≈ ${fmt(tr.c3, 0)} km²/s² (Δv ≈ ${tr.dvLEO.toFixed(1)} km/s from LEO vs ≈ 3.6 in a window). Next good window: ${nextWindowText(tr.dep)}.` };
  }
  function nextWindowText(d) { const o = marsWindows().find(o => o.close > d); return o ? `${dShort(o.open)} – ${dShort(o.close)}` : 'beyond 10 years'; }

  // Pre-departure orbital refuelling campaign in LEO (estimate): ship launch, N tanker dockings, then TMI/TLI at T+0.
  function addRefuel(m, plan) {
    m.plan = plan; m.start = -plan.campaign;
    if (!plan.n) return m;
    const pre = plan.campaign, first = -pre + DAY, per = plan.transfer / plan.n * (1 - plan.loss);
    const dock = k => first + (k + 0.5) * plan.interval; // docking time of tanker k (0-based)
    m.dock = dock;
    const pre_ph = [
      { t: -pre, name: 'Starship launched to Earth orbit (LEO)', note: `Arrives with ≈ ${plan.resid} t of propellant left – far short of the ≈ ${fmt(plan.prop)} t needed`, refuel: true },
      { t: first, name: `Orbital refuelling: ${plan.n} tanker flights`, note: `Tankers launch ~every ${plan.interval / DAY} days and transfer propellant ship-to-ship (estimate)`, refuel: true },
      { t: dock(plan.n - 1) + 6 * H, name: 'Tanks full – final checks', refuel: true } ];
    m.phases = pre_ph.concat(m.phases); m.stops = pre_ph.map(p => p.t).concat(m.stops);
    const base = m.at.bind(m), baseAt = m.at;
    m.at = t => {
      if (t >= 0) return baseAt(t);
      t = Math.max(t, -pre);
      const date = new Date(m.t0 + t * 1000), E = C.helio('earth', date);
      let k = 0, prop = plan.resid, docking = null;
      for (let i = 0; i < plan.n; i++) {
        const td = dock(i);
        if (t >= td + 6 * H) { prop += per; k = i + 1; }
        else if (t >= td - 12 * H) { docking = { i, f: Math.max(0, Math.min(1, (t - (td - 12 * H)) / (12 * H))), x: t >= td ? Math.min(1, (t - td) / (6 * H)) : 0 }; if (t >= td) prop += per * docking.x; break; }
      }
      prop = Math.min(prop, plan.prop);
      const w = 2 * Math.PI / 5400 * t, leo = [C.LEO_R * Math.cos(w), C.LEO_R * Math.sin(w), 0];
      const phase = m.phases.filter(p => p.t <= t).pop();
      const st = { t, date, E, leo: true, refuel: { k, n: plan.n, prop, docking }, phase, local: null };
      if (S.target === 'mars') { const M = C.helio('mars', date); Object.assign(st, { M, r: E.r, v: E.v, speed: C.norm(E.v), dEarth: 250, dTarget: C.norm(C.sub(M.r, E.r)) }); }
      else { const Mo = C.moonGeo(date); Object.assign(st, { Mo, r: leo, v: [0, 0, 0], speedGeo: 7.75, speed: C.norm(E.v), dEarth: 250, dTarget: C.norm(C.sub(Mo.r, leo)) - C.R_MOON }); }
      return st;
    };
    void base;
    return m;
  }
  function select(tr, label) {
    S.sel = { tr, label };
    S.mission = addRefuel(S.target === 'mars' ? C.marsMission(tr) : C.moonMission(tr), C.refuelPlan(S.target, tr));
    S.t = S.mission.start; setPlaying(false); hideSpaceResults(); S.view.fitted = false; S.orbits = null; S.follow = false;
    $('spDate').value = tr.dep.toISOString().slice(0, 16);
    renderWindows(); renderSummary(); renderPhases(); syncUrl();
    const r = ratingFor(tr); $('spRating').className = 'sp-rating ' + r.cls; $('spRating').innerHTML = r.text;
  }
  // "Live": tankers start launching now, so the injection burn happens after the refuelling campaign.
  function planLive() {
    const now = new Date(), best = d => (S.target === 'mars' ? C.bestForDate(d) : C.bestMoon(d));
    const plan = C.refuelPlan(S.target, best(now));
    const dep = new Date(Math.ceil((now.getTime() + plan.campaign * 1000) / 60000) * 60000);
    const tr = best(dep);
    if (tr) select(tr, `Live: tankers start launching now → earliest departure after ≈ ${Math.round(plan.campaign / DAY)} days of refuelling`);
  }
  function planCustom(date) {
    if (!(date instanceof Date) || isNaN(date)) return;
    const tr = S.target === 'mars' ? C.bestForDate(date) : C.bestMoon(date);
    if (tr) select(tr, 'Custom date');
  }

  // ---------- panel rendering ----------
  function renderWindows() {
    const el = $('spWindows');
    if (S.target === 'mars') {
      $('spWinTitle').textContent = 'Mars launch windows (next ~10 years)';
      $('spWinNote').innerHTML = 'Porkchop search: Lambert solutions on real ephemerides, departure every 2 days × flight time 100–330 days, refined to 1 day. <b>Fast</b> = Type I (&lt;180° transfer), <b>Min-energy</b> = Type II. Span = departures within +5 km²/s² of the best C3.';
      el.innerHTML = marsWindows().map((o, i) => {
        const opt = (w, k, lbl) => w ? `<button class="win-opt${S.sel && S.sel.tr === w ? ' on' : ''}" data-i="${i}" data-k="${k}"><b>${lbl}</b><br>${dShort(w.dep)} → ${dShort(w.arr)}<br>${Math.round(w.tof)} d · C3 ${w.c3.toFixed(1)} · Δv ${w.dvLEO.toFixed(2)} km/s<br>arrive v∞ ${w.vinfArr.toFixed(1)} km/s</button>` : '';
        const sel = S.sel && (S.sel.tr === o.fast || S.sel.tr === o.eco);
        return `<div class="win${sel ? ' sel' : ''}"><div class="win-head"><span>${o.year} window</span><span class="muted small">${o.open <= new Date(Date.now() + DAY * 1000) ? 'open now' : dShort(o.open)} – ${dShort(o.close)}</span></div><div class="win-opts">${opt(o.fast, 'fast', '⚡ Fast (Type I)')}${opt(o.eco, 'eco', '🌱 Min-energy (Type II)')}</div></div>`;
      }).join('');
    } else {
      $('spWinTitle').textContent = 'Lunar windows';
      $('spWinNote').innerHTML = 'The Moon is reachable every day (~3–4 day coast, TLI ≈ 3.15 km/s). Listed: the next monthly windows arriving near lunar <b>perigee</b> (closest approach, slightly cheaper). Or pick any date below.';
      el.innerHTML = moonWindows().map((w, i) => `<div class="win${S.sel && S.sel.tr === w ? ' sel' : ''}"><button class="win-opt${S.sel && S.sel.tr === w ? ' on' : ''}" data-i="${i}" data-k="moon"><b>${dShort(w.dep)}</b> · TLI ${w.dep.toISOString().slice(11, 16)} UTC → land ${dShort(w.arr)}<br>${w.tof.toFixed(1)}-day coast · TLI ${w.dvTLI.toFixed(2)} + LOI ${w.dvLOI.toFixed(2)} km/s · Moon ${fmt(w.moonDist)} km, ${phaseName(w.phase)}</button></div>`).join('');
    }
  }
  function phaseName(p) { return p < 22.5 || p >= 337.5 ? 'new Moon' : p < 67.5 ? 'waxing crescent' : p < 112.5 ? 'first quarter' : p < 157.5 ? 'waxing gibbous' : p < 202.5 ? 'full Moon' : p < 247.5 ? 'waning gibbous' : p < 292.5 ? 'last quarter' : 'waning crescent'; }
  function renderSummary() {
    const tr = S.sel.tr, m = S.mission;
    $('spSummary').innerHTML = S.target === 'mars'
      ? `<div class="muted small">${esc(S.sel.label)}</div><div class="kv"><span>Trans-Mars injection</span><b>${dUTC(tr.dep)}</b></div><div class="kv"><span>Mars entry</span><b>${dUTC(tr.arr)}</b></div>
         <div class="kv"><span>Transit</span><b>${Math.round(tr.tof)} days (${(tr.tof / 30.44).toFixed(1)} months)</b></div><div class="kv"><span>C3 / Δv from LEO</span><b>${tr.c3.toFixed(1)} km²/s² / ${tr.dvLEO.toFixed(2)} km/s</b></div>
         <div class="kv"><span>Arrival v∞ / entry speed</span><b>${tr.vinfArr.toFixed(2)} / ${tr.vEntry.toFixed(2)} km/s</b></div><div class="kv"><span>Transfer angle</span><b>${(tr.dnu * 180 / Math.PI).toFixed(0)}°</b></div>${refuelHtml(m.plan)}`
      : `<div class="muted small">${esc(S.sel.label)}</div><div class="kv"><span>Trans-lunar injection</span><b>${dUTC(tr.dep)}</b></div><div class="kv"><span>Lunar orbit insertion</span><b>${dUTC(tr.arr)}</b></div>
         <div class="kv"><span>Coast</span><b>${tr.tof.toFixed(1)} days</b></div><div class="kv"><span>TLI / LOI Δv</span><b>${tr.dvTLI.toFixed(2)} / ${tr.dvLOI.toFixed(2)} km/s</b></div>
         <div class="kv"><span>Landing</span><b>${dUTC(new Date(m.t0 + m.phases[m.phases.length - 1].t * 1000))}</b></div><div class="kv"><span>Moon at arrival</span><b>${fmt(tr.moonDist)} km</b></div>${refuelHtml(m.plan)}`;
  }
  function refuelHtml(plan) {
    if (!plan) return '';
    const items = plan.items.map(i => `<div class="kv"><span>${esc(i[0])}</span><b>${i[1].toFixed(2)} km/s</b></div>`).join('');
    const head = !plan.feasible
      ? `<div class="refuel bad">⛽ <b>Not feasible as planned:</b> Δv ${plan.dv.toFixed(1)} km/s would need ≈ ${fmt(plan.needRaw)} t of propellant – more than Starship's ≈ ${fmt(plan.cap)} t tanks, even when completely refilled (${plan.n} tankers). Pick a launch window.</div>`
      : `<div class="refuel">⛽ <b>Refuelling: ${plan.n} tanker flights needed</b> <span class="est">estimate</span><br>
        One launch reaches LEO with ≈ ${plan.resid} t left (≈ ${plan.singleDv.toFixed(1)} km/s) vs ${plan.dv.toFixed(2)} km/s needed → load ≈ ${fmt(plan.prop)} t via ${plan.n} × ${plan.tanker} t tankers (range ${plan.nLo}–${plan.nHi} for 100–150 t per tanker).${plan.limited ? ` Payload limited to ≈ ${fmt(plan.payload)} t.` : ''}</div>`;
    return `${head}<details class="info"><summary>Propellant estimate details</summary>${items}
      <div class="kv"><span>Total Δv after LEO</span><b>${plan.dv.toFixed(2)} km/s</b></div>
      <div class="kv"><span>Ship dry / payload</span><b>${plan.dry} t / ${fmt(plan.payload)} t</b></div>
      <div class="kv"><span>Propellant needed (rocket eq.)</span><b>${fmt(plan.prop)} t</b></div>
      <div class="muted small">Rocket equation, Isp ${plan.isp} s (Raptor vacuum, ballpark), ${plan.cap.toLocaleString('en-GB')} t tank capacity, ${plan.tanker} t per tanker (public 100–150 t ballpark), ${Math.round(plan.loss * 100)} % transfer/boil-off loss. Real numbers depend on Starship version and are not public in detail.</div></details>`;
  }
  function renderPhases() {
    const m = S.mission;
    $('spPhases').innerHTML = m.phases.map((p, i) => `<button data-i="${i}"><span>${esc(p.name)}</span><span>${Math.abs(p.t) < DAY ? met(p.t).replace(/^T([+−])0d /, 'T$1') : 'T' + (p.t < 0 ? '−' : '+') + (Math.abs(p.t) / DAY).toFixed(Math.abs(p.t) > 20 * DAY ? 0 : 1) + ' d'}</span></button>`).join('');
    $('spTEnd').textContent = met(m.end); $('spScrub').title = `${met(m.start)} … ${met(m.end)}`;
  }
  function updatePhaseList(cur) {
    [...$('spPhases').children].forEach((b, i) => { const p = S.mission.phases[i]; b.className = p === cur ? 'cur' : p.t < S.t ? 'past' : ''; });
  }
  function renderReadout(st) {
    const m = S.mission, tr = m.tr, ph = st.phase, L = st.local;
    let rows;
    const plan = m.plan;
    if (st.leo) rows = [
      ['Orbit', 'LEO ≈ 250 km, 7.75 km/s'], ['Heliocentric speed', `${fmt(st.speed, 2)} km/s`],
      ['Tankers docked', `${st.refuel.k} of ${st.refuel.n}${st.refuel.docking ? ` (#${st.refuel.docking.i + 1} ${st.refuel.docking.x > 0 ? 'transferring' : 'approaching'})` : ''}`],
      ['Ship propellant', `${fmt(st.refuel.prop)} / ${fmt(plan.prop)} t`],
      [S.target === 'mars' ? 'Earth → Mars now' : 'To Moon', kmStr(st.dTarget)], ['Departure in', met(-st.t).replace('T+', '')]];
    else if (S.target === 'mars') rows = [
      ['Heliocentric speed', `${fmt(st.speed, 2)} km/s`], ['', `${fmt(st.speed * 3600)} km/h`],
      ['From Earth', kmStr(st.dEarth)], ['To Mars', L ? (L.h > 0 ? fmt(L.h, 1) + ' km altitude' : 'on the surface') : kmStr(Math.max(0, st.dTarget - C.R_MARS))],
      ...(L ? [['Speed vs Mars', `${fmt(L.v * 3600)} km/h`], ['Altitude', `${fmt(L.h, 1)} km`]] : [['Transfer progress', `${fmt(Math.min(100, st.t / m.arrival * 100), 1)} %`], ['Light-time to Earth', `${fmt(st.dEarth / 299792.458 / 60, 1)} min`]])];
    else rows = [
      ['Heliocentric speed', `${fmt(st.speed, 2)} km/s`], ['Speed vs Earth', `${fmt(st.speedGeo * 3600)} km/h`],
      ['From Earth', `${fmt(st.dEarth)} km`], ['To Moon', L ? (L.h > 0.05 ? fmt(L.h, 1) + ' km altitude' : 'on the surface') : `${fmt(st.dTarget)} km`],
      ...(L ? [['Speed vs Moon', `${fmt(L.v * 3600)} km/h`], ['Altitude', `${fmt(L.h, 1)} km`]] : [['Transfer progress', `${fmt(Math.min(100, st.t / m.arrival * 100), 1)} %`], ['Light-time to Earth', `${fmt(norm3(st.r) / 299792.458, 2)} s`]])];
    $('spaceReadouts').innerHTML = `<div class="ro" style="border-left:3px solid #38bdf8">
      <div class="ro-title" style="color:#38bdf8">🚀 Starship → ${S.target === 'mars' ? 'Mars' : 'Moon'}</div>
      <div class="ro-date">${dUTC(st.date)}<br><small>${dLon(st.date)}</small></div>
      <div class="ro-phase-big">${esc(ph.name)}</div>${ph.note ? `<div class="ro-note">${esc(ph.note)}</div>` : ''}
      <div class="ro-speed">${met(st.t)}</div>
      ${plan && plan.n ? `<div class="ro-refuel${plan.feasible ? '' : ' bad'}">⛽ Refuelling: ${plan.n} tanker flights needed <span class="est">estimate</span>${plan.feasible ? '' : ' · exceeds tank capacity'}</div>` : ''}
      <div class="ro-grid">${rows.map(r => `<span>${r[0]}</span><b>${r[1]}</b>`).join('')}</div>
      <div class="bar"><i style="width:${Math.min(100, (st.t - m.start) / (m.end - m.start) * 100)}%;background:#38bdf8"></i></div></div>
      <div class="ro-verdict">${S.target === 'mars' ? `Real Earth & Mars positions for these dates · ${Math.round(tr.tof)}-day ${tr.dnu < Math.PI ? 'Type I' : 'Type II'} transfer` : `Real Moon position · ${tr.tof.toFixed(1)}-day translunar coast`} · patched-conic model</div>`;
  }
  const norm3 = C.norm;
  function syncUrl() {
    if (!S.active || !S.sel) return;
    const q = new URLSearchParams({ mode: 'space', target: S.target, dep: S.sel.tr.dep.toISOString().slice(0, 16) + 'Z', tof: (+S.sel.tr.tof).toFixed(2) });
    history.replaceState(null, '', '?' + q.toString());
  }
  window.__space = S; S.select = select; S.planCustom = planCustom; S.marsWindows = marsWindows; S.moonWindows = moonWindows;
  S.renderReadout = renderReadout; S.updatePhaseList = updatePhaseList; S.met = met;
  S.helpers = { fmt, dShort, esc, ratingFor };
  window.__spaceInternal = { renderWindows };

  // ================= rendering =================
  const cv = $('spaceCanvas'), ctx = cv.getContext('2d'), icv = $('spaceInset'), ictx = icv.getContext('2d');
  let W = 0, Hh = 0, DPR = 1;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; Hh = cv.clientHeight; cv.width = W * DPR; cv.height = Hh * DPR;
    icv.width = 300 * DPR; icv.height = 220 * DPR;
  }
  const unitK = () => S.target === 'mars' ? C.AU : 1000; // world unit: AU (Mars) or 1000 km (Moon)
  const toS = (x, y) => [W / 2 + (x - S.view.cx) * S.view.scale, Hh / 2 - (y - S.view.cy) * S.view.scale];
  const P = r => toS(r[0] / unitK(), r[1] / unitK());
  function buildOrbits() {
    const m = S.mission, o = {};
    if (S.target === 'mars') {
      o.earth = []; for (let i = 0; i <= 180; i++) o.earth.push(C.helio('earth', new Date(m.t0 + i / 180 * 365.25 * DAY * 1000)).r);
      o.mars = []; for (let i = 0; i <= 240; i++) o.mars.push(C.helio('mars', new Date(m.t0 + i / 240 * 687 * DAY * 1000)).r);
      const now = new Date(); o.nowE = C.helio('earth', now).r; o.nowM = C.helio('mars', now).r; o.now = now;
      o.depE = C.helio('earth', new Date(m.t0)).r; o.arrM = C.helio('mars', new Date(m.t0 + m.arrival * 1000)).r;
    } else {
      o.moon = []; for (let i = 0; i <= 220; i++) o.moon.push(C.moonGeo(new Date(m.t0 + i / 220 * 27.55 * DAY * 1000)).r);
      o.arrMo = C.moonGeo(new Date(m.t0 + m.arrival * 1000)).r;
    }
    S.orbits = o;
  }
  function fit() {
    const r = S.target === 'mars' ? 1.78 : 440;
    S.view.cx = 0; S.view.cy = 0; S.view.scale = Math.min(W, Hh) / 2 / r; S.view.fitted = true;
  }
  function line(pts, color, width, dash) {
    ctx.beginPath(); pts.forEach((p, i) => { const q = P(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
  }
  function dot(r, rad, fill, stroke) { const q = P(r); ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, 7); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); } return q; }
  function label(q, text, color, dx = 9, dy = -9, align = 'left') {
    ctx.font = '600 12px Inter, system-ui, sans-serif'; ctx.textAlign = align; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width, x = align === 'left' ? q[0] + dx : align === 'right' ? q[0] - dx - w : q[0] - w / 2;
    ctx.fillStyle = 'rgba(5,8,16,.72)'; ctx.fillRect(x - 4, q[1] + dy - 9, w + 8, 18);
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, x, q[1] + dy);
  }
  function glowDot(q, rad, color) {
    const g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], rad * 4); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q[0], q[1], rad * 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, 7); ctx.fill();
  }
  function shipMarker(q, st) {
    glowDot(q, 3.5, 'rgba(56,189,248,.85)');
    if (st.leo) label(q, `Starship · refuelling in LEO (${st.refuel.k}/${st.refuel.n})`, '#7dd3fc', 10, -24, 'right');
    else label(q, st.local ? (S.target === 'moon' && st.local.h > 99 ? 'Starship (lunar orbit)' : st.local.h > 0.01 ? 'Starship (landing)' : 'Starship (landed)') : 'Starship', '#7dd3fc', 10, st.local ? -26 : 12);
  }
  function draw(st) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, Hh);
    ctx.fillStyle = 'rgba(3,6,14,.55)'; ctx.fillRect(0, 0, W, Hh);
    if (!S.orbits) buildOrbits();
    if (!S.view.fitted) fit();
    const m = S.mission, o = S.orbits, done = Math.max(0, st.t) / m.arrival, n = m.arc.length - 1, k = Math.max(0, Math.min(n, Math.floor(done * n)));
    if (S.follow) { const r = st.local ? (S.target === 'mars' ? st.M.r : st.Mo.r) : st.r; S.view.cx = r[0] / unitK(); S.view.cy = r[1] / unitK(); }
    if (S.target === 'mars') {
      // AU rings + Sun
      ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillStyle = '#3b4a66';
      [0.5, 1, 1.5, 2].forEach(a => { const c = toS(0, 0); ctx.beginPath(); ctx.arc(c[0], c[1], a * S.view.scale, 0, 7); ctx.strokeStyle = 'rgba(120,140,180,.10)'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillText(a + ' AU', c[0] + a * S.view.scale * 0.707 + 4, c[1] - a * S.view.scale * 0.707); });
      const c = toS(0, 0), g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], 40); g.addColorStop(0, 'rgba(255,220,120,1)'); g.addColorStop(0.25, 'rgba(255,170,40,.8)'); g.addColorStop(1, 'rgba(255,140,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c[0], c[1], 40, 0, 7); ctx.fill(); label(c, 'Sun', '#fcd34d', 0, 26, 'center');
      const ax = toS(1.9, 0); ctx.fillStyle = '#3b4a66'; ctx.fillText('♈︎ →', Math.min(W - 40, ax[0]), c[1] - 6);
      line(o.earth, 'rgba(96,165,250,.35)', 1.2); line(o.mars, 'rgba(248,113,113,.35)', 1.2);
      // live "today" ghosts
      if (Math.abs(o.now - m.t0) > 2 * DAY * 1000) { dot(o.nowE, 3, null, 'rgba(96,165,250,.6)'); dot(o.nowM, 3, null, 'rgba(248,113,113,.6)'); label(P(o.nowE), 'Earth today', 'rgba(147,197,253,.75)', 8, 10); label(P(o.nowM), 'Mars today', 'rgba(252,165,165,.75)', 8, 10); }
      line(m.arc, 'rgba(56,189,248,.35)', 1.5, [6, 6]); if (st.t > 0) line(m.arc.slice(0, k + 1).concat([st.t < m.arrival ? st.r : m.arc[n]]), '#38bdf8', 2.5);
      const qd = dot(o.depE, 6, null, 'rgba(96,165,250,.8)'); label(qd, 'Departure ' + dShort(new Date(m.t0)), '#93c5fd', 10, -14);
      const qa = dot(o.arrM, 6, null, 'rgba(248,113,113,.8)'); label(qa, 'Arrival ' + dShort(new Date(m.t0 + m.arrival * 1000)), '#fca5a5', 10, -14);
      const qe = dot(st.E.r, 6, '#3b82f6', '#bfdbfe'); label(qe, 'Earth', '#bfdbfe', 10, 10);
      if (st.t < 0) { dot(o.depE, 6, null, 'rgba(96,165,250,.8)'); }
      const qm = dot(st.M.r, 5, '#ef4444', '#fecaca'); label(qm, 'Mars', '#fecaca', 10, 10);
      if (st.leo) shipMarker(qe, st); else if (!st.local) shipMarker(P(st.r), st); else shipMarker(qm, st);
    } else {
      const c = toS(0, 0);
      [100, 200, 300, 400].forEach(a => { ctx.beginPath(); ctx.arc(c[0], c[1], a * S.view.scale, 0, 7); ctx.strokeStyle = 'rgba(120,140,180,.08)'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#3b4a66'; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillText(fmt(a * 1000) + ' km', c[0] + a * S.view.scale * 0.707 + 4, c[1] - a * S.view.scale * 0.707); });
      line(o.moon, 'rgba(203,213,225,.28)', 1.2);
      line(m.arc, 'rgba(56,189,248,.35)', 1.5, [6, 6]); if (st.t > 0) line(m.arc.slice(0, k + 1).concat([st.t < m.arrival ? st.r : m.arc[n]]), '#38bdf8', 2.5);
      const er = Math.max(7, C.R_E / 1000 * S.view.scale), g = ctx.createRadialGradient(c[0] - er / 3, c[1] - er / 3, 1, c[0], c[1], er);
      g.addColorStop(0, '#93c5fd'); g.addColorStop(1, '#1d4ed8'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c[0], c[1], er, 0, 7); ctx.fill(); label(c, 'Earth', '#bfdbfe', er + 6, er + 6);
      const qa = dot(o.arrMo, Math.max(5, C.R_MOON / 1000 * S.view.scale) + 3, null, 'rgba(203,213,225,.5)'); if (st.t < m.arrival - 6 * H) label(qa, 'Moon at arrival ' + dShort(new Date(m.t0 + m.arrival * 1000)), '#cbd5e1', 12, -16);
      const mr = Math.max(5, C.R_MOON / 1000 * S.view.scale), qm = P(st.Mo.r);
      ctx.fillStyle = '#d4d4d8'; ctx.beginPath(); ctx.arc(qm[0], qm[1], mr, 0, 7); ctx.fill(); label(qm, 'Moon', '#e4e4e7', mr + 6, mr + 8);
      shipMarker(P(st.r), st);
    }
    $('spaceLegend').innerHTML = S.target === 'mars'
      ? '<i style="background:#38bdf8"></i>Starship transfer arc (flown / planned)<br><i style="background:rgba(96,165,250,.6)"></i>Earth orbit · <i style="background:rgba(248,113,113,.6)"></i>Mars orbit<br>Top-down view of the ecliptic plane · real positions'
      : '<i style="background:#38bdf8"></i>Starship translunar trajectory<br><i style="background:rgba(203,213,225,.5)"></i>Moon\'s real orbit (next 27.5 days)<br>Earth-centred view · Earth & Moon sizes enlarged';
    drawInset(st);
  }
  // ---------- inset close-up (departure / approach / landing) ----------
  function drawInset(st) {
    const m = S.mission, L = st.local, w = 300, h = 220;
    let mode = null;
    if (st.leo) mode = 'refuel';
    else if (S.target === 'mars') mode = st.t < 2 * DAY ? 'earth' : st.t > m.arrival - 2 * DAY ? 'mars' : null;
    else mode = st.t < 3 * H ? 'earth' : st.t > m.arrival - 8 * H ? 'moon' : null;
    $('insetWrap').hidden = !mode; if (!mode) return;
    const c = ictx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, w, h);
    const txt = (s, x, y, col = '#cbd5e1', f = '600 11px Inter, system-ui') => { c.font = f; c.fillStyle = col; c.fillText(s, x, y); };
    const planet = (x, y, r, c0, c1) => { const g = c.createRadialGradient(x - r / 3, y - r / 3, 1, x, y, r); g.addColorStop(0, c0); g.addColorStop(1, c1); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
    const ship = (x, y) => { const g = c.createRadialGradient(x, y, 0, x, y, 12); g.addColorStop(0, 'rgba(56,189,248,.9)'); g.addColorStop(1, 'rgba(56,189,248,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, 12, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); };
    const logMap = (d, d0, d1, p0, p1) => p0 + (p1 - p0) * Math.max(0, Math.min(1, Math.log(Math.max(d, d0) / d0) / Math.log(d1 / d0)));
    if (mode === 'refuel') {
      const R = st.refuel, plan = m.plan;
      $('insetTitle').textContent = `Close-up · orbital refuelling in LEO (estimate)`;
      const cx = 92, cy = 112, re = 52, ro = re * 1.45;
      planet(cx, cy, re, '#93c5fd', '#1d4ed8');
      c.beginPath(); c.arc(cx, cy, ro, 0, 7); c.strokeStyle = 'rgba(148,163,184,.35)'; c.setLineDash([3, 4]); c.stroke(); c.setLineDash([]);
      const a = -2.2, sx = cx + ro * Math.cos(a), sy = cy + ro * Math.sin(a);
      if (R.docking) { // tanker climbs from the launch site and closes in on the ship
        const f = R.docking.f, la = 1.0, ta = la + (a + 2 * Math.PI - la) * smooth01(f), rr = re + (ro - re) * Math.min(1, f * 2.2);
        const tx = R.docking.x > 0 ? sx - 9 : cx + rr * Math.cos(ta), ty = R.docking.x > 0 ? sy - 4 : cy + rr * Math.sin(ta);
        c.fillStyle = '#facc15'; c.beginPath(); c.arc(tx, ty, 3.5, 0, 7); c.fill(); txt(`Tanker ${R.docking.i + 1}`, Math.max(2, tx - 50), ty + 4, '#fde68a', '600 10px Inter');
        if (R.docking.x > 0) { c.strokeStyle = 'rgba(250,204,21,.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(tx, ty); c.lineTo(sx, sy); c.stroke(); c.lineWidth = 1; }
      }
      ship(sx, sy); txt('Starship', sx + 8, sy - 6, '#7dd3fc');
      txt(`Tankers docked: ${R.k} / ${R.n}`, 168, 70, '#e2e8f0'); txt(R.docking ? (R.docking.x > 0 ? 'Transferring propellant…' : 'Tanker approaching…') : (R.k >= R.n ? 'Tanks full' : 'Waiting for next tanker'), 168, 88, '#fde68a', '600 10px Inter');
      const fill = Math.min(1, R.prop / Math.max(plan.prop, 1));
      c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(168, 100, 118, 12); c.fillStyle = '#38bdf8'; c.fillRect(168, 100, 118 * fill, 12);
      txt(`${fmt(R.prop)} / ${fmt(plan.prop)} t`, 168, 128, '#cbd5e1');
      txt(`${plan.n} × ~${plan.tanker} t tanker flights`, 168, 146, '#94a3b8', '10px Inter');
      txt(st.phase.name, 12, 20, '#38bdf8');
    } else if (mode === 'earth') {
      $('insetTitle').textContent = S.target === 'mars' ? 'Close-up · Earth departure' : 'Close-up · trans-lunar injection';
      planet(70, 110, 46, '#93c5fd', '#1d4ed8');
      c.beginPath(); c.arc(70, 110, 46 * (1 + 250 / 6378 * 4), 0, 7); c.strokeStyle = 'rgba(148,163,184,.4)'; c.setLineDash([3, 4]); c.stroke(); c.setLineDash([]);
      const d = st.dEarth, x = logMap(d, 250, S.target === 'mars' ? 3e6 : 6e4, 70 + 46 * 1.16, 280);
      ship(x, 110 - (x - 120) * 0.25); txt('Earth', 50, 175); txt(fmt(d) + ' km from Earth', 140, 200, '#7dd3fc');
      txt(st.phase.name, 12, 20, '#38bdf8');
    } else if (mode === 'mars') {
      $('insetTitle').textContent = L ? 'Close-up · Mars entry, descent & landing' : 'Close-up · Mars approach';
      if (!L) {
        planet(80, 120, 48, '#fca5a5', '#9a3412'); const d = Math.max(0, st.dTarget - C.R_MARS);
        const x = logMap(d, 100, 1.2e6, 135, 285); ship(x, 120 - (x - 135) * 0.18); txt('Mars', 62, 186); txt(fmt(d) + ' km to Mars', 150, 200, '#7dd3fc');
        txt(st.phase.name, 12, 20, '#38bdf8');
      } else {
        // curved horizon + atmosphere; altitude exaggerated
        const gY = 196; c.fillStyle = 'rgba(248,113,113,.10)'; c.fillRect(0, gY - 125 * 1.25, w, 125 * 1.25);
        planet(150, gY + 900, 900, '#f87171', '#7c2d12');
        c.strokeStyle = 'rgba(148,163,184,.25)'; c.setLineDash([2, 4]);
        [125, 60, 20].forEach(a => { c.beginPath(); c.moveTo(0, gY - a * 1.25); c.lineTo(w, gY - a * 1.25); c.stroke(); txt(a + ' km', 4, gY - a * 1.25 - 3, '#64748b', '10px Inter'); }); c.setLineDash([]);
        const f = Math.min(1, L.te / 470), x = 30 + 220 * Math.pow(f, 0.55), y = gY - L.h * 1.25;
        c.strokeStyle = 'rgba(56,189,248,.5)'; c.beginPath(); for (let i = 0; i <= 40; i++) { const tt = i / 40 * Math.min(L.te, 470); const s2 = m.at(m.arrival + tt).local; const xx = 30 + 220 * Math.pow(tt / 470, 0.55), yy = gY - s2.h * 1.25; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke();
        if (st.phase.name.startsWith('Atmos')) { c.fillStyle = 'rgba(251,146,60,.6)'; c.beginPath(); c.arc(x - 4, y + 2, 8, 0, 7); c.fill(); }
        ship(x, y);
        txt(st.phase.name, 12, 20, '#38bdf8'); txt(`alt ${fmt(L.h, 1)} km · ${fmt(L.v * 3600)} km/h`, 12, 36, '#e2e8f0');
        txt('Illustrative Starship-style EDL', 180, 214, '#fde68a', '10px Inter');
      }
    } else {
      $('insetTitle').textContent = L ? 'Close-up · lunar orbit & landing (altitude ×5)' : 'Close-up · lunar approach';
      const cx = 120, cy = 112, R = 70;
      planet(cx, cy, R, '#e4e4e7', '#52525b');
      const llo = R * (1 + 100 / 1737 * 5); c.beginPath(); c.arc(cx, cy, llo, 0, 7); c.strokeStyle = 'rgba(56,189,248,.35)'; c.setLineDash([3, 4]); c.stroke(); c.setLineDash([]);
      if (!L) { const d = st.dTarget, x = logMap(d, 100, 6e4, cx + llo, 292); ship(x, cy - 40 * (x - cx - llo) / (292 - cx - llo)); txt(fmt(d) + ' km to the Moon', 150, 205, '#7dd3fc'); }
      else { const rr = R * (1 + L.h / 1737 * 5), a = L.ang; ship(cx + rr * Math.cos(a), cy - rr * Math.sin(a)); txt(`alt ${fmt(L.h, 1)} km · ${fmt(L.v * 3600)} km/h`, 12, 205, '#e2e8f0'); }
      txt(st.phase.name, 12, 20, '#38bdf8'); txt('Landing region: lunar south pole (illustrative)', 12, 36, '#64748b', '10px Inter');
    }
  }

  function showSpaceResults() {
    const m = S.mission, tr = m.tr, plan = m.plan, box = $('results'), land = m.phases[m.phases.length - 1];
    const rows = S.target === 'mars'
      ? [['Trans-Mars injection', dShort(tr.dep)], ['Landed on Mars', dShort(new Date(m.t0 + land.t * 1000))], ['Transit', `${Math.round(tr.tof)} days`], ['Δv from LEO / entry speed', `${tr.dvLEO.toFixed(2)} / ${tr.vEntry.toFixed(2)} km/s`]]
      : [['Trans-lunar injection', dShort(tr.dep)], ['Landed on the Moon', dShort(new Date(m.t0 + land.t * 1000))], ['Coast', `${tr.tof.toFixed(1)} days`], ['TLI / LOI Δv', `${tr.dvTLI.toFixed(2)} / ${tr.dvLOI.toFixed(2)} km/s`]];
    if (plan && plan.n) rows.push(['Refuelling (estimate)', `${plan.n} tanker flights, ≈ ${fmt(plan.prop)} t`]);
    rows.push(['Total mission time', met(m.end - m.start).replace('T+', '')]);
    box.className = 'results space';
    box.innerHTML = `<div class="res-head"><b>🏁 Mission complete – Starship landed on ${S.target === 'mars' ? 'Mars' : 'the Moon'}</b><button class="res-x" aria-label="Close">✕</button></div>
      <div class="res-runs"><div class="res-run" style="--c:#38bdf8"><div class="res-grid">${rows.map(r => `<span>${r[0]}</span><b>${r[1]}</b>`).join('')}</div></div></div>
      <div class="res-actions"><button class="btn small-btn" data-sact="copy">🔗 Copy share link</button><button class="btn small-btn" data-sact="replay">↺ Replay</button></div>`;
    box.hidden = false;
  }
  $('results').addEventListener('click', e => {
    const box = $('results'), b = e.target.closest('button'); if (!b || !box.classList.contains('space')) return;
    if (b.classList.contains('res-x')) box.hidden = true;
    else if (b.dataset.sact === 'copy') window.__launchSim.copyLink && window.__launchSim.copyLink(b);
    else if (b.dataset.sact === 'replay') { box.hidden = true; S.t = S.mission.start; setPlaying(true); }
  });
  function smooth01(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  // ================= playback =================
  function capFor(ph) {
    const n = ph.name;
    if (/injection|insertion/i.test(n)) return 120;
    if (ph.edl || /descent|touchdown|Landed/i.test(n)) return 20;
    if (/Low lunar orbit/.test(n)) return 1200;
    if (/Earth departure/.test(n)) return 21600;
    if (/approach/i.test(n)) return S.target === 'mars' ? 43200 : 3600;
    return Infinity;
  }
  function setPlaying(p) {
    if (p && S.mission && S.t >= S.mission.end) S.t = S.mission.start;
    S.playing = p; $('spPlay').textContent = p ? '❚❚ Pause' : '▶ Play';
  }
  S.setPlaying = setPlaying;
  let last = 0, lastRO = 0, lastPhase = null;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!S.active || !S.mission) { last = now; return; }
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    const m = S.mission;
    if (S.playing) {
      let ph = m.at(S.t).phase, rate = S.rate;
      if ($('spAutoSlow').checked) rate = Math.min(rate, capFor(ph));
      let nt = S.t + dt * rate;
      if ($('spAutoSlow').checked) { const nx = m.phases.find(p => p.t > S.t + 1e-6); if (nx && nt > nx.t && capFor(nx) < rate) nt = nx.t; }
      S.t = Math.min(nt, m.end); if (S.t >= m.end) { setPlaying(false); showSpaceResults(); }
    }
    const st = m.at(S.t);
    draw(st);
    if (now - lastRO > 90 || !S.playing) { renderReadout(st); lastRO = now; if (st.phase !== lastPhase) { updatePhaseList(st.phase); lastPhase = st.phase; } }
    $('spScrub').value = Math.round((S.t - m.start) / (m.end - m.start) * 10000); $('spTNow').textContent = met(S.t);
  }
  requestAnimationFrame(frame);

  // ================= interaction =================
  let drag = null;
  cv.addEventListener('wheel', e => {
    e.preventDefault(); const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const k = Math.exp(-e.deltaY * 0.0015), wx = S.view.cx + (mx - W / 2) / S.view.scale, wy = S.view.cy - (my - Hh / 2) / S.view.scale;
    S.view.scale *= k; if (!S.follow) { S.view.cx = wx - (mx - W / 2) / S.view.scale; S.view.cy = wy + (my - Hh / 2) / S.view.scale; }
  }, { passive: false });
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, cx: S.view.cx, cy: S.view.cy }; cv.classList.add('drag'); cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (!drag) return; S.follow = false; S.view.cx = drag.cx - (e.clientX - drag.x) / S.view.scale; S.view.cy = drag.cy + (e.clientY - drag.y) / S.view.scale; });
  cv.addEventListener('pointerup', () => { drag = null; cv.classList.remove('drag'); });
  window.addEventListener('resize', () => { resize(); });

  $('spTarget').onclick = e => { const b = e.target.closest('button'); if (b) setTarget(b.dataset.target); };
  function setTarget(t, keep) {
    S.target = t; document.querySelectorAll('#spTarget button').forEach(b => b.classList.toggle('on', b.dataset.target === t));
    $('spWindows').innerHTML = '<div class="muted small">Computing windows from live ephemerides…</div>';
    setTimeout(() => {
      if (keep) return;
      if (t === 'mars') { const o = marsWindows()[0]; select(o.fast || o.eco, `${o.year} window · ${o.fast ? 'Fast (Type I)' : 'Min-energy (Type II)'}`); }
      else planLive();
    }, 30);
  }
  $('spWindows').onclick = e => {
    const b = e.target.closest('.win-opt'); if (!b) return;
    if (b.dataset.k === 'moon') { const w = moonWindows()[+b.dataset.i]; select(w, 'Monthly window · perigee arrival'); }
    else { const o = marsWindows()[+b.dataset.i], w = o[b.dataset.k]; select(w, `${o.year} window · ${b.dataset.k === 'fast' ? 'Fast (Type I)' : 'Min-energy (Type II)'}`); }
  };
  const nowLocalInput = () => new Date().toISOString().slice(0, 16);
  $('spNow').onclick = () => planLive();
  $('spPlan').onclick = () => planCustom(new Date($('spDate').value + 'Z'));
  $('spDate').onkeydown = e => { if (e.key === 'Enter') $('spPlan').click(); };
  $('spPlay').onclick = () => setPlaying(!S.playing);
  $('spReset').onclick = () => { S.t = S.mission.start; setPlaying(false); };
  $('spScrub').oninput = e => { const m = S.mission; S.t = m.start + +e.target.value / 10000 * (m.end - m.start); };
  $('spSpeed').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.rate = +b.dataset.rate; document.querySelectorAll('#spSpeed button').forEach(x => x.classList.toggle('on', x === b)); };
  $('spPhases').onclick = e => { const b = e.target.closest('button'); if (b) { S.t = S.mission.phases[+b.dataset.i].t + 1; } };
  $('spFit').onclick = () => { S.follow = false; fit(); };
  $('spFollow').onclick = () => { S.follow = true; S.view.scale = S.target === 'mars' ? Math.min(W, Hh) / 2 / 0.25 : Math.min(W, Hh) / 2 / 60; };
  document.addEventListener('keydown', e => {
    if (!S.active || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === ' ') { e.preventDefault(); setPlaying(!S.playing); }
    else if (e.key === 'r' || e.key === 'R') { S.t = S.mission.start; setPlaying(false); }
    else if (e.key === 'g' || e.key === 'G') setMode('globe');
    else if (/^[1-6]$/.test(e.key)) document.querySelectorAll('#spSpeed button')[+e.key - 1].click();
  });

  // ================= mode switching =================
  const TAG_GLOBE = $('tagline').textContent;
  function hideSpaceResults() { const b = $('results'); if (b.classList.contains('space')) { b.hidden = true; b.className = 'results'; } }
  function setMode(mode) {
    hideSpaceResults();
    const space = mode === 'space'; S.active = space;
    document.body.classList.toggle('space-mode', space);
    $('space').hidden = !space; $('spaceReadouts').hidden = !space;
    document.querySelectorAll('.space-only').forEach(el => el.hidden = !space);
    document.querySelectorAll('#modeTabs button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    $('tagline').textContent = space ? 'Starship to the Moon & Mars on real planetary positions' : TAG_GLOBE;
    const G = window.__launchSim;
    if (space) {
      if (G) { G.setPlaying && G.setPlaying(false); G.globe && G.globe.pauseAnimation(); }
      resize();
      if (!S.mission) setTarget(S.target); else { S.view.fitted = false; syncUrl(); }
    } else {
      setPlaying(false);
      if (G) { G.globe && G.globe.resumeAnimation(); G.syncUrl ? G.syncUrl() : history.replaceState(null, '', location.pathname); }
    }
  }
  S.setMode = setMode; S.setTarget = setTarget;
  $('modeTabs').onclick = e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); };
  // init from URL
  $('spDate').value = nowLocalInput();
  if (qs.get('mode') === 'space') {
    setMode('space');
    const dep = new Date(qs.get('dep') || ''), tof = +qs.get('tof');
    if (!isNaN(dep) && tof > 0) {
      setTarget(S.target, true);
      setTimeout(() => {
        const tr = S.target === 'mars' ? C.marsTransfer(dep, tof) : C.moonTransfer(dep, tof);
        if (tr) select(tr, 'Shared link'); else setTarget(S.target);
      }, 40);
    }
  }
})();

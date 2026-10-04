/* v7 Mission control: live telemetry graphs (altitude, speed, acceleration in g), event timeline and a
   flight-director panel. Works for globe runs (any vehicle) and Space missions. Educational: speed, range,
   altitude and flight phases only. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const G = window.__launchSim, Sim = window.LaunchSim;
  const fmtInt = x => Math.round(x).toLocaleString('en-GB');
  const met = s => { const neg = s < 0; s = Math.abs(Math.floor(s)); const d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60, x = s % 60;
    return (neg ? 'T−' : 'T+') + (d ? d + 'd ' + String(h).padStart(2, '0') + ':' : h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0'); };
  const root = document.createElement('div'); root.id = 'mc'; root.className = 'mc'; root.hidden = true;
  root.innerHTML = `<div class="mc-head"><b>📈 Mission control</b><span class="mc-veh" data-k="veh"></span><span class="mc-met" data-k="met">T+00:00</span>
      <button class="mc-x" data-act="close" title="Close (M)">✕</button></div>
    <div class="mc-body"><div class="mc-charts"><canvas data-k="c0"></canvas><canvas data-k="c1"></canvas><canvas data-k="c2"></canvas></div>
      <div class="mc-side"><div class="mc-fd"><div class="mc-fd-t">🎧 Flight director</div><div class="mc-call" data-k="call">Standing by for launch</div>
        <div class="mc-next" data-k="next"></div><div class="mc-lights" data-k="lights"></div></div>
        <div class="mc-tl" data-k="tl"></div></div></div>`;
  document.body.appendChild(root);
  const q = k => root.querySelector(`[data-k="${k}"]`);
  let open = false, model = null, modelKey = '', lastDraw = 0;

  // ---------- data model: series + events for the current scenario ----------
  function smoothArr(a, w) { return a.map((_, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - w); j <= Math.min(a.length - 1, i + w); j++) { s += a[j]; n++; } return s / n; }); }
  function runSeries(r, tMax) {
    const N = 360, T = [], H = [], V = [], A = [];
    for (let i = 0; i <= N; i++) { const t = tMax * i / N, st = Sim.stateAt(r, Math.min(t, r.end)); T.push(t); H.push(st.h); V.push(st.v); }
    for (let i = 0; i <= N; i++) { const a = Math.max(0, i - 1), b = Math.min(N, i + 1); A.push(Math.abs((V[b] - V[a]) / 3.6 / ((T[b] - T[a]) || 1)) / 9.81); }
    return { T, H, V, A: smoothArr(A, 3) };
  }
  function globeEvents(r) {
    const ev = [], S0 = r.samples; let last = null;
    S0.forEach(q => { if (q.phase !== last) { if (last !== null) ev.push({ t: q.t, txt: q.phase, k: 'phase' }); last = q.phase; } });
    let machT = null, karman = null, apo = { h: -1, t: 0 };
    for (let t = 0; t <= r.end; t += Math.max(0.5, r.end / 1500)) {
      const st = Sim.stateAt(r, t);
      if (machT == null && Sim.speedOfSound && st.v > Sim.speedOfSound(st.h)) machT = t;
      if (karman == null && st.h >= 100) karman = t;
      if (st.h > apo.h) apo = { h: st.h, t };
    }
    ev.push({ t: 0, txt: r.preset.kind === 'orbital' ? 'Liftoff' : 'Launch', k: 'big' });
    if (machT != null && machT > 0) ev.push({ t: machT, txt: 'Supersonic (Mach 1)', k: 'mach' });
    if (karman != null) ev.push({ t: karman, txt: 'Crossed the Kármán line (100 km) – space', k: 'space' });
    if (r.preset.kind !== 'orbital' && apo.h > 0) ev.push({ t: apo.t, txt: `Apogee ≈ ${fmtInt(apo.h)} km`, k: 'apo' });
    if (r.booster) { let bl = null; r.booster.samples.forEach(q => { if (q.phase !== bl) { ev.push({ t: q.t, txt: 'Booster: ' + q.phase, k: 'boost' }); bl = q.phase; } }); }
    ev.push({ t: r.arrival, txt: r.preset.kind === 'orbital' ? 'Over the destination' : r.outOfRange ? 'Reached maximum range' : 'Arrived', k: 'big' });
    return ev.sort((a, b) => a.t - b.t);
  }
  function buildModel() {
    const S = window.__space;
    if (S && S.active && S.mission) {
      const m = S.mission, N = 300, T = [], D = [], V = [], X = [];
      for (let i = 0; i <= N; i++) { const t = m.start + (m.end - m.start) * i / N, st = m.at(t); T.push(t); D.push(t < 0 ? 250 : st.local ? st.local.h : (m.kind === 'mars' ? st.dEarth - 6371 : st.dEarth)); V.push(t < 0 ? 7.75 : st.local ? st.local.v : m.kind === 'mars' ? st.speed : st.speedGeo); X.push(st.local ? 0 : Math.max(0, st.dTarget)); }
      return { space: true, key: 'space' + m.t0 + m.kind, t0: m.start, t1: m.end, title: `Starship → ${m.kind === 'mars' ? 'Mars' : 'Moon'}`,
        charts: [{ lab: 'Distance from Earth / altitude', unit: 'km', s: [{ T, Y: D, c: '#38bdf8' }], log: true }, { lab: 'Speed', unit: 'km/s', s: [{ T, Y: V, c: '#f59e0b' }] }, { lab: `Distance to ${m.kind === 'mars' ? 'Mars' : 'Moon'}`, unit: 'km', s: [{ T, Y: X, c: '#a78bfa' }], log: true }],
        events: m.phases.map(p => ({ t: p.t, txt: p.name, k: p.edl || p.lunar ? 'big' : 'phase' })) };
    }
    const st = G.state, runs = st.runs; if (!runs || !runs.length) return null;
    const tMax = Math.max(...runs.map(r => r.end)), ser = runs.map(r => ({ r, d: runSeries(r, tMax) }));
    const mk = (k, lab, unit) => ({ lab, unit, s: ser.map(({ r, d }, i) => ({ T: d.T, Y: d[k], c: r.color, dash: i === 1 })) });
    return { space: false, key: runs.map(r => r.preset.id + r.end.toFixed(0)).join('|') + st.from.id, t0: 0, t1: tMax, title: runs.map(r => `${r.label}: ${r.preset.name}`).join('  ·  '),
      charts: [mk('H', 'Altitude', 'km'), mk('V', 'Speed', 'km/h'), mk('A', 'Acceleration', 'g')], events: globeEvents(runs[0]), runs };
  }
  // ---------- drawing ----------
  function drawChart(cv, ch, tNow, m) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    const L = 46, R = 8, Tp = 16, B = 14, pw = w - L - R, ph = h - Tp - B;
    let ymax = 0, ymin = ch.log ? Infinity : 0; ch.s.forEach(s => s.Y.forEach(y => { ymax = Math.max(ymax, y); if (ch.log && y > 0) ymin = Math.min(ymin, y); }));
    if (!ymax) ymax = 1; if (ch.log) { ymin = Math.max(1, ymin === Infinity ? 1 : ymin); }
    const fy = y => ch.log ? Tp + ph * (1 - (Math.log10(Math.max(ymin, y)) - Math.log10(ymin)) / ((Math.log10(ymax) - Math.log10(ymin)) || 1)) : Tp + ph * (1 - y / (ymax * 1.08));
    const fx = t => L + pw * (t - m.t0) / ((m.t1 - m.t0) || 1);
    x.strokeStyle = 'rgba(148,163,184,.15)'; x.lineWidth = 1; x.fillStyle = '#64748b'; x.font = '10px system-ui, sans-serif';
    for (let i = 0; i <= 3; i++) { const yy = Tp + ph * i / 3; x.beginPath(); x.moveTo(L, yy); x.lineTo(L + pw, yy); x.stroke();
      const val = ch.log ? Math.pow(10, Math.log10(ymax) - (Math.log10(ymax) - Math.log10(ymin)) * i / 3) : ymax * 1.08 * (1 - i / 3);
      x.fillText(val >= 1e6 ? (val / 1e6).toFixed(1) + 'M' : val >= 1e4 ? Math.round(val / 1e3) + 'k' : val >= 10 ? fmtInt(val) : val.toFixed(1), 4, yy + 3); }
    x.fillStyle = '#cbd5e1'; x.font = '600 11px system-ui, sans-serif'; x.fillText(`${ch.lab} (${ch.unit})`, L, 11);
    ch.s.forEach(s => {
      x.strokeStyle = s.c; x.globalAlpha = 0.35; x.lineWidth = 1.5; x.setLineDash(s.dash ? [4, 3] : []);
      x.beginPath(); s.T.forEach((t, i) => { const px = fx(t), py = fy(s.Y[i]); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke();
      x.globalAlpha = 1; x.lineWidth = 2.2; x.beginPath(); let started = false, lastY = null;
      for (let i = 0; i < s.T.length && s.T[i] <= tNow; i++) { const px = fx(s.T[i]), py = fy(s.Y[i]); started ? x.lineTo(px, py) : x.moveTo(px, py); started = true; lastY = s.Y[i]; }
      x.stroke(); x.setLineDash([]);
      if (lastY != null && !s.dash) { x.fillStyle = s.c; const px = fx(Math.min(tNow, m.t1)), py = fy(lastY); x.beginPath(); x.arc(px, py, 3.2, 0, 7); x.fill();
        x.font = '600 11px system-ui'; const lab = (lastY >= 100 ? fmtInt(lastY) : lastY.toFixed(lastY < 10 ? 2 : 1)) + ' ' + ch.unit; const tw = x.measureText(lab).width; x.fillStyle = '#f8fafc'; x.fillText(lab, Math.min(px + 6, L + pw - tw), Math.max(Tp + 10, py - 5)); }
    });
    const cx = fx(Math.min(tNow, m.t1)); x.strokeStyle = 'rgba(253,230,138,.55)'; x.lineWidth = 1; x.beginPath(); x.moveTo(cx, Tp); x.lineTo(cx, Tp + ph); x.stroke();
  }
  const band = h => h < 12 ? 'Troposphere' : h < 50 ? 'Stratosphere' : h < 85 ? 'Mesosphere' : h < 100 ? 'Thermosphere (edge of space)' : 'Space (above 100 km)';
  function fdGlobe(m, t) {
    const r = m.runs[0], st = Sim.stateAt(r, Math.min(t, r.end)), mach = Sim.speedOfSound ? st.v / Sim.speedOfSound(st.h) : st.v / 1235;
    const past = m.events.filter(e => e.t <= t), next = m.events.find(e => e.t > t);
    const playing = G.state.playing, cd = (G.countdownLeft && G.countdownLeft()) || 0;
    let call = past.length ? past[past.length - 1].txt : 'Standing by for launch';
    if (cd > 0) call = `T-minus ${Math.ceil(cd)} – all stations GO for launch`;
    else if (t === 0 && !playing) call = 'All stations GO – awaiting LAUNCH';
    const thrust = /boost|burn|ascent|stage|liftoff|max-q|first|second|third|core|side|engine|climb|take-off/i.test(st.phase) && !/coast|separation|cutoff|glide|cruise/i.test(st.phase) && !st.done;
    const lights = [
      ['Propulsion', st.done ? 'SAFE' : thrust ? 'BURNING' : 'COAST', st.done ? 'off' : thrust ? 'hot' : 'ok'],
      ['Trajectory', r.outOfRange ? 'RANGE LIMIT' : 'NOMINAL', r.outOfRange ? 'warn' : 'ok'],
      ['Altitude band', band(st.h), st.h >= 100 ? 'space' : 'ok'],
      ['Speed regime', st.v < 1 ? 'STATIONARY' : mach < 0.8 ? 'SUBSONIC' : mach < 1.2 ? 'TRANSONIC' : mach < 5 ? 'SUPERSONIC' : st.v > 26000 ? 'ORBITAL' : 'HYPERSONIC', mach >= 5 ? 'hot' : 'ok']];
    if (r.booster && t >= r.booster.samples[0].t) { const b = Sim.stateAt(r.booster, Math.min(t, r.booster.end)); lights.push(['Booster', b.phase.toUpperCase(), /Landed|Back/.test(b.phase) ? 'space' : 'ok']); }
    return { call, next, lights, extra: `${fmtInt(st.v)} km/h · ${st.h < 1 ? Math.round(st.h * 1000) + ' m' : st.h.toFixed(1) + ' km'} · Mach ${mach.toFixed(1)}` };
  }
  function fdSpace(m, t) {
    const S = window.__space, st = S.mission.at(t), past = m.events.filter(e => e.t <= t), next = m.events.find(e => e.t > t);
    return { call: past.length ? past[past.length - 1].txt : m.events[0].txt, next, extra: '',
      lights: [['Propulsion', /burn|descent|landing|injection|insertion/i.test(st.phase.name) && !/coast/i.test(st.phase.name) ? 'BURNING' : 'COAST', /burn|injection|insertion/i.test(st.phase.name) ? 'hot' : 'ok'],
        ['Comms delay', (st.dEarth / 299792.458).toFixed(1) + ' s one-way', 'ok'], ['Phase', st.phase.name.toUpperCase(), st.phase.done ? 'space' : 'ok']] };
  }
  function draw() {
    if (!open) return;
    const S = window.__space, space = S && S.active;
    const k = space && S.mission ? 'space' + S.mission.t0 + S.mission.kind : (G.state.runs || []).map(r => r.preset.id + r.end.toFixed(0)).join('|') + G.state.from.id;
    if (k !== modelKey) { model = buildModel(); modelKey = k; renderTimeline(); }
    if (!model) return;
    const cd = (G.countdownLeft && G.countdownLeft()) || 0;
    const t = model.space ? S.t : (G.state.t <= 0 && cd > 0 ? -cd : G.state.t);
    q('veh').textContent = model.title; q('met').textContent = met(t);
    model.charts.forEach((ch, i) => drawChart(q('c' + i), ch, t, model));
    const fd = model.space ? fdSpace(model, t) : fdGlobe(model, Math.max(0, t));
    q('call').innerHTML = `<span class="mc-dot"></span>${fd.call}${fd.extra ? `<small>${fd.extra}</small>` : ''}`;
    q('next').textContent = fd.next ? `Next: ${fd.next.txt} in ${met(fd.next.t - t).slice(2)}` : 'All events complete';
    q('lights').innerHTML = fd.lights.map(([a, b, c]) => `<div class="mc-light ${c}"><i></i><span>${a}</span><b>${b}</b></div>`).join('');
    root.querySelectorAll('.mc-ev').forEach(el => { const et = +el.dataset.t; el.classList.toggle('past', et <= t); });
    const cur = [...root.querySelectorAll('.mc-ev.past')].pop();
    root.querySelectorAll('.mc-ev.cur').forEach(el => el !== cur && el.classList.remove('cur'));
    if (cur && !cur.classList.contains('cur')) { cur.classList.add('cur'); const tl = q('tl'); tl.scrollTop = Math.max(0, cur.offsetTop - tl.clientHeight / 2); }
  }
  function renderTimeline() {
    q('tl').innerHTML = model ? '<div class="mc-tl-t">Event timeline</div>' + model.events.map(e => `<div class="mc-ev ${e.k}" data-t="${e.t}"><span>${met(e.t)}</span>${e.txt}</div>`).join('') : '';
  }
  function loop(now) { if (!open) return; requestAnimationFrame(loop); if (now - lastDraw > 90) { lastDraw = now; draw(); } }
  function setOpen(v) {
    open = v; root.hidden = !v; document.body.classList.toggle('mc-open', v); const b = $('mcBtn'); if (b) b.classList.toggle('on', v);
    if (v) { modelKey = ''; requestAnimationFrame(loop); }
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act="close"]'); if (b) return setOpen(false);
    const ev = e.target.closest('.mc-ev'); if (ev && model) { const t = +ev.dataset.t + 0.5; if (model.space) { window.__space.t = t; } else { G.state.t = Math.min(Math.max(0, t), G.state.maxEnd); G.draw(true); } }
  });
  document.addEventListener('keydown', e => { if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) setOpen(!open); });
  const btn = $('mcBtn'); if (btn) btn.onclick = () => setOpen(!open);
  window.__missionControl = { open: () => setOpen(true), close: () => setOpen(false), toggle: () => setOpen(!open), isOpen: () => open, refresh: () => { modelKey = ''; } };
})();

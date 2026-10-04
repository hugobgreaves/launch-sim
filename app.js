/* Launch Speed Simulator – UI + globe. Educational visualisation only. */
(function () {
  'use strict';
  const S = window.LaunchSim;
  const $ = id => document.getElementById(id);

  // Well-known public places (approximate coordinates).
  const PLACES = [
    { group: 'Spaceports', id: 'ksc', cc: 'US', name: 'Cape Canaveral / Kennedy (USA)', lat: 28.57, lng: -80.65 },
    { group: 'Spaceports', id: 'vsfb', cc: 'US', name: 'Vandenberg (USA)', lat: 34.74, lng: -120.57 },
    { group: 'Spaceports', id: 'starbase', cc: 'US', name: 'Starbase, Boca Chica (USA)', lat: 25.99, lng: -97.15 },
    { group: 'Spaceports', id: 'wallops', cc: 'US', name: 'Wallops Island (USA)', lat: 37.84, lng: -75.48 },
    { group: 'Spaceports', id: 'kourou', cc: 'FR', name: 'Guiana Space Centre, Kourou (France)', lat: 5.24, lng: -52.77 },
    { group: 'Spaceports', id: 'baikonur', cc: 'RU', name: 'Baikonur Cosmodrome (Russian-operated, Kazakhstan)', lat: 45.96, lng: 63.31 },
    { group: 'Spaceports', id: 'plesetsk', cc: 'RU', name: 'Plesetsk Cosmodrome (Russia)', lat: 62.93, lng: 40.57 },
    { group: 'Spaceports', id: 'jiuquan', cc: 'CN', name: 'Jiuquan (China)', lat: 40.96, lng: 100.29 },
    { group: 'Spaceports', id: 'wenchang', cc: 'CN', name: 'Wenchang (China)', lat: 19.61, lng: 110.95 },
    { group: 'Spaceports', id: 'tanegashima', cc: 'JP', name: 'Tanegashima (Japan)', lat: 30.40, lng: 130.97 },
    { group: 'Spaceports', id: 'sriharikota', cc: 'IN', name: 'Satish Dhawan, Sriharikota (India)', lat: 13.72, lng: 80.23 },
    { group: 'Spaceports', id: 'sohae', cc: 'KP', name: 'Sohae, Tongchang-ri (North Korea)', lat: 39.66, lng: 124.71 },
    { group: 'Spaceports', id: 'semnan', cc: 'IR', name: 'Semnan Space Centre (Iran)', lat: 35.23, lng: 53.92 },
    { group: 'Spaceports', id: 'palmachim', cc: 'IL', name: 'Palmachim (Israel)', lat: 31.88, lng: 34.68 },
    { group: 'Spaceports', id: 'mahia', cc: 'NZ', name: 'Rocket Lab LC-1, Mahia (NZ)', lat: -39.26, lng: 177.86 },
    { group: 'Spaceports', id: 'saxavord', cc: 'UK', name: 'SaxaVord, Shetland (UK)', lat: 60.82, lng: -0.77 },
    { group: 'Spaceports', id: 'esrange', cc: 'SE', name: 'Esrange, Kiruna (Sweden)', lat: 67.89, lng: 21.10 },
    { group: 'Cities', id: 'london', cc: 'UK', name: 'London', lat: 51.507, lng: -0.128 },
    { group: 'Cities', id: 'paris', cc: 'FR', name: 'Paris', lat: 48.857, lng: 2.352 },
    { group: 'Cities', id: 'berlin', cc: 'DE', name: 'Berlin', lat: 52.520, lng: 13.405 },
    { group: 'Cities', id: 'stockholm', cc: 'SE', name: 'Stockholm', lat: 59.329, lng: 18.069 },
    { group: 'Cities', id: 'washington', cc: 'US', name: 'Washington, DC', lat: 38.907, lng: -77.037 },
    { group: 'Cities', id: 'newyork', cc: 'US', name: 'New York', lat: 40.713, lng: -74.006 },
    { group: 'Cities', id: 'losangeles', cc: 'US', name: 'Los Angeles', lat: 34.052, lng: -118.244 },
    { group: 'Cities', id: 'honolulu', cc: 'US', name: 'Honolulu', lat: 21.307, lng: -157.858 },
    { group: 'Cities', id: 'anchorage', cc: 'US', name: 'Anchorage', lat: 61.218, lng: -149.900 },
    { group: 'Cities', id: 'ottawa', cc: 'CA', name: 'Ottawa', lat: 45.421, lng: -75.697 },
    { group: 'Cities', id: 'saopaulo', cc: 'BR', name: 'São Paulo', lat: -23.551, lng: -46.633 },
    { group: 'Cities', id: 'reykjavik', cc: 'IS', name: 'Reykjavík', lat: 64.147, lng: -21.942 },
    { group: 'Cities', id: 'capetown', cc: 'ZA', name: 'Cape Town', lat: -33.925, lng: 18.424 },
    { group: 'Cities', id: 'nairobi', cc: 'KE', name: 'Nairobi', lat: -1.292, lng: 36.822 },
    { group: 'Cities', id: 'dubai', cc: 'AE', name: 'Dubai', lat: 25.205, lng: 55.271 },
    { group: 'Cities', id: 'telaviv', cc: 'IL', name: 'Tel Aviv', lat: 32.085, lng: 34.782 },
    { group: 'Cities', id: 'tehran', cc: 'IR', name: 'Tehran', lat: 35.689, lng: 51.389 },
    { group: 'Cities', id: 'moscow', cc: 'RU', name: 'Moscow', lat: 55.756, lng: 37.617 },
    { group: 'Cities', id: 'minsk', cc: 'BY', name: 'Minsk', lat: 53.900, lng: 27.567 },
    { group: 'Cities', id: 'islamabad', cc: 'PK', name: 'Islamabad', lat: 33.684, lng: 73.048 },
    { group: 'Cities', id: 'delhi', cc: 'IN', name: 'Delhi', lat: 28.614, lng: 77.209 },
    { group: 'Cities', id: 'beijing', cc: 'CN', name: 'Beijing', lat: 39.904, lng: 116.407 },
    { group: 'Cities', id: 'pyongyang', cc: 'KP', name: 'Pyongyang', lat: 39.039, lng: 125.763 },
    { group: 'Cities', id: 'seoul', cc: 'KR', name: 'Seoul', lat: 37.566, lng: 126.978 },
    { group: 'Cities', id: 'singapore', cc: 'SG', name: 'Singapore', lat: 1.352, lng: 103.820 },
    { group: 'Cities', id: 'tokyo', cc: 'JP', name: 'Tokyo', lat: 35.676, lng: 139.650 },
    { group: 'Cities', id: 'sydney', cc: 'AU', name: 'Sydney', lat: -33.869, lng: 151.209 },
    { group: 'Cities', id: 'auckland', cc: 'NZ', name: 'Auckland', lat: -36.848, lng: 174.763 },
  ];

  // ---------- Formatting ----------
  const fmtInt = n => Math.round(n).toLocaleString('en-GB');
  const relKey = p => { const r = S.vehicleRelation(p, state.from && state.from.cc); return r.rel; };
  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  }
  const fmtAlt = h => h < 1 ? `${fmtInt(h * 1000)} m` : `${h < 100 ? h.toFixed(1) : fmtInt(h)} km`;
  const fmtCoord = p => `${Math.abs(p.lat).toFixed(2)}°${p.lat >= 0 ? 'N' : 'S'}, ${Math.abs(p.lng).toFixed(2)}°${p.lng >= 0 ? 'E' : 'W'}`;

  // ---------- State ----------
  const qs = new URLSearchParams(location.search);
  const BASES = window.LaunchBases || [];
  const findPlace = id => PLACES.find(p => p.id === id) || BASES.find(b => b.id === id);
  const EXTRA_CC = { BR: 'Brazil', IS: 'Iceland', ZA: 'South Africa', KE: 'Kenya', AE: 'United Arab Emirates', SG: 'Singapore' };
  const ccName = cc => (cc && (S.CC_NAME[cc] || EXTRA_CC[cc])) || cc || 'Unknown';
  const SUB_SVG = '<svg viewBox="0 0 40 16" width="34" height="14"><path d="M4 9c0-2.5 3-4 8-4h13c5 0 9 1.6 11 4-2 2.4-6 4-11 4H12c-5 0-8-1.5-8-4z" fill="#0ea5e9" stroke="#e0f2fe" stroke-width="1.2"/><rect x="16" y="1.5" width="6" height="5" rx="1.2" fill="#0ea5e9" stroke="#e0f2fe" stroke-width="1.2"/><path d="M1 6v6" stroke="#e0f2fe" stroke-width="1.5"/></svg>';
  function makeSub(cc, lat, lng) {
    return { id: 'sub', isSub: true, cc, lat, lng, countryName: ccName(cc), name: `${ccName(cc)} submarine`, subClass: S.SUB_CLASSES[cc] || '' };
  }
  const baseLabel = b => b.host ? `${b.name} (${ccName(b.cc)} base in ${b.host})` : `${b.name} (${ccName(b.cc)})`;
  const parseLL = v => { const m = /^(-?[\d.]+),(-?[\d.]+)$/.exec(v || ''); return m ? { id: 'custom', name: 'Custom point', lat: +m[1], lng: +m[2] } : null; };
  const state = {
    from: findPlace(qs.get('from')) || parseLL(qs.get('from')) || findPlace('ksc'),
    to: findPlace(qs.get('to')) || parseLL(qs.get('to')) || findPlace('london'),
    a: S.PRESETS.find(p => p.id === qs.get('a')) || S.PRESETS.find(p => p.id === 'icbm'),
    b: S.PRESETS.find(p => p.id === qs.get('b')) || S.PRESETS.find(p => p.id === 'airliner'),
    compare: qs.get('compare') !== '0',
    speed: [1, 10, 100, 1000].includes(+qs.get('speed')) ? +qs.get('speed') : 100,
    aar: qs.get('aar') === '1',
    exag: [1, 3, 10, 30].includes(+qs.get('exag')) ? +qs.get('exag') : 3,
    t: 0, playing: false, pick: 'from', follow: false,
    runs: [],
  };

  // ---------- Globe ----------
  const el = $('globe');
  const globe = new Globe(el, { animateIn: false })
    .globeImageUrl('vendor/earth-dark.jpg')
    .bumpImageUrl('vendor/earth-topology.png')
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true).atmosphereColor('#3b82f6').atmosphereAltitude(0.18)
    .polygonCapColor(() => 'rgba(56,189,248,0.035)')
    .polygonSideColor(() => 'rgba(0,0,0,0)')
    .polygonStrokeColor(() => 'rgba(148,163,184,0.55)')
    .polygonAltitude(0.003)
    .polygonLabel(d => `<div style="font:12px system-ui;background:rgba(5,7,13,.8);padding:3px 7px;border-radius:6px">${d.properties.name}</div>`)
    .pathPoints('pts').pathPointLat(p => p[0]).pathPointLng(p => p[1]).pathPointAlt(p => p[2])
    .pathColor(d => d.color).pathStroke(d => d.width)
    .pathDashLength(d => d.dash ? 0.01 : 1).pathDashGap(d => d.dash ? 0.008 : 0).pathDashAnimateTime(0)
    .pathTransitionDuration(0)
    .htmlElementVisibilityModifier((e, vis) => e.classList.toggle('behind', !vis)).htmlElement(d => d.el).htmlLat(d => d.lat).htmlLng(d => d.lng).htmlAltitude(d => d.alt)
    .htmlTransitionDuration(0)
    .ringColor(d => t => `${d.rgb},${1 - t})`).ringMaxRadius(3).ringPropagationSpeed(1.5).ringRepeatPeriod(1400)
    .onGlobeClick(({ lat, lng }) => onPick(lat, lng))
    .onPolygonClick((poly, ev, coords) => coords && onPick(coords.lat, coords.lng));
  globe.controls().autoRotate = false;
  globe.controls().enableDamping = true;
  const resize = () => globe.width(el.clientWidth).height(el.clientHeight);
  window.addEventListener('resize', resize); resize();

  let countryFeatures = [];
  fetch('vendor/countries.geojson').then(r => r.json()).then(g => {
    countryFeatures = g.features; globe.polygonsData(g.features);
    // re-resolve custom points now that outlines are available
    let changed = false;
    ['from', 'to'].forEach(k => { const p = state[k]; if (p.id === 'custom' && !p.cc) { resolveCountry(p); changed = true; } });
    if (changed) { ensureValidVehicles(true); rebuild(); }
  }).catch(() => {});
  function ringContains(ring, x, y) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function featureAt(lat, lng) {
    for (const f of countryFeatures) {
      const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      for (const poly of polys) if (ringContains(poly[0], lng, lat) && !poly.slice(1).some(h => ringContains(h, lng, lat))) return f;
    }
    return null;
  }
  // Resolve a point's country: outline lookup first, else nearest listed place within 300 km.
  function resolveCountry(p) {
    const f = featureAt(p.lat, p.lng);
    if (f) { p.countryName = f.properties.name; p.cc = S.NAME_CC[f.properties.name] || null; p.feature = f; }
    else {
      let best = null, bd = 1e9;
      PLACES.forEach(q => { const d = S.greatCircleKm(p, q); if (d < bd) { bd = d; best = q; } });
      if (best && bd < 300) { p.cc = best.cc; p.countryName = ccName(best.cc); }
      else { p.cc = null; p.countryName = 'International waters'; }
    }
    return p;
  }
  const launchCC = () => state.from.cc || null;
  const launchCountryName = () => state.from.countryName || ccName(state.from.cc);
  setTimeout(() => $('loading').classList.add('hide'), 300);

  const visAlt = h => Math.max(h * state.exag / S.R, 0.0018);

  function subMarkerEl(p) {
    const d = document.createElement('div');
    d.className = 'mk sub';
    d.innerHTML = `<div class="subicon">${SUB_SVG}</div><div class="lbl">${esc(p.name)}</div>`;
    return d;
  }
  function markerEl(color, label, cls) {
    const d = document.createElement('div');
    d.className = 'mk ' + (cls || '');
    d.style.setProperty('--c', color);
    d.innerHTML = `<div class="pip"></div>${label ? `<div class="lbl">${label}</div>` : ''}`;
    return d;
  }

  // ---------- Simulation runs ----------
  function runColors() {
    const ca = state.a.color;
    let cb = state.b.color;
    if (cb.toLowerCase() === ca.toLowerCase()) cb = ca.toLowerCase() === '#e2e8f0' ? '#a78bfa' : '#e2e8f0';
    return [ca, cb];
  }
  function vehicles() { return state.compare ? [state.a, state.b] : [state.a]; }
  let gcFn = null, routeKm = 0;
  function rebuild() {
    routeKm = S.greatCircleKm(state.from, state.to);
    if (routeKm < 1) { // nudge identical points apart
      state.to = { ...state.to, id: 'custom', name: 'Custom point', lat: state.to.lat + 0.5, isBase: false };
      setTimeout(() => toast('Launch point and destination were the same – destination moved ≈ 55 km north.'), 0);
      routeKm = S.greatCircleKm(state.from, state.to);
    }
    gcFn = S.makeGreatCircle(state.from, state.to);
    state.runs = vehicles().map((p, i) => {
      const aar = state.aar && p.aar && isFinite(p.maxRange) && routeKm > p.maxRange;
      const r = S.simulateRoute(aar ? { ...p, maxRange: Infinity } : p, routeKm);
      if (aar) r.aarRefuels = Math.ceil(routeKm / p.maxRange) - 1;
      r.preset = p;
      r.label = i === 0 ? 'A' : 'B';
      r.color = runColors()[i];
      r.marker = { el: markerEl(r.color, `${r.label}`, 'veh lab-' + r.label.toLowerCase()), lat: state.from.lat, lng: state.from.lng, alt: 0 };
      r.rel = S.relationLabel(p, launchCC());
      // Full planned path (dim) — sample ~400 points evenly in time
      const N = 400, pts = [];
      for (let k = 0; k <= N; k++) {
        const st = S.stateAt(r, r.end * k / N), ll = gcFn(st.s);
        pts.push([ll.lat, ll.lng, visAlt(st.h)]);
      }
      r.planned = { pts, color: hexA(r.color, 0.5), width: 1.2, dash: true };
      if (r.booster) {
        const bp = r.booster.samples.map(q => { const ll = gcFn(q.s); return [ll.lat, ll.lng, visAlt(q.h)]; });
        r.booster.planned = { pts: bp, color: 'rgba(251,191,36,0.35)', width: 0.8, dash: true };
        r.booster.marker = { el: markerEl('#fbbf24', 'Booster', 'veh lab-boost'), lat: state.from.lat, lng: state.from.lng, alt: 0 };
      }
      if (r.outOfRange) {
        const ll = gcFn(r.flyKm);
        r.stopMk = { el: markerEl(r.color, `✕ ${r.label}: max range`, 'stop'), lat: ll.lat, lng: ll.lng, alt: 0.003 };
      }
      return r;
    });
    // Range rings (ground circle of max range) for vehicles with a finite range
    state.rings = []; state.ringLabels = [];
    state.runs.forEach(r => {
      const max = r.preset.maxRange;
      if (!isFinite(max) || max >= 19900) return;
      const pts = [];
      for (let k = 0; k <= 180; k++) { const ll = destPoint(state.from, k * 2, max / S.R); pts.push([ll.lat, ll.lng, 0.0025]); }
      state.rings.push({ pts, color: hexA(r.color, 0.85), width: 1.6, dash: true });
      const lab = destPoint(state.from, 180 + 25 * (r.label === 'A' ? 1 : -1), max / S.R);
      state.ringLabels.push({ el: markerEl(r.color, `${r.label} range ≈ ${fmtInt(max)} km`, 'ringlab'), lat: lab.lat, lng: lab.lng, alt: 0.003 });
    });
    state.maxEnd = Math.max(...state.runs.map(r => r.end));
    state.t = Math.min(state.t, state.maxEnd);
    // ground track (great circle on the surface)
    const ground = [];
    for (let k = 0; k <= 200; k++) { const ll = gcFn(routeKm * k / 200); ground.push([ll.lat, ll.lng, 0.0012]); }
    state.ground = { pts: ground, color: 'rgba(255,255,255,0.3)', width: 0.6, dash: false };
    const launchEl = state.from.isSub ? subMarkerEl(state.from) : markerEl('#22c55e', short(state.from), 'site');
    const launchMk = { el: launchEl, lat: state.from.lat, lng: state.from.lng, alt: 0.002 };
    const destMk = { el: markerEl('#f43f5e', short(state.to), 'site'), lat: state.to.lat, lng: state.to.lng, alt: 0.002 };
    state.siteMarkers = [launchMk, destMk];
    globe.ringsData([
      { lat: state.from.lat, lng: state.from.lng, rgb: 'rgba(34,197,94' },
      { lat: state.to.lat, lng: state.to.lng, rgb: 'rgba(244,63,94' },
    ]);
    buildReadouts();
    renderRouteInfo();
    renderPresetInfo();
    syncUrl();
    lastPathDraw = 0;
    draw(true);
  }
  function short(p) { return p.id === 'custom' ? fmtCoord(p) : p.name.replace(/\s*\(.*\)$/, ''); }
  // Point at bearing (deg) and angular distance (rad) from p.
  function destPoint(p, brgDeg, ang) {
    const la = p.lat * Math.PI / 180, lo = p.lng * Math.PI / 180, b = brgDeg * Math.PI / 180;
    const la2 = Math.asin(Math.sin(la) * Math.cos(ang) + Math.cos(la) * Math.sin(ang) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(ang) * Math.cos(la), Math.cos(ang) - Math.sin(la) * Math.sin(la2));
    return { lat: la2 * 180 / Math.PI, lng: ((lo2 * 180 / Math.PI + 540) % 360) - 180 };
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  // Look at the route from slightly to one side so the altitude of arcs is visible.
  function focusRoute(ms) {
    const M = S.toVec(...Object.values(pick(gcFn(routeKm / 2))));
    const M2 = S.toVec(...Object.values(pick(gcFn(routeKm / 2 + 10))));
    const D = M2.map((x, i) => x - M[i]);
    let N = [M[1] * D[2] - M[2] * D[1], M[2] * D[0] - M[0] * D[2], M[0] * D[1] - M[1] * D[0]];
    const nn = Math.hypot(...N) || 1; N = N.map(x => x / nn);
    if (N[2] > 0) N = N.map(x => -x); // view from the equator-ward side
    const off = 14 * Math.PI / 180;
    const V = M.map((x, i) => x * Math.cos(off) + N[i] * Math.sin(off));
    const ll = S.toLatLng(V);
    const alt = Math.min(3.8, Math.max(1.4, routeKm / 4000 + 1.3)) * (innerWidth < 820 ? 0.8 : 1);
    globe.pointOfView({ lat: ll.lat, lng: ll.lng, altitude: alt }, ms);
  }
  const pick = p => ({ lat: p.lat, lng: p.lng });
  // Close-up of the launch: camera a little behind and to the side of the launch site, looking along the route.
  function focusLaunch(ms) {
    state.follow = false; $('follow').checked = false;
    const ahead = gcFn(Math.min(routeKm, 600) * 0.5);
    const back = { lat: state.from.lat + (state.from.lat - ahead.lat) * 0.6 - 6, lng: state.from.lng + (state.from.lng - ahead.lng) * 0.6 };
    globe.pointOfView({ lat: Math.max(-85, Math.min(85, back.lat)), lng: back.lng, altitude: 0.55 }, ms);
  }

  // ---------- Readouts ----------
  function rangeNote(r) {
    if (r.outOfRange) return `<b>Out of range:</b> ${esc(r.preset.name)} reaches ≈ ${fmtInt(r.preset.maxRange)} km; this route is ${fmtInt(routeKm)} km. Flight stops at max range, ≈ ${fmtInt(r.shortBy)} km short (✕ on globe).`;
    return '';
  }
  function buildReadouts() {
    const box = $('readouts');
    box.innerHTML = '';
    state.runs.forEach(r => {
      const d = document.createElement('div');
      d.className = 'ro';
      d.style.setProperty('--c', r.color);
      const totalLbl = r.preset.kind === 'orbital' ? 'Over dest.' : (r.outOfRange ? 'To max range' : 'Total time');
      d.innerHTML = `
        <div class="ro-head"><div class="ro-name">${r.label} · ${r.preset.name}</div><div class="ro-phase" data-k="phase"></div></div>
        <div class="ro-country"><span class="rel rel-${relKey(r.preset)}">${esc(r.rel)}</span>${r.preset.country && r.preset.country !== 'Generic' ? ' · ' + esc(r.preset.country) : ''}${r.preset.retired ? ' · <span class="retired">retired</span>' : ''} · figures approx.</div>
        ${state.from.isSub ? `<div class="ro-plat">🚢 Submarine-launched · ${esc(state.from.subClass)}</div>` : ''}
        <div class="ro-speed"><span data-k="kmh"></span> <small>km/h</small></div>
        <div class="ro-grid">
          <div><span>Mach</span> <b data-k="mach"></b></div>
          <div><span>Altitude</span> <b data-k="alt"></b></div>
          <div><span>Distance</span> <b data-k="dist"></b></div>
          <div><span>Elapsed</span> <b data-k="el"></b></div>
          <div><span>${totalLbl}</span> <b>${fmtDur(r.arrival)}</b></div>
          <div><span>Peak speed</span> <b>${fmtInt(r.maxV)}</b></div>
          <div><span>Max range</span> <b>${isFinite(r.preset.maxRange) ? '≈ ' + fmtInt(r.preset.maxRange) + ' km' : (r.preset.kind === 'orbital' ? 'Orbital' : 'Not capped')}</b></div>
          <div><span>Peak alt.</span> <b>${fmtAlt(r.maxH)}</b></div>
        </div>
        <div class="bar"><i data-k="bar"></i></div>
        ${r.booster ? '<div class="ro-sub" data-k="sub"></div>' : ''}
        ${rangeNote(r) ? `<div class="ro-note oor">${rangeNote(r)}</div>` : ''}
        ${r.aarRefuels ? `<div class="ro-note aar">⛽ <b>Air-to-air refuelling:</b> ≈ ${r.aarRefuels} tanker top-up${r.aarRefuels > 1 ? 's extend' : ' extends'} ${esc(r.preset.name)} beyond its ≈ ${fmtInt(r.preset.maxRange)} km unrefuelled range (estimate; ring shows unrefuelled range).</div>` : ''}`;
      d.classList.toggle('is-oor', !!r.outOfRange);
      r.ro = {};
      d.querySelectorAll('[data-k]').forEach(n => { r.ro[n.dataset.k] = n; });
      box.appendChild(d);
    });
    if (state.runs.length === 2 && state.runs.some(r => r.outOfRange)) {
      const v = document.createElement('div');
      v.className = 'verdict';
      const reach = state.runs.filter(r => !r.outOfRange), cant = state.runs.filter(r => r.outOfRange);
      v.textContent = reach.length
        ? `${reach.map(r => r.label).join(' & ')} reaches the destination (${fmtDur(reach[0].arrival)}); ${cant.map(r => r.label).join(' & ')} can't – out of range.`
        : `Neither vehicle can reach this destination – both stop at their max range.`;
      box.appendChild(v);
    } else if (state.runs.length === 2) {
      const [a, b] = state.runs;
      const fast = a.arrival <= b.arrival ? a : b, slow = fast === a ? b : a;
      const ratio = slow.arrival / fast.arrival;
      const v = document.createElement('div');
      v.className = 'verdict';
      v.textContent = `${fast.label} ${fast.preset.kind === 'orbital' ? 'passes over' : 'reaches'} the destination ${ratio >= 1.05 ? ratio.toFixed(ratio < 10 ? 1 : 0) + '× faster' : 'at about the same time'} (${fmtDur(fast.arrival)} vs ${fmtDur(slow.arrival)}).`;
      box.appendChild(v);
    }
    $('tEnd').textContent = 'End T+' + fmtDur(state.maxEnd);
  }
  function updateReadouts(states) {
    state.runs.forEach((r, i) => {
      const st = states[i];
      const mach = st.v / S.speedOfSound(st.h);
      r.ro.kmh.textContent = fmtInt(st.v);
      r.ro.mach.textContent = (mach < 10 ? mach.toFixed(2) : mach.toFixed(1)) + (st.h > 86 ? '*' : '');
      r.ro.alt.textContent = fmtAlt(st.h);
      const shown = Math.min(st.s, Math.max(routeKm, st.s));
      r.ro.dist.textContent = `${fmtInt(Math.min(shown, r.outOfRange ? r.flyKm : shown))} / ${fmtInt(routeKm)} km`;
      r.ro.el.textContent = fmtDur(Math.min(state.t, r.end));
      const arrived = state.t >= r.arrival;
      r.ro.phase.textContent = st.done ? (r.preset.kind === 'orbital' ? 'In orbit' : (r.outOfRange ? 'Stopped at max range' : 'Arrived')) :
        (r.preset.kind === 'orbital' && arrived ? 'Orbit · passed destination' : st.phase);
      r.ro.bar.style.width = Math.min(100, 100 * state.t / r.arrival) + '%';
      if (r.booster && r.ro.sub) {
        const b0 = r.booster.samples[0].t;
        if (state.t < b0) r.ro.sub.innerHTML = `Booster: attached · separates ≈ T+${fmtDur(b0)}`;
        else { const bs = S.stateAt(r.booster, state.t); r.ro.sub.innerHTML = `Booster: <b>${bs.phase}</b> · ${fmtInt(bs.v)} km/h · ${fmtAlt(bs.h)}`; }
      }
    });
    $('tNow').textContent = 'T+' + fmtDur(state.t);
    $('scrub').value = state.maxEnd ? Math.round(1000 * state.t / state.maxEnd) : 0;
  }

  // ---------- Drawing ----------
  let lastPathDraw = 0;
  function draw(forcePaths) {
    const states = state.runs.map(r => S.stateAt(r, state.t));
    const paths = [state.ground, ...(state.rings || [])];
    state.runs.forEach((r, i) => {
      const st = states[i], ll = gcFn(st.s);
      Object.assign(r.marker, { lat: ll.lat, lng: ll.lng, alt: visAlt(st.h) });
      paths.push(r.planned);
      // travelled portion
      const pts = [];
      const S0 = r.samples, last = st.done ? S0.length - 1 : (st.idx || 0);
      const stride = Math.max(1, Math.ceil((last + 1) / 300));
      for (let k = 0; k <= last; k += stride) { const q = S0[k], p = gcFn(q.s); pts.push([p.lat, p.lng, visAlt(q.h)]); }
      pts.push([ll.lat, ll.lng, visAlt(st.h)]);
      if (pts.length < 2) pts.unshift(pts[0]);
      paths.push({ pts, color: r.color, width: 3.5, dash: false });
      if (r.booster) {
        const B = r.booster, b0 = B.samples[0].t;
        paths.push(B.planned);
        if (state.t >= b0) {
          const bst = S.stateAt(B, state.t), bl = gcFn(bst.s);
          const bpts = [];
          const lastB = bst.done ? B.samples.length - 1 : (bst.idx || 0);
          for (let k = 0; k <= lastB; k += 2) { const q = B.samples[k], p = gcFn(q.s); bpts.push([p.lat, p.lng, visAlt(q.h)]); }
          bpts.push([bl.lat, bl.lng, visAlt(bst.h)]);
          if (bpts.length < 2) bpts.unshift(bpts[0]);
          paths.push({ pts: bpts, color: '#fbbf24', width: 3, dash: false });
          Object.assign(B.marker, { lat: bl.lat, lng: bl.lng, alt: visAlt(bst.h), show: true });
        } else B.marker.show = false;
      }
    });
    const now = performance.now();
    if (forcePaths || now - lastPathDraw > 70) { globe.pathsData(paths); lastPathDraw = now; }
    const mks = [...state.siteMarkers, ...(state.ringLabels || []), ...(state.baseMarkers || []), ...state.runs.map(r => r.marker)];
    state.runs.forEach(r => { if (r.stopMk) mks.push(r.stopMk); });
    state.runs.forEach(r => { if (r.booster && r.booster.marker.show) mks.push(r.booster.marker); });
    globe.htmlElementsData(mks);
    if (state.follow && state.runs[0]) {
      const m = state.runs[0].marker;
      globe.pointOfView({ lat: m.lat, lng: m.lng, altitude: Math.max(0.8, globe.pointOfView().altitude) }, 0);
    }
    updateReadouts(states);
  }

  // ---------- Loop ----------
  let lastFrame = performance.now();
  const setZoomed = pov => el.classList.toggle('zoomed', (pov || globe.pointOfView()).altitude < 0.9);
  if (globe.onZoom) globe.onZoom(setZoomed);
  let zoomCheck = 0;
  function frame(now) {
    if (++zoomCheck % 3 === 0) setZoomed();
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    if (state.playing) {
      state.t += dt * state.speed;
      if (state.t >= state.maxEnd) { state.t = state.maxEnd; setPlaying(false); }
      draw(false);
    }
    requestAnimationFrame(frame);
  }
  function setPlaying(p) {
    if (p && state.t >= state.maxEnd) state.t = 0;
    state.playing = p;
    $('playBtn').textContent = p ? '❚❚ Pause' : '▶ Play';
  }

  // ---------- Controls ----------
  function fillPlaceSelect(sel, cur) {
    const groups = {};
    PLACES.forEach(p => (groups[p.group] = groups[p.group] || []).push(p));
    let html = cur.id === 'custom' ? `<option value="custom">📍 Custom: ${fmtCoord(cur)}${cur.countryName ? ' · ' + esc(cur.countryName) : ''}</option>` : '';
    if (cur.isBase) html += `<option value="${cur.id}">🎖 ${esc(baseLabel(cur))}</option>`;
    if (cur.isSub) html += `<option value="sub">🚢 ${esc(cur.name)} at ${fmtCoord(cur)}</option>`;
    for (const g in groups) html += `<optgroup label="${g}">` + groups[g].map(p => `<option value="${p.id}">${p.name}</option>`).join('') + '</optgroup>';
    sel.innerHTML = html;
    sel.value = cur.id;
  }
  // ---------- Searchable, grouped vehicle picker ----------
  function esc(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function renderPickerButton(which) {
    const p = which === 'a' ? state.a : state.b;
    const col = runColors()[which === 'a' ? 0 : 1];
    $(which === 'a' ? 'vehA' : 'vehB').innerHTML = `<button class="vp-btn" type="button" data-which="${which}">
      <i class="dot" style="background:${col}"></i><span class="vp-name">${esc(p.name)}</span>
      <span class="vp-sub">${esc([p.country, p.group].filter(Boolean).join(' · '))}</span><span class="vp-caret">▾</span></button>`;
  }
  let popWhich = null, popActive = -1;
  function openPicker(which) {
    popWhich = which;
    const pop = $('vpop'), btn = $(which === 'a' ? 'vehA' : 'vehB');
    pop.hidden = false; $('vpopBackdrop').hidden = false;
    if (innerWidth > 820) {
      const r = btn.getBoundingClientRect();
      const w = Math.min(420, innerWidth - 16);
      pop.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
      const ph = Math.min(innerHeight * 0.7, 640);
      pop.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - ph - 8)) + 'px';
    }
    $('vpopSearch').value = '';
    renderPickerList('');
    if (innerWidth > 820) $('vpopSearch').focus();
    const sel = $('vpopList').querySelector('.sel');
    if (sel) sel.scrollIntoView({ block: 'center' });
  }
  function closePicker() { $('vpop').hidden = true; $('vpopBackdrop').hidden = true; popWhich = null; }
  function renderPickerList(q) {
    const cur = popWhich === 'b' ? state.b : state.a;
    const cc = launchCC();
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const match = p => { const hay = `${p.name} ${p.country || ''} ${p.group} ${p.typicalSpeed}`.toLowerCase(); return terms.every(t => hay.includes(t)); };
    const groups = S.availableGroups(cc);
    const hasEquip = groups.some(g => g.key === 'own' || g.key.startsWith('ally'));
    let html = `<div class="vpop-ctx">Launching from <b>${esc(short(state.from))}</b> · ${esc(launchCountryName())}` +
      (hasEquip ? ' — own & allied equipment only' : ' — <span class="warn">no listed military equipment; civilian & generic only</span>') + '</div>';
    let n = 0;
    groups.forEach(g => {
      const items = g.items.filter(match);
      if (!items.length) return;
      n += items.length;
      html += `<div class="vpop-group g-${g.key.split('-')[0]}">${esc(g.label)} <span style="opacity:.6">(${items.length})</span></div>`;
      html += items.map(p => `<div class="vpop-item${p.id === cur.id ? ' sel' : ''}" data-id="${p.id}" role="option">
        <i class="dot" style="background:${p.color}"></i><div class="nm">${esc(p.name)}${p.retired ? ' <span class="retired">retired</span>' : ''}</div>
        <div class="sp">${esc(p.typicalSpeed.replace(/\s*\(.*\)$/, ''))}${p.rangeTxt ? `<br><span class="muted">${esc(p.rangeTxt)}</span>` : ''}</div>
        <div class="ct">${esc(p.country || '')}${p.opNote && g.key === 'own' ? ' · ' + esc(ownNote(p, cc)) : ''} · <span class="muted">${esc(p.group)}</span></div></div>`).join('');
    });
    $('vpopList').innerHTML = n ? html : html + '<div class="vpop-empty">No vehicles match.</div>';
    popActive = -1;
  }
  // e.g. Trident from the UK -> "UK-operated, US-built"
  function ownNote(p, cc) {
    if (p.built && p.built !== cc) return `${cc}-operated, ${p.built}-built`;
    return p.opNote || '';
  }
  let toastTimer = null;
  function toast(msg) {
    const t = $('toast'); t.innerHTML = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 6000);
  }
  // Switch vehicles that aren't operated by the launch country or its allies.
  function ensureValidVehicles(quiet) {
    const cc = launchCC(), msgs = [];
    ['a', 'b'].forEach(k => {
      const p = state[k];
      if (S.isAllowed(p, cc)) return;
      const groups = S.availableGroups(cc);
      const equip = groups.filter(g => g.key === 'own' || g.key.startsWith('ally')).flatMap(g => g.items);
      const all = groups.flatMap(g => g.items);
      const own = groups.filter(g => g.key === 'own').flatMap(g => g.items);
      const other = state[k === 'a' ? 'b' : 'a'];
      const ordered = [equip.find(q => q.group === p.group), equip.find(q => q.kind === p.kind),
        all.find(q => q.isGeneric && q.kind === p.kind), all.find(q => q.isGeneric)].concat(own, all).filter(Boolean);
      const repl = ordered.find(q => q.id !== other.id) || ordered[0]; // avoid A and B ending up identical
      state[k] = repl;
      const why = S.platform === 'sub' ? `isn't submarine-launched by ${esc(launchCountryName())} or its allies` : `isn't operated by ${esc(launchCountryName())} or its allies`;
      msgs.push(`${k.toUpperCase()}: <b>${esc(p.name)}</b> ${why} → switched to <b>${esc(repl.name)}</b>`);
    });
    if (msgs.length && !quiet) toast(msgs.join('<br>'));
    setDots();
    return msgs;
  }
  function choose(id) {
    const p = S.PRESETS.find(x => x.id === id);
    if (!p || !popWhich) return;
    if (popWhich === 'a') state.a = p; else state.b = p;
    closePicker();
    setDots(); state.t = 0; setPlaying(false); rebuild();
  }
  $('vpopList').addEventListener('click', e => { const it = e.target.closest('.vpop-item'); if (it) choose(it.dataset.id); });
  $('vpopSearch').addEventListener('input', e => renderPickerList(e.target.value));
  $('vpopSearch').addEventListener('keydown', e => {
    const items = [...$('vpopList').querySelectorAll('.vpop-item')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      popActive = Math.max(0, Math.min(items.length - 1, popActive + (e.key === 'ArrowDown' ? 1 : -1)));
      items.forEach((n, i) => n.classList.toggle('active', i === popActive));
      if (items[popActive]) items[popActive].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') { const it = items[Math.max(0, popActive)]; if (it) choose(it.dataset.id); }
    else if (e.key === 'Escape') closePicker();
  });
  $('vpopClose').onclick = closePicker;
  $('vpopBackdrop').onclick = closePicker;
  ['vehA', 'vehB'].forEach(id => $(id).addEventListener('click', e => { const b = e.target.closest('.vp-btn'); if (b) openPicker(b.dataset.which); }));

  function renderRouteInfo() {
    const mi = routeKm * 0.621371;
    const oor = state.runs.filter(r => r.outOfRange);
    $('routeInfo').innerHTML = `<div class="muted small">Launch country: <b style="color:#e6ebf5">${esc(launchCountryName())}</b>${state.from.isBase ? ' · ' + esc(state.from.role) : ''}</div>
      <div class="muted small">Platform: <b style="color:#e6ebf5">${state.from.isSub ? '🚢 Submarine (' + esc(state.from.subClass) + '), at sea' : 'Land'}</b></div>
      Great-circle distance<br><b>${fmtInt(routeKm)} km</b> <span class="muted">(${fmtInt(mi)} mi)</span>
      ${oor.map(r => `<div class="oor-pill">⚠ ${r.label}: out of range (max ≈ ${fmtInt(r.preset.maxRange)} km)</div>`).join('')}
      <div class="muted small">${fmtCoord(state.from)} → ${fmtCoord(state.to)}</div>`;
  }
  function renderPresetInfo() {
    const list = vehicles().filter((p, i, a) => a.indexOf(p) === i);
    $('presetInfo').innerHTML = `<summary>About these vehicles</summary>` + list.map(p => `
      <h4 style="color:${p.color}">${p.name}</h4>
      <p><span class="muted">From ${esc(short(state.from))}:</span> ${esc(S.relationLabel(p, launchCC()))}${p.retired ? ' · retired' : ''}</p>
      ${p.country && p.country !== 'Generic' ? `<p><span class="muted">Country:</span> ${p.country}${p.opNote ? ' (' + esc(p.opNote) + ')' : ''}</p>` : ''}
      <p><span class="muted">Max range used:</span> ${isFinite(p.maxRange) ? '≈ ' + fmtInt(p.maxRange) + ' km (enforced)' : (p.kind === 'orbital' ? 'orbital (global)' : 'not capped (generic class, range varies)')}</p>
      <p><span class="muted">Top / typical speed (approx.):</span> ${p.typicalSpeed}</p>
      <p><span class="muted">Altitude (approx.):</span> ${p.typicalAlt}</p>
      ${p.rangeTxt ? `<p><span class="muted">Range (approx.):</span> ${p.rangeTxt}</p>` : ''}
      <p><span class="muted">Profile:</span> ${p.profile}</p>`).join('') +
      `<p class="muted small" style="margin-top:8px">* Mach above ~86 km is nominal (there is almost no air). Ballistic arcs use a simple boost + unpowered coast in a central gravity field, scaled so that at max range they match the listed top speed and apogee; shorter routes fly a lower, slower arc.</p>`;
  }
  function syncUrl() {
    const enc = p => p.id === 'custom' ? `${p.lat.toFixed(3)},${p.lng.toFixed(3)}` : p.id;
    const enc0 = enc;
    const encF = p => p.isSub ? `${p.lat.toFixed(3)},${p.lng.toFixed(3)}` : enc0(p);
    const q = new URLSearchParams({ from: encF(state.from), to: enc(state.to), a: state.a.id, b: state.b.id, compare: state.compare ? '1' : '0', speed: state.speed, exag: state.exag });
    if (S.platform === 'sub') { q.set('platform', 'sub'); q.set('sub', state.subCC); }
    if (state.aar) q.set('aar', '1');
    history.replaceState(null, '', '?' + q.toString());
  }
  function onPick(lat, lng) {
    if (state.pick === 'off') return;
    if (state.pick === 'country') { showCountry(lat, lng); return; }
    if (state.pick === 'from' && S.platform === 'sub') {
      const land = featureAt(lat, lng);
      if (land) { toast(`🚫 That's land (${esc(land.properties.name)}). Submarines launch at sea – tap on the ocean.`); return; }
      state.from = makeSub(state.subCC, lat, lng);
      fillPlaceSelect($('fromSel'), state.from); setPick('to');
      const sw = ensureValidVehicles(true);
      toast([`🚢 ${esc(state.from.name)} (${esc(state.from.subClass)}) placed at ${fmtCoord(state.from)}.`].concat(sw).join('<br>'));
      state.t = 0; setPlaying(false); rebuild();
      return;
    }
    const p = resolveCountry({ id: 'custom', name: 'Custom point', lat, lng });
    if (state.pick === 'from') {
      state.from = p; fillPlaceSelect($('fromSel'), p); setPick('to');
      const groups = S.availableGroups(p.cc);
      const none = !groups.some(g => g.key === 'own' || g.key.startsWith('ally'));
      const sw = ensureValidVehicles(true);
      const lines = [`📍 Launch point in <b>${esc(p.countryName || 'unknown')}</b>` + (none ? ': no listed military equipment for this country – only civilian & generic options are available.' : ' – vehicle list follows its own/ally rules.')].concat(sw);
      toast(lines.join('<br>'));
    } else { state.to = p; fillPlaceSelect($('toSel'), p); }
    state.t = 0; setPlaying(false); rebuild();
  }
  // Country mode: highlight the tapped country and show its major bases (incl. overseas).
  function showCountry(lat, lng) {
    const f = featureAt(lat, lng);
    const cc = f ? S.NAME_CC[f.properties.name] : null;
    state.highlight = f || null;
    refreshPolys();
    const list = cc ? BASES.filter(b => b.cc === cc) : [];
    state.baseMarkers = list.map(b => {
      const el = markerEl('#facc15', b.name + (b.host ? ` (${b.host})` : ''), 'base' + (b.host ? ' overseas' : ''));
      el.title = `${baseLabel(b)} – ${b.role}. Click to launch from here.`;
      el.addEventListener('click', ev => { ev.stopPropagation(); setLaunchFromBase(b); });
      return { el, lat: b.lat, lng: b.lng, alt: 0.004 };
    });
    $('countryInfo').innerHTML = f ? (list.length
      ? `<b>${esc(f.properties.name)}</b>: ${list.length} major bases shown (yellow, incl. overseas). Home-base names appear on hover or when zoomed in. Click one to launch from it.`
      : `<b>${esc(f.properties.name)}</b>: no bases listed in this catalogue.`) : 'Ocean – click on land to pick a country.';
    draw(true);
  }
  function setLaunchFromBase(b) {
    if (S.platform === 'sub') setPlatform('land', true);
    state.from = { ...b, countryName: ccName(b.cc) };
    fillPlaceSelect($('fromSel'), state.from);
    ensureValidVehicles();
    state.t = 0; setPlaying(false); rebuild(); focusRoute(1000);
    toast(`🎖 Launch point: <b>${esc(baseLabel(b))}</b> – ${esc(b.role)}. Vehicle list follows ${esc(ccName(b.cc))}'s own/ally rules.`);
  }
  function refreshPolys() {
    globe.polygonCapColor(d => d === state.highlight ? 'rgba(250,204,21,0.28)' : 'rgba(56,189,248,0.035)')
      .polygonStrokeColor(d => d === state.highlight ? 'rgba(250,204,21,0.95)' : 'rgba(148,163,184,0.55)')
      .polygonAltitude(d => d === state.highlight ? 0.008 : 0.003);
  }
  function setPick(v) {
    state.pick = v;
    document.querySelectorAll('#pickSeg button').forEach(b => b.classList.toggle('on', b.dataset.pick === v));
  }
  function setSpeed(v) {
    state.speed = v;
    document.querySelectorAll('#speedSeg button').forEach(b => b.classList.toggle('on', +b.dataset.speed === v));
  }
  function setDots() {
    const [ca, cb] = runColors();
    $('dotA').style.background = ca;
    $('dotB').style.background = cb;
    renderPickerButton('a'); renderPickerButton('b');
    $('vehBWrap').style.display = state.compare ? '' : 'none';
  }

  fillPlaceSelect($('fromSel'), state.from);
  fillPlaceSelect($('toSel'), state.to);
  $('compare').checked = state.compare;
  $('exag').value = String(state.exag);
  setSpeed(state.speed); setDots();

  function fillSubSelect() {
    $('subSel').innerHTML = Object.keys(S.SUB_CLASSES).map(cc => `<option value="${cc}">${esc(ccName(cc))} – ${esc(S.SUB_CLASSES[cc])}</option>`).join('');
    if (state.subCC) $('subSel').value = state.subCC;
  }
  function syncPlatformUI() {
    document.querySelectorAll('#platSeg button').forEach(b => b.classList.toggle('on', b.dataset.plat === S.platform));
    $('subWrap').hidden = S.platform !== 'sub';
  }
  let lastLand = null, lastLandVeh = null;
  function setPlatform(pl, quiet) {
    if (pl === S.platform) return;
    S.platform = pl;
    if (pl === 'sub') {
      lastLand = state.from; lastLandVeh = { a: state.a, b: state.b };
      const cc = S.SUB_CLASSES[state.from.cc] ? state.from.cc : (state.subCC || 'UK');
      state.subCC = cc; $('subSel').value = cc;
      const d = S.SUB_DEFAULT_POS[cc];
      state.from = makeSub(cc, d[0], d[1]);
      setPick('from');
    } else if (!quiet) {
      state.from = lastLand && !lastLand.isSub ? lastLand : findPlace('london');
      if (lastLandVeh) { state.a = lastLandVeh.a; state.b = lastLandVeh.b; }
    }
    syncPlatformUI();
    fillPlaceSelect($('fromSel'), state.from);
    const sw = ensureValidVehicles(true);
    if (!quiet) {
      toast((pl === 'sub' ? [`🚢 Submarine mode: ${esc(state.from.name)} (${esc(state.from.subClass)}). Tap anywhere at sea to move it. Only submarine-launched missiles are listed.`] : ['Land launch mode.']).concat(sw).join('<br>'));
      state.t = 0; setPlaying(false); rebuild(); focusRoute(1000);
    }
  }
  $('platSeg').onclick = e => { const b = e.target.closest('button'); if (b) setPlatform(b.dataset.plat); };
  $('subSel').onchange = e => {
    state.subCC = e.target.value;
    const d = S.SUB_DEFAULT_POS[state.subCC];
    state.from = makeSub(state.subCC, d[0], d[1]);
    fillPlaceSelect($('fromSel'), state.from);
    const ownSub = (S.availableGroups(state.subCC).find(g => g.key === 'own') || { items: [] }).items;
    if (ownSub.length && !ownSub.includes(state.a)) state.a = ownSub.find(q => q.id !== state.b.id) || ownSub[0];
    const sw = ensureValidVehicles(true);
    toast([`🚢 ${esc(state.from.name)} (${esc(state.from.subClass)}) at a default sea position – tap the ocean to move it.`].concat(sw).join('<br>'));
    state.t = 0; setPlaying(false); rebuild(); focusRoute(1000);
  };
  $('aar').checked = state.aar;
  $('aar').onchange = e => { state.aar = e.target.checked; state.t = 0; setPlaying(false); rebuild(); syncUrl(); };
  const routeChanged = () => { $('toast').hidden = true; state.t = 0; setPlaying(false); rebuild(); focusRoute(1000); };
  $('fromSel').onchange = e => { const p = findPlace(e.target.value); if (p) { if (S.platform === 'sub') setPlatform('land', true); state.from = p.isBase ? { ...p, countryName: ccName(p.cc) } : p; fillPlaceSelect($('fromSel'), state.from); $('toast').hidden = true; ensureValidVehicles(); state.t = 0; setPlaying(false); rebuild(); focusRoute(1000); } };
  $('toSel').onchange = e => { const p = findPlace(e.target.value); if (p) { state.to = p; fillPlaceSelect($('toSel'), p); routeChanged(); } };
  $('compare').onchange = e => { state.compare = e.target.checked; setDots(); rebuild(); };
  $('exag').onchange = e => { state.exag = +e.target.value; rebuild(); };
  $('follow').onchange = e => { state.follow = e.target.checked; if (!state.follow) focusRoute(800); draw(true); };
  $('pickSeg').onclick = e => { const b = e.target.closest('button'); if (b) setPick(b.dataset.pick); };
  $('speedSeg').onclick = e => { const b = e.target.closest('button'); if (b) { setSpeed(+b.dataset.speed); syncUrl(); } };
  $('playBtn').onclick = () => setPlaying(!state.playing);
  $('resetBtn').onclick = () => { setPlaying(false); state.t = 0; draw(true); };
  $('scrub').oninput = e => { state.t = state.maxEnd * e.target.value / 1000; draw(true); };
  $('panelToggle').onclick = () => $('panel').classList.toggle('collapsed');
  $('camRoute').onclick = () => { state.follow = false; $('follow').checked = false; focusRoute(900); };
  $('camLaunch').onclick = () => focusLaunch(900);
  document.addEventListener('keydown', e => {
    if (document.body.classList.contains('space-mode')) return;
    if (/SELECT|INPUT|TEXTAREA/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!$('vpop').hidden) { if (e.key === 'Escape') closePicker(); return; }
    const k = e.code;
    if (k === 'Space') { e.preventDefault(); setPlaying(!state.playing); }
    else if (k === 'KeyR') { setPlaying(false); state.t = 0; draw(true); }
    else if (k === 'KeyC') focusLaunch(900);
    else if (k === 'KeyV') $('camRoute').click();
    else if (k === 'KeyF') { $('follow').checked = !$('follow').checked; $('follow').onchange({ target: $('follow') }); }
    else if (/^Digit[1-4]$/.test(k)) { setSpeed([1, 10, 100, 1000][+k.slice(5) - 1]); syncUrl(); }
  });

  if (state.from.isBase) state.from = { ...state.from, countryName: ccName(state.from.cc) };
  if (qs.get('platform') === 'sub' && S.SUB_CLASSES[qs.get('sub')]) {
    const cc = qs.get('sub'), ll = parseLL(qs.get('from')), d = S.SUB_DEFAULT_POS[cc];
    S.platform = 'sub'; state.subCC = cc;
    state.from = makeSub(cc, ll ? ll.lat : d[0], ll ? ll.lng : d[1]);
  }
  fillSubSelect(); syncPlatformUI();
  fillPlaceSelect($('fromSel'), state.from);
  ensureValidVehicles();
  rebuild();
  focusRoute(0);
  requestAnimationFrame(frame);
  if (qs.get('t')) { state.t = Math.min(state.maxEnd, +qs.get('t')); draw(true); }
  if (qs.get('autoplay') === '1') setPlaying(true);

  // Small hook for automated checks
  window.__launchSim = { syncUrl, setPlatform, state, draw, setPlaying, globe, openPicker, closePicker, onPick, setPick, showCountry, setLaunchFromBase, focusLaunch, featureAt, rebuild };
})();

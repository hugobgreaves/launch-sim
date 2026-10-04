/* v6 polish layer: day/night Earth, starfield, launch countdown + cinematic camera, WebAudio SFX,
   onboarding guide, collapsible panels, share-link copy, lazy-loaded space mode. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const G = window.__launchSim, globe = G.globe, state = G.state;
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const rad = Math.PI / 180;

  // ================= Live day/night terminator =================
  function sunLatLng(date) { // low-precision solar position (≈0.1°), good for a terminator
    const d = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 864e5;
    const g = (357.529 + 0.98560028 * d) * rad, q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * d) * rad;
    const dec = Math.asin(Math.sin(e) * Math.sin(L)), ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / rad;
    const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24 * 15;
    return { lat: dec / rad, lng: ((ra - gmst + 540) % 360) - 180 };
  }
  const uni = { nightMap: { value: null }, sunDir: { value: [1, 0, 0] } };
  function updateSun() {
    const s = sunLatLng(new Date()), c = globe.getCoords(s.lat, s.lng, 0), n = Math.hypot(c.x, c.y, c.z) || 1;
    uni.sunDir.value[0] = c.x / n; uni.sunDir.value[1] = c.y / n; uni.sunDir.value[2] = c.z / n;
    G.sun = s;
  }
  function setupDayNight() {
    const mat = globe.globeMaterial(), img = new Image();
    img.onload = () => {
      const ready = () => {
        if (!mat.map) return setTimeout(ready, 150);
        const night = new mat.map.constructor(img); night.colorSpace = mat.map.colorSpace; night.anisotropy = 4; night.needsUpdate = true;
        uni.nightMap.value = night; updateSun();
        mat.onBeforeCompile = sh => {
          sh.uniforms.nightMap = uni.nightMap; sh.uniforms.sunDir = uni.sunDir;
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWN;')
            .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vWN = normalize(mat3(modelMatrix) * objectNormal);');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D nightMap;\nuniform vec3 sunDir;\nvarying vec3 vWN;')
            .replace('#include <opaque_fragment>', `
  float sd = dot(normalize(vWN), sunDir);
  float dm = smoothstep(-0.16, 0.10, sd);
  vec3 lights = texture2D(nightMap, vMapUv).rgb;
  vec3 nightCol = outgoingLight * 0.10 + lights * vec3(1.0, 0.82, 0.55) * 1.7;
  float twilight = (1.0 - abs(dm - 0.5) * 2.0) * 0.08;
  outgoingLight = mix(nightCol, outgoingLight * 1.08, dm) + vec3(0.9, 0.45, 0.2) * twilight;
#include <opaque_fragment>`);
        };
        mat.needsUpdate = true;
        setInterval(updateSun, 30000);
        G.dayNightReady = true;
      };
      ready();
    };
    img.src = 'vendor/earth-night.jpg';
  }
  setupDayNight();

  // ================= Starfield =================
  (function stars() {
    const mk = (n, bright) => {
      const c = document.createElement('canvas'), w = 1600, h = 1000; c.width = w; c.height = h; const x = c.getContext('2d');
      if (!bright) { // faint Milky Way band
        const g = x.createLinearGradient(0, h * 0.9, w, h * 0.1);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, 'rgba(120,140,200,0.07)'); g.addColorStop(0.5, 'rgba(160,170,220,0.10)'); g.addColorStop(0.55, 'rgba(120,140,200,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
      }
      for (let i = 0; i < n; i++) {
        const r = bright ? 0.8 + Math.random() * 1.1 : Math.random() * 0.9 + 0.2, t = Math.random();
        x.fillStyle = t < 0.15 ? 'rgba(180,200,255,' : t > 0.9 ? 'rgba(255,220,180,' : 'rgba(255,255,255,';
        x.fillStyle += (bright ? 0.9 : 0.25 + Math.random() * 0.55) + ')';
        x.beginPath(); x.arc(Math.random() * w, Math.random() * h, r, 0, 7); x.fill();
      }
      return c.toDataURL('image/png');
    };
    const el = $('stars');
    el.style.backgroundImage = `url(${mk(1400, false)})`;
    const tw = document.createElement('div'); tw.className = 'stars-twinkle'; tw.style.backgroundImage = `url(${mk(120, true)})`; el.appendChild(tw);
  })();

  // ================= Sound (WebAudio, generated; muted by default) =================
  let ac = null, soundOn = LS.get('ls_sound') === '1';
  const ctx = () => { if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (A) ac = new A(); } if (ac && ac.state === 'suspended') ac.resume(); return ac; };
  function tone(f, dur, type = 'sine', vol = 0.18, when = 0) {
    if (!soundOn || !ctx()) return; const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, f0, f1, vol) {
    if (!soundOn || !ctx()) return; const t = ac.currentTime, n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } // brown noise
    const src = ac.createBufferSource(), lp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buf; lp.type = 'lowpass'; lp.frequency.setValueAtTime(f0, t); lp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(lp).connect(g).connect(ac.destination); src.start(t);
  }
  const SFX = {
    tick: () => tone(880, 0.12, 'sine', 0.15), go: () => { tone(1320, 0.35, 'triangle', 0.18); noise(4.5, 900, 120, 0.9); },
    arrive: () => { tone(784, 0.25, 'sine', 0.14); tone(1175, 0.4, 'sine', 0.12, 0.12); }, stop: () => { tone(160, 0.5, 'sawtooth', 0.08); noise(0.8, 400, 80, 0.4); },
    click: () => tone(1500, 0.04, 'square', 0.04)
  };
  G.sfx = SFX;
  function renderSound() { $('soundBtn').textContent = soundOn ? '🔊 Sound' : '🔇 Sound'; $('soundBtn').setAttribute('aria-pressed', soundOn); $('soundBtn').classList.toggle('on', soundOn); }
  $('soundBtn').onclick = () => { soundOn = !soundOn; LS.set('ls_sound', soundOn ? '1' : '0'); renderSound(); if (soundOn) SFX.arrive(); };
  renderSound();

  // ================= Launch: countdown, liftoff FX, cinematic camera =================
  const CD = 5; let cdTimer = null, cdN = 0, camTimer = null, cdEnd = 0;
  G.countdownLeft = () => cdTimer ? Math.max(0, (cdEnd - performance.now()) / 1000) : 0;
  const H = G.hooks;
  const cinematic = () => $('cinematic').checked;
  function labelLaunch() {
    const b = $('launchBtn');
    if (state.playing) { b.textContent = '❚❚ Pause'; b.classList.add('live'); }
    else if (state.t > 0 && state.t < state.maxEnd) { b.textContent = '▶ Resume'; b.classList.remove('live'); }
    else { b.textContent = '🚀 LAUNCH'; b.classList.remove('live'); }
  }
  H.onPlayState = () => labelLaunch();
  function startCountdown() {
    if (cdTimer) return;
    $('results').hidden = true; G.setPlaying(false); state.t = 0; G.draw(true);
    const names = state.runs.map(r => `${r.label}: ${r.preset.name}`).join(' · ');
    $('cdSub').textContent = names; cdN = CD; $('cdNum').textContent = cdN; $('countdown').hidden = false; $('countdown').classList.remove('liftoff');
    if (cinematic()) G.focusLaunch(1800);
    cdEnd = performance.now() + CD * 1000;
    SFX.tick();
    cdTimer = setInterval(() => {
      cdN--;
      if (cdN > 0) { $('cdNum').textContent = cdN; $('cdNum').classList.remove('pop'); void $('cdNum').offsetWidth; $('cdNum').classList.add('pop'); SFX.tick(); }
      else go();
    }, 1000);
  }
  function stopCountdown() { clearInterval(cdTimer); cdTimer = null; }
  function go() {
    stopCountdown();
    $('cdNum').textContent = 'LIFTOFF'; $('countdown').classList.add('liftoff');
    setTimeout(() => { $('countdown').hidden = true; }, 700);
    SFX.go();
    state.t = 0; state.launchFxUntil = performance.now() + 2600; state.launchRing = null;
    plume();
    G.setPlaying(true);
    clearTimeout(camTimer);
    if (cinematic() && !state.follow) camTimer = setTimeout(() => { if (state.playing && !state.follow) G.focusRoute(2600); }, 2200);
  }
  function plume() {
    const d = document.createElement('div'); d.className = 'mk fx';
    d.innerHTML = '<div class="flash"></div>' + Array.from({ length: 10 }, (_, i) => `<span class="puff" style="--a:${(i / 10) * 360}deg;--d:${0.9 + Math.random() * 0.8}s;--s:${0.7 + Math.random() * 0.8}"></span>`).join('');
    const fx = { el: d, lat: state.from.lat, lng: state.from.lng, alt: 0.003 };
    state.fx = [fx]; G.draw(true);
    setTimeout(() => { state.fx = (state.fx || []).filter(x => x !== fx); G.draw(true); }, 3000);
  }
  H.onArrive = r => { (r.outOfRange ? SFX.stop : SFX.arrive)(); };
  H.onEnd = () => {
    clearTimeout(camTimer);
    const a = state.runs[0];
    if (cinematic() && a && a.preset.kind !== 'orbital' && !state.follow) {
      const e = G.gcFn(a.outOfRange ? a.flyKm : G.routeKm());
      globe.pointOfView({ lat: e.lat - 4, lng: e.lng, altitude: Math.max(1.0, Math.min(2.2, G.routeKm() / 6000 + 0.9)) }, 2000);
    }
  };
  H.onReplay = () => go();
  $('launchBtn').onclick = () => {
    if (cdTimer) return go();
    if (state.playing) G.setPlaying(false);
    else if (state.t > 0 && state.t < state.maxEnd) G.setPlaying(true);
    else startCountdown();
  };
  $('cdSkip').onclick = () => go();
  $('countdown').onclick = e => { if (e.target === $('countdown')) go(); };
  $('lbReset').onclick = () => { stopCountdown(); $('countdown').hidden = true; $('resetBtn').click(); labelLaunch(); };
  document.addEventListener('keydown', e => {
    if (document.body.classList.contains('space-mode') || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (cdTimer && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopImmediatePropagation(); go(); }
    else if ((e.key === 'l' || e.key === 'L') && !e.metaKey && !e.ctrlKey) $('launchBtn').click();
  }, true);
  labelLaunch();
  G.startCountdown = startCountdown; G.go = go;

  // ================= Starship cam (lazy-loaded 3D close-up) =================
  let camP = null;
  function openCam() {
    const b = $('camBtn');
    if (window.__starshipCam) { window.__starshipCam.isOpen() ? window.__starshipCam.close() : window.__starshipCam.open(); return Promise.resolve(); }
    if (!camP) { b.classList.add('loading-tab'); b.textContent = '⏳ Loading 3D…'; try { delete window.__THREE__; } catch (e) {} // globe.gl bundles its own three.js; the 3D cam loads a separate copy on purpose
      camP = import('./starship-cam.js').finally(() => { b.classList.remove('loading-tab'); b.textContent = '🛰 Starship cam'; }); }
    return camP.then(m => m.open()).catch(e => { console.error(e); camP = null; });
  }
  G.openCam = openCam;
  $('camBtn').onclick = () => openCam();
  document.addEventListener('keydown', e => { if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && $('guide').hidden) openCam(); });

  // ================= Share link =================
  H.copyLink = btn => {
    const url = location.href, done = ok => { const t = btn.textContent; btn.textContent = ok ? '✅ Link copied' : '⚠️ Copy failed – link is in the address bar'; setTimeout(() => btn.textContent = t, 1800); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(() => done(true), () => fallback());
    else fallback();
    function fallback() { const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); done(ok); }
  };
  G.copyLink = H.copyLink;

  // ================= Collapsible sidebar sections =================
  const collapsed = JSON.parse(LS.get('ls_collapsed') || '{}');
  document.querySelectorAll('.panel .card').forEach(card => {
    const t = card.querySelector('.card-title'); if (!t) return;
    const key = (t.childNodes[0].textContent || '').trim();
    const chev = document.createElement('span'); chev.className = 'chev'; chev.textContent = '▾'; t.appendChild(chev);
    t.classList.add('collapsible'); t.title = t.title || 'Click to collapse / expand';
    if (collapsed[key]) card.classList.add('collapsed');
    t.addEventListener('click', e => { if (e.target.closest('button') && !e.target.classList.contains('chev')) return; card.classList.toggle('collapsed'); collapsed[key] = card.classList.contains('collapsed'); LS.set('ls_collapsed', JSON.stringify(collapsed)); });
  });

  // ================= Lazy-loaded space mode =================
  let spaceP = null;
  function loadSpace() {
    if (window.__space) return Promise.resolve();
    if (spaceP) return spaceP;
    const tab = document.querySelector('#modeTabs [data-mode="space"]'); tab.classList.add('loading-tab');
    spaceP = ['vendor/astronomy.browser.min.js', 'space-core.js', 'space.js'].reduce((p, src) => p.then(() => new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Failed to load ' + src)); document.body.appendChild(s);
    })), Promise.resolve()).finally(() => tab.classList.remove('loading-tab'));
    return spaceP;
  }
  G.loadSpace = loadSpace;
  $('modeTabs').onclick = e => { // replaced by space.js's own handler once loaded
    const b = e.target.closest('button'); if (!b || b.dataset.mode !== 'space') return;
    stopCountdown(); $('countdown').hidden = true;
    loadSpace().then(() => window.__space.setMode('space')).catch(e => console.error(e));
  };
  if (new URLSearchParams(window.__initialSearch || '').get('mode') === 'space') {
    const ld = $('loading'); ld.classList.add('hold'); const sub = ld.querySelector('.ld-sub'); if (sub) sub.textContent = 'Loading space mode: ephemerides & mission planner…';
    loadSpace().catch(e => console.error(e)).finally(() => ld.classList.remove('hold'));
  }

  // ================= First-time guide =================
  const STEPS = [
    { title: 'Welcome to Launch Speed Simulator', body: 'An educational sandbox for comparing how fast rockets, missiles and aircraft travel – <b>speed, range and altitude only</b>. Here is a 30-second tour.' },
    { sel: '#panel .card.globe-only', title: '🌍 Globe mode', body: 'Pick a launch point and destination from the lists or tap the globe. Vehicles follow the launch country\'s own &amp; allied equipment, and published maximum ranges are enforced (dashed range rings).' },
    { sel: '#platSeg', title: '🚢 Submarine launches', body: 'Switch to <b>Submarine</b>, choose the navy, then tap anywhere at sea. Only submarine-launched missiles are offered.' },
    { sel: '#pickSeg [data-pick="country"]', title: '🎖 Countries &amp; bases', body: 'Choose <b>Country</b>, then tap a country to highlight it and show its major military bases. Click a base to launch from it.' },
    { sel: '#modeTabs', title: '🪐 Space missions', body: 'Fly Starship to the Moon or Mars on real planetary positions, with computed launch windows and orbital-refuelling estimates.' },
    { sel: '#camBtn', title: '🛰 Starship cam', body: 'Zoom right in on a detailed 3D Starship: the pad at Starbase, liftoff, Mach diamonds, hot staging, the booster flipping back and – in Space missions – Mars entry. Drag to orbit, scroll to zoom, or press <kbd>C</kbd>.' },
    { sel: '#launchBar', title: '🚀 Launch!', body: 'Press <b>LAUNCH</b> (or <kbd>L</kbd>) for a skippable countdown and a cinematic flight. Sound is off by default – toggle it in the top bar. Reopen this guide with <b>❔ Guide</b>.' }
  ];
  let step = 0;
  function showGuide(i = 0) {
    if (document.body.classList.contains('space-mode')) return;
    step = i; const s = STEPS[step], g = $('guide'); g.hidden = false;
    const tgt = s.sel && document.querySelector(s.sel), r = tgt && tgt.getBoundingClientRect();
    const spot = r ? `<div class="g-spot" style="left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px"></div>` : '<div class="g-dim"></div>';
    let cx = innerWidth / 2 - 170, cy = innerHeight / 2 - 110;
    if (r) { cx = r.left > innerWidth / 2 ? r.left - 360 : r.right + 18; cy = Math.min(innerHeight - 240, Math.max(16, r.top)); if (r.top > innerHeight - 160) { cx = Math.max(16, r.left + r.width / 2 - 170); cy = r.top - 230; } }
    g.innerHTML = `${spot}<div class="g-card" style="left:${Math.max(12, Math.min(innerWidth - 352, cx))}px;top:${cy}px">
      <div class="g-step">${step + 1} / ${STEPS.length}</div><div class="g-title">${s.title}</div><div class="g-body">${s.body}</div>
      <div class="g-actions"><button class="btn small-btn" data-g="skip">Skip tour</button><span></span>${step ? '<button class="btn small-btn" data-g="back">Back</button>' : ''}<button class="btn primary small-btn" data-g="next">${step === STEPS.length - 1 ? 'Done' : 'Next'}</button></div></div>`;
  }
  function endGuide() { $('guide').hidden = true; LS.set('ls_guide_done', '1'); }
  $('guide').onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; const a = b.dataset.g; if (a === 'next') step < STEPS.length - 1 ? showGuide(step + 1) : endGuide(); else if (a === 'back') showGuide(step - 1); else endGuide(); };
  document.addEventListener('keydown', e => { if (!$('guide').hidden && e.key === 'Escape') endGuide(); });
  window.addEventListener('resize', () => { if (!$('guide').hidden) showGuide(step); });
  $('helpBtn').onclick = () => { if (document.body.classList.contains('space-mode')) document.querySelector('#modeTabs [data-mode="globe"]').click(); setTimeout(() => showGuide(0), 50); };
  G.showGuide = showGuide;
  const firstVisit = !LS.get('ls_guide_done') && !navigator.webdriver && new URLSearchParams(window.__initialSearch || '').get('mode') !== 'space';
  if (firstVisit) setTimeout(() => showGuide(0), 1400);
})();

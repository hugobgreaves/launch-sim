/* v7: Focus / clean view (button, H key) and the phone layout helpers (bottom sheet, compact readouts). */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), G = window.__launchSim, Sim = window.LaunchSim, body = document.body;
  if (!G) return;
  const fmtInt = n => Math.round(n).toLocaleString('en-GB');
  const typing = e => /INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || '');
  const camOpen = () => !!(window.__starshipCam && window.__starshipCam.isOpen());
  const spaceOn = () => body.classList.contains('space-mode') && window.__space && window.__space.mission;
  const kick = () => requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));

  // ================= Focus / clean view =================
  const hud = $('focusHud'), btn = $('focusBtn');
  let on = false, timer = 0;
  function clock(t) { t = Math.max(0, Math.round(t)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return 'T+' + (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); }
  function spaceClock(t) { const neg = t < 0; t = Math.abs(t); const d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60); return (neg ? 'T−' : 'T+') + (d ? d + 'd ' + h + 'h' : h + 'h ' + String(m).padStart(2, '0') + 'm'); }
  function update() {
    let spd = '', time = '', playing = false, col = '#38bdf8';
    if (camOpen()) {
      const r = $('scam'), s = r && r.querySelector('[data-k="spd"]'), m = r && r.querySelector('.scam-met');
      spd = s ? s.textContent : ''; time = m ? m.textContent : ''; col = '#f59e0b';
      playing = body.classList.contains('space-mode') ? !!(window.__space && window.__space.playing) : G.state.playing;
    } else if (spaceOn()) {
      const S = window.__space, st = S.mission.at(S.t);
      spd = fmtInt(st.speed * 3600) + ' km/h <small style="color:#94a3b8">vs Sun</small>'; time = spaceClock(S.t); playing = S.playing;
    } else {
      const st = G.state, runs = st.runs || [];
      spd = runs.map(r => { const s = Sim.stateAt(r, st.t); return `<b style="color:${r.color}">${r.label}</b> ${fmtInt(s.v)}`; }).join('  ') + ' km/h';
      time = clock(st.t); playing = st.playing; col = runs[0] ? runs[0].color : col;
    }
    $('fhSpeed').innerHTML = spd; $('fhTime').textContent = time; $('fhDot').style.background = col;
    $('fhPlay').textContent = playing ? '❚❚' : '▶';
  }
  function setFocus(v) {
    v = !!v; if (v === on) return; on = v;
    body.classList.toggle('focus', on); hud.hidden = !on;
    if (btn) { btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on); }
    if (on) { if (!$('vpop').hidden && G.closePicker) G.closePicker(); update(); timer = setInterval(update, 200); }
    else { clearInterval(timer); }
    if (G.updateRings) G.updateRings();
    kick();
  }
  const toggle = () => setFocus(!on);
  window.__focus = { toggle, set: setFocus, get on() { return on; } };
  if (btn) btn.onclick = toggle;
  $('fhExit').onclick = () => setFocus(false);
  $('fhPlay').onclick = () => {
    if (body.classList.contains('space-mode')) { const S = window.__space; if (S && S.setPlaying) S.setPlaying(!S.playing); }
    else $('launchBtn').click();
    setTimeout(update, 30);
  };
  window.addEventListener('keydown', e => {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey || !$('guide').hidden) return;
    if (e.code === 'KeyH') { e.preventDefault(); toggle(); }
    else if (e.key === 'Escape' && on) { e.preventDefault(); e.stopImmediatePropagation(); setFocus(false); }
  }, true);

  // ================= Phone layout =================
  const mq = window.matchMedia('(max-width: 820px)');
  const panel = $('panel'), tog = $('panelToggle'), root = document.documentElement;
  let sheet = 'peek';
  const PEEK = 58;
  const snapH = k => k === 'peek' ? PEEK : k === 'half' ? Math.round(innerHeight * 0.48) : Math.max(PEEK, innerHeight - 150);
  function setSheet(k, quiet) {
    sheet = k; panel.dataset.sheet = k; panel.classList.toggle('collapsed', k === 'peek');
    tog.setAttribute('aria-expanded', k !== 'peek');
    root.style.setProperty('--sheet-h', snapH(k) + 'px');
    if (!quiet) kick();
  }
  window.__sheet = { set: k => setSheet(k), state: () => sheet, phone: () => mq.matches };
  // drag the handle to resize the sheet, tap to toggle (peek ↔ half)
  let drag = null;
  tog.onclick = null;
  tog.addEventListener('click', e => { e.preventDefault(); if (!mq.matches) return; if (drag && drag.moved) return; });
  tog.addEventListener('pointerdown', e => {
    if (!mq.matches) return;
    drag = { y: e.clientY, h: panel.getBoundingClientRect().height, moved: false };
    try { tog.setPointerCapture(e.pointerId); } catch (er) {}
  });
  tog.addEventListener('pointermove', e => {
    if (!drag) return; const dy = drag.y - e.clientY;
    if (!drag.moved && Math.abs(dy) < 6) return;
    drag.moved = true; panel.classList.add('dragging');
    panel.style.height = Math.max(PEEK, Math.min(innerHeight - 90, drag.h + dy)) + 'px';
  });
  const endDrag = e => {
    if (!drag) return; const d = drag; drag = d.moved ? { moved: true } : null; setTimeout(() => { drag = null; }, 0);
    panel.classList.remove('dragging');
    if (!d.moved) { if (e.type === 'pointerup') setSheet(sheet === 'peek' ? 'half' : 'peek'); return; }
    const h = panel.getBoundingClientRect().height; panel.style.height = '';
    const best = ['peek', 'half', 'full'].map(k => [k, Math.abs(snapH(k) - h)]).sort((a, b) => a[1] - b[1])[0][0];
    setSheet(best);
  };
  tog.addEventListener('pointerup', endDrag); tog.addEventListener('pointercancel', endDrag);
  tog.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && mq.matches) { e.preventDefault(); setSheet(sheet === 'peek' ? 'half' : 'peek'); } });

  // sheet summary line and compact readouts (tap a readout chip to expand / collapse it)
  const short = p => p ? String(p.name || p.label || '').split(/[\/(,]/)[0].trim() : '';
  function summary() {
    if (!mq.matches) return;
    let t;
    if (body.classList.contains('space-mode')) t = '🪐 Mission, dates & playback';
    else { const s = G.state; t = s.from && s.to && s.a ? `${short(s.from)} → ${short(s.to)} · ${s.a.name}${s.b ? ' vs ' + s.b.name : ''}` : 'Route, vehicles & settings'; }
    const el = $('sheetSum'); if (el.textContent !== t) el.textContent = t;
    const sp = $('spPlay'), mp = $('mSpPlay'); if (sp && mp && mp.textContent !== sp.textContent) mp.textContent = sp.textContent;
  }
  setInterval(summary, 700);
  ['readouts', 'spaceReadouts'].forEach(id => $(id).addEventListener('click', e => { if (mq.matches && !e.target.closest('a,button')) $(id).classList.toggle('ro-open'); }));
  $('mSpPlay').onclick = () => { const b = $('spPlay'); if (b) b.click(); setTimeout(summary, 30); };
  $('mSpFit').onclick = () => { const b = $('spFit'); if (b) b.click(); };

  // relayout the globe / space canvas when overlays that change the free area open or close
  let lastCls = '';
  new MutationObserver(() => {
    const k = ['mc-open', 'space-mode', 'scam-open', 'focus'].map(c => body.classList.contains(c) ? c : '').join();
    if (k !== lastCls) { lastCls = k; kick(); }
  }).observe(body, { attributes: true, attributeFilter: ['class'] });

  function applyMq() {
    body.classList.toggle('is-phone', mq.matches);
    if (mq.matches) { setSheet(sheet, true); summary(); } else { root.style.removeProperty('--sheet-h'); panel.style.height = ''; }
    kick();
  }
  (mq.addEventListener ? mq.addEventListener('change', applyMq) : mq.addListener(applyMq));
  window.addEventListener('resize', () => { if (mq.matches) root.style.setProperty('--sheet-h', snapH(sheet) + 'px'); });
  applyMq();
})();

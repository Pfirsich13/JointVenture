/* =========================================================================
   hub.js – Startseite: Spiele, Spielstände, Projekte, Anmeldung
   Neues Spiel: unten in GAMES eintragen und ein Modul window.Games.<id>
   mit start(el, hub) und stop() bereitstellen.
   Neues Projekt: unten in PROJECTS eintragen (p = Fortschritt in Prozent).
   ========================================================================= */
(function () {
  const SITE = window.SITE || { name: 'JointVenture' };
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Spielbilder (eigene Zeichnungen) ---------- */
  const COVER = {
    airhockey: `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="cA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2550"/><stop offset="1" stop-color="#0d0f18"/></linearGradient><radialGradient id="cAg" cx=".3" cy=".55" r=".35"><stop offset="0" stop-color="#4c7dff" stop-opacity=".55"/><stop offset="1" stop-color="#4c7dff" stop-opacity="0"/></radialGradient><radialGradient id="cAr" cx=".72" cy=".42" r=".3"><stop offset="0" stop-color="#ff4d5e" stop-opacity=".5"/><stop offset="1" stop-color="#ff4d5e" stop-opacity="0"/></radialGradient></defs><rect width="320" height="200" fill="url(#cA)"/><rect x="34" y="34" width="252" height="132" rx="22" fill="#121624" stroke="rgba(255,255,255,.18)" stroke-width="2"/><line x1="160" y1="34" x2="160" y2="166" stroke="rgba(255,255,255,.25)" stroke-width="2" stroke-dasharray="6 6"/><circle cx="160" cy="100" r="24" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="2"/><rect width="320" height="200" fill="url(#cAg)"/><rect width="320" height="200" fill="url(#cAr)"/><circle cx="96" cy="110" r="17" fill="#4c7dff"/><circle cx="96" cy="110" r="7" fill="#2f4fc0"/><circle cx="230" cy="84" r="17" fill="#ff4d5e"/><circle cx="230" cy="84" r="7" fill="#c42b3c"/><path d="M128 96l40-10" stroke="rgba(255,255,255,.35)" stroke-width="6" stroke-linecap="round"/><circle cx="178" cy="84" r="8" fill="#f2f4fa"/></svg>`,
    reaction: `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="cR" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#3a1220"/><stop offset="1" stop-color="#0e0c12"/></radialGradient><radialGradient id="cRg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#3ddc97" stop-opacity=".8"/><stop offset="1" stop-color="#3ddc97" stop-opacity="0"/></radialGradient></defs><rect width="320" height="200" fill="url(#cR)"/><g fill="none" stroke="rgba(61,220,151,.25)" stroke-width="2"><circle cx="160" cy="100" r="56"/><circle cx="160" cy="100" r="76"/><circle cx="160" cy="100" r="96"/></g><circle cx="160" cy="100" r="60" fill="url(#cRg)"/><circle cx="160" cy="100" r="34" fill="#3ddc97"/><path d="M154 80l18-4-10 18 12-2-22 30 6-22-12 2z" fill="#0e0c12"/></svg>`,
    bomber: `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="cB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b1640"/><stop offset="1" stop-color="#120d18"/></linearGradient><radialGradient id="cBg" cx=".62" cy=".42" r=".25"><stop offset="0" stop-color="#ffb347" stop-opacity=".9"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient></defs><rect width="320" height="200" fill="url(#cB)"/><g fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.12)"><rect x="24" y="24" width="40" height="40" rx="6"/><rect x="88" y="24" width="40" height="40" rx="6"/><rect x="216" y="24" width="40" height="40" rx="6"/><rect x="24" y="136" width="40" height="40" rx="6"/><rect x="152" y="136" width="40" height="40" rx="6"/><rect x="256" y="136" width="40" height="40" rx="6"/></g><rect width="320" height="200" fill="url(#cBg)"/><circle cx="170" cy="112" r="26" fill="#0b0a10" stroke="rgba(255,255,255,.2)" stroke-width="2"/><path d="M186 92q10-18 24-12" fill="none" stroke="#c9a27a" stroke-width="4"/><circle cx="212" cy="80" r="6" fill="#ffd27a"/><rect x="74" y="96" width="28" height="30" rx="8" fill="#4c7dff"/><rect x="248" y="88" width="28" height="30" rx="8" fill="#ff4d5e"/></svg>`,
    arena: `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="cX" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a140d"/><stop offset="1" stop-color="#0d0b09"/></linearGradient><radialGradient id="cXg" cx=".5" cy=".78" r=".55"><stop offset="0" stop-color="#d8a85a" stop-opacity=".55"/><stop offset="1" stop-color="#d8a85a" stop-opacity="0"/></radialGradient></defs><rect width="320" height="200" fill="url(#cX)"/><rect width="320" height="200" fill="url(#cXg)"/><ellipse cx="160" cy="160" rx="140" ry="30" fill="#2a2016" stroke="rgba(216,168,90,.5)" stroke-width="2"/><rect x="102" y="96" width="38" height="52" rx="6" fill="#4c7dff"/><rect x="180" y="96" width="38" height="52" rx="6" fill="#ff4d5e"/><path d="M144 108l40-22" stroke="#e8ecf5" stroke-width="5" stroke-linecap="round"/><path d="M176 116l-34 20" stroke="#aeb6c8" stroke-width="5" stroke-linecap="round"/><circle cx="160" cy="104" r="4" fill="#fff"/></svg>`,
    zombie: `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="cZ" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14201a"/><stop offset="1" stop-color="#0a0d0b"/></linearGradient><radialGradient id="cZm" cx=".82" cy=".22" r=".25"><stop offset="0" stop-color="#e9f3df" stop-opacity=".5"/><stop offset="1" stop-color="#e9f3df" stop-opacity="0"/></radialGradient></defs><rect width="320" height="200" fill="url(#cZ)"/><rect width="320" height="200" fill="url(#cZm)"/><circle cx="262" cy="44" r="16" fill="#e9f3df"/><path d="M0 168q80-16 160 0t160 0V200H0z" fill="#101712"/><g fill="#6f8f5a"><rect x="184" y="94" width="26" height="34" rx="7"/><rect x="236" y="104" width="24" height="30" rx="7"/></g><g fill="#3b3352"><rect x="187" y="126" width="20" height="38" rx="5"/><rect x="239" y="132" width="18" height="34" rx="5"/></g><path d="M184 108h-20M210 108h18M236 116h-16" stroke="#6f8f5a" stroke-width="6" stroke-linecap="round"/><g fill="#ff4d5e"><circle cx="193" cy="106" r="2.5"/><circle cx="202" cy="106" r="2.5"/><circle cx="244" cy="115" r="2.5"/><circle cx="252" cy="115" r="2.5"/></g><rect x="48" y="104" width="26" height="34" rx="7" fill="#4c7dff"/><rect x="72" y="116" width="26" height="7" rx="3" fill="#cfd5e3"/><path d="M104 119l18-6v12z" fill="#ffd27a"/><path d="M126 119h40" stroke="#ffd27a" stroke-width="3" stroke-dasharray="5 6" opacity=".8"/></svg>`
  };

  const GAMES = [
    { id: 'airhockey', title: 'Air-Hockey', live: true, desc: 'Schnell, laut, gemein. Wer zuerst 7 Tore hat, gewinnt.' },
    { id: 'reaction', title: 'Reaktionsduell', desc: 'Warte aufs Signal und tippe schneller als der andere.' },
    { id: 'bomber', title: 'Mini-Bomber', desc: 'Bomben legen, Wände sprengen, den anderen erwischen.' },
    { id: 'arena', title: 'Arena-PvP', desc: 'Das 3D-Kampfspiel aus dem Projekt deines Bruders.' },
    { id: 'zombie', title: 'Zombie-Shooter', desc: 'Welle um Welle gegen Horden, allein oder zusammen.' }
  ];

  /* Projekte, an denen gerade gebaut wird (p = Fortschritt in %) */
  const PROJECTS = [
    { t: 'Anmeldung & Spielstände', who: 'Ron', p: 90, s: 'Supabase verbunden, Tabellen stehen', n: 'Auf beiden Handys registrieren und testen' },
    { t: 'Arena-PvP', who: 'Bruder', p: 25, s: 'Prototyp mit Würfeln läuft', n: 'Thema wählen: Gladiatoren, Mechs oder Magier' },
    { t: 'Reaktionsduell', who: 'Ron', p: 5, s: 'Geplant', n: 'Als nächstes Spiel bauen' },
    { t: 'Mini-Bomber', who: 'offen', p: 0, s: 'Idee', n: 'Regeln und Karte festlegen' },
    { t: 'Zombie-Shooter (PvE)', who: 'offen', p: 0, s: 'Idee', n: 'Für viele Spieler später eigener Server' }
  ];

  /* ---------- Speicher auf diesem Gerät ---------- */
  const KEY = 'duellhalle_v1';
  let store = { name: '', opp: '', stats: {}, history: [] };
  try { const raw = localStorage.getItem(KEY); if (raw) store = Object.assign(store, JSON.parse(raw)); } catch (e) { }
  if (!Array.isArray(store.history)) store.history = [];
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { } }

  let cloud = null;   // Ergebnisse aus Supabase, wenn angemeldet

  const hub = {
    intent: null,
    getName: () => (window.Auth && Auth.user() && Auth.name()) || store.name || 'Spieler',
    recordResult(game, kind, won, oppName, scoreText) {
      const g = store.stats[game] || (store.stats[game] = {});
      const k = g[kind] || (g[kind] = { w: 0, l: 0 });
      won ? k.w++ : k.l++;
      if (kind === 'online' && oppName) store.opp = String(oppName).slice(0, 20);
      const entry = { g: game, k: kind, w: !!won, o: String(oppName || '').slice(0, 20), s: String(scoreText || '').slice(0, 9), t: Date.now() };
      store.history.unshift(entry); store.history = store.history.slice(0, 30); save();
      if (window.Auth && Auth.user()) {
        Auth.saveResult({ game, mode: kind, won, score: scoreText, opponent: oppName }).then((ok) => { if (ok) refreshCloud(); });
      }
    },
    statsFor(game) { return store.stats[game] || {}; },
    back() { if (location.hash) history.replaceState(null, '', location.pathname + location.search); route(); }
  };
  window.Hub = hub;

  /* ---------- Darstellung ---------- */
  function applyName() {
    document.title = SITE.name;
    document.querySelectorAll('.site-name').forEach((n) => { n.textContent = SITE.name; });
    if (SITE.tagline) $('#tagline').textContent = SITE.tagline;
  }
  function renderGames() {
    $('#games').innerHTML = GAMES.map((g) => `
      <button class="game ${g.live ? '' : 'soon'}" type="button" data-id="${g.id}">
        <span class="cover" aria-hidden="true">${COVER[g.id] || ''}</span>
        <span class="meta">
          <span class="t"><b>${esc(g.title)}</b><span class="pill ${g.live ? 'ok' : ''}">${g.live ? 'Spielbar' : 'Bald'}</span></span>
          <span class="d">${esc(g.desc)}</span>
        </span>
      </button>`).join('');
  }
  function renderProjects() {
    $('#projects').innerHTML = PROJECTS.map((p) => `
      <article class="proj">
        <div class="t"><b>${esc(p.t)}</b><span class="who">${esc(p.who)}</span></div>
        <div class="bar" role="progressbar" aria-valuenow="${p.p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(2, p.p)}%"></i></div>
        <div class="row"><span>${esc(p.s)}</span><span>${p.p} %</span></div>
        <div class="next">Nächster Schritt: ${esc(p.n)}</div>
      </article>`).join('');
  }
  const gameTitle = (id) => (GAMES.find((g) => g.id === id) || { title: id }).title;
  function ago(t) {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'gerade eben'; if (m < 60) return `vor ${m} Min.`;
    const h = Math.round(m / 60); if (h < 24) return `vor ${h} Std.`;
    const d = Math.round(h / 24); return d === 1 ? 'gestern' : `vor ${d} Tagen`;
  }
  function results() {
    if (cloud) return cloud.map((r) => ({ g: r.game, k: r.mode, w: r.won, o: r.opponent, s: r.score, t: Date.parse(r.created_at) }));
    return store.history;
  }
  function renderStand() {
    const list = results();
    const online = list.filter((r) => r.k === 'online');
    const w = online.filter((r) => r.w).length, l = online.length - w;
    const signedIn = window.Auth && Auth.user();
    const canLogin = window.Auth && Auth.ready;
    $('#tMe').textContent = w; $('#tOp').textContent = l;
    $('#tMeName').textContent = hub.getName(); $('#tOpName').textContent = store.opp || 'Gegner';
    $('#standHint').textContent = signedIn ? `Gespeichert in deinem Konto, ${hub.getName()}.` : 'Auf diesem Gerät gespeichert.';
    const rate = w + l ? Math.round((w / (w + l)) * 100) : 0;
    const loginBox = signedIn ? '' : `<div class="login-cta"><span>${canLogin ? 'Melde dich an, damit deine Spielstände auf jedem Gerät da sind.' : 'Anmeldung kommt in Kürze. Bis dahin zählt dieses Gerät mit.'}</span>${canLogin ? '<button class="btn primary" type="button" data-login>Anmelden</button>' : ''}</div>`;
    const recent = list.slice(0, 8);
    $('#standBox').innerHTML = `
      <div class="panel">
        <h3>Online-Bilanz</h3>
        <div class="big-score"><strong class="w">${w}</strong><span>Siege</span><strong class="l">${l}</strong><span>Niederlagen</span></div>
        <div class="rate" aria-label="Siegquote ${rate} Prozent"><i style="width:${w + l ? rate : 50}%"></i></div>
        <p class="hint">${w + l ? `Siegquote ${rate} %` : 'Noch kein Online-Duell gespielt.'}</p>
        ${loginBox}
      </div>
      <div class="panel">
        <h3>Letzte Spiele</h3>
        ${recent.length ? `<ol class="hist">${recent.map((r) => `<li><span><b>${esc(gameTitle(r.g))} gegen ${esc(r.o || (r.k === 'bot' ? 'Bot' : 'Gegner'))}</b><small>${r.k === 'online' ? 'Online' : r.k === 'bot' ? 'Training' : 'Lokal'} · ${ago(r.t)}</small></span><span class="sc">${esc(r.s || '')}</span><span class="res ${r.w ? 'w' : 'l'}">${r.w ? 'Sieg' : 'Niederlage'}</span></li>`).join('')}</ol>` : '<p class="empty">Noch keine Spiele. Fordere deinen Bruder heraus!</p>'}
      </div>`;
  }
  function renderAccount() {
    const u = window.Auth && Auth.user();
    $('#acctTxt').textContent = u ? hub.getName() : (window.Auth && Auth.ready ? 'Anmelden' : hub.getName());
    $('#acctAv').textContent = (hub.getName()[0] || '?').toUpperCase();
  }
  function renderAll() { renderAccount(); renderStand(); }
  async function refreshCloud() {
    cloud = window.Auth && Auth.user() ? await Auth.loadResults() : null;
    renderAll();
  }

  /* ---------- Fenster: Anmelden / Registrieren / Name ---------- */
  function sheet(html) {
    const el = document.createElement('div'); el.className = 'sheet'; el.innerHTML = `<div class="box">${html}</div>`;
    el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-close]')) el.remove(); });
    document.body.appendChild(el); return el;
  }
  function openAccount() {
    if (!window.Auth || !Auth.ready) return askName(false);
    if (Auth.user()) {
      const el = sheet(`<h3>${esc(hub.getName())}</h3><p>Angemeldet als ${esc(Auth.user().email || '')}</p>
        <div class="row"><button class="btn" type="button" data-close>Schließen</button><button class="btn danger" type="button" data-out>Abmelden</button></div>`);
      el.querySelector('[data-out]').onclick = async () => { await Auth.signOut(); el.remove(); };
      return;
    }
    let mode = 'in';
    const el = sheet(`<h3>Willkommen</h3><p>Melde dich an, damit deine Spielstände gespeichert werden.</p>
      <div class="tabs" role="tablist"><button type="button" role="tab" data-t="in" aria-selected="true">Anmelden</button><button type="button" role="tab" data-t="up" aria-selected="false">Registrieren</button></div>
      <form novalidate>
        <input class="field" name="name" placeholder="Dein Name" maxlength="16" autocomplete="nickname" hidden>
        <input class="field" name="email" type="email" placeholder="E-Mail" autocomplete="email" required>
        <input class="field" name="pw" type="password" placeholder="Passwort (mind. 6 Zeichen)" autocomplete="current-password" required>
        <p class="msg" aria-live="polite"></p>
        <div class="row"><button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary" type="submit">Anmelden</button></div>
      </form>`);
    const f = el.querySelector('form'), msg = el.querySelector('.msg'), submit = f.querySelector('[type=submit]');
    el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => {
      mode = b.dataset.t;
      el.querySelectorAll('[data-t]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      f.elements.name.hidden = mode !== 'up'; submit.textContent = mode === 'up' ? 'Konto erstellen' : 'Anmelden';
      f.elements.pw.autocomplete = mode === 'up' ? 'new-password' : 'current-password'; msg.textContent = '';
    }; });
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); msg.className = 'msg'; msg.textContent = '';
      const name = f.elements.name.value.trim(), email = f.elements.email.value.trim(), pw = f.elements.pw.value;
      if (mode === 'up' && !name) { msg.textContent = 'Bitte gib einen Namen ein.'; return; }
      if (!email || !pw) { msg.textContent = 'Bitte E-Mail und Passwort eingeben.'; return; }
      submit.disabled = true;
      try {
        if (mode === 'up') {
          const r = await Auth.signUp(name, email, pw);
          if (r.needsConfirm) { msg.className = 'msg good'; msg.textContent = 'Fast geschafft: Bestätige den Link in deiner E-Mail und melde dich dann an.'; submit.disabled = false; return; }
        } else await Auth.signIn(email, pw);
        el.remove();
      } catch (err) { msg.textContent = err.message; submit.disabled = false; }
    });
    setTimeout(() => f.elements.email.focus(), 50);
  }
  function askName(first) {
    const el = sheet(`<h3>${first ? 'Wie heißt du?' : 'Dein Name'}</h3><p>So sieht dich dein Gegner im Spiel.</p>
      <form><input class="field" name="n" maxlength="16" autocomplete="nickname" placeholder="Dein Name">
      <div class="row">${first ? '' : '<button class="btn" type="button" data-close>Abbrechen</button>'}<button class="btn primary" type="submit">Speichern</button></div></form>`);
    const f = el.querySelector('form'); f.elements.n.value = store.name;
    f.addEventListener('submit', (e) => { e.preventDefault(); const v = f.elements.n.value.trim().slice(0, 16); if (!v) return; store.name = v; save(); el.remove(); renderAll(); });
    setTimeout(() => f.elements.n.focus(), 50);
  }

  /* ---------- Live-Vorschau: zwei Bots spielen Air-Hockey ---------- */
  const demo = (() => {
    const cv = $('#demo'); if (!cv) return { pause() { }, resume() { } };
    const cx = cv.getContext('2d');
    const T = { w: 1.7, h: 1 }, pr = 0.045, Rp = 0.08;
    let puck = { x: 0.85, y: 0.5, vx: 1.1, vy: 0.6 }, A = { x: 0.2, y: 0.5 }, B = { x: 1.5, y: 0.5 }, trail = [], raf = 0, on = false, last = 0;
    function step(dt) {
      puck.x += puck.vx * dt; puck.y += puck.vy * dt;
      if (puck.y < pr || puck.y > T.h - pr) { puck.vy *= -1; puck.y = Math.max(pr, Math.min(T.h - pr, puck.y)); }
      if (puck.x < pr || puck.x > T.w - pr) {
        if (Math.abs(puck.y - 0.5) < 0.17) { puck = { x: T.w / 2, y: 0.5, vx: (Math.random() < 0.5 ? -1 : 1) * 0.9, vy: (Math.random() - 0.5) * 1.2 }; trail = []; return; }
        puck.vx *= -1; puck.x = Math.max(pr, Math.min(T.w - pr, puck.x));
      }
      for (const [p, home, dir] of [[A, 0.18, 1], [B, T.w - 0.18, -1]]) {
        const mine = dir > 0 ? puck.x < T.w / 2 : puck.x > T.w / 2;
        const tx = mine ? puck.x - dir * 0.07 : home, ty = mine ? puck.y : 0.5 + (puck.y - 0.5) * 0.5;
        p.x += Math.max(-1.3 * dt, Math.min(1.3 * dt, tx - p.x)); p.y += Math.max(-1.3 * dt, Math.min(1.3 * dt, ty - p.y));
        const dx = puck.x - p.x, dy = puck.y - p.y, d = Math.hypot(dx, dy);
        if (d < pr + Rp && d > 0) { const nx = dx / d, ny = dy / d; puck.x = p.x + nx * (pr + Rp); puck.y = p.y + ny * (pr + Rp); const sp = 1.6 + Math.random() * 0.8; puck.vx = nx * sp + dir * 0.4; puck.vy = ny * sp; }
      }
      trail.push({ x: puck.x, y: puck.y }); if (trail.length > 12) trail.shift();
    }
    function rr(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
    function draw() {
      const W = cv.clientWidth, H = cv.clientHeight, d = Math.min(devicePixelRatio || 1, 2);
      if (!W || !H) return;
      if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
      cx.setTransform(d, 0, 0, d, 0, 0);
      const bg = cx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#141a33'); bg.addColorStop(1, '#0c0d12'); cx.fillStyle = bg; cx.fillRect(0, 0, W, H);
      const top = 52, bot = W < 520 ? 58 : 66, s = Math.min((W - 40) / T.w, (H - top - bot) / T.h), ox = (W - T.w * s) / 2, oy = top + (H - top - bot - T.h * s) / 2;
      cx.fillStyle = '#121624'; cx.strokeStyle = 'rgba(255,255,255,.16)'; cx.lineWidth = 2; rr(ox, oy, T.w * s, T.h * s, 18); cx.fill(); cx.stroke();
      cx.strokeStyle = 'rgba(255,255,255,.2)'; cx.setLineDash([7, 7]); cx.beginPath(); cx.moveTo(ox + T.w * s / 2, oy + 6); cx.lineTo(ox + T.w * s / 2, oy + T.h * s - 6); cx.stroke(); cx.setLineDash([]);
      cx.beginPath(); cx.arc(ox + T.w * s / 2, oy + T.h * s / 2, 0.14 * s, 0, 7); cx.stroke();
      cx.fillStyle = 'rgba(76,125,255,.6)'; cx.fillRect(ox - 3, oy + (0.5 - 0.17) * s, 4, 0.34 * s);
      cx.fillStyle = 'rgba(255,77,94,.6)'; cx.fillRect(ox + T.w * s - 1, oy + (0.5 - 0.17) * s, 4, 0.34 * s);
      for (let i = 0; i < trail.length; i++) { cx.fillStyle = `rgba(242,244,250,${(i / trail.length) * 0.18})`; cx.beginPath(); cx.arc(ox + trail[i].x * s, oy + trail[i].y * s, pr * s * (0.4 + i / trail.length * 0.6), 0, 7); cx.fill(); }
      const pad = (p, c, c2) => {
        cx.save(); cx.shadowColor = c; cx.shadowBlur = 18;
        cx.fillStyle = c; cx.beginPath(); cx.arc(ox + p.x * s, oy + p.y * s, Rp * s, 0, 7); cx.fill(); cx.restore();
        cx.fillStyle = c2; cx.beginPath(); cx.arc(ox + p.x * s, oy + p.y * s, Rp * s * 0.42, 0, 7); cx.fill();
      };
      pad(A, '#4c7dff', '#2f4fc0'); pad(B, '#ff4d5e', '#c42b3c');
      cx.save(); cx.shadowColor = '#fff'; cx.shadowBlur = 12; cx.fillStyle = '#f2f4fa'; cx.beginPath(); cx.arc(ox + puck.x * s, oy + puck.y * s, pr * s, 0, 7); cx.fill(); cx.restore();
    }
    function loop(t) { if (!on) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.033, (t - last) / 1000 || 0.016); last = t; step(dt); draw(); }
    function pause() { on = false; cancelAnimationFrame(raf); }
    function resume() { if (reduced) { draw(); return; } if (on) return; on = true; last = performance.now(); raf = requestAnimationFrame(loop); }
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting && !$('#hub').hidden) resume(); else pause(); });
    io.observe(cv);
    addEventListener('resize', () => { if (!on) draw(); });
    return { pause, resume };
  })();

  /* ---------- Umschalten zwischen Startseite und Spiel ---------- */
  let current = null;
  function route() {
    const id = location.hash.slice(1);
    const game = GAMES.find((g) => g.id === id && g.live);
    const mod = game && window.Games && window.Games[id];
    if (current && (!mod || current !== mod)) { try { current.stop(); } catch (e) { console.error(e); } current = null; $('#game').innerHTML = ''; }
    if (mod) {
      $('#hub').hidden = true; $('#game').hidden = false; demo.pause();
      if (!current) { current = mod; mod.start($('#game'), hub); hub.intent = null; }
    } else {
      $('#game').hidden = true; $('#hub').hidden = false; renderAll(); demo.resume();
    }
  }
  function open(id, intent) { hub.intent = intent || null; location.hash = id; }

  let toastT = 0;
  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'g-net'; t.style.cssText = 'position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:60;font-size:14px;padding:9px 16px;color:var(--ink)'; document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 1800);
  }

  /* ---------- Start ---------- */
  applyName(); renderGames(); renderProjects(); renderAll();
  $('#games').addEventListener('click', (e) => {
    const t = e.target.closest('.game'); if (!t) return;
    const g = GAMES.find((x) => x.id === t.dataset.id);
    if (g && g.live) open(g.id); else toast(`${g ? g.title : 'Das Spiel'} ist noch in Arbeit.`);
  });
  $('#playMain').onclick = () => open('airhockey');
  $('#featureCard').onclick = () => open('airhockey');
  $('#playBot').onclick = () => open('airhockey', 'bot');
  $('#acctBtn').onclick = openAccount;
  $('#standBox').addEventListener('click', (e) => { if (e.target.closest('[data-login]')) openAccount(); });
  // Bereichs-Links nur scrollen, ohne die Adresse zu ändern (die Adresse steuert die Spiele)
  document.querySelectorAll('.links a').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); const t = document.querySelector(a.getAttribute('href')); if (t) t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  }));
  $('.brand').addEventListener('click', (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); });
  addEventListener('hashchange', route);
  if (window.Auth) { Auth.onChange(() => refreshCloud()); Auth.init(); }
  route();
  if (!store.name && !(window.Auth && Auth.ready) && !location.hash) askName(true);
})();

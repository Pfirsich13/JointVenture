/* =========================================================================
   hub.js – Startseite: Spiele, Spielstände, Projekte, Anmeldung
   Texte, Spiele und Projekte kommen aus content.js (Admin-Panel).
   Eingebautes Spiel: Modul window.Games.<id> mit start(el, hub) und stop().
   Hochgeladenes Spiel: eine HTML-Datei, läuft abgeschirmt in einem Rahmen.
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

  const C = () => Content.get();
  const isAdmin = () => !!(window.Auth && Auth.isAdmin());
  const allGames = () => C().games || [];
  const adminOnly = (g) => g.status === 'hidden' || g.status === 'review';
  const visibleGames = () => allGames().filter((g) => !adminOnly(g) || isAdmin());
  const findGame = (id) => allGames().find((g) => g.id === id);
  // Kann man das Spiel starten? (eingebautes Modul oder hochgeladene Datei)
  // Eingebaute Spiele liegen als js/games/<id>.js im Code und werden bei Bedarf nachgeladen.
  const PAGE_PATH = /^play\/[a-z0-9-]+\/[\w.-]+\.html$/;     // Spiele mit eigenem Ordner auf dieser Seite
  const BUILTIN_PLAYABLE = (g) => g.kind === 'builtin' && (g.status !== 'soon');
  const playable = (g) => g && (g.status === 'live' || g.status === 'beta' || (adminOnly(g) && isAdmin()))
    && (BUILTIN_PLAYABLE(g) || (g.kind === 'upload' && g.file_path) || (g.kind === 'page' && PAGE_PATH.test(g.file_path || '')) || (g.kind === 'bundle' && g.file_path));
  const ONLINE_GAMES = ['airhockey', 'arena', 'gladiator'];            // Spiele mit Online-Räumen (Freunde herausfordern)
  const STATUS = { live: ['Spielbar', 'ok'], beta: ['Beta', 'beta'], soon: ['Bald', ''], hidden: ['Versteckt', 'off'], review: ['Zur Freigabe', 'review'] };
  const loadedScripts = {};
  function loadGameModule(id) {
    if (window.Games && window.Games[id]) return Promise.resolve(window.Games[id]);
    if (!/^[a-z0-9-]{2,40}$/.test(id)) return Promise.reject(new Error('ungültige Spiel-ID'));
    if (!loadedScripts[id]) {
      loadedScripts[id] = new Promise((res, rej) => {
        const sc = document.createElement('script'); sc.src = `js/games/${id}.js?v=${encodeURIComponent((findGame(id) || {}).updated_at || '')}`;
        sc.onload = () => (window.Games && window.Games[id]) ? res(window.Games[id]) : rej(new Error('Spielmodul fehlt'));
        sc.onerror = () => { delete loadedScripts[id]; rej(new Error('Spiel konnte nicht geladen werden')); };
        document.head.appendChild(sc);
      });
    }
    return loadedScripts[id];
  }

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
    toast: (m) => toast(m),
    login: () => openAccount(),
    /** Spiele, zu denen man Freunde herausfordern kann */
    onlineGames: () => visibleGames().filter((g) => playable(g) && ONLINE_GAMES.includes(g.id)),
    /** Ein Spiel meldet: Raum ist offen. Bei einer Herausforderung geht die Einladung automatisch raus. */
    roomOpened(game, code) {
      const ch = hub.challenge;
      if (ch && ch.game === game && ch.sent !== code) { ch.sent = code; hub.invite(game, code, 'auto'); }
    },
    /** Freund herausfordern: Spiel öffnen (Air-Hockey erstellt gleich einen Raum), Einladung dann über hub.invite */
    startChallenge(friend, game) {
      hub.challenge = { id: friend.id, name: friend.name, game };
      open(game, game === 'airhockey' ? 'host' : null);
      toast(`Raum für das Duell mit ${friend.name} wird geöffnet …`);
    },
    back() { if (location.hash) history.replaceState(null, '', location.pathname + location.search); route(); },
    report(gameId) { openReport(gameId); },                // Spiele können so „Fehler melden“ öffnen
    inviteLink: (game, code) => `${location.origin}${location.pathname}#${game}/${code}`,
    /** Freund einladen: am Handy Teilen-Menü (WhatsApp …), am PC WhatsApp im Browser. 'copy' kopiert nur den Link.
        Läuft gerade eine Herausforderung aus der Freundesliste, geht die Einladung als Chat-Nachricht an den Freund
        ('auto' schickt nur dann, sonst nichts). */
    async invite(game, code, how) {
      const g = findGame(game), url = hub.inviteLink(game, code), ch = hub.challenge;
      if (how !== 'copy' && ch && ch.game === game && window.Social && Social.isFriend(ch.id)) {
        try {
          await Social.sendInvite(ch.id, `🎮 Ich fordere dich bei ${g ? g.title : 'JointVenture'} heraus! Raum-Code ${code}: ${url}`);
          toast(`Einladung an ${ch.name} geschickt`); return 'chat';
        } catch (e) { toast(e.message); if (how === 'auto') return 'fehler'; }
      }
      if (how === 'auto') return 'nichts';
      const text = `Ich fordere dich bei ${g ? g.title : 'JointVenture'} heraus! Tipp auf den Link, dann bist du direkt in meinem Raum (Code ${code}): ${url}`;
      if (how === 'copy') { try { await navigator.clipboard.writeText(url); return 'kopiert'; } catch (e) { prompt('Link kopieren:', url); return 'kopiert'; } }
      if (navigator.maxTouchPoints > 0 && navigator.share) { try { await navigator.share({ text }); return 'geteilt'; } catch (e) { return 'abgebrochen'; } }
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
      return 'whatsapp';
    }
  };
  window.Hub = hub;

  /* ---------- Darstellung ---------- */
  function applyContent() {
    const site = C().site || {};
    const name = site.name || SITE.name;
    document.title = name;
    document.querySelectorAll('.site-name').forEach((n) => { n.textContent = name; });
    const set = (id, v) => { const el = $(id); if (el && v != null) el.textContent = v; };
    set('#kicker', site.kicker); set('#tagline', site.tagline); set('#lead', site.lead);
    set('#gamesHint', site.gamesHint); set('#projectsHint', site.projectsHint); set('#footerTxt', site.footer);
    // Startseite: Air-Hockey-Knöpfe nur, solange es das Spiel gibt
    const ah = playable(findGame('airhockey'));
    $('#playMain').hidden = !ah; $('#playBot').hidden = !ah; $('#featureCard').hidden = !ah;
    // Ankündigung
    const a = C().announcement || {};
    $('#banner').hidden = !(a.on && a.text);
    $('#bannerTxt').textContent = a.text || '';
    // Wartungsmodus: Admins sehen die Seite trotzdem
    const m = C().maintenance || {};
    const blocked = !!m.on && !isAdmin();
    $('#maint').hidden = !blocked;
    $('#maintTxt').textContent = m.text || 'Wir bauen gerade um.';
    $('#mainView').classList.toggle('blocked', blocked);
    $('#adminLink').hidden = !isAdmin();
    if (m.on && isAdmin()) { $('#banner').hidden = false; $('#bannerTxt').textContent = 'Wartungsmodus ist an. Nur Admins sehen die Seite.' + (a.on && a.text ? ' · ' + a.text : ''); }
  }
  function coverFor(g) {
    // Ein hochgeladenes Titelbild hat Vorrang vor dem eingebauten Bild
    if (g.cover_path) return `<img src="${esc(Content.fileUrl(g.cover_path, g.updated_at))}" alt="" loading="lazy">`;
    if (COVER[g.id]) return COVER[g.id];
    const hue = [...g.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
    return `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="cg-${esc(g.id)}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 60% 28%)"/><stop offset="1" stop-color="#0d0e12"/></linearGradient></defs><rect width="320" height="200" fill="url(#cg-${esc(g.id)})"/><text x="160" y="122" text-anchor="middle" font-family="Sora, sans-serif" font-weight="800" font-size="64" fill="rgba(255,255,255,.85)">${esc((g.title || '?').slice(0, 2).toUpperCase())}</text></svg>`;
  }
  function renderGames() {
    const list = visibleGames();
    $('#games').innerHTML = list.length ? list.map((g) => {
      const [label, cls] = STATUS[g.status] || STATUS.soon;
      return `
      <button class="game ${playable(g) ? '' : 'soon'} ${adminOnly(g) ? 'hidden-game' : ''}" type="button" data-id="${esc(g.id)}">
        <span class="cover" aria-hidden="true">${coverFor(g)}</span>
        <span class="meta">
          <span class="t"><b>${esc(g.title)}</b><span class="pill ${cls}">${label}${g.version && g.status !== 'soon' ? ' ' + esc(g.version) : ''}</span></span>
          <span class="d">${esc(g.description || '')}</span>
        </span>
      </button>`;
    }).join('') : '<p class="empty">Noch keine Spiele.</p>';
  }
  function renderProjects() {
    const list = C().projects || [];
    $('#projects').innerHTML = list.length ? list.map((p) => {
      const pr = Math.max(0, Math.min(100, Number(p.progress) || 0));
      return `
      <article class="proj">
        <div class="t"><b>${esc(p.title)}</b>${p.owner ? `<span class="who">${esc(p.owner)}</span>` : ''}</div>
        <div class="bar" role="progressbar" aria-valuenow="${pr}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(2, pr)}%"></i></div>
        <div class="row"><span>${esc(p.status || '')}</span><span>${pr} %</span></div>
        ${p.next_step ? `<div class="next">Nächster Schritt: ${esc(p.next_step)}</div>` : ''}
      </article>`;
    }).join('') : '<p class="empty">Gerade keine Projekte.</p>';
  }
  function renderContent() { applyContent(); renderGames(); renderProjects(); }
  const gameTitle = (id) => (findGame(id) || { title: id }).title;
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
    $('#standHint').textContent = (C().site && C().site.standHint) || (signedIn ? `Gespeichert in deinem Konto, ${hub.getName()}.` : 'Auf diesem Gerät gespeichert.');
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
    const pic = u && Auth.avatar && Auth.avatar();
    $('#acctAv').innerHTML = pic ? `<img src="${esc(pic)}" alt="">` : esc((hub.getName()[0] || '?').toUpperCase());
    if (u) $('#acctAv').dataset.uid = u.id; else delete $('#acctAv').dataset.uid;     // Status-Punkt (social.js)
    $('#acctBtn').classList.toggle('in', !!u);
    $('#acctBtn').setAttribute('aria-label', u ? 'Konto: ' + hub.getName() : 'Anmelden');
  }
  function renderAll() { renderAccount(); renderStand(); }
  async function refreshCloud() {
    forcePasswordChange();
    cloud = window.Auth && Auth.user() ? await Auth.loadResults() : null;
    renderAll(); renderRank();
  }

  /* ---------- Fenster: Anmelden / Registrieren / Name ---------- */
  function sheet(html) {
    const el = document.createElement('div'); el.className = 'sheet'; el.innerHTML = `<div class="box">${html}</div>`;
    el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-close]')) el.remove(); });
    document.body.appendChild(el); return el;
  }
  function openAccount() {
    if (document.querySelector('.sheet')) return;          // nie mehrere Fenster übereinander
    if (!window.Auth || !Auth.ready) return askName(false);
    if (Auth.user()) return openProfile();
    let mode = 'in';
    const el = sheet(`<h3>Willkommen</h3><p>Melde dich an, damit deine Spielstände gespeichert werden.</p>
      <div class="tabs" role="tablist"><button type="button" role="tab" data-t="in" aria-selected="true">Anmelden</button><button type="button" role="tab" data-t="up" aria-selected="false">Registrieren</button></div>
      <form novalidate>
        <input class="field" name="name" placeholder="Dein Name" maxlength="16" autocomplete="nickname" hidden>
        <input class="field" name="email" type="email" placeholder="E-Mail" autocomplete="email" required>
        <input class="field" name="pw" type="password" placeholder="Passwort" autocomplete="current-password" required>
        <p class="hint pw-hint" hidden>Mindestens 8 Zeichen, mit Buchstaben und Zahlen.</p>
        <p class="msg" aria-live="polite"></p>
        <div class="row"><button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary" type="submit">Anmelden</button></div>
        <button class="linkbtn" type="button" data-forgot>Passwort vergessen?</button>
      </form>`);
    el.querySelector('[data-forgot]').onclick = () => { const mail = el.querySelector('[name=email]').value.trim(); el.remove(); openForgot(mail); };
    const f = el.querySelector('form'), msg = el.querySelector('.msg'), submit = f.querySelector('[type=submit]');
    el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => {
      mode = b.dataset.t;
      el.querySelectorAll('[data-t]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      f.elements.name.hidden = mode !== 'up'; submit.textContent = mode === 'up' ? 'Konto erstellen' : 'Anmelden';
      f.elements.pw.autocomplete = mode === 'up' ? 'new-password' : 'current-password'; msg.textContent = '';
      f.elements.pw.placeholder = mode === 'up' ? 'Passwort (mind. 8 Zeichen)' : 'Passwort';
      el.querySelector('.pw-hint').hidden = mode !== 'up';
      el.querySelector('[data-forgot]').hidden = mode === 'up';
    }; });
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); msg.className = 'msg'; msg.textContent = '';
      const name = f.elements.name.value.trim(), email = f.elements.email.value.trim(), pw = f.elements.pw.value;
      if (mode === 'up' && !name) { msg.textContent = 'Bitte gib einen Namen ein.'; return; }
      if (!email || !pw) { msg.textContent = 'Bitte E-Mail und Passwort eingeben.'; return; }
      if (mode === 'up' && (pw.length < 8 || !/[A-Za-zÄÖÜäöüß]/.test(pw) || !/\d/.test(pw))) { msg.textContent = 'Das Passwort braucht mindestens 8 Zeichen, mit Buchstaben und Zahlen.'; return; }
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
  /* ---------- Profil: Name, eigene Statistik, Platz in der Rangliste ---------- */
  const MODES = [['online', 'Online'], ['bot', 'Training'], ['local', 'Lokal']];
  async function openProfile() {
    const u = Auth.user();
    const el = sheet(`<div class="prof-head"><span class="av big" id="profPic" data-uid="${esc(u.id)}"></span>
        <div><h3>${esc(hub.getName())}</h3><p>${esc(u.email || '')}${isAdmin() ? ' · Admin' : ''}</p>
        <div class="pic-btns"><label class="btn small">Profilbild wählen<input type="file" accept="image/*" hidden data-pic></label><button class="btn small" type="button" data-nopic hidden>Entfernen</button></div></div></div>
      <p class="msg pic-msg" aria-live="polite"></p>
      <form class="prof-name" novalidate><label class="f"><span>Dein Name (so sehen dich die anderen)</span>
        <div class="inline"><input class="field" name="n" maxlength="16" value="${esc(hub.getName())}" autocomplete="nickname"><button class="btn" type="submit">Speichern</button></div></label>
        <p class="msg" aria-live="polite"></p></form>
      ${window.Social ? `<div class="prof-status"><span>Mein Status</span><div class="seg" role="radiogroup" aria-label="Mein Status">
        <button type="button" role="radio" data-pmode="auto">Automatisch</button><button type="button" role="radio" data-pmode="invisible">Unsichtbar</button></div>
        <p class="hint pmode-hint"></p></div>` : ''}
      <h4>Deine Statistik</h4><div class="prof-stats"><p class="empty">Lädt …</p></div>
      <p class="prof-rank"></p>
      <details class="prof-pw"><summary>Passwort ändern</summary>
        <form novalidate><input class="field" name="p1" type="password" autocomplete="new-password" placeholder="Neues Passwort (mind. 8 Zeichen)">
        <input class="field" name="p2" type="password" autocomplete="new-password" placeholder="Neues Passwort wiederholen">
        <p class="hint">Mindestens 8 Zeichen, mit Buchstaben und Zahlen.</p><p class="msg" aria-live="polite"></p>
        <div class="row"><button class="btn primary" type="submit">Passwort speichern</button></div></form></details>
      <div class="row wrap-row"><button class="btn" type="button" data-mine>Deine Fehlermeldungen</button><button class="btn danger" type="button" data-out>Abmelden</button></div>
      <div class="row"><button class="btn" type="button" data-close>Schließen</button></div>`);
    el.querySelector('.box').classList.add('wide');
    const picMsg = el.querySelector('.pic-msg');
    const showPic = () => {
      const url = Auth.avatar();
      el.querySelector('#profPic').innerHTML = url ? `<img src="${esc(url)}" alt="Dein Profilbild">` : esc((hub.getName()[0] || '?').toUpperCase());
      el.querySelector('[data-nopic]').hidden = !url;
    };
    showPic();
    el.querySelector('[data-pic]').addEventListener('change', async (e) => {
      const file = e.target.files[0]; e.target.value = ''; if (!file) return;
      picMsg.className = 'msg pic-msg'; picMsg.textContent = 'Lädt hoch …';
      try { await Auth.setAvatar(file); showPic(); picMsg.className = 'msg pic-msg good'; picMsg.textContent = 'Profilbild gespeichert.'; renderRank(); }
      catch (err) { picMsg.textContent = err.message; }
    });
    el.querySelector('[data-nopic]').onclick = async () => {
      try { await Auth.removeAvatar(); showPic(); picMsg.className = 'msg pic-msg'; picMsg.textContent = ''; renderRank(); }
      catch (err) { picMsg.textContent = err.message; }
    };
    el.querySelector('[data-out]').onclick = async () => { await Auth.signOut(); el.remove(); };
    // Mein Status: Automatisch (online/abwesend) oder Unsichtbar (erscheint offline)
    const showMode = () => {
      const m = Social.mode();
      el.querySelectorAll('[data-pmode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.pmode === m)));
      el.querySelector('.pmode-hint').textContent = m === 'invisible' ? 'Du erscheinst für alle als offline. „Zuletzt online“ wird nicht mehr aktualisiert.' : 'Andere sehen, ob du online oder abwesend bist und wann du zuletzt online warst.';
    };
    if (window.Social) {
      showMode();
      el.querySelectorAll('[data-pmode]').forEach((b) => { b.onclick = async () => {
        try { await Social.setMode(b.dataset.pmode); showMode(); toast(b.dataset.pmode === 'invisible' ? 'Du bist jetzt unsichtbar' : 'Dein Status ist wieder sichtbar'); }
        catch (err) { toast(err.message); }
      }; });
    }
    el.querySelector('[data-mine]').onclick = () => { el.remove(); openReport('', true); };
    bindPasswordForm(el.querySelector('.prof-pw form'), () => { el.querySelector('.prof-pw').open = false; });
    const nf = el.querySelector('.prof-name'), nmsg = nf.querySelector('.msg');
    nf.addEventListener('submit', async (e) => {
      e.preventDefault(); nmsg.className = 'msg'; nmsg.textContent = '';
      const n = nf.elements.n.value.trim();
      if (n.length < 1 || n.length > 16) { nmsg.textContent = 'Der Name braucht 1 bis 16 Zeichen.'; return; }
      try { await Auth.rename(n); store.name = n; save(); nmsg.className = 'msg good'; nmsg.textContent = 'Gespeichert.'; el.querySelector('.prof-head h3').textContent = n; showPic(); renderAll(); renderRank(); }
      catch (err) { nmsg.textContent = err.message; }
    });
    // Statistik pro Spiel und Art
    const rows = await Auth.myStats(), per = {};
    rows.forEach((r) => { const g = per[r.game] || (per[r.game] = {}); const k = g[r.mode] || (g[r.mode] = { w: 0, l: 0 }); r.won ? k.w++ : k.l++; });
    const games = Object.keys(per);
    el.querySelector('.prof-stats').innerHTML = games.length ? `<table class="stat-table"><thead><tr><th>Spiel</th>${MODES.map(([, n]) => `<th>${n}</th>`).join('')}</tr></thead><tbody>${games.map((g) => `<tr><td>${esc(gameTitle(g))}</td>${MODES.map(([m]) => { const k = per[g][m]; return `<td>${k ? `<b class="w">${k.w}</b> : <b class="l">${k.l}</b>` : '–'}</td>`; }).join('')}</tr>`).join('')}</tbody></table><p class="hint">Siege : Niederlagen</p>` : '<p class="empty">Noch keine gespeicherten Spiele. Leg los!</p>';
    // Platz in der Rangliste
    const lb = await Auth.leaderboard(null), i = lb ? lb.findIndex((x) => x.player_id === u.id) : -1;
    el.querySelector('.prof-rank').innerHTML = i >= 0 ? `In der Rangliste: <b>Platz ${i + 1}</b> von ${lb.length} (Online-Duelle)` : 'In der Rangliste bist du, sobald du ein Online-Duell gespielt hast.';
  }

  // Passwort-Regeln wie beim Registrieren
  const pwProblem = (pw) => pw.length < 8 || !/[A-Za-zÄÖÜäöüß]/.test(pw) || !/\d/.test(pw) ? 'Das Passwort braucht mindestens 8 Zeichen, mit Buchstaben und Zahlen.' : '';
  function bindPasswordForm(f, done) {
    const msg = f.querySelector('.msg'), btn = f.querySelector('[type=submit]');
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); msg.className = 'msg'; msg.textContent = '';
      const p1 = f.elements.p1.value, p2 = f.elements.p2.value;
      const problem = pwProblem(p1) || (p1 !== p2 ? 'Die beiden Passwörter sind nicht gleich.' : '');
      if (problem) { msg.textContent = problem; return; }
      btn.disabled = true;
      try {
        await Auth.setPassword(p1);
        f.reset(); msg.className = 'msg good'; msg.textContent = 'Neues Passwort gespeichert.';
        if (done) setTimeout(done, 1200);
      } catch (err) { msg.textContent = err.message; }
      btn.disabled = false;
    });
  }

  /* ---------- Rangliste (nur Online-Duelle) ---------- */
  let rankGame = '';
  async function renderRank() {
    const box = $('#rankBox'); if (!box) return;
    const filters = visibleGames().filter((g) => g.kind === 'builtin' && g.status !== 'soon');
    $('#rankFilter').innerHTML = filters.length > 1 ? [['', 'Alle Spiele'], ...filters.map((g) => [g.id, g.title])].map(([id, n]) => `<button type="button" class="chip" data-rank="${esc(id)}" aria-pressed="${id === rankGame}">${esc(n)}</button>`).join('') : '';
    if (!window.Auth || !Auth.ready) { box.innerHTML = '<p class="empty">Die Rangliste ist gerade nicht erreichbar.</p>'; return; }
    if (!Auth.user()) { box.innerHTML = '<div class="rank-login"><p>Melde dich an, um zu sehen, wer vorne liegt, und um selbst in die Rangliste zu kommen.</p><button class="btn primary" type="button" data-login>Anmelden</button></div>'; return; }
    const list = await Auth.leaderboard(rankGame || null);
    if (!list) { box.innerHTML = '<p class="empty">Die Rangliste konnte nicht geladen werden.</p>'; return; }
    if (!list.length) { box.innerHTML = '<p class="empty">Noch keine Online-Duelle. Fordere jemanden heraus!</p>'; return; }
    const me = Auth.user().id, medal = ['🥇', '🥈', '🥉'];
    const myIdx = list.findIndex((x) => x.player_id === me);
    const shown = list.slice(0, 20); if (myIdx >= 20) shown.push(list[myIdx]);
    box.innerHTML = `<table class="rank-table"><thead><tr><th>Platz</th><th>Spieler</th><th>Siege</th><th>Niederl.</th><th>Quote</th></tr></thead><tbody>${shown.map((r) => {
      const i = list.indexOf(r), q = r.matches ? Math.round(r.wins / r.matches * 100) : 0;
      const pic = Auth.avatarUrl(r.avatar_path);
      return `<tr class="${r.player_id === me ? 'me' : ''}"><td>${medal[i] || i + 1}</td><td><span class="rank-who"><span class="av sm" data-uid="${esc(r.player_id)}">${pic ? `<img src="${esc(pic)}" alt="" loading="lazy">` : esc((r.name || '?')[0].toUpperCase())}</span>${esc(r.name)}${r.player_id === me ? ' <small>(du)</small>' : ''}</span></td><td>${r.wins}</td><td>${r.losses}</td><td>${q} %</td></tr>`;
    }).join('')}</tbody></table>`;
  }
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-rank]'); if (c) { rankGame = c.dataset.rank; renderRank(); return; }
    if (e.target.closest('#rankBox [data-login]')) openAccount();
  });

  /* ---------- Passwort vergessen: Anfrage an die Admins ---------- */
  function openForgot(mail) {
    if (document.querySelector('.sheet')) return;
    const el = sheet(`<h3>Passwort vergessen</h3>
      <p>Kein Problem. Deine Anfrage geht an die Admins. Sie geben dir ein Einmal-Passwort, mit dem du dich anmeldest und dann ein neues festlegst.</p>
      <form novalidate><input class="field" name="email" type="email" autocomplete="email" placeholder="Deine E-Mail" value="${esc(mail || '')}">
        <input class="field" name="name" maxlength="40" autocomplete="nickname" placeholder="Dein Name auf der Seite">
        <textarea class="field" name="message" maxlength="500" rows="2" placeholder="Wie erreichen dich die Admins? (z. B. „schreib mir per WhatsApp“)"></textarea>
        <p class="msg" aria-live="polite"></p>
        <div class="row"><button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary" type="submit">Anfrage senden</button></div></form>`);
    const f = el.querySelector('form'), msg = f.querySelector('.msg'), btn = f.querySelector('[type=submit]');
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); msg.className = 'msg'; msg.textContent = '';
      const email = f.elements.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Bitte gib deine E-Mail-Adresse ein.'; return; }
      btn.disabled = true;
      try {
        await Auth.requestPasswordHelp({ email, name: f.elements.name.value.trim(), message: f.elements.message.value.trim() });
        // Immer dieselbe Antwort, egal ob es das Konto gibt
        el.querySelector('.box').innerHTML = '<h3>Anfrage ist bei den Admins</h3><p>Sobald ein Admin sie sieht, bekommst du ein Einmal-Passwort. Damit meldest du dich an und legst sofort ein neues Passwort fest.</p><div class="row"><button class="btn primary" type="button" data-close>OK</button></div>';
      } catch (err) { msg.textContent = /Zu viele/.test(err.message) ? err.message : 'Das hat nicht geklappt. Bitte später nochmal versuchen.'; btn.disabled = false; }
    });
    setTimeout(() => (mail ? f.elements.name : f.elements.email).focus(), 50);
  }
  // Nach dem Anmelden mit Einmal-Passwort: neues Passwort festlegen (lässt sich nicht wegklicken)
  function forcePasswordChange() {
    if (!window.Auth || !Auth.mustChangePassword || !Auth.mustChangePassword() || document.querySelector('.sheet.locked')) return;
    document.querySelectorAll('.sheet').forEach((x) => x.remove());
    const el = document.createElement('div'); el.className = 'sheet locked';
    el.innerHTML = `<div class="box"><h3>Neues Passwort festlegen</h3><p>Du hast dich mit einem Einmal-Passwort angemeldet. Leg jetzt dein eigenes Passwort fest.</p>
      <form novalidate><input class="field" name="p1" type="password" autocomplete="new-password" placeholder="Neues Passwort (mind. 8 Zeichen)">
      <input class="field" name="p2" type="password" autocomplete="new-password" placeholder="Neues Passwort wiederholen">
      <p class="hint">Mindestens 8 Zeichen, mit Buchstaben und Zahlen.</p><p class="msg" aria-live="polite"></p>
      <div class="row"><button class="btn primary" type="submit">Passwort speichern</button></div></form>
      <button class="linkbtn" type="button" data-out>Abmelden</button></div>`;
    document.body.appendChild(el);
    bindPasswordForm(el.querySelector('form'), () => el.remove());
    el.querySelector('[data-out]').onclick = async () => { el.remove(); await Auth.signOut(); };
    setTimeout(() => el.querySelector('[name=p1]').focus(), 50);
  }

  /* ---------- Fehler melden ---------- */
  const REPORT_STATUS = { neu: ['Neu', ''], in_arbeit: ['In Arbeit', 'beta'], erledigt: ['Erledigt', 'ok'], abgelehnt: ['Kein Fehler', 'off'] };
  function reportContext() {
    const src = (document.querySelector('script[src*="hub.js"]') || {}).src || '';
    return {
      seite: location.href.split('?')[0], spiel_offen: current ? current.id : null,
      version: (src.match(/[?&]v=(\d+)/) || [])[1] || null,
      browser: navigator.userAgent, sprache: navigator.language,
      bildschirm: `${screen.width}x${screen.height}`, fenster: `${innerWidth}x${innerHeight}`, pixel: devicePixelRatio,
      touch: navigator.maxTouchPoints > 0, online: navigator.onLine, zeit: new Date().toString(),
      fehler: (window.JV_ERRORS || []).slice(-10)
    };
  }
  function openReport(gameId, showMine) {
    if (document.querySelector('.sheet')) return;
    if (!window.Auth || !Auth.ready) {
      sheet('<h3>Fehler melden</h3><p>Melden geht gerade nicht, weil keine Verbindung zum Server besteht. Versuch es bitte später nochmal.</p><div class="row"><button class="btn" type="button" data-close>Schließen</button></div>');
      return;
    }
    if (!Auth.user()) {
      const el = sheet('<h3>Fehler melden</h3><p>Danke, dass du helfen willst! Zum Melden musst du angemeldet sein, damit wir bei Rückfragen wissen, wer es war.</p><div class="row"><button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary" type="button" data-login>Anmelden</button></div>');
      el.querySelector('[data-login]').onclick = () => { el.remove(); openAccount(); };
      return;
    }
    const games = visibleGames().filter((g) => g.status !== 'soon');
    const pre = gameId || (current && current.id) || '';
    const el = sheet(`<h3>Fehler melden</h3><p>Beschreib kurz, was nicht geklappt hat. Wir kümmern uns darum.</p>
      <form class="report" novalidate>
        <select class="field" name="game" aria-label="Wo ist der Fehler?"><option value="">Allgemein / Webseite</option>${games.map((g) => `<option value="${esc(g.id)}" ${g.id === pre ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select>
        <input class="field" name="title" maxlength="120" placeholder="Was ist kaputt? (kurz)" aria-label="Kurze Überschrift">
        <textarea class="field" name="description" maxlength="4000" rows="5" placeholder="Was hast du gemacht? Was ist passiert? Was hättest du erwartet?" aria-label="Beschreibung"></textarea>
        <label class="filebox"><span>Bildschirmfoto (optional)</span><input type="file" name="shot" accept="image/png,image/jpeg,image/webp"></label>
        <p class="hint">Gerät, Browser und die letzten technischen Fehlermeldungen werden automatisch mitgeschickt.</p>
        <p class="msg" aria-live="polite"></p>
        <div class="row"><button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary" type="submit">Senden</button></div>
      </form>
      <details class="myreports"><summary>Deine Meldungen</summary><div class="mr-list"><p class="empty">Lädt …</p></div></details>`);
    el.querySelector('.box').classList.add('wide');
    const f = el.querySelector('form'), msg = el.querySelector('.msg'), submit = f.querySelector('[type=submit]');
    const ctx = reportContext();                            // Stand beim Öffnen (vor eventuellen neuen Fehlern beim Tippen)
    el.querySelector('.myreports').addEventListener('toggle', async (e) => {
      if (!e.target.open) return;
      const list = await Auth.myReports(), box = el.querySelector('.mr-list');
      box.innerHTML = list.length ? list.map((r) => {
        const [lab, cls] = REPORT_STATUS[r.status] || REPORT_STATUS.neu;
        return `<div class="mr"><div><b>${esc(r.title)}</b><small>${ago(Date.parse(r.created_at))}</small></div><span class="pill ${cls}">${lab}</span>${r.admin_note ? `<p class="mr-note">Antwort: ${esc(r.admin_note)}</p>` : ''}</div>`;
      }).join('') : '<p class="empty">Du hast noch nichts gemeldet.</p>';
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); msg.className = 'msg'; msg.textContent = '';
      const title = f.elements.title.value.trim(), description = f.elements.description.value.trim(), shot = f.elements.shot.files[0];
      if (title.length < 3) { msg.textContent = 'Bitte gib eine kurze Überschrift ein (mindestens 3 Zeichen).'; f.elements.title.focus(); return; }
      if (!description) { msg.textContent = 'Bitte beschreib kurz, was passiert ist.'; f.elements.description.focus(); return; }
      if (shot && (!/^image\/(png|jpeg|webp)$/.test(shot.type) || shot.size > 5 * 1024 * 1024)) { msg.textContent = 'Bildschirmfoto bitte als PNG, JPG oder WebP, höchstens 5 MB.'; return; }
      submit.disabled = true; submit.textContent = 'Sendet …';
      try {
        await Auth.report({ game: f.elements.game.value, title, description, context: ctx, shot });
        el.querySelector('.box').innerHTML = '<h3>Danke!</h3><p>Deine Meldung ist angekommen. Unter „Fehler melden“ → „Deine Meldungen“ siehst du, wenn wir sie bearbeitet haben.</p><div class="row"><button class="btn primary" type="button" data-close>Schließen</button></div>';
      } catch (err) { msg.textContent = err.message; submit.disabled = false; submit.textContent = 'Senden'; }
    });
    if (showMine) { const d = el.querySelector('.myreports'); d.open = true; d.scrollIntoView({ block: 'nearest' }); }
    else setTimeout(() => f.elements.title.focus(), 50);
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
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting && !inGame()) resume(); else pause(); });
    io.observe(cv);
    addEventListener('resize', () => { if (!on) draw(); });
    return { pause, resume };
  })();

  /* ---------- Hochgeladenes Spiel abspielen (abgeschirmter Rahmen) ---------- */
  const uploadPlayer = {
    start(el, g) {
      el.innerHTML = `<div class="g-top"><button class="g-back" type="button">Zurück</button><span class="g-net">${esc(g.title)}${g.status === 'beta' ? ' · Beta' : ''}${g.version ? ' · ' + esc(g.version) : ''}</span></div>
        <iframe class="upframe" title="${esc(g.title)}" sandbox="allow-scripts allow-pointer-lock allow-popups allow-forms allow-modals" allow="fullscreen; autoplay; gamepad"></iframe>
        <div class="g-panel" id="upLoad"><div class="box"><h2>Lädt …</h2><div class="wait"><i></i><i></i><i></i></div></div></div>`;
      el.querySelector('.g-back').onclick = () => hub.back();
      const frame = el.querySelector('iframe');
      fetch(Content.fileUrl(g.file_path, g.updated_at))
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then((html) => { frame.srcdoc = html; el.querySelector('#upLoad').remove(); })
        .catch(() => { el.querySelector('#upLoad .box').innerHTML = '<h2>Ups</h2><p>Das Spiel konnte nicht geladen werden. Internet prüfen und nochmal versuchen.</p><button class="btn" type="button" data-b>Zurück</button>'; el.querySelector('[data-b]').onclick = () => hub.back(); });
    },
    stop() { }
  };

  /* ---------- Spiel mit eigenem Ordner (z. B. play/arena/) im ganzen Fenster ---------- */
  const pagePlayer = {
    start(el, g) {
      const q = new URLSearchParams({ v: g.updated_at || g.version || '1' });
      const ph = new URLSearchParams(location.search).get('peerhost');      // nur für Tests
      if (ph) q.set('peerhost', ph);
      if (hub.intent && hub.intent.join) q.set('join', hub.intent.join);    // Einladung: direkt in den Raum
      el.innerHTML = `<iframe class="upframe" title="${esc(g.title)}" allow="fullscreen; autoplay; gamepad; screen-wake-lock; web-share; clipboard-write" src="${esc(g.file_path)}?${q}"></iframe>`;
      const frame = el.querySelector('iframe');
      frame.addEventListener('load', () => { try { window.JV_WATCH(frame.contentWindow, g.title); } catch (e) { /* fremde Seite */ } });
      frame.focus();
    },
    stop() { }
  };
  /* ---------- Spiel aus einer hochgeladenen ZIP (Dateien im Speicher) ---------- */
  // Die Startseite des Spiels wird geladen und mit <base> auf den Speicher-Ordner gezeigt.
  // Der Rahmen läuft wie ein Teil der Seite (wie play/…), deshalb nur Spiele von Admins.
  const bundlePlayer = {
    start(el, g) {
      const params = new URLSearchParams();
      if (hub.intent && hub.intent.join) params.set('join', hub.intent.join);             // Einladung: direkt in den Raum
      const ph = new URLSearchParams(location.search).get('peerhost'); if (ph) params.set('peerhost', ph);   // nur für Tests
      // Startwerte fürs Spiel stehen im Namen des Rahmens (muss beim Anlegen schon da sein)
      el.innerHTML = `<iframe class="upframe" name="${esc('jv:' + params)}" title="${esc(g.title)}" allow="fullscreen; autoplay; gamepad; screen-wake-lock; web-share; clipboard-write"></iframe>
        <div class="g-panel" id="upLoad"><div class="box"><h2>Lädt …</h2><div class="wait"><i></i><i></i><i></i></div></div></div>`;
      const frame = el.querySelector('iframe');
      const url = Content.fileUrl(g.file_path, g.updated_at), dir = url.split('?')[0].replace(/index\.html$/, '');
      fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }).then((html) => {
        const head = `<base href="${esc(dir)}"><script>try{parent.JV_WATCH(window,${JSON.stringify(g.title).replace(/</g, "\\u003c")})}catch(e){}<\/script>`;
        frame.srcdoc = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + head) : head + html;
        const load = el.querySelector('#upLoad'); if (load) load.remove();
        frame.focus();
      }).catch(() => {
        const box = el.querySelector('#upLoad .box'); if (!box) return;
        box.innerHTML = '<h2>Ups</h2><p>Das Spiel konnte nicht geladen werden. Internet prüfen und nochmal versuchen.</p><button class="btn" type="button" data-b>Zurück</button>';
        box.querySelector('[data-b]').onclick = () => hub.back();
      });
    },
    stop() { }
  };
  // Das eingebettete Spiel meldet "zurück" (Knopf auf seinem Startbildschirm).
  addEventListener('message', (e) => {
    if (e.origin === location.origin && e.data && e.data.type === 'jv-back' && !$('#game').hidden) hub.back();
  });

  /* ---------- Umschalten: Startseite, Spiel, Admin ---------- */
  // Im Spiel bleibt am PC die Kopfzeile sichtbar (das Spiel beginnt darunter), am Handy gibt es Vollbild.
  const SECTIONS = ['spiele', 'rangliste', 'stand', 'arbeit'];
  const inGame = () => document.body.classList.contains('in-game');
  function setInGame(on) {
    document.body.classList.toggle('in-game', on);
    document.documentElement.style.setProperty('--top-h', $('.top').getBoundingClientRect().height + 'px');
  }
  addEventListener('resize', () => { if (inGame()) setInGame(true); });
  let current = null;
  function route() {
    let [id, arg] = decodeURIComponent(location.hash.slice(1)).split('/');
    // Einladungs-Link #spiel/CODE: direkt beitreten, danach die Adresse aufräumen
    if (arg && /^[A-Za-z0-9]{4}$/.test(arg)) { hub.intent = { join: arg.toUpperCase() }; history.replaceState(null, '', location.pathname + location.search + '#' + id); }
    if (id === 'admin') {
      if (current) { try { current.stop(); } catch (e) { } current = null; $('#game').innerHTML = ''; }
      $('#game').hidden = true; setInGame(false); demo.pause();
      if (isAdmin() && window.Admin) {
        $('#mainView').hidden = true; $('#maint').hidden = true; $('#adminView').hidden = false;
        Admin.render($('#adminView'), { refresh: () => Content.load(), toast });
      } else if (window.Auth && Auth.ready && !Auth.user()) {
        // Erst fragen, wenn feststeht, dass niemand angemeldet ist (sonst blitzt das Fenster kurz auf)
        $('#adminView').hidden = true; $('#mainView').hidden = false; if (Auth.loaded) openAccount();
      } else { history.replaceState(null, '', location.pathname + location.search); route(); }
      scrollTo(0, 0);
      return;
    }
    $('#adminView').hidden = true; $('#mainView').hidden = false;
    const g = findGame(id);
    const can = g && playable(g);
    if (current && (!can || current.id !== id)) { try { current.mod.stop(); } catch (e) { console.error(e); } current = null; $('#game').innerHTML = ''; }
    if (can) {
      setInGame(true); $('#game').hidden = false; demo.pause();
      if (!current) {
        const token = current = { id, mod: { stop() { } } };
        const player = g.kind === 'page' ? pagePlayer : g.kind === 'bundle' ? bundlePlayer : uploadPlayer;
        const starting = g.kind === 'builtin' ? loadGameModule(g.id) : Promise.resolve({ start: (el) => player.start(el, g), stop() { } });
        if (g.kind === 'builtin' && !(window.Games && window.Games[g.id])) $('#game').innerHTML = '<div class="g-panel"><div class="box"><h2>Lädt …</h2><div class="wait"><i></i><i></i><i></i></div></div></div>';
        starting.then((mod) => {
          if (current !== token) return;                 // inzwischen woanders hin gewechselt
          $('#game').innerHTML = ''; token.mod = mod; mod.start($('#game'), hub); hub.intent = null;
        }).catch((err) => {
          if (current !== token) return;
          $('#game').innerHTML = `<div class="g-panel"><div class="box"><h2>Ups</h2><p>${esc(err.message)}</p><button class="btn" type="button" data-b>Zurück</button></div></div>`;
          $('#game').querySelector('[data-b]').onclick = () => hub.back();
        });
      }
    } else {
      $('#game').hidden = true; setInGame(false); renderAll(); applyContent(); demo.resume(); hub.challenge = null;
      if (SECTIONS.includes(id)) requestAnimationFrame(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({ block: 'start' }); });
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
  renderContent(); renderAll();
  $('#games').addEventListener('click', (e) => {
    const t = e.target.closest('.game'); if (!t) return;
    const g = findGame(t.dataset.id);
    if (playable(g)) open(g.id); else toast(`${g ? g.title : 'Das Spiel'} ist noch in Arbeit.`);
  });
  $('#reportBtn').onclick = () => openReport();
  document.addEventListener('click', (e) => { if (e.target.closest('[data-report]')) openReport(e.target.closest('[data-report]').dataset.report || ''); });
  $('#playMain').onclick = () => open('airhockey');
  $('#featureCard').onclick = () => open('airhockey');
  $('#playBot').onclick = () => open('airhockey', 'bot');
  $('#acctBtn').onclick = openAccount;
  $('#standBox').addEventListener('click', (e) => { if (e.target.closest('[data-login]')) openAccount(); });
  // Links oben (Spiele, Spielstände, In Arbeit, Logo): aus dem Admin-Bereich oder einem Spiel
  // erst zurück zur Startseite, dann zum Bereich scrollen. Die Adresse bleibt sauber (sie steuert die Spiele).
  function goSection(sel) {
    const leaving = !!location.hash;
    if (leaving) { history.pushState(null, '', location.pathname + location.search); route(); }
    const behavior = leaving || reduced ? 'auto' : 'smooth';
    requestAnimationFrame(() => {
      const t = sel && document.querySelector(sel);
      if (t) t.scrollIntoView({ behavior }); else scrollTo({ top: 0, behavior });
    });
  }
  document.querySelectorAll('.links a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); goSection(a.getAttribute('href')); }));
  $('.brand').addEventListener('click', (e) => { e.preventDefault(); goSection(null); });
  addEventListener('hashchange', route);
  Content.onChange(() => { renderContent(); if (location.hash === '#admin' && !isAdmin()) route(); });
  if (window.Auth) {
    let firstAuth = true;
    Auth.onChange(() => {
      refreshCloud(); renderContent();
      if (firstAuth) { firstAuth = false; Content.load().then(() => { if (location.hash) route(); }); }
      else if (location.hash === '#admin') route();
    });
    Auth.init();
  }
  route();
  if (!store.name && !(window.Auth && Auth.ready) && !location.hash) askName(true);
})();

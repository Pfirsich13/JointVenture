/* =========================================================================
   hub.js – Startseite: Kacheln, Filter, Duell-Bilanz, Name, Umschalten
   Neues Spiel hinzufügen: unten in GAMES eintragen und ein Modul
   window.Games.<id> mit start(el, hub) und stop() bereitstellen.
   ========================================================================= */
(function () {
  const SITE_NAME = 'Duellhalle';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const FILTERS = [
    { id: 'alle', name: 'Alle' },
    { id: 'echtzeit', name: 'Echtzeit-Duell' },
    { id: 'reaktion', name: 'Reaktion' },
    { id: 'taktik', name: 'Taktik' },
    { id: 'solo', name: 'Solo mit Bot' }
  ];

  const ART = {
    airhockey: '<svg viewBox="0 0 260 130"><rect x="30" y="14" width="200" height="102" rx="20" fill="#fff" stroke="#16130f" stroke-width="4"/><line x1="130" y1="14" x2="130" y2="116" stroke="#16130f" stroke-width="3" stroke-dasharray="8 6"/><rect x="24" y="44" width="8" height="42" rx="3" fill="#16130f"/><rect x="228" y="44" width="8" height="42" rx="3" fill="#16130f"/><circle cx="70" cy="65" r="17" fill="#2453ff" stroke="#16130f" stroke-width="4"/><circle cx="192" cy="50" r="17" fill="#ff3a2a" stroke="#16130f" stroke-width="4"/><g class="puck-run" style="animation-duration:2.4s"><circle cx="118" cy="74" r="9" fill="#16130f"/></g></svg>',
    reaction: '<svg viewBox="0 0 260 130"><circle cx="130" cy="65" r="44" fill="#fff" stroke="#16130f" stroke-width="4"/><circle cx="130" cy="65" r="28" fill="#2ee86b" stroke="#16130f" stroke-width="4"/><path d="M60 40l-22-8M58 65H32M60 90l-22 8M200 40l22-8M202 65h26M200 90l22 8" stroke="#16130f" stroke-width="5" stroke-linecap="round"/></svg>',
    bomber: '<svg viewBox="0 0 260 130"><g fill="#fff" stroke="#16130f" stroke-width="3"><rect x="40" y="20" width="30" height="30"/><rect x="100" y="20" width="30" height="30"/><rect x="160" y="20" width="30" height="30"/><rect x="40" y="80" width="30" height="30"/><rect x="160" y="80" width="30" height="30"/></g><circle cx="125" cy="88" r="17" fill="#16130f"/><path d="M134 72q8-12 18-8" fill="none" stroke="#16130f" stroke-width="4"/><circle cx="154" cy="62" r="5" fill="#ffcf24" stroke="#16130f" stroke-width="2"/><rect x="204" y="78" width="26" height="30" rx="6" fill="#2453ff" stroke="#16130f" stroke-width="3"/></svg>',
    zombie: '<svg viewBox="0 0 260 130"><rect x="20" y="12" width="220" height="106" rx="12" fill="#232a1c" stroke="#16130f" stroke-width="4"/><g stroke="#16130f" stroke-width="3"><rect x="150" y="40" width="30" height="34" rx="5" fill="#9bc25a"/><rect x="196" y="52" width="26" height="30" rx="5" fill="#9bc25a"/><rect x="40" y="56" width="30" height="34" rx="5" fill="#2453ff"/></g><circle cx="160" cy="54" r="3" fill="#ff3a2a"/><circle cx="171" cy="54" r="3" fill="#ff3a2a"/><circle cx="205" cy="64" r="3" fill="#ff3a2a"/><circle cx="214" cy="64" r="3" fill="#ff3a2a"/><path d="M74 70h22" stroke="#16130f" stroke-width="6" stroke-linecap="round"/><path d="M104 70h34" stroke="#ffcf24" stroke-width="4" stroke-linecap="round" stroke-dasharray="8 7"/></svg>',
    arena: '<svg viewBox="0 0 260 130"><ellipse cx="130" cy="92" rx="104" ry="28" fill="#d8b277" stroke="#ffcf24" stroke-width="4"/><rect x="82" y="46" width="34" height="40" rx="4" fill="#2453ff" stroke="#ffcf24" stroke-width="3"/><rect x="146" y="46" width="34" height="40" rx="4" fill="#ff3a2a" stroke="#ffcf24" stroke-width="3"/><path d="M118 58l26-14" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>'
  };

  const GAMES = [
    { id: 'airhockey', title: 'Air-Hockey', live: true, c: '#2453ff', cats: ['echtzeit', 'solo'],
      desc: 'Scheibe ins Tor dreschen. Wer zuerst 7 Tore hat, gewinnt.', tags: ['1 gegen 1 online', 'Bot', '2 auf 1 Handy'] },
    { id: 'reaction', title: 'Reaktionsduell', c: '#ff3a2a', cats: ['reaktion', 'echtzeit'],
      desc: 'Warte auf das Signal und tippe schneller als der andere. Zu früh heißt verloren.', tags: ['1 gegen 1 online'] },
    { id: 'bomber', title: 'Mini-Bomber', c: '#ff4fa3', tc: '#16130f', cats: ['echtzeit', 'taktik'],
      desc: 'Bomben legen, Wände sprengen, den anderen erwischen.', tags: ['1 gegen 1 online'] },
    { id: 'arena', title: 'Arena-PvP', c: '#16130f', tc: '#ffcf24', cats: ['echtzeit'],
      desc: 'Das 3D-Kampfspiel aus dem Projekt deines Bruders. Kommt rein, sobald es fertig ist.', tags: ['3D', '1 gegen 1'] },
    { id: 'zombie', title: 'Zombie-Shooter', c: '#4b5d2a', cats: ['solo'],
      desc: 'Welle um Welle gegen Zombie-Horden. Wie lange überlebst du?', tags: ['PvE', 'Wellen'] }
  ];

  /* ---------- Speicher auf diesem Gerät ---------- */
  const KEY = 'duellhalle_v1';
  let store = { name: '', opp: '', stats: {} };
  try { const raw = localStorage.getItem(KEY); if (raw) store = Object.assign(store, JSON.parse(raw)); } catch (e) { }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { } }

  const hub = {
    getName: () => store.name || 'Spieler',
    recordResult(game, kind, won, oppName) {
      const g = store.stats[game] || (store.stats[game] = {});
      const k = g[kind] || (g[kind] = { w: 0, l: 0 });
      won ? k.w++ : k.l++;
      if (kind === 'online' && oppName) store.opp = String(oppName).slice(0, 20);
      save();
    },
    statsFor(game) { return store.stats[game] || {}; },
    back() { if (location.hash) history.replaceState(null, '', location.pathname + location.search); route(); }
  };
  window.Hub = hub;

  /* ---------- Startseite zeichnen ---------- */
  let filter = 'alle';
  function renderFilters() {
    $('#filters').innerHTML = FILTERS.map((f) => `<button class="chip" type="button" data-f="${f.id}" aria-pressed="${f.id === filter}">${f.name}</button>`).join('');
  }
  function renderTiles() {
    const list = GAMES.filter((g) => filter === 'alle' || g.cats.includes(filter));
    $('#grid').innerHTML = list.map((g) => `
      <button class="tile ${g.live ? '' : 'soon'}" type="button" data-id="${g.id}" style="--c:${g.c};${g.tc ? '--tc:' + g.tc : ''}">
        <span class="art" aria-hidden="true">${ART[g.id] || ''}</span>
        <span class="badge ${g.live ? 'live' : ''}">${g.live ? 'Spielbar' : 'In Arbeit'}</span>
        <span class="body">
          <span class="h">${esc(g.title)}</span>
          <span class="p">${esc(g.desc)}</span>
          <span class="tags">${g.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</span>
        </span>
      </button>`).join('');
  }
  function renderScore() {
    let w = 0, l = 0;
    for (const g of Object.values(store.stats)) { if (g.online) { w += g.online.w; l += g.online.l; } }
    $('#myName').textContent = hub.getName();
    $('#scMe').textContent = hub.getName();
    $('#scOp').textContent = store.opp || 'Gegner';
    $('#scMeN').textContent = w;
    $('#scOpN').textContent = l;
    $('#scoreNote').textContent = (w + l) ? `${w + l} Online-Duelle gespielt, gezählt auf diesem Handy.` : 'Noch kein Online-Duell gespielt. Zeit, das zu ändern.';
  }

  /* ---------- Namen ändern ---------- */
  function askName(first) {
    const el = document.createElement('div');
    el.className = 'sheet';
    el.innerHTML = `<form class="box"><h3>${first ? 'Wie heißt du?' : 'Name ändern'}</h3>
      <input class="field" id="nameIn" maxlength="16" autocomplete="nickname" placeholder="Dein Name">
      <div class="row">${first ? '' : '<button class="btn" type="button" data-x>Abbrechen</button>'}<button class="btn main" type="submit">Speichern</button></div></form>`;
    document.body.appendChild(el);
    const inp = el.querySelector('#nameIn');
    inp.value = store.name;
    setTimeout(() => inp.focus(), 50);
    el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = inp.value.trim().slice(0, 16);
      if (!v) { inp.focus(); return; }
      store.name = v; save(); el.remove(); renderScore();
    });
    const x = el.querySelector('[data-x]'); if (x) x.onclick = () => el.remove();
  }

  /* ---------- Umschalten zwischen Startseite und Spiel ---------- */
  let current = null;
  function route() {
    const id = location.hash.slice(1);
    const game = GAMES.find((g) => g.id === id && g.live);
    const mod = game && window.Games && window.Games[id];
    if (current && (!mod || current !== mod)) { try { current.stop(); } catch (e) { console.error(e); } current = null; $('#game').innerHTML = ''; }
    if (mod) {
      $('#hub').hidden = true; $('#game').hidden = false;
      if (!current) { current = mod; mod.start($('#game'), hub); }
    } else {
      $('#game').hidden = true; $('#hub').hidden = false; renderScore();
    }
  }
  function open(id) { location.hash = id; }

  let toastT = 0;
  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'g-net'; t.style.cssText = 'position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:60;font-size:15px;padding:8px 16px'; document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 1800);
  }

  /* ---------- Start ---------- */
  document.title = SITE_NAME; $('#siteName').textContent = SITE_NAME;
  renderFilters(); renderTiles(); renderScore();
  $('#filters').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f; renderFilters(); renderTiles(); });
  $('#grid').addEventListener('click', (e) => {
    const t = e.target.closest('.tile'); if (!t) return;
    const g = GAMES.find((x) => x.id === t.dataset.id);
    if (g && g.live) open(g.id); else toast(`${g ? g.title : 'Das Spiel'} ist noch in Arbeit.`);
  });
  $('#quickPlay').onclick = () => open('airhockey');
  $('#editName').onclick = () => askName(false);
  addEventListener('hashchange', route);
  route();
  if (!store.name) askName(true);
})();

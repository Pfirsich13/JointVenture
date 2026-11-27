/* =========================================================================
   social.js – Freunde (Teil 3), später Chat und Online-Status
   -------------------------------------------------------------------------
   Social.open(tab)      -> Fenster „Freunde“ öffnen (am PC unten rechts, am Handy Vollbild)
   Social.avatar(p, cls) -> Profilbild als HTML (mit data-uid für den Status-Punkt)
   Daten: Tabellen friendships und blocks (RLS: nur die Beteiligten sehen sie),
   Spielersuche über die RPC search_players (liefert nur id, Name, Bild).
   ========================================================================= */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const db = () => Auth.client();
  const me = () => (window.Auth && Auth.user() ? Auth.user().id : null);
  const toast = (m) => { if (window.Hub && Hub.toast) Hub.toast(m); };

  const state = { uid: null, friendships: [], blocks: [], profiles: {}, loaded: false };
  let dock = null, tab = 'friends', channel = null, pollT = 0, searchT = 0, lastQuery = '';

  /* ---------- Hilfen ---------- */
  function avatar(p, cls) {
    p = p || {};
    const url = p.avatar_path && Auth.avatarUrl ? Auth.avatarUrl(p.avatar_path) : '';
    const letter = ((p.name || '?')[0] || '?').toUpperCase();
    return `<span class="av ${cls || 'sm'}"${p.id ? ` data-uid="${esc(p.id)}"` : ''}>${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : esc(letter)}</span>`;
  }
  const other = (f) => (f.requester === state.uid ? f.addressee : f.requester);
  const prof = (id) => state.profiles[id] || { id, name: 'Spieler' };
  const incoming = () => state.friendships.filter((f) => f.status === 'pending' && f.addressee === state.uid);
  const outgoing = () => state.friendships.filter((f) => f.status === 'pending' && f.requester === state.uid);
  const friends = () => state.friendships.filter((f) => f.status === 'accepted')
    .sort((a, b) => prof(other(a)).name.localeCompare(prof(other(b)).name, 'de'));
  const relation = (id) => {
    if (state.blocks.some((b) => b.blocked === id)) return { kind: 'blocked' };
    const f = state.friendships.find((x) => other(x) === id);
    if (!f) return { kind: 'none' };
    if (f.status === 'accepted') return { kind: 'friend', f };
    return { kind: f.requester === state.uid ? 'out' : 'in', f };
  };
  function deErr(e) {
    const m = (e && (e.message || e.details)) || String(e);
    if (e && e.code === '23505') return 'Zwischen euch gibt es schon eine Anfrage.';
    if (/row-level security|violates row/i.test(m)) return 'Das geht leider nicht (vielleicht wurdest du blockiert).';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Keine Verbindung. Prüfe dein Internet.';
    return m;
  }
  function since(t) {
    const d = new Date(t);
    return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }

  /* ---------- Daten ---------- */
  async function loadProfiles(ids) {
    ids = [...new Set(ids)].filter(Boolean);
    if (!ids.length) return;
    const { data, error } = await db().from('profiles').select('id,name,avatar_path').in('id', ids);
    if (error) throw error;
    (data || []).forEach((p) => { state.profiles[p.id] = Object.assign(state.profiles[p.id] || {}, p); });
  }
  async function load() {
    const uid = me(); if (!uid) return;
    const [fr, bl] = await Promise.all([
      db().from('friendships').select('id,requester,addressee,status,created_at,accepted_at').order('created_at', { ascending: false }),
      db().from('blocks').select('blocked,created_at')
    ]);
    if (fr.error) throw fr.error;
    if (uid !== me()) return;                                   // inzwischen abgemeldet
    state.uid = uid; state.friendships = fr.data || []; state.blocks = bl.data || [];
    await loadProfiles([...state.friendships.map(other), ...state.blocks.map((b) => b.blocked)]);
    state.loaded = true; updateBadge(); if (dock && tab === 'friends') renderFriends();
  }
  let loadT = 0;
  const reload = () => { clearTimeout(loadT); loadT = setTimeout(() => load().catch((e) => console.warn(e)), 250); };

  /* ---------- Zahl am Freunde-Knopf ---------- */
  function badgeCount() { return incoming().length; }
  function updateBadge() {
    const n = state.uid ? badgeCount() : 0;
    const b = $('#friendsBtn .cnt'); if (b) { b.textContent = n > 99 ? '99+' : String(n); b.hidden = !n; }
    const btn = $('#friendsBtn'); if (btn) btn.setAttribute('aria-label', n ? `Freunde, ${n} neu` : 'Freunde');
    const t = dock && $('[data-stab=friends] .cnt', dock); if (t) { t.textContent = String(incoming().length); t.hidden = !incoming().length; }
  }

  /* ---------- Fenster ---------- */
  function open(which) {
    if (!me()) { if (window.Hub && Hub.login) Hub.login('Melde dich an, um Freunde hinzuzufügen.'); return; }
    tab = which || tab || 'friends';
    if (!dock) {
      dock = document.createElement('aside');
      dock.className = 'social'; dock.setAttribute('role', 'dialog'); dock.setAttribute('aria-label', 'Freunde');
      dock.innerHTML = `<div class="so-head"><div class="so-tabs" role="tablist">
          <button type="button" role="tab" data-stab="friends">Freunde <span class="cnt" hidden></span></button>
        </div><button class="so-x" type="button" aria-label="Schließen" title="Schließen">×</button></div>
        <div class="so-body"></div>`;
      document.body.appendChild(dock);
      dock.querySelector('.so-x').onclick = close;
      dock.querySelector('.so-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-stab]'); if (b) show(b.dataset.stab); });
      dock.addEventListener('click', onClick);
      dock.addEventListener('submit', onSubmit);
      dock.addEventListener('input', onInput);
      document.body.classList.add('so-open');
    }
    show(tab);
    if (!state.loaded) load().catch((e) => { const body = $('.so-body', dock); if (body) body.innerHTML = `<p class="empty">${esc(deErr(e))}</p>`; });
  }
  function close() { if (dock) { dock.remove(); dock = null; document.body.classList.remove('so-open'); } }
  function show(which) {
    tab = which;
    dock.querySelectorAll('[data-stab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.stab === tab)));
    if (tab === 'friends') renderFriends();
    updateBadge();
  }

  /* ---------- Reiter „Freunde“ ---------- */
  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9h4M8 7v4M15 9.5h.01M18 8h.01M7.5 5h9a4.5 4.5 0 0 1 4.4 5.4l-1 5a3 3 0 0 1-5.3 1.3L13.5 15h-3l-1.1 1.7a3 3 0 0 1-5.3-1.3l-1-5A4.5 4.5 0 0 1 7.5 5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg>'
  };
  function row(p, sub, actions, extra) {
    return `<div class="so-row" data-uid="${esc(p.id)}">${avatar(p)}<div class="so-who"><b>${esc(p.name)}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="so-act">${actions}</div>${extra || ''}</div>`;
  }
  function renderFriends() {
    const body = $('.so-body', dock); if (!body) return;
    const keepQ = (body.querySelector('[name=q]') || {}).value || '';
    const inc = incoming(), out = outgoing(), fr = friends();
    body.innerHTML = `<form class="so-search" role="search"><input class="field" name="q" type="search" placeholder="Spieler suchen (Name)" maxlength="30" autocomplete="off" value="${esc(keepQ)}" aria-label="Spieler suchen"></form>
      <div class="so-results" aria-live="polite"></div>
      ${!state.loaded ? '<p class="empty">Lädt …</p>' : ''}
      ${inc.length ? `<h4>Anfragen <span class="cnt">${inc.length}</span></h4>${inc.map((f) => row(prof(other(f)), 'möchte dein Freund sein',
        `<button class="sbtn pri" type="button" data-accept="${f.id}">Annehmen</button><button class="sbtn" type="button" data-decline="${f.id}">Ablehnen</button>`)).join('')}` : ''}
      ${state.loaded ? `<h4>Deine Freunde${fr.length ? ` · ${fr.length}` : ''}</h4>
      ${fr.length ? fr.map((f) => { const p = prof(other(f)); return row(p, esc(statusText(p, f)),
        `<button class="ibtn" type="button" data-challenge="${esc(p.id)}" title="Herausfordern" aria-label="${esc(p.name)} herausfordern">${ICON.play}</button>
         <button class="ibtn" type="button" data-more="${esc(p.id)}" title="Mehr" aria-label="Mehr zu ${esc(p.name)}" aria-expanded="false">${ICON.more}</button>`,
        `<div class="so-menu" hidden><button class="sbtn" type="button" data-challenge="${esc(p.id)}">Herausfordern</button><button class="sbtn" type="button" data-remove="${f.id}">Entfernen</button><button class="sbtn bad" type="button" data-block="${esc(p.id)}">Blockieren</button></div>`); }).join('')
        : '<p class="empty">Noch keine Freunde. Such oben nach einem Namen und schick eine Anfrage.</p>'}` : ''}
      ${out.length ? `<h4>Gesendet</h4>${out.map((f) => row(prof(other(f)), 'wartet auf Antwort', `<button class="sbtn" type="button" data-decline="${f.id}">Zurückziehen</button>`)).join('')}` : ''}
      ${state.blocks.length ? `<details class="so-blocked"><summary>Blockiert · ${state.blocks.length}</summary>${state.blocks.map((b) => row(prof(b.blocked), '', `<button class="sbtn" type="button" data-unblock="${esc(b.blocked)}">Freigeben</button>`)).join('')}</details>` : ''}`;
    if (keepQ) search(keepQ, true);
  }
  function statusText(p, f) { return f && f.accepted_at ? 'Freunde seit ' + since(f.accepted_at) : 'Freund'; }

  async function search(q, quiet) {
    const box = dock && $('.so-results', dock); if (!box) return;
    q = q.trim(); lastQuery = q;
    if (!q) { box.innerHTML = ''; return; }
    if (!quiet) box.innerHTML = '<p class="empty">Sucht …</p>';
    const { data, error } = await db().rpc('search_players', { q });
    if (q !== lastQuery || !dock) return;
    if (error) { box.innerHTML = `<p class="empty">${esc(deErr(error))}</p>`; return; }
    if (!data.length) { box.innerHTML = `<p class="empty">Niemand mit „${esc(q)}“ gefunden.</p>`; return; }
    data.forEach((p) => { state.profiles[p.id] = Object.assign(state.profiles[p.id] || {}, p); });
    box.innerHTML = `<div class="so-list">${data.map((p) => {
      const r = relation(p.id);
      const act = r.kind === 'friend' ? '<span class="so-tag">Freund</span>'
        : r.kind === 'out' ? '<span class="so-tag">Angefragt</span>'
        : r.kind === 'in' ? `<button class="sbtn pri" type="button" data-accept="${r.f.id}">Annehmen</button>`
        : r.kind === 'blocked' ? `<button class="sbtn" type="button" data-unblock="${esc(p.id)}">Freigeben</button>`
        : `<button class="sbtn pri" type="button" data-add="${esc(p.id)}">Anfrage senden</button>`;
      return row(p, '', act);
    }).join('')}</div>`;
  }

  /* ---------- Aktionen ---------- */
  async function run(btn, fn, okMsg) {
    btn.disabled = true;
    try { await fn(); if (okMsg) toast(okMsg); await load(); }
    catch (e) { toast(deErr(e)); btn.disabled = false; }
  }
  function onInput(e) {
    if (e.target.name !== 'q') return;
    clearTimeout(searchT); const v = e.target.value;
    searchT = setTimeout(() => search(v), 300);
  }
  function onSubmit(e) {
    if (!e.target.classList.contains('so-search')) return;
    e.preventDefault(); clearTimeout(searchT); search(e.target.elements.q.value);
  }
  function onClick(e) {
    const b = e.target.closest('button'); if (!b || !dock.contains(b)) return;
    const d = b.dataset, name = (id) => prof(id).name;
    if (d.more) {
      const menu = b.closest('.so-row').querySelector('.so-menu'), on = menu.hidden;
      dock.querySelectorAll('.so-menu').forEach((m) => { m.hidden = true; });
      dock.querySelectorAll('[data-more]').forEach((x) => x.setAttribute('aria-expanded', 'false'));
      menu.hidden = !on; b.setAttribute('aria-expanded', String(on));
    } else if (d.add) {
      run(b, async () => { const { error } = await db().from('friendships').insert({ addressee: d.add }); if (error) throw error; }, `Anfrage an ${name(d.add)} gesendet`);
    } else if (d.accept) {
      const f = state.friendships.find((x) => x.id === Number(d.accept));
      run(b, async () => { const { error } = await db().from('friendships').update({ status: 'accepted' }).eq('id', Number(d.accept)); if (error) throw error; }, f ? `Du bist jetzt mit ${name(other(f))} befreundet` : 'Angenommen');
    } else if (d.decline) {
      run(b, async () => { const { error } = await db().from('friendships').delete().eq('id', Number(d.decline)); if (error) throw error; });
    } else if (d.remove) {
      const f = state.friendships.find((x) => x.id === Number(d.remove)); if (!f) return;
      if (!confirm(`${name(other(f))} als Freund entfernen?`)) return;
      run(b, async () => { const { error } = await db().from('friendships').delete().eq('id', f.id); if (error) throw error; }, 'Freund entfernt');
    } else if (d.block) {
      const n = name(d.block);
      if (!confirm(`${n} blockieren? Ihr seid dann keine Freunde mehr, und ${n} kann dir keine Anfragen und Nachrichten mehr schicken.`)) return;
      run(b, async () => { const { error } = await db().from('blocks').insert({ blocked: d.block }); if (error) throw error; }, `${n} ist blockiert`);
    } else if (d.unblock) {
      run(b, async () => { const { error } = await db().from('blocks').delete().eq('blocked', d.unblock); if (error) throw error; }, `${name(d.unblock)} ist wieder freigegeben`);
    } else if (d.challenge) {
      challenge(d.challenge);
    } else if (d.pickGame) {
      const p = prof(d.pickFor);
      close(); Hub.startChallenge({ id: p.id, name: p.name }, d.pickGame);
    } else if (d.pickCancel) {
      renderFriends();
    }
  }

  /* ---------- Herausfordern: Spiel wählen, Raum öffnen, Einladung über hub.invite ---------- */
  function challenge(id) {
    const p = prof(id), games = window.Hub && Hub.onlineGames ? Hub.onlineGames() : [];
    const body = $('.so-body', dock);
    body.innerHTML = `<h4>${esc(p.name)} herausfordern</h4>
      ${games.length ? `<p class="so-note">Wähle ein Spiel. Es öffnet sich ein Raum, und du schickst ${esc(p.name)} die Einladung.</p>
        <div class="so-games">${games.map((g) => `<button class="btn" type="button" data-pick-game="${esc(g.id)}" data-pick-for="${esc(p.id)}">${esc(g.title)}</button>`).join('')}</div>`
        : '<p class="empty">Gerade gibt es kein Online-Spiel.</p>'}
      <button class="sbtn so-back" type="button" data-pick-cancel="1">Zurück</button>`;
  }

  /* ---------- Live-Updates ---------- */
  function subscribe(uid) {
    unsubscribe();
    const c = db();
    if (!c || !c.channel) return;
    const onRow = (payload) => {
      const n = payload.new || {};
      if (payload.eventType === 'INSERT' && n.addressee === uid && n.status === 'pending') {
        loadProfiles([n.requester]).then(() => toast(`${prof(n.requester).name} möchte dein Freund sein`)).catch(() => { });
      }
      if (payload.eventType === 'UPDATE' && n.requester === uid && n.status === 'accepted') {
        loadProfiles([n.addressee]).then(() => toast(`${prof(n.addressee).name} hat deine Anfrage angenommen`)).catch(() => { });
      }
      reload();
    };
    channel = c.channel('freunde-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `addressee=eq.${uid}` }, onRow)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `requester=eq.${uid}` }, onRow)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'friendships' }, (p) => {
        if (state.friendships.some((f) => f.id === (p.old || {}).id)) reload();
      })
      .subscribe();
  }
  function unsubscribe() { if (channel) { try { db().removeChannel(channel); } catch (e) { } channel = null; } }

  /* ---------- An- und Abmelden ---------- */
  function onAuth() {
    const uid = me();
    const btn = $('#friendsBtn'); if (btn) btn.hidden = !(window.Auth && Auth.ready);
    if (uid === state.uid && state.loaded) return;
    unsubscribe(); clearInterval(pollT);
    state.uid = uid; state.friendships = []; state.blocks = []; state.loaded = false; updateBadge();
    if (!uid) { close(); return; }
    load().catch((e) => console.warn(e));
    subscribe(uid);
    pollT = setInterval(() => { if (!document.hidden) reload(); }, 60000);   // falls Live-Updates mal ausfallen
  }
  if (window.Auth) Auth.onChange(onAuth);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && dock && !document.querySelector('.sheet')) close(); });
  function bindButton() { const b = $('#friendsBtn'); if (b && !b.onclick) b.onclick = () => (dock ? close() : open('friends')); }
  bindButton(); document.addEventListener('DOMContentLoaded', bindButton);

  window.Social = { open, close, avatar, reload, state };
})();

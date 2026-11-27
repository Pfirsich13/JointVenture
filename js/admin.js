/* =========================================================================
   admin.js – Admin-Panel (nur für Admins sichtbar, Adresse #admin)
   -------------------------------------------------------------------------
   Bereiche: Übersicht, Texte, Spiele (inkl. Upload), Projekte, Spieler,
   Einstellungen (Ankündigung, Wartungsmodus, Export).
   Die Datenbank prüft selbst, ob jemand Admin ist. Dieses Panel ist nur
   die Oberfläche dafür.
   ========================================================================= */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const db = () => Auth.client();
  const now = () => new Date().toISOString();
  const TABS = [
    ['overview', 'Übersicht'], ['texts', 'Texte'], ['games', 'Spiele'],
    ['projects', 'Projekte'], ['players', 'Spieler'], ['settings', 'Einstellungen']
  ];
  const STATUS_OPTS = [['live', 'Spielbar'], ['beta', 'Beta'], ['soon', 'Bald'], ['hidden', 'Versteckt'], ['review', 'Zur Freigabe']];
  let root = null, ctx = null, tab = 'overview';
  try { tab = sessionStorage.getItem('jv_admin_tab') || 'overview'; } catch (e) { }

  function ago(t) {
    const m = Math.round((Date.now() - Date.parse(t)) / 60000);
    if (m < 1) return 'gerade eben'; if (m < 60) return `vor ${m} Min.`;
    const h = Math.round(m / 60); if (h < 24) return `vor ${h} Std.`;
    const d = Math.round(h / 24); return d === 1 ? 'gestern' : `vor ${d} Tagen`;
  }
  const slug = (t) => String(t).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  async function saved(msg) { await ctx.refresh(); ctx.toast(msg || 'Gespeichert'); }
  function fail(e) { console.error(e); ctx.toast('Fehler: ' + ((e && e.message) || e)); }
  function busy(btn, on) { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.t = btn.textContent; btn.textContent = 'Speichert …'; } else if (btn.dataset.t) btn.textContent = btn.dataset.t; }

  /* ---------- Gerüst ---------- */
  function render(el, context) {
    root = el; ctx = context;
    root.innerHTML = `<div class="wrap adm">
      <div class="adm-head"><div><p class="kicker">Admin</p><h1>Seite verwalten</h1></div><a class="btn" href="#">Zur Seite</a></div>
      <nav class="adm-tabs" role="tablist">${TABS.map(([id, n]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${id === tab}">${n}</button>`).join('')}</nav>
      <div class="adm-body" id="admBody"><p class="empty">Lädt …</p></div></div>`;
    root.querySelector('.adm-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      tab = b.dataset.tab; try { sessionStorage.setItem('jv_admin_tab', tab); } catch (err) { }
      root.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      show();
    });
    show();
  }
  function show() {
    // frisches Element, damit keine alten Klick-Handler hängen bleiben
    const old = root.querySelector('#admBody'), body = old.cloneNode(false); old.replaceWith(body);
    body.innerHTML = '<p class="empty">Lädt …</p>';
    ({ overview, texts, games, projects, players, settings })[tab](body).catch((e) => { body.innerHTML = `<p class="msg">Konnte nicht laden: ${esc(e.message || e)}</p>`; });
  }

  /* ---------- Übersicht ---------- */
  async function overview(body) {
    const [pr, rs] = await Promise.all([
      db().from('profiles').select('id,name,role,created_at'),
      db().from('results').select('user_id,game,mode,won,score,opponent,created_at').order('created_at', { ascending: false }).limit(1000)
    ]);
    if (pr.error) throw pr.error; if (rs.error) throw rs.error;
    const names = Object.fromEntries(pr.data.map((p) => [p.id, p.name]));
    const res = rs.data, today = new Date().toDateString();
    const todayCount = res.filter((r) => new Date(r.created_at).toDateString() === today).length;
    const online = res.filter((r) => r.mode === 'online').length;
    const perGame = {}; res.forEach((r) => { perGame[r.game] = (perGame[r.game] || 0) + 1; });
    const titles = Object.fromEntries((Content.get().games || []).map((g) => [g.id, g.title]));
    const top = Object.entries(perGame).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = top.length ? top[0][1] : 1;
    const pending = (Content.get().games || []).filter((g) => g.status === 'review');
    body.innerHTML = `
      ${pending.length ? `<div class="panel pending-box"><h3>Wartet auf deine Freigabe</h3>${pending.map((g) => `<div class="pend" data-id="${esc(g.id)}"><span><b>${esc(g.title)}</b><small>${g.version ? 'Version ' + esc(g.version) + ' · ' : ''}<a href="#${esc(g.id)}">Jetzt testen</a></small></span><span class="pend-btns"><button class="btn" type="button" data-release="beta">Als Beta</button><button class="btn primary" type="button" data-release="live">Spielbar</button></span></div>`).join('')}</div>` : ''}
      <div class="kpis">
        <div class="kpi"><strong>${pr.data.length}</strong><span>Spieler</span></div>
        <div class="kpi"><strong>${res.length}</strong><span>Matches gesamt</span></div>
        <div class="kpi"><strong>${todayCount}</strong><span>Matches heute</span></div>
        <div class="kpi"><strong>${online}</strong><span>davon online</span></div>
      </div>
      <div class="adm-grid">
        <div class="panel"><h3>Beliebteste Spiele</h3>${top.length ? top.map(([g, n]) => `<div class="hbar"><span>${esc(titles[g] || g)}</span><div><i style="width:${Math.round(n / max * 100)}%"></i></div><b>${n}</b></div>`).join('') : '<p class="empty">Noch keine Matches.</p>'}</div>
        <div class="panel"><h3>Letzte Matches</h3>${res.length ? `<ol class="hist">${res.slice(0, 10).map((r) => `<li><span><b>${esc(names[r.user_id] || 'Spieler')}: ${esc(titles[r.game] || r.game)} gegen ${esc(r.opponent || 'Gegner')}</b><small>${r.mode === 'online' ? 'Online' : r.mode === 'bot' ? 'Training' : 'Lokal'} · ${ago(r.created_at)}</small></span><span class="sc">${esc(r.score || '')}</span><span class="res ${r.won ? 'w' : 'l'}">${r.won ? 'Sieg' : 'Niederlage'}</span></li>`).join('')}</ol>` : '<p class="empty">Noch keine Matches.</p>'}</div>
      </div>`;
  }

  // Freischalten (Übersicht und Spiele-Karten)
  async function release(id, status) {
    const { error } = await db().from('games').update({ status, updated_at: now() }).eq('id', id);
    if (error) return fail(error);
    await saved(status === 'live' ? 'Freigeschaltet: jetzt für alle spielbar' : 'Als Beta freigeschaltet'); show();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-release]'); if (!b || !root || !root.contains(b)) return;
    release(b.closest('[data-id]').dataset.id, b.dataset.release);
  });

  /* ---------- Texte ---------- */
  const TEXT_FIELDS = [
    ['name', 'Name der Seite', 'input', 40],
    ['kicker', 'Kleine Zeile über der Überschrift', 'input', 60],
    ['tagline', 'Große Überschrift', 'input', 80],
    ['lead', 'Einleitungstext', 'textarea', 300],
    ['gamesHint', 'Text neben „Spiele“', 'input', 80],
    ['standHint', 'Text neben „Spielstände“ (leer = automatisch)', 'input', 80],
    ['projectsHint', 'Text neben „In Arbeit“', 'input', 80],
    ['footer', 'Fußzeile', 'input', 120]
  ];
  async function texts(body) {
    const site = Content.get().site || {};
    body.innerHTML = `<form class="panel form" id="txtForm">
      ${TEXT_FIELDS.map(([k, label, type, max]) => `<label class="f"><span>${label}</span>${type === 'textarea'
        ? `<textarea class="field" name="${k}" maxlength="${max}" rows="3">${esc(site[k])}</textarea>`
        : `<input class="field" name="${k}" maxlength="${max}" value="${esc(site[k])}">`}</label>`).join('')}
      <div class="row"><button class="btn primary" type="submit">Texte speichern</button></div></form>`;
    const f = body.querySelector('#txtForm');
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); const btn = f.querySelector('[type=submit]'); busy(btn, true);
      const value = {}; TEXT_FIELDS.forEach(([k]) => { value[k] = f.elements[k].value.trim(); });
      if (!value.name) value.name = 'JointVenture';
      const { error } = await db().from('site_settings').upsert({ key: 'site', value, updated_at: now() });
      busy(btn, false); if (error) return fail(error); saved('Texte gespeichert');
    });
  }

  /* ---------- Spiele ---------- */
  async function uploadFile(path, file, asText) {
    const blob = asText ? new Blob([await file.text()], { type: 'text/plain' }) : file;
    const { error } = await db().storage.from('games').upload(path, blob, { upsert: true, contentType: asText ? 'text/plain' : file.type, cacheControl: '60' });
    if (error) throw error;
  }
  function checkHtml(file) {
    if (!file) return 'Bitte eine HTML-Datei auswählen.';
    if (!/\.html?$/i.test(file.name)) return 'Die Spieldatei muss eine .html-Datei sein.';
    if (file.size > 20 * 1024 * 1024) return 'Die Datei ist größer als 20 MB.';
    return '';
  }
  function checkImg(file) {
    if (!file) return '';
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return 'Titelbild bitte als PNG, JPG oder WebP.';
    if (file.size > 5 * 1024 * 1024) return 'Das Titelbild ist größer als 5 MB.';
    return '';
  }
  const imgExt = (f) => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[f.type]);

  async function games(body) {
    const { data: list, error } = await db().from('games').select('*').order('sort').order('title');
    if (error) throw error;
    body.innerHTML = `
      <details class="panel new" ${list.length ? '' : 'open'}><summary>+ Neues Spiel oder Beta-Version hochladen</summary>
        <form class="form" id="newGame">
          <p class="hint">Ein Spiel ist eine einzelne HTML-Datei, in der alles steckt (wie der Arena-Prototyp). Es läuft abgeschirmt in einem eigenen Rahmen.</p>
          <label class="f"><span>Titel</span><input class="field" name="title" maxlength="40" required></label>
          <label class="f"><span>Kurzname für die Adresse (automatisch)</span><input class="field" name="id" maxlength="40" required></label>
          <label class="f"><span>Beschreibung</span><textarea class="field" name="description" maxlength="200" rows="2"></textarea></label>
          <div class="f2"><label class="f"><span>Status</span><select class="field" name="status">${STATUS_OPTS.map(([v, n]) => `<option value="${v}" ${v === 'beta' ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="f"><span>Version</span><input class="field" name="version" maxlength="20" value="0.1"></label></div>
          <label class="f"><span>Spieldatei (.html)</span><input class="field" name="file" type="file" accept=".html,.htm,text/html" required></label>
          <label class="f"><span>Titelbild (optional)</span><input class="field" name="cover" type="file" accept="image/png,image/jpeg,image/webp"></label>
          <p class="msg"></p>
          <div class="row"><button class="btn primary" type="submit">Hochladen</button></div>
        </form></details>
      <div class="cards" id="gameCards">${list.map((g, i) => gameCard(g, i, list.length)).join('')}</div>`;

    const nf = body.querySelector('#newGame');
    nf.elements.title.addEventListener('input', () => { if (!nf.elements.id.dataset.touched) nf.elements.id.value = slug(nf.elements.title.value); });
    nf.elements.id.addEventListener('input', () => { nf.elements.id.dataset.touched = '1'; });
    nf.addEventListener('submit', async (e) => {
      e.preventDefault(); const msg = nf.querySelector('.msg'); msg.textContent = '';
      const id = slug(nf.elements.id.value), file = nf.elements.file.files[0], cover = nf.elements.cover.files[0];
      const problem = (!/^[a-z0-9-]{2,40}$/.test(id) && 'Kurzname: nur a-z, 0-9 und Bindestrich, mind. 2 Zeichen.') || (list.some((g) => g.id === id) && 'Diesen Kurznamen gibt es schon.') || ['admin'].includes(id) && 'Dieser Kurzname ist reserviert.' || checkHtml(file) || checkImg(cover);
      if (problem) { msg.textContent = problem; return; }
      const btn = nf.querySelector('[type=submit]'); busy(btn, true);
      try {
        await uploadFile(`${id}/index.html`, file, true);
        let cover_path = null;
        if (cover) { cover_path = `${id}/cover.${imgExt(cover)}`; await uploadFile(cover_path, cover, false); }
        const maxSort = list.reduce((m, g) => Math.max(m, g.sort), 0);
        const { error: err } = await db().from('games').insert({
          id, title: nf.elements.title.value.trim(), description: nf.elements.description.value.trim(), status: nf.elements.status.value,
          kind: 'upload', file_path: `${id}/index.html`, cover_path, version: nf.elements.version.value.trim() || null, sort: maxSort + 10, updated_at: now()
        });
        if (err) throw err;
        await saved('Spiel hochgeladen'); show();
      } catch (err) { msg.textContent = 'Fehler: ' + (err.message || err); busy(btn, false); }
    });

    const cards = body.querySelector('#gameCards');
    cards.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const card = b.closest('[data-id]'), id = card.dataset.id, i = list.findIndex((g) => g.id === id), g = list[i];
      if (b.dataset.act === 'up' || b.dataset.act === 'down') {
        const j = b.dataset.act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= list.length) return;
        const o = list[j], a = g.sort === o.sort ? g.sort + (j > i ? 1 : -1) : o.sort;
        const r1 = await db().from('games').update({ sort: a, updated_at: now() }).eq('id', g.id);
        const r2 = await db().from('games').update({ sort: g.sort, updated_at: now() }).eq('id', o.id);
        if (r1.error || r2.error) return fail(r1.error || r2.error);
        await saved('Reihenfolge geändert'); show();
      }
      if (b.dataset.act === 'del') {
        if (!confirm(`„${g.title}“ wirklich löschen? Das kann nicht rückgängig gemacht werden.`)) return;
        try {
          const { data: files } = await db().storage.from('games').list(g.id);
          if (files && files.length) await db().storage.from('games').remove(files.map((f) => `${g.id}/${f.name}`));
          const { error: err } = await db().from('games').delete().eq('id', g.id); if (err) throw err;
          await saved('Spiel gelöscht'); show();
        } catch (err) { fail(err); }
      }
    });
    cards.addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target, id = f.closest('[data-id]').dataset.id, g = list.find((x) => x.id === id);
      const msg = f.querySelector('.msg'); msg.textContent = '';
      const file = f.elements.file && f.elements.file.files[0], cover = f.elements.cover && f.elements.cover.files[0];
      const problem = (file && checkHtml(file)) || checkImg(cover);
      if (problem) { msg.textContent = problem; return; }
      const btn = f.querySelector('[type=submit]'); busy(btn, true);
      try {
        const upd = { title: f.elements.title.value.trim() || g.title, description: f.elements.description.value.trim(), status: f.elements.status.value, version: f.elements.version.value.trim() || null, updated_at: now() };
        if (file) { await uploadFile(`${id}/index.html`, file, true); upd.file_path = `${id}/index.html`; }
        if (cover) { upd.cover_path = `${id}/cover.${imgExt(cover)}`; await uploadFile(upd.cover_path, cover, false); }
        const { error: err } = await db().from('games').update(upd).eq('id', id); if (err) throw err;
        await saved(file ? 'Neue Version hochgeladen' : 'Spiel gespeichert'); show();
      } catch (err) { msg.textContent = 'Fehler: ' + (err.message || err); busy(btn, false); }
    });
  }
  function gameCard(g, i, n) {
    const up = g.kind === 'upload';
    return `<article class="panel card ${g.status === 'review' ? 'pending' : ''}" data-id="${esc(g.id)}">
      ${g.status === 'review' ? `<div class="pend-note"><span>Neu, wartet auf Freigabe. <a href="#${esc(g.id)}">Testen</a></span><span class="pend-btns"><button class="btn" type="button" data-release="beta">Als Beta</button><button class="btn primary" type="button" data-release="live">Spielbar</button></span></div>` : ''}
      <div class="card-head"><div><b>${esc(g.title)}</b><small>${up ? 'Hochgeladen' : 'Eingebaut'} · #${esc(g.id)}${g.updated_at ? ' · geändert ' + ago(g.updated_at) : ''}</small></div>
        <div class="ord"><button class="icon" type="button" data-act="up" aria-label="Nach oben" ${i === 0 ? 'disabled' : ''}>↑</button><button class="icon" type="button" data-act="down" aria-label="Nach unten" ${i === n - 1 ? 'disabled' : ''}>↓</button></div></div>
      <form class="form">
        <label class="f"><span>Titel</span><input class="field" name="title" maxlength="40" value="${esc(g.title)}"></label>
        <label class="f"><span>Beschreibung</span><textarea class="field" name="description" maxlength="200" rows="2">${esc(g.description)}</textarea></label>
        <div class="f2"><label class="f"><span>Status</span><select class="field" name="status">${STATUS_OPTS.map(([v, nm]) => `<option value="${v}" ${v === g.status ? 'selected' : ''}>${nm}</option>`).join('')}</select></label>
        <label class="f"><span>Version</span><input class="field" name="version" maxlength="20" value="${esc(g.version || '')}"></label></div>
        ${up ? `<label class="f"><span>Neue Version hochladen (.html, optional)</span><input class="field" name="file" type="file" accept=".html,.htm,text/html"></label>` : ''}
        <label class="f"><span>Titelbild ${g.cover_path ? 'ersetzen' : 'hinzufügen'} (optional)</span><input class="field" name="cover" type="file" accept="image/png,image/jpeg,image/webp"></label>
        <p class="msg"></p>
        <div class="row">${up ? '<button class="btn danger" type="button" data-act="del">Löschen</button>' : ''}<button class="btn primary" type="submit">Speichern</button></div>
      </form></article>`;
  }

  /* ---------- Projekte ---------- */
  async function projects(body) {
    const { data: list, error } = await db().from('projects').select('*').order('sort').order('id');
    if (error) throw error;
    body.innerHTML = `<div class="row top"><button class="btn primary" type="button" id="addProj">+ Neues Projekt</button></div>
      <div class="cards">${list.map((p, i) => `<article class="panel card" data-id="${p.id}">
        <div class="card-head"><div><b>${esc(p.title)}</b><small>geändert ${ago(p.updated_at)}</small></div>
          <div class="ord"><button class="icon" type="button" data-act="up" aria-label="Nach oben" ${i === 0 ? 'disabled' : ''}>↑</button><button class="icon" type="button" data-act="down" aria-label="Nach unten" ${i === list.length - 1 ? 'disabled' : ''}>↓</button></div></div>
        <form class="form">
          <div class="f2"><label class="f"><span>Titel</span><input class="field" name="title" maxlength="60" value="${esc(p.title)}" required></label>
          <label class="f"><span>Zuständig</span><input class="field" name="owner" maxlength="20" value="${esc(p.owner)}"></label></div>
          <label class="f"><span>Fortschritt: <b class="pv">${p.progress} %</b></span><input class="range" name="progress" type="range" min="0" max="100" step="5" value="${p.progress}"></label>
          <label class="f"><span>Status</span><input class="field" name="status" maxlength="80" value="${esc(p.status)}"></label>
          <label class="f"><span>Nächster Schritt</span><input class="field" name="next_step" maxlength="120" value="${esc(p.next_step)}"></label>
          <div class="row"><button class="btn danger" type="button" data-act="del">Löschen</button><button class="btn primary" type="submit">Speichern</button></div>
        </form></article>`).join('')}</div>`;
    body.querySelector('#addProj').onclick = async () => {
      const maxSort = list.reduce((m, p) => Math.max(m, p.sort), 0);
      const { error: err } = await db().from('projects').insert({ title: 'Neues Projekt', owner: Auth.name() || '', progress: 0, status: 'Idee', next_step: '', sort: maxSort + 10 });
      if (err) return fail(err); await saved('Projekt angelegt'); show();
    };
    body.addEventListener('input', (e) => { if (e.target.name === 'progress') e.target.closest('label').querySelector('.pv').textContent = e.target.value + ' %'; });
    body.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const id = Number(b.closest('[data-id]').dataset.id), i = list.findIndex((p) => p.id === id), p = list[i];
      if (b.dataset.act === 'del') {
        if (!confirm(`Projekt „${p.title}“ löschen?`)) return;
        const { error: err } = await db().from('projects').delete().eq('id', id); if (err) return fail(err);
        await saved('Projekt gelöscht'); show(); return;
      }
      const j = b.dataset.act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= list.length) return;
      const o = list[j], a = p.sort === o.sort ? p.sort + (j > i ? 1 : -1) : o.sort;
      const r1 = await db().from('projects').update({ sort: a }).eq('id', p.id);
      const r2 = await db().from('projects').update({ sort: p.sort }).eq('id', o.id);
      if (r1.error || r2.error) return fail(r1.error || r2.error);
      await saved('Reihenfolge geändert'); show();
    });
    body.addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target, id = Number(f.closest('[data-id]').dataset.id), btn = f.querySelector('[type=submit]'); busy(btn, true);
      const { error: err } = await db().from('projects').update({
        title: f.elements.title.value.trim() || 'Projekt', owner: f.elements.owner.value.trim(), progress: Number(f.elements.progress.value),
        status: f.elements.status.value.trim(), next_step: f.elements.next_step.value.trim(), updated_at: now()
      }).eq('id', id);
      busy(btn, false); if (err) return fail(err); saved('Projekt gespeichert');
    });
  }

  /* ---------- Spieler ---------- */
  async function players(body) {
    const [pr, rs] = await Promise.all([
      db().from('profiles').select('id,name,role,created_at').order('created_at'),
      db().from('results').select('user_id').limit(5000)
    ]);
    if (pr.error) throw pr.error;
    const count = {}; (rs.data || []).forEach((r) => { count[r.user_id] = (count[r.user_id] || 0) + 1; });
    const me = Auth.user() && Auth.user().id;
    body.innerHTML = `<p class="hint">Neue Spieler registrieren sich selbst auf der Seite (oben rechts „Anmelden“). Hier kannst du ihnen Admin-Rechte geben.</p>
      <div class="cards">${pr.data.map((p) => `<article class="panel player" data-id="${p.id}">
        <span class="av">${esc((p.name || '?')[0].toUpperCase())}</span>
        <div class="pinfo"><b>${esc(p.name)}${p.id === me ? ' <small>(du)</small>' : ''}</b><small>dabei seit ${new Date(p.created_at).toLocaleDateString('de-DE')} · ${count[p.id] || 0} Matches</small></div>
        <span class="pill ${p.role === 'admin' ? 'ok' : ''}">${p.role === 'admin' ? 'Admin' : 'Spieler'}</span>
        <button class="btn" type="button" data-role="${p.role === 'admin' ? 'player' : 'admin'}">${p.role === 'admin' ? 'Admin entfernen' : 'Zum Admin machen'}</button>
      </article>`).join('')}</div>`;
    body.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-role]'); if (!b) return;
      const id = b.closest('[data-id]').dataset.id, role = b.dataset.role;
      if (role === 'player' && id === me && !confirm('Dir selbst die Admin-Rechte entziehen? Dann kommst du nicht mehr ins Admin-Panel.')) return;
      const { error } = await db().rpc('set_role', { target: id, new_role: role });
      if (error) return fail(error);
      ctx.toast(role === 'admin' ? 'Ist jetzt Admin' : 'Admin-Rechte entfernt');
      if (id === me) location.reload(); else show();
    });
  }

  /* ---------- Einstellungen ---------- */
  async function settings(body) {
    const c = Content.get(), a = c.announcement || {}, m = c.maintenance || {};
    body.innerHTML = `
      <form class="panel form" id="annForm"><h3>Ankündigung</h3>
        <p class="hint">Ein Banner ganz oben auf der Seite, z. B. „Neues Spiel: Reaktionsduell ist da!“</p>
        <label class="switch"><input type="checkbox" name="on" ${a.on ? 'checked' : ''}><span>Banner anzeigen</span></label>
        <label class="f"><span>Text</span><input class="field" name="text" maxlength="160" value="${esc(a.text)}"></label>
        <div class="row"><button class="btn primary" type="submit">Speichern</button></div></form>
      <form class="panel form" id="mntForm"><h3>Wartungsmodus</h3>
        <p class="hint">Alle außer Admins sehen statt der Spiele nur diesen Hinweis. Praktisch, wenn ihr gerade umbaut.</p>
        <label class="switch"><input type="checkbox" name="on" ${m.on ? 'checked' : ''}><span>Wartungsmodus an</span></label>
        <label class="f"><span>Text</span><input class="field" name="text" maxlength="160" value="${esc(m.text)}"></label>
        <div class="row"><button class="btn primary" type="submit">Speichern</button></div></form>
      <div class="panel form"><h3>Sicherung</h3>
        <p class="hint">Lädt alle Texte, Spiele, Projekte, Spieler und Ergebnisse als Datei herunter.</p>
        <div class="row"><button class="btn" type="button" id="exportBtn">Daten exportieren</button>
        <a class="btn" href="https://supabase.com/dashboard/project/gekavukdzlhnhgpjyyyd" target="_blank" rel="noopener">Supabase öffnen</a></div></div>`;
    const bind = (id, key, label) => body.querySelector(id).addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target, btn = f.querySelector('[type=submit]'); busy(btn, true);
      const value = { on: f.elements.on.checked, text: f.elements.text.value.trim() };
      const { error } = await db().from('site_settings').upsert({ key, value, updated_at: now() });
      busy(btn, false); if (error) return fail(error); saved(label);
    });
    bind('#annForm', 'announcement', 'Ankündigung gespeichert');
    bind('#mntForm', 'maintenance', 'Wartungsmodus gespeichert');
    body.querySelector('#exportBtn').onclick = async () => {
      try {
        const tables = ['site_settings', 'games', 'projects', 'profiles', 'results'];
        const out = { exportiert: now() };
        for (const t of tables) { const { data, error } = await db().from(t).select('*'); if (error) throw error; out[t] = data; }
        const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
        const a2 = document.createElement('a'); a2.href = URL.createObjectURL(blob);
        a2.download = `jointventure-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a2); a2.click(); a2.remove(); setTimeout(() => URL.revokeObjectURL(a2.href), 5000);
        ctx.toast('Sicherung heruntergeladen');
      } catch (err) { fail(err); }
    };
  }

  window.Admin = { render };
})();

/* =========================================================================
   app.js – das Admin-Programm (installierbar über Edge oder Chrome)
   -------------------------------------------------------------------------
   Zeigt Anmeldung, dann das Admin-Panel mit der Konsole als Startreiter.
   Prüft jede Minute auf neue Fehlermeldungen: Zahl am Programmsymbol
   und, wenn erlaubt, eine Windows-Benachrichtigung.
   ========================================================================= */
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const view = $('#app');
  const LAST_KEY = 'jv_app_last_report';
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let mode = '', watchTimer = 0, installEvent = null;

  let toastT = 0;
  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'g-net toast'; document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2400);
  }

  // ------------------------------------------------------------ Ansichten
  function showLogin() {
    if (mode === 'login') return; mode = 'login'; stopWatch();
    $('#who').textContent = ''; $('#logoutBtn').hidden = true; $('#notifBtn').hidden = true;
    view.innerHTML = `<form class="panel form app-login" novalidate>
      <h1>Anmelden</h1><p class="hint">Mit deinem Admin-Konto von JointVenture.</p>
      <input class="field" name="email" type="email" autocomplete="email" placeholder="E-Mail" required>
      <input class="field" name="pw" type="password" autocomplete="current-password" placeholder="Passwort" required>
      <p class="msg" aria-live="polite"></p>
      <div class="row"><button class="btn primary" type="submit">Anmelden</button></div></form>`;
    const f = view.querySelector('form'), msg = f.querySelector('.msg'), btn = f.querySelector('[type=submit]');
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); msg.textContent = ''; btn.disabled = true;
      try { await Auth.signIn(f.elements.email.value.trim(), f.elements.pw.value); }
      catch (err) { msg.textContent = err.message; btn.disabled = false; }
    });
    setTimeout(() => f.elements.email.focus(), 50);
  }
  function showNoAdmin() {
    if (mode === 'noadmin') return; mode = 'noadmin'; stopWatch();
    view.innerHTML = `<div class="panel app-login"><h1>Kein Zugang</h1><p class="hint">Das Konto ${esc(Auth.name())} ist kein Admin. Ein Admin kann dich im Reiter „Spieler“ freischalten.</p></div>`;
  }
  function showOffline() {
    if (mode === 'offline') return; mode = 'offline'; stopWatch();
    view.innerHTML = '<div class="panel app-login"><h1>Keine Verbindung</h1><p class="hint">Der Server ist gerade nicht erreichbar. Prüfe das Internet und lade das Programm neu (F5).</p></div>';
  }
  async function showAdmin() {
    if (mode === 'admin') return; mode = 'admin';
    $('#who').textContent = Auth.name(); $('#logoutBtn').hidden = false;
    await Content.load();
    let tab = 'console'; try { tab = sessionStorage.getItem('jv_admin_tab') || 'console'; } catch (e) { }
    Admin.render(view, { app: true, tab, refresh: () => Content.load(), toast });
    setupNotify(); startWatch();
  }

  // ------------------------------------------------------------ Neue Meldungen
  async function checkReports() {
    if (mode !== 'admin') return;
    const { data, error } = await Auth.client().from('reports').select('id,title,reporter,game').eq('status', 'neu').order('id', { ascending: false }).limit(20);
    if (error) return;
    try { if (data.length) navigator.setAppBadge && navigator.setAppBadge(data.length); else navigator.clearAppBadge && navigator.clearAppBadge(); } catch (e) { }
    document.title = (data.length ? `(${data.length}) ` : '') + 'JointVenture Admin';
    const last = Number(localStorage.getItem(LAST_KEY) || 0), fresh = data.filter((r) => r.id > last);
    if (data.length) localStorage.setItem(LAST_KEY, String(Math.max(last, data[0].id)));
    if (!last || !fresh.length) return;                    // beim ersten Start nicht alles auf einmal melden
    const text = fresh.length === 1 ? `#${fresh[0].id} ${fresh[0].title} (von ${fresh[0].reporter || '?'})` : `${fresh.length} neue Fehlermeldungen`;
    toast('Neue Meldung: ' + text);
    if (window.Admin && Admin.api) Admin.api.updateBadge();
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification('Neue Fehlermeldung', { body: text, icon: 'admin-192.png', tag: 'jv-report' });
      n.onclick = () => { window.focus(); Admin.api.goTab('reports'); n.close(); };
    }
  }
  const LAST_PW = 'jv_app_last_pwreq';
  async function checkPwRequests() {
    if (mode !== 'admin') return;
    const { data, error } = await Auth.client().from('password_requests').select('id,name,email').eq('status', 'offen').order('id', { ascending: false }).limit(20);
    if (error) return;
    const last = Number(localStorage.getItem(LAST_PW) || 0), fresh = data.filter((r) => r.id > last);
    if (data.length) localStorage.setItem(LAST_PW, String(Math.max(last, data[0].id)));
    if (!last || !fresh.length) return;
    const text = `${fresh[0].name || fresh[0].email} hat das Passwort vergessen`;
    toast(text); if (window.Admin && Admin.api) Admin.api.updateBadge();
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification('Passwort-Anfrage', { body: text, icon: 'admin-192.png', tag: 'jv-pw' });
      n.onclick = () => { window.focus(); Admin.api.goTab('players'); n.close(); };
    }
  }
  function startWatch() { stopWatch(); const tick = () => { checkReports(); checkPwRequests(); }; tick(); watchTimer = setInterval(tick, 60000); }
  function stopWatch() { clearInterval(watchTimer); watchTimer = 0; }
  function setupNotify() {
    const b = $('#notifBtn');
    b.hidden = !('Notification' in window) || Notification.permission !== 'default';
    b.onclick = async () => { const p = await Notification.requestPermission(); b.hidden = p !== 'default'; if (p === 'granted') toast('Benachrichtigungen sind an'); };
  }

  // ------------------------------------------------------------ Installieren
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; $('#installBtn').hidden = false; $('#installHelp').hidden = true; });
  addEventListener('appinstalled', () => { $('#installBtn').hidden = true; toast('Installiert! Du findest „JointVenture Admin“ jetzt im Startmenü.'); });
  $('#installBtn').onclick = async () => { if (!installEvent) return; installEvent.prompt(); await installEvent.userChoice; installEvent = null; $('#installBtn').hidden = true; };
  if (!standalone) setTimeout(() => { if (!installEvent) $('#installHelp').hidden = false; }, 1500);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });

  $('#logoutBtn').onclick = async () => { await Auth.signOut(); };

  // ------------------------------------------------------------ Start
  function update() {
    if (!Auth.loaded) return;
    if (!Auth.ready) return showOffline();
    if (!Auth.user()) return showLogin();
    if (!Auth.isAdmin()) return showNoAdmin();
    showAdmin();
  }
  Auth.onChange(update);
  Auth.init();
})();

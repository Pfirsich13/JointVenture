/* =========================================================================
   auth.js – Anmeldung und gespeicherte Spielstände (Supabase)
   -------------------------------------------------------------------------
   Solange in config.js keine Supabase-Daten stehen, ist die Anmeldung
   ausgeschaltet und alles wird nur auf dem Gerät gespeichert.

   Auth.ready            -> true, wenn Supabase eingerichtet ist
   Auth.user()           -> angemeldeter Nutzer oder null
   Auth.name()           -> Anzeigename des Nutzers
   Auth.onChange(fn)     -> wird bei An-/Abmeldung aufgerufen
   Auth.signUp(name, mail, pw) / Auth.signIn(mail, pw) / Auth.signOut()
   Auth.saveResult({game, mode, won, score, opponent})
   Auth.loadResults()    -> Liste der eigenen Ergebnisse (neueste zuerst)
   Auth.isAdmin()        -> true für Admins (dürfen die Seite bearbeiten)
   Auth.client()         -> Supabase-Verbindung (für Inhalte und Admin-Panel)
   ========================================================================= */
(function () {
  const S = window.SITE || {};
  const configured = !!(S.supabaseUrl && S.supabaseKey);
  let client = null, user = null, profileName = '', role = 'player', avatarPath = null, mustChange = false, failed = false, loaded = false;
  const listeners = [];
  const emit = () => listeners.forEach((fn) => { try { fn(user); } catch (e) { console.error(e); } });

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.onload = res;
      s.onerror = () => rej(new Error('Supabase konnte nicht geladen werden.'));
      document.head.appendChild(s);
    });
  }

  async function loadProfile() {
    profileName = ''; role = 'player'; avatarPath = null; mustChange = false;
    if (!user) return;
    profileName = (user.user_metadata && user.user_metadata.name) || '';
    try {
      const { data } = await client.from('profiles').select('name,role,avatar_path,must_change_password').eq('id', user.id).maybeSingle();
      if (data) mustChange = !!data.must_change_password;
      if (data && data.name) profileName = data.name;
      if (data && data.role) role = data.role;
      if (data) avatarPath = data.avatar_path || null;
    } catch (e) { /* Tabelle fehlt: Name aus den Metadaten */ }
  }

  async function init() {
    if (!configured) { loaded = true; emit(); return; }
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js');
      client = window.supabase.createClient(S.supabaseUrl, S.supabaseKey);
      const { data } = await client.auth.getSession();
      user = data.session ? data.session.user : null;
      await loadProfile(); loaded = true; emit();
      client.auth.onAuthStateChange(async (_e, session) => {
        user = session ? session.user : null;
        await loadProfile(); emit();
      });
    } catch (e) { console.warn('Anmeldung nicht erreichbar:', e.message); failed = true; loaded = true; emit(); }
  }

  const deErr = (e) => {
    const m = String((e && e.message) || e || '');
    if (/Invalid login/i.test(m)) return 'E-Mail oder Passwort stimmt nicht.';
    if (/already registered|already exists/i.test(m)) return 'Diese E-Mail ist schon registriert. Melde dich an.';
    if (/should be different|same_password/i.test(m)) return 'Das neue Passwort muss anders sein als das alte.';
    if (/Password should contain|weak password|weak_password/i.test(m)) return 'Das Passwort ist zu schwach: mindestens 8 Zeichen, mit Buchstaben und Zahlen.';
    if (/Password should be at least (\d+)/i.test(m)) return `Das Passwort muss mindestens ${m.match(/at least (\d+)/i)[1]} Zeichen haben.`;
    if (/Password should be/i.test(m)) return 'Das Passwort muss mindestens 8 Zeichen haben, mit Buchstaben und Zahlen.';
    if (/pwned|leaked|compromised/i.test(m)) return 'Dieses Passwort ist aus einem Datenleck bekannt. Bitte wähle ein anderes.';
    if (/reauthentication|session.*(expired|missing)|not logged in/i.test(m)) return 'Bitte melde dich einmal neu an und versuch es dann nochmal.';
    if (/Email not confirmed/i.test(m)) return 'Bitte bestätige zuerst deine E-Mail (Link im Postfach).';
    if (/valid email|invalid.*email/i.test(m)) return 'Bitte eine gültige E-Mail-Adresse eingeben.';
    if (/signups? (are|is) disabled|signup.*not allowed/i.test(m)) return 'Registrieren ist bei Supabase gerade ausgeschaltet (Authentication → Sign In / Providers).';
    if (/rate limit|too many/i.test(m)) return 'Zu viele Versuche. Bitte kurz warten und nochmal probieren.';
    if (/fetch|network/i.test(m)) return 'Keine Verbindung. Internet prüfen und nochmal versuchen.';
    return m || 'Das hat nicht geklappt.';
  };

  // Bild mittig quadratisch zuschneiden und verkleinern (spart Speicher und Ladezeit)
  function squareImage(file, size) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas');
        c.width = c.height = size;
        const cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high';
        cx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(url);
        c.toBlob((b) => b ? resolve(b) : reject(new Error('Bild konnte nicht verarbeitet werden.')), 'image/webp', 0.86);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Dieses Bild kann der Browser nicht öffnen. Versuch ein JPG oder PNG.')); };
      img.src = url;
    });
  }
  const need = () => { if (!client) throw new Error('Die Anmeldung ist gerade nicht erreichbar. Bitte später nochmal versuchen.'); };
  window.Auth = {
    get ready() { return configured && !failed; },
    /** true, sobald feststeht, ob jemand angemeldet ist */
    get loaded() { return loaded; },
    init,
    user: () => user,
    name: () => profileName,
    isAdmin: () => !!user && role === 'admin',
    client: () => client,
    async rename(name) {
      need(); if (!user) return;
      const { error } = await client.from('profiles').update({ name }).eq('id', user.id);
      if (error) throw new Error(deErr(error));
      profileName = name; emit();
    },
    onChange(fn) { listeners.push(fn); },
    async signUp(name, email, password) {
      need();
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: location.origin + location.pathname } });
      if (error) throw new Error(deErr(error));
      return { needsConfirm: !data.session };
    },
    async signIn(email, password) {
      need();
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(deErr(error));
    },
    /** Öffentliche Adresse eines Profilbilds (oder null) */
    avatarUrl(path) { return path && client ? client.storage.from('avatars').getPublicUrl(path).data.publicUrl : null; },
    /** Profilbild des angemeldeten Spielers (oder null) */
    avatar() { return Auth.avatarUrl(avatarPath); },
    /** Neues Profilbild: wird quadratisch auf 256 px verkleinert und hochgeladen */
    async setAvatar(file) {
      need(); if (!user) throw new Error('Bitte melde dich zuerst an.');
      if (!/^image\//.test(file.type)) throw new Error('Bitte ein Bild auswählen (JPG, PNG oder WebP).');
      if (file.size > 15 * 1024 * 1024) throw new Error('Das Bild ist zu groß (höchstens 15 MB).');
      const blob = await squareImage(file, 256);
      const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const up = await client.storage.from('avatars').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
      if (up.error) throw new Error('Hochladen ging nicht: ' + deErr(up.error));
      const { error } = await client.from('profiles').update({ avatar_path: path }).eq('id', user.id);
      if (error) { await client.storage.from('avatars').remove([path]); throw new Error(deErr(error)); }
      const old = avatarPath; avatarPath = path; emit();
      if (old) client.storage.from('avatars').remove([old]);    // altes Bild aufräumen
    },
    /** Neues Passwort setzen (angemeldet) */
    async setPassword(password) {
      need(); if (!user) throw new Error('Bitte melde dich zuerst an.');
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new Error(deErr(error));
      if (mustChange) { await client.rpc('password_changed'); mustChange = false; emit(); }
    },
    /** Nach einem Einmal-Passwort muss ein neues festgelegt werden */
    mustChangePassword: () => !!user && mustChange,
    /** "Passwort vergessen": Anfrage an die Admins (geht auch ohne Anmeldung) */
    async requestPasswordHelp({ email, name, message }) {
      need();
      const { error } = await client.from('password_requests').insert({ email, name: name || null, message: message || null });
      if (error) throw new Error(deErr(error));
    },
    async removeAvatar() {
      need(); if (!user || !avatarPath) return;
      const { error } = await client.from('profiles').update({ avatar_path: null }).eq('id', user.id);
      if (error) throw new Error(deErr(error));
      const old = avatarPath; avatarPath = null; emit();
      client.storage.from('avatars').remove([old]);
    },
    /** Rangliste (nur Online-Duelle). game = null für alle Spiele */
    async leaderboard(game) {
      if (!client || !user) return null;
      const { data, error } = await client.rpc('leaderboard', { p_game: game || null });
      if (error) { console.warn(error); return null; }
      return data || [];
    },
    /** Alle eigenen Ergebnisse (für die Profil-Statistik) */
    async myStats() {
      if (!client || !user) return [];
      const { data, error } = await client.from('results').select('game,mode,won').eq('user_id', user.id).limit(5000);
      if (error) { console.warn(error); return []; }
      return data || [];
    },
    /** Fehlermeldung senden (mit optionalem Bildschirmfoto) */
    async report({ game, title, description, context, shot }) {
      need();
      if (!user) throw new Error('Bitte melde dich zuerst an.');
      let screenshot_path = null;
      if (shot) {
        const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[shot.type] || 'png';
        screenshot_path = `${user.id}/${Date.now()}.${ext}`;
        const { error } = await client.storage.from('reports').upload(screenshot_path, shot, { contentType: shot.type });
        if (error) throw new Error('Das Bildschirmfoto ging nicht hoch: ' + deErr(error));
      }
      const { error } = await client.from('reports').insert({ user_id: user.id, game: game || null, title, description, context, screenshot_path });
      if (error) throw new Error(deErr(error));
    },
    /** Die eigenen Meldungen mit Status und Antwort */
    async myReports() {
      if (!client || !user) return [];
      const { data, error } = await client.from('reports').select('id,title,status,admin_note,created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
      if (error) { console.warn(error); return []; }
      return data || [];
    },
    async signOut() { if (client) await client.auth.signOut(); },
    async saveResult(r) {
      if (!client || !user) return false;
      const { error } = await client.from('results').insert({
        user_id: user.id, game: r.game, mode: r.mode, won: !!r.won,
        score: String(r.score || '').slice(0, 9), opponent: String(r.opponent || '').slice(0, 20)
      });
      if (error) { console.error(error); return false; }
      return true;
    },
    async loadResults() {
      if (!client || !user) return [];
      const { data, error } = await client.from('results').select('game,mode,won,score,opponent,created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
      if (error) { console.error(error); return []; }
      return data || [];
    }
  };
})();

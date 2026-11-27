/* =========================================================================
   errors.js – merkt sich die letzten Fehlermeldungen im Browser
   -------------------------------------------------------------------------
   Wird als Erstes geladen. Meldet ein Spieler einen Fehler, gehen die
   letzten Einträge automatisch mit, damit Claude den Fehler leichter findet.
   window.JV_ERRORS  -> Liste [{t: Uhrzeit, m: Text}], höchstens 15
   window.JV_LOG(m)  -> eigenen Eintrag hinzufügen
   ========================================================================= */
(function () {
  const buf = window.JV_ERRORS = [];
  const text = (x) => {
    if (x && x.message) return x.message;
    if (typeof x === 'object') { try { return JSON.stringify(x); } catch (e) { return String(x); } }
    return String(x);
  };
  function log(m) {
    buf.push({ t: new Date().toTimeString().slice(0, 8), m: String(m).slice(0, 300) });
    if (buf.length > 15) buf.shift();
  }
  window.JV_LOG = log;
  // Einen Fensterbereich beobachten (auch eingebettete Spiele derselben Seite)
  window.JV_WATCH = function (w, prefix) {
    const p = prefix ? prefix + ': ' : '';
    w.addEventListener('error', (e) => log(p + (e.message || 'Fehler') + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : '')));
    w.addEventListener('unhandledrejection', (e) => log(p + 'Promise: ' + text(e.reason)));
    const orig = w.console.error;
    w.console.error = function (...args) {
      try { log(p + args.map(text).join(' ')); } catch (e) { /* nie stören */ }
      return orig.apply(this, args);
    };
  };
  window.JV_WATCH(window, '');
})();

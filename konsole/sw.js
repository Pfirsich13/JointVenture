/* Service Worker des Admin-Programms.
   Speichert nichts zwischen. Er zeigt nur einen Hinweis, wenn kein Internet da ist,
   und macht das Programm installierbar. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JointVenture Admin</title>' +
    '<body style="background:#0d0e12;color:#e9ebf2;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center">' +
    '<div><h1>Keine Verbindung</h1><p>Das Admin-Programm braucht Internet. Prüfe die Verbindung und lade neu.</p></div></body>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});

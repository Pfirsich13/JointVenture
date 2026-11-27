# Arena auf JointVenture

Das Arena-Spiel (Projekt des Bruders, Ordner `RONHANDYAPP`) braucht normalerweise einen eigenen Spiel-Server (Colyseus, Port 2567).
Damit es auf GitHub Pages ohne gemieteten Server läuft, gibt es eine kleine Anpassung: `arena-p2p.patch`.

## Was die Anpassung macht
- Wer **Raum erstellen** tippt, ist der Gastgeber. In seinem Browser läuft der normale Spiel-Raum `server/src/rooms/ArenaRoom.ts`, unverändert.
- Das Paket `colyseus` wird dafür im Browser durch einen kleinen Nachbau ersetzt (`client/src/net/browser/colyseus-shim.ts`, über `resolve.alias` in `vite.config.ts`).
- Der Mitspieler verbindet sich per Raum-Code direkt mit dem Gastgeber (WebRTC über PeerJS, `client/src/net/browser/P2P.ts`).
- `Connection.ts` wählt diesen Weg nur, wenn mit `VITE_NET=p2p` gebaut wird. `npm run dev` und `Spiel starten.bat` laufen also wie vorher mit dem echten Server.
- Eingebettet in die Seite zeigt der Startbildschirm „← Zurück zur Spieleauswahl“.

Unterschied zum echten Server: Der Gastgeber hat keine Verzögerung, der Mitspieler die doppelte Strecke. Schließt der Gastgeber das Spiel, endet der Raum.

## Neue Version einspielen
```bash
unzip Arena-Spieldemo.zip && cd RONHANDYAPP
patch -p1 < /pfad/zu/JointVenture/quellen/arena/arena-p2p.patch
npm install
cd client && VITE_NET=p2p npx vite build --base ./ --outDir dist-web --emptyOutDir
rm -rf /pfad/zu/JointVenture/play/arena && cp -r dist-web /pfad/zu/JointVenture/play/arena
```
Danach in Supabase: `update public.games set version = '…', status = 'review', updated_at = now() where id = 'arena';`

Zum Testen ohne Internet-Vermittler: `?peerhost=127.0.0.1:9000` an die Adresse hängen (eigener PeerJS-Server).

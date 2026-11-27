# Arena auf JointVenture

Das Arena-Spiel (Projekt von Tim, Ordner `RONHANDYAPP`) braucht normalerweise einen eigenen Spiel-Server (Colyseus, Port 2567).
Damit es auf der JointVenture-Seite ohne gemieteten Server läuft, gibt es eine kleine Anpassung: `arena-p2p.patch`.

## Was die Anpassung macht
- Wer **Raum erstellen** tippt, ist der Gastgeber. In seinem Browser läuft der normale Spiel-Raum `server/src/rooms/ArenaRoom.ts`, unverändert.
- Das Paket `colyseus` wird dafür im Browser durch einen kleinen Nachbau ersetzt (`client/src/net/browser/colyseus-shim.ts`, über `resolve.alias` in `vite.config.ts`).
- Der Mitspieler verbindet sich per Raum-Code direkt mit dem Gastgeber (WebRTC über PeerJS, `client/src/net/browser/P2P.ts`).
- Knopf „Freund einladen“ (WhatsApp-Link, der direkt in den Raum führt) und Beitreten über `?join=1234` bzw. den Rahmen-Namen `jv:join=1234` (`params.ts`).
- Eingebettet in die Seite zeigt der Startbildschirm „← Zurück zur Spieleauswahl“.
- Eingebettet in JointVenture übernimmt die Seite das Einladen (`window.parent.Hub.invite`). Kommt die Herausforderung aus der Freundesliste, geht die Einladung automatisch als Chat-Nachricht an den Freund (`roomOpened` in `invite.ts`, aufgerufen in `Hud.ts`).
- `npm run dev` und `Spiel starten.bat` laufen wie vorher mit dem echten Server. Der Online-Modus ohne Server ist nur im Build für JointVenture aktiv (`client/.env.jointventure`).

## Einmal: Anpassung ins Projekt übernehmen
Die Datei `arena-p2p.patch` in den Projektordner legen und der KI sagen: „Übernimm diese Änderungen“. Oder selbst im Projektordner:
```
git apply --ignore-whitespace arena-p2p.patch
npm install
```

## Jede neue Version auf die Seite bringen
1. Im Projektordner **„Für JointVenture bauen.bat“** doppelklicken. Es entsteht `JointVenture-Arena.zip`.
2. Auf der Seite: **Admin → Spiele → Arena-PvP → Neue Version hochladen**, die ZIP wählen, **Speichern**.
3. Das Spiel steht dann auf „Zur Freigabe“. Testen, dann **Als Beta** oder **Spielbar**.

Ohne Windows: `npm run build:jointventure -w client`, dann den Inhalt von `client/dist-jointventure` als ZIP hochladen.

## Technik
Hochgeladene ZIPs landen im Supabase-Speicher `games/<id>/v<zeit>/…` (Spiel-Typ `bundle`). Die Seite lädt `index.html`, setzt `<base>` auf den Ordner und zeigt das Spiel in einem Rahmen, der wie ein Teil der Seite läuft. Jede neue Version bekommt einen eigenen Ordner, die alte wird danach gelöscht.

Zum Testen ohne Internet-Vermittler: `?peerhost=127.0.0.1:9000` an die Adresse der Seite hängen (eigener PeerJS-Server).

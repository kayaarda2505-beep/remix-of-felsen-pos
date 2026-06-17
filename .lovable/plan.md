# SAINTS Print-Agent (Windows)

Ein kleines Programm, das auf dem PC läuft, an dem der Epson TM-T20III per USB hängt. Es nimmt Druckaufträge von der Kasse (PC + Tablet im selben WLAN) entgegen und schickt sie direkt als ESC/POS an den Drucker.

## So funktioniert es

```text
   Kasse PC ─┐
             ├──► http://<PC-IP>:9110/print ──► Print-Agent ──► Windows-Druckwarteschlange ──► Epson TM-T20III (USB)
   Tablet ───┘
```

- Der Agent läuft als normales Fenster (oder im Hintergrund / Autostart).
- Er nutzt den **bereits installierten Windows-Treiber** des Druckers und schickt rohe ESC/POS-Bytes an die Druckerwarteschlange. Das funktioniert mit jedem Drucker, der in *Drucker & Scanner* sichtbar ist — inkl. Kassenschublade-Befehl und Schneidekommando.

## Was gebaut wird

1. **Ordner `print-agent/`** im Projekt mit dem Quellcode des Agents (Node.js + TypeScript).
2. **HTTP-Endpunkte** auf Port `9110`:
   - `GET /health` → `{ ok: true, version, printers: [...] }`
   - `POST /discover` → listet alle installierten Windows-Drucker
   - `POST /test` → druckt einen Testbon
   - `POST /print` → druckt einen echten Bon (Items, Total, MwSt, optional Kassenschublade auf)
3. **CORS** offen für `https://felsens-pos-glow.lovable.app` und `http://localhost`.
4. **Fertige `SAINTS-PrintAgent.exe`** für Windows (Single-File, kein Node nötig), gepackt mit `@yao-pkg/pkg`.
5. **Setup-README** mit:
   - Doppelklick auf `.exe` startet den Agent
   - Autostart-Anleitung (Verknüpfung in `shell:startup`)
   - Firewall-Regel für Port 9110 (damit das Tablet drauf zugreifen kann)
   - Eintrag der Agent-URL in der Kasse:
     - Auf dem PC selbst: `http://localhost:9110`
     - Vom Tablet aus: `http://<PC-IP>:9110` (z. B. `http://192.168.1.50:9110`)

## Tech-Details (für später)

- **Sprache**: Node.js 20 + TypeScript, Fastify als HTTP-Server.
- **Drucken**: Paket `@thiagoelg/node-printer` (hat vorgebaute Windows-Binaries für x64), sendet `RAW`-Datentyp an die Windows-Spooler-Queue.
- **ESC/POS-Encoder**: Paket `esc-pos-encoder` baut den Byte-Buffer (Header, Items, Total, Footer, Schnitt, Kassenschublade-Puls).
- **Bon-Format** ist 1:1 kompatibel mit dem bestehenden `printReceipt()`-Call der Kasse, der bereits `POST /print` mit `{ printer, payload }` schickt — keine Anpassung der App nötig.
- **Packaging**: `bun run build` → `pkg . --targets node20-win-x64 --output SAINTS-PrintAgent.exe`. Ergebnis: einzelne `.exe` (~40 MB) + zwei `.node`-Dateien daneben für die Druck-Bindings.
- **Auslieferung**: ZIP-Datei nach `/mnt/documents/SAINTS-PrintAgent-win-x64.zip` → User lädt sie aus dem Chat herunter, entpackt sie, startet die `.exe`.

## Was du danach tust

1. ZIP herunterladen, entpacken (z. B. nach `C:\SAINTS\PrintAgent\`).
2. `SAINTS-PrintAgent.exe` doppelklicken → schwarzes Fenster mit „Listening on :9110" erscheint.
3. Beim ersten Start fragt Windows nach Firewall-Freigabe → **„Privates Netzwerk" zulassen**.
4. In der Kasse → Einstellungen → Drucker:
   - Auf dem PC: URL = `http://localhost:9110`
   - Auf dem Tablet: URL = `http://<IP-des-PCs>:9110`
   - Drucker aus Liste wählen (`EPSON TM-T20III Receipt`)
   - **Testdruck** klicken → Bon kommt raus.

Wenn du einverstanden bist, baue ich Agent + .exe und lege den Download-Link bereit.

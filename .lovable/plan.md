## Fix: Packager-Skript im Projektordner ablegen

**Problem:** `saints-packager.cjs` liegt in `C:\Users\hasan\AppData\Local\Temp\`. Node sucht `node_modules` ab dem Skript-Verzeichnis aufwärts — dort gibt es keine `node_modules`, daher `MODULE_NOT_FOUND`.

**Lösung:** Skript ins Projektverzeichnis schreiben (neben `package.json`), ausführen, danach löschen.

### Änderung in `build-exe.ps1`

- `$packagerScript = Join-Path $PSScriptRoot "saints-packager.cjs"` statt `$env:TEMP`
- Rest bleibt identisch (Inhalt des Skripts, `node $packagerScript`, Cleanup, Exit-Code-Check)

So findet `require('@electron/packager')` die im Projekt installierten `node_modules`.

Keine weiteren Dateien betroffen. `build-exe.sh` und `build-exe.bat` bleiben unverändert.
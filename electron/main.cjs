const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("path");
const { sendToPrinter, discoverPrinters } = require("./printer.cjs");

const APP_URL =
  process.env.SAINTS_POS_URL ||
  "https://app.saintsthebar.ch";

const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#0a0a0a",
    autoHideMenuBar: true,
    title: "SAINTS POS",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.webContents.setUserAgent(CHROME_USER_AGENT);
  mainWindow.loadURL(APP_URL, { userAgent: CHROME_USER_AGENT });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    mainWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(`
        <html><body style="margin:0;background:#0a0a0a;color:#fff;font-family:Arial,sans-serif;display:grid;place-items:center;height:100vh">
          <div style="max-width:520px;text-align:center;padding:24px">
            <h1>SAINTS POS konnte nicht geladen werden</h1>
            <p>${errorDescription || `Fehler ${errorCode}`}</p>
            <button onclick="location.href='${APP_URL}'" style="padding:12px 18px;border:0;border-radius:8px;cursor:pointer">Erneut versuchen</button>
          </div>
        </body></html>
      `)}`,
    );
  });

  // Externe Links im System-Browser öffnen
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require("electron").shell.openExternal(url);
    return { action: "deny" };
  });
}

// IPC: Druck-Anfragen vom Renderer
ipcMain.handle("printer:print", async (_evt, { printer, payload }) => {
  try {
    await sendToPrinter(printer, payload);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle("printer:test", async (_evt, printer) => {
  try {
    await sendToPrinter(printer, {
      title: "TEST-DRUCK",
      lines: [
        { text: "SAINTS POS", bold: true, align: "center", size: "large" },
        { text: "Druckertest erfolgreich", align: "center" },
        { text: new Date().toLocaleString("de-CH"), align: "center" },
      ],
      cut: true,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle("printer:discover", async (_evt, opts) => {
  try {
    const results = await discoverPrinters(opts || {});
    return { ok: true, results };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

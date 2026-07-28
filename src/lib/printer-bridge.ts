// Bridge zum lokalen Print-Agent.
//
// Frühere Version: window.printerBridge (nur in der Electron .exe).
// Neue Version: die App läuft als Web-URL, daher gibt es keinen Node-Zugriff
// im Browser mehr. Statt dessen läuft ein kleines Hilfsprogramm
// ("Piratino Print-Agent") im lokalen Netz auf einem Rechner und nimmt
// Druckaufträge per HTTP entgegen.
//
// Erwartete Endpunkte am Agent (Basis-URL z.B. http://192.168.1.10:9110):
//   GET  /health                 -> { ok: true }
//   POST /print     {printer, payload}  -> { ok, error? }
//   POST /test      {printer}            -> { ok, error? }
//   POST /discover  {port?}              -> { ok, results: [{ip_address, port}] }
//
// Konfiguration läuft über localStorage-Key "print_agent_url".

export type PrinterConfig = {
  id: string;
  name: string;
  type: string;
  ip_address: string | null;
  port: number | null;
};

export type ReceiptLine =
  | { separator: true }
  | { qr: string; size?: number }
  | { logo: true }
  | {
      text?: string;
      cols?: [string, string];
      bold?: boolean;
      align?: "left" | "center" | "right";
      size?: "normal" | "large" | "double-h" | "double-w";
    };

export type ReceiptPayload = {
  title?: string;
  lines: ReceiptLine[];
  cut?: boolean;
  drawer?: boolean;
};

type DiscoverResult = { ip_address: string; port: number };
export type AgentPrinter = { name: string; isDefault: boolean; status?: string };

const STORAGE_KEY = "print_agent_url";

export function getPrintAgentUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (!v) return null;
    const trimmed = v.trim().replace(/\/+$/, "");
    return trimmed || null;
  } catch {
    return null;
  }
}

/**
 * Normalisiert eine eingegebene Agent-URL.
 * `0.0.0.0` ist nur die Lausch-Adresse des Agents und vom Browser NICHT
 * erreichbar — auf demselben PC ist das `localhost`.
 */
export function normalizeAgentUrl(url: string): string {
  let v = (url ?? "").trim().replace(/\/+$/, "");
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = `http://${v}`;
  try {
    const u = new URL(v);
    if (u.hostname === "0.0.0.0" || u.hostname === "[::]") u.hostname = "localhost";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return v;
  }
}

export function setPrintAgentUrl(url: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!url) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, normalizeAgentUrl(url));
  } catch {
    /* ignore */
  }
}


/**
 * True, sobald eine Print-Agent-URL hinterlegt ist.
 * Name bleibt aus Kompatibilitätsgründen erhalten – wird projektweit benutzt,
 * um zu entscheiden, ob Druck-Aktionen angeboten werden.
 */
export function isDesktopApp(): boolean {
  return !!getPrintAgentUrl();
}

/** Alias mit aussagekräftigerem Namen für neue Aufrufer. */
export const isPrintAgentConfigured = isDesktopApp;

const AUTO_PRINT_KEY = "auto_print_receipts";

/**
 * Direktdruck: Quittungen werden ohne Browser-Druckdialog direkt an den
 * Print-Agent / Drucker gesendet. Standard: aktiv.
 */
export function isAutoPrintEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUTO_PRINT_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setAutoPrintEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTO_PRINT_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/**
 * Prüft, ob eine Agent-URL vom aktuellen Browser-Kontext überhaupt
 * aufgerufen werden darf. Wichtigster Fall: Diese App läuft über HTTPS,
 * der Print-Agent aber über http:// im lokalen Netz — das blockiert der
 * Browser als "Mixed Content", noch bevor eine Anfrage rausgeht.
 */
export function getAgentUrlIssue(url: string): string | null {
  const v = (url ?? "").trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) {
    return "URL muss mit http:// oder https:// beginnen (z. B. http://192.168.1.10:9110).";
  }
  let parsed: URL;
  try {
    parsed = new URL(v);
  } catch {
    return "Die URL ist ungültig. Beispiel: http://192.168.1.10:9110";
  }
  if (typeof window === "undefined") return null;
  const host = parsed.hostname;
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  if (
    window.location.protocol === "https:" &&
    parsed.protocol === "http:" &&
    !isLocal
  ) {
    return (
      "Diese Seite läuft über HTTPS, der Print-Agent über http:// — der Browser blockiert das (Mixed Content). " +
      "Lösung: den Agent auf demselben Gerät nutzen (http://localhost:9110), die Desktop-App verwenden, " +
      "oder den Agent per HTTPS erreichbar machen."
    );
  }
  return null;
}


async function callAgent<T>(
  path: string,
  body: unknown,
  timeoutMs = 15000,
): Promise<T> {
  const base = getPrintAgentUrl();
  if (!base) throw new Error("Kein Print-Agent konfiguriert");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`Agent antwortete mit ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function pingPrintAgent(): Promise<boolean> {
  const base = getPrintAgentUrl();
  if (!base) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${base}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export async function getAgentPrinters(): Promise<{ ok: boolean; printers?: AgentPrinter[]; error?: string }> {
  const base = getPrintAgentUrl();
  if (!base) return { ok: false, error: "Kein Print-Agent konfiguriert" };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${base}/printers`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { ok: false, error: `Agent antwortete mit ${res.status}` };
    return (await res.json()) as { ok: boolean; printers?: AgentPrinter[]; error?: string };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Print-Agent nicht erreichbar" };
  }
}

export async function printReceipt(
  printer: PrinterConfig,
  payload: ReceiptPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!isDesktopApp()) {
    return { ok: false, error: "Kein Print-Agent konfiguriert" };
  }
  try {
    return await callAgent<{ ok: boolean; error?: string }>("/print", {
      printer,
      payload,
    });
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Print-Agent nicht erreichbar" };
  }
}

export async function testPrinter(
  printer: PrinterConfig,
): Promise<{ ok: boolean; error?: string }> {
  if (!isDesktopApp()) {
    return { ok: false, error: "Kein Print-Agent konfiguriert" };
  }
  try {
    return await callAgent<{ ok: boolean; error?: string }>("/test", { printer });
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Print-Agent nicht erreichbar" };
  }
}

export async function discoverPrintersOnNetwork(opts?: {
  port?: number;
}): Promise<{ ok: boolean; results?: DiscoverResult[]; error?: string }> {
  if (!isDesktopApp()) {
    return { ok: false, error: "Kein Print-Agent konfiguriert" };
  }
  try {
    return await callAgent<{ ok: boolean; results?: DiscoverResult[]; error?: string }>(
      "/discover",
      { port: opts?.port ?? 9100 },
      45000,
    );
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Print-Agent nicht erreichbar" };
  }
}

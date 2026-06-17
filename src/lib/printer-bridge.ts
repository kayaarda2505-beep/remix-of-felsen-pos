// Bridge zum lokalen Print-Agent.
//
// Frühere Version: window.printerBridge (nur in der Electron .exe).
// Neue Version: die App läuft als Web-URL, daher gibt es keinen Node-Zugriff
// im Browser mehr. Statt dessen läuft ein kleines Hilfsprogramm
// ("SAINTS Print-Agent") im lokalen Netz auf einem Rechner und nimmt
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

export function setPrintAgentUrl(url: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!url) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/+$/, ""));
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

// Wrapper um window.printerBridge (nur in der Electron .exe verfügbar).
// Im normalen Browser sind alle Methoden no-op und melden Browser-Modus.

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

type Bridge = {
  isAvailable: () => boolean;
  print: (printer: PrinterConfig, payload: ReceiptPayload) => Promise<{ ok: boolean; error?: string }>;
  test: (printer: PrinterConfig) => Promise<{ ok: boolean; error?: string }>;
  discover?: (opts?: { port?: number; concurrency?: number }) => Promise<{ ok: boolean; results?: DiscoverResult[]; error?: string }>;
};

declare global {
  interface Window {
    printerBridge?: Bridge;
  }
}

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && !!window.printerBridge?.isAvailable?.();
}

export async function printReceipt(
  printer: PrinterConfig,
  payload: ReceiptPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!isDesktopApp()) {
    return { ok: false, error: "Druck nur in der SAINTS-POS Desktop-App verfügbar" };
  }
  return window.printerBridge!.print(printer, payload);
}

export async function testPrinter(
  printer: PrinterConfig,
): Promise<{ ok: boolean; error?: string }> {
  if (!isDesktopApp()) {
    return { ok: false, error: "Druck nur in der SAINTS-POS Desktop-App verfügbar" };
  }
  return window.printerBridge!.test(printer);
}

export async function discoverPrintersOnNetwork(opts?: {
  port?: number;
}): Promise<{ ok: boolean; results?: DiscoverResult[]; error?: string }> {
  if (!isDesktopApp() || !window.printerBridge?.discover) {
    return { ok: false, error: "Suche nur in der SAINTS-POS Desktop-App verfügbar" };
  }
  return window.printerBridge.discover(opts);
}

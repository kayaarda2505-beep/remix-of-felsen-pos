/**
 * SAINTS Print-Agent
 * ------------------
 * Kleiner lokaler HTTP-Server, der von der POS-App Druck-Aufträge
 * entgegennimmt und per ESC/POS an einen am PC installierten Drucker
 * (z.B. Epson TM-T20III via USB) schickt.
 *
 * Ports:
 *   - 9110 (Standard, überschreibbar via env PORT)
 *
 * Endpunkte:
 *   GET  /health                 -> { ok, version, printers }
 *   GET  /printers               -> { ok, printers: [{name, isDefault, status}] }
 *   POST /discover  {port?}      -> { ok, results: [] }     (Stub für Netzwerk-Scan)
 *   POST /test      {printer}    -> { ok, error? }
 *   POST /print     {printer, payload}  -> { ok, error? }
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const printer = require("@thiagoelg/node-printer");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const EscPosEncoder = require("esc-pos-encoder");

const VERSION = "1.0.0";
const PORT = Number(process.env.PORT ?? 9110);
const HOST = "0.0.0.0";

type PrinterCfg = {
  id?: string;
  name?: string;
  type?: string;
  ip_address?: string | null;
  port?: number | null;
};

type ReceiptLine =
  | { separator: true }
  | {
      text?: string;
      cols?: [string, string];
      bold?: boolean;
      align?: "left" | "center" | "right";
      size?: "normal" | "large" | "double-h" | "double-w";
    };

type ReceiptPayload = {
  title?: string;
  lines: ReceiptLine[];
  cut?: boolean;
  drawer?: boolean;
};

// ---------------------------------------------------------------------------
// ESC/POS encoding
// ---------------------------------------------------------------------------

const COLS = 42; // TM-T20III @ Font A, 80mm

function padCols(left: string, right: string, width = COLS): string {
  const l = (left ?? "").toString();
  const r = (right ?? "").toString();
  if (l.length + r.length + 1 >= width) {
    return l.slice(0, Math.max(0, width - r.length - 1)) + " " + r;
  }
  return l + " ".repeat(width - l.length - r.length) + r;
}

function buildPayload(payload: ReceiptPayload): Buffer {
  const enc = new EscPosEncoder();
  enc.initialize().codepage("cp858");

  if (payload.title) {
    enc.align("center").bold(true).size("normal").line(payload.title).bold(false);
    enc.line("");
  }

  for (const line of payload.lines) {
    if ("separator" in line && line.separator) {
      enc.align("left").size("normal").bold(false).line("-".repeat(COLS));
      continue;
    }
    const l = line as Exclude<ReceiptLine, { separator: true }>;
    enc.align(l.align ?? "left");
    enc.bold(!!l.bold);
    // esc-pos-encoder size: 'normal' default, otherwise width/height multiplier
    if (l.size === "large") enc.size(2 as any);
    else if (l.size === "double-h") enc.size(1 as any, 2 as any);
    else if (l.size === "double-w") enc.size(2 as any, 1 as any);
    else enc.size("normal");

    if (l.cols) {
      enc.line(padCols(l.cols[0] ?? "", l.cols[1] ?? ""));
    } else {
      enc.line(l.text ?? "");
    }
  }

  enc.bold(false).align("left").size("normal");
  enc.newline().newline().newline();

  if (payload.cut !== false) enc.cut("partial");

  // Kassenschublade-Puls (ESC p 0 25 250)
  if (payload.drawer) {
    enc.raw([0x1b, 0x70, 0x00, 0x19, 0xfa]);
  }

  return Buffer.from(enc.encode());
}

// ---------------------------------------------------------------------------
// Windows-Spooler senden
// ---------------------------------------------------------------------------

function listPrinters(): Array<{ name: string; isDefault: boolean; status?: string }> {
  try {
    const all = printer.getPrinters() as Array<any>;
    const def = (() => {
      try { return printer.getDefaultPrinterName(); } catch { return null; }
    })();
    return all.map((p) => ({
      name: p.name,
      isDefault: p.name === def,
      status: Array.isArray(p.status) ? p.status.join(",") : String(p.status ?? ""),
    }));
  } catch (e) {
    console.error("listPrinters failed:", e);
    return [];
  }
}

function sendRaw(printerName: string, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      printer.printDirect({
        data,
        printer: printerName,
        type: "RAW",
        success: () => resolve(),
        error: (err: any) => reject(err instanceof Error ? err : new Error(String(err))),
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

// ---------------------------------------------------------------------------
// HTTP-Server
// ---------------------------------------------------------------------------

async function main() {
  const app = Fastify({ logger: { level: "info" } });

  await app.register(cors, {
    origin: true, // jede Origin – Agent ist nur lokal erreichbar
    methods: ["GET", "POST", "OPTIONS"],
  });

  app.get("/health", async () => ({
    ok: true,
    version: VERSION,
    printers: listPrinters(),
  }));

  app.get("/printers", async () => ({ ok: true, printers: listPrinters() }));

  app.post("/discover", async () => ({ ok: true, results: [] }));

  app.post<{ Body: { printer: PrinterCfg } }>("/test", async (req, reply) => {
    const cfg = req.body?.printer;
    const name = cfg?.name;
    if (!name) return reply.code(400).send({ ok: false, error: "Druckername fehlt" });
    try {
      const buf = buildPayload({
        title: "SAINTS POS — Testdruck",
        lines: [
          { text: new Date().toLocaleString("de-CH"), align: "center" },
          { separator: true },
          { text: "Drucker:", bold: true },
          { text: name },
          { separator: true },
          { text: "Wenn du das lesen kannst,", align: "center" },
          { text: "ist alles bereit.", align: "center" },
        ],
        cut: true,
      });
      await sendRaw(name, buf);
      return { ok: true };
    } catch (e: any) {
      app.log.error(e);
      return reply.code(500).send({ ok: false, error: e?.message ?? "Druckfehler" });
    }
  });

  app.post<{ Body: { printer: PrinterCfg; payload: ReceiptPayload } }>(
    "/print",
    async (req, reply) => {
      const { printer: cfg, payload } = req.body ?? ({} as any);
      const name = cfg?.name;
      if (!name) return reply.code(400).send({ ok: false, error: "Druckername fehlt" });
      if (!payload || !Array.isArray(payload.lines)) {
        return reply.code(400).send({ ok: false, error: "Ungültiges Payload" });
      }
      try {
        const buf = buildPayload(payload);
        await sendRaw(name, buf);
        return { ok: true };
      } catch (e: any) {
        app.log.error(e);
        return reply.code(500).send({ ok: false, error: e?.message ?? "Druckfehler" });
      }
    },
  );

  await app.listen({ host: HOST, port: PORT });

  // Banner
  const printers = listPrinters();
  console.log("");
  console.log("==========================================");
  console.log(`  SAINTS Print-Agent v${VERSION}`);
  console.log(`  Hört auf  http://0.0.0.0:${PORT}`);
  console.log(`  Drucker:  ${printers.length}`);
  for (const p of printers) {
    console.log(`   - ${p.name}${p.isDefault ? "  (Standard)" : ""}`);
  }
  console.log("==========================================");
  console.log("");
  console.log("Fenster geöffnet lassen. Beenden mit Ctrl+C.");
}

main().catch((err) => {
  console.error("Agent konnte nicht starten:", err);
  process.exit(1);
});

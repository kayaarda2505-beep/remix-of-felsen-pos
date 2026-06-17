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
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  | { qr: string; size?: number }
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
// Windows-Spooler senden (ohne native Node-Module)
// ---------------------------------------------------------------------------

type ListedPrinter = { name: string; isDefault: boolean; status?: string };

const POWERSHELL = process.env.POWERSHELL_EXE || "powershell.exe";

function runPowerShellFile(scriptPath: string, args: string[] = []): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      POWERSHELL,
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args],
      { windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const msg = [error.message, stderr?.trim()].filter(Boolean).join("\n");
          reject(new Error(msg));
          return;
        }
        resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
      },
    );
    child.stdin?.end();
  });
}

async function withTempScript(script: string, args: string[]) {
  const dir = await mkdtemp(join(tmpdir(), "saints-print-"));
  const scriptPath = join(dir, "run.ps1");
  try {
    await writeFile(scriptPath, script, "utf8");
    return await runPowerShellFile(scriptPath, args);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function listPrinters(): Promise<ListedPrinter[]> {
  if (process.platform !== "win32") return [];
  try {
    const script = `
$ErrorActionPreference = 'Stop'
$items = Get-CimInstance -ClassName Win32_Printer | ForEach-Object {
  [pscustomobject]@{
    name = [string]$_.Name
    isDefault = [bool]$_.Default
    status = [string]$_.PrinterStatus
  }
}
$items | ConvertTo-Json -Compress
`;
    const { stdout } = await withTempScript(script, []);
    const trimmed = stdout.trim();
    if (!trimmed) return [];
    const parsed = JSON.parse(trimmed);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.map((p) => ({
      name: String(p.name ?? ""),
      isDefault: Boolean(p.isDefault),
      status: String(p.status ?? ""),
    })).filter((p) => p.name);
  } catch (e) {
    console.error("listPrinters failed:", e);
    return [];
  }
}

async function sendRaw(printerName: string, data: Buffer): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("RAW-Druck ist nur unter Windows verfügbar");
  }

  const dir = await mkdtemp(join(tmpdir(), "saints-print-"));
  const dataPath = join(dir, `${randomUUID()}.bin`);
  const scriptPath = join(dir, "raw-print.ps1");
  const script = `
param(
  [Parameter(Mandatory=$true)][string]$PrinterName,
  [Parameter(Mandatory=$true)][string]$DataPath
)
$ErrorActionPreference = 'Stop'

$signature = @"
using System;
using System.Runtime.InteropServices;

public class SaintsRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }

  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, Int32 dwCount, out Int32 dwWritten);

  public static void SendBytesToPrinter(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    DOCINFOA di = new DOCINFOA();
    di.pDocName = "SAINTS POS Bon";
    di.pDataType = "RAW";

    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }

    try {
      if (!StartDocPrinter(hPrinter, 1, di)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      try {
        if (!StartPagePrinter(hPrinter)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        try {
          int written;
          if (!WritePrinter(hPrinter, bytes, bytes.Length, out written)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
          if (written != bytes.Length) throw new Exception("Nicht alle Bytes wurden geschrieben: " + written + "/" + bytes.Length);
        } finally {
          EndPagePrinter(hPrinter);
        }
      } finally {
        EndDocPrinter(hPrinter);
      }
    } finally {
      ClosePrinter(hPrinter);
    }
  }
}
"@

Add-Type -TypeDefinition $signature -Language CSharp
[byte[]]$bytes = [System.IO.File]::ReadAllBytes($DataPath)
[SaintsRawPrinter]::SendBytesToPrinter($PrinterName, $bytes)
`;

  try {
    await writeFile(dataPath, data);
    await writeFile(scriptPath, script, "utf8");
    await runPowerShellFile(scriptPath, [printerName, dataPath]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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
    printers: await listPrinters(),
  }));

  app.get("/printers", async () => ({ ok: true, printers: await listPrinters() }));

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
  const printers = await listPrinters();
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

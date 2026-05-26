// Mini ESC/POS encoder + TCP-Sender für Netzwerk-Bondrucker (Port 9100).
// Kein externer Lib-Zwang — funktioniert mit Epson/Star/Bixolon ESC/POS.

const net = require("net");
const os = require("os");

const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  INIT: Buffer.from([ESC, 0x40]),
  CUT: Buffer.from([GS, 0x56, 0x00]),
  CUT_PARTIAL: Buffer.from([GS, 0x56, 0x01]),
  LF: Buffer.from([0x0a]),
  ALIGN_LEFT: Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: Buffer.from([ESC, 0x61, 0x02]),
  BOLD_ON: Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]),
  SIZE_NORMAL: Buffer.from([GS, 0x21, 0x00]),
  SIZE_DOUBLE_H: Buffer.from([GS, 0x21, 0x01]),
  SIZE_DOUBLE_W: Buffer.from([GS, 0x21, 0x10]),
  SIZE_LARGE: Buffer.from([GS, 0x21, 0x11]),
  DRAWER_KICK: Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]),
};

function encodeText(text) {
  // CP437/Latin-1 — die meisten Bondrucker mappen so. Umlaute notfalls ersetzen.
  return Buffer.from(
    String(text)
      .replace(/ä/g, "\x84").replace(/Ä/g, "\x8e")
      .replace(/ö/g, "\x94").replace(/Ö/g, "\x99")
      .replace(/ü/g, "\x81").replace(/Ü/g, "\x9a")
      .replace(/ß/g, "\xe1").replace(/€/g, "\x80"),
    "binary",
  );
}

function alignBuf(align) {
  if (align === "center") return CMD.ALIGN_CENTER;
  if (align === "right") return CMD.ALIGN_RIGHT;
  return CMD.ALIGN_LEFT;
}

function sizeBuf(size) {
  if (size === "large") return CMD.SIZE_LARGE;
  if (size === "double-h") return CMD.SIZE_DOUBLE_H;
  if (size === "double-w") return CMD.SIZE_DOUBLE_W;
  return CMD.SIZE_NORMAL;
}

// payload = { title?, lines: [{text, bold?, align?, size?, cols?: [left, right]}], cut?, drawer? }
function buildBuffer(payload) {
  const chunks = [CMD.INIT];

  if (payload.title) {
    chunks.push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.SIZE_LARGE);
    chunks.push(encodeText(payload.title), CMD.LF, CMD.LF);
    chunks.push(CMD.SIZE_NORMAL, CMD.BOLD_OFF);
  }

  for (const line of payload.lines || []) {
    if (line.separator) {
      chunks.push(CMD.ALIGN_LEFT, encodeText("-".repeat(42)), CMD.LF);
      continue;
    }
    chunks.push(alignBuf(line.align), sizeBuf(line.size));
    if (line.bold) chunks.push(CMD.BOLD_ON);

    if (Array.isArray(line.cols) && line.cols.length === 2) {
      const [l, r] = line.cols;
      const width = 42;
      const left = String(l);
      const right = String(r);
      const space = Math.max(1, width - left.length - right.length);
      chunks.push(encodeText(left + " ".repeat(space) + right), CMD.LF);
    } else {
      chunks.push(encodeText(line.text || ""), CMD.LF);
    }

    if (line.bold) chunks.push(CMD.BOLD_OFF);
  }

  // Footer-Abstand
  chunks.push(CMD.LF, CMD.LF, CMD.LF, CMD.LF);

  if (payload.drawer) chunks.push(CMD.DRAWER_KICK);
  if (payload.cut !== false) chunks.push(CMD.CUT);

  return Buffer.concat(chunks);
}

function sendToPrinter(printer, payload) {
  return new Promise((resolve, reject) => {
    if (!printer || !printer.ip_address) {
      return reject(new Error("Drucker ohne IP-Adresse"));
    }
    const port = printer.port || 9100;
    const buf = buildBuffer(payload);

    const socket = new net.Socket();
    let settled = false;
    const done = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      err ? reject(err) : resolve();
    };

    socket.setTimeout(5000);
    socket.once("timeout", () => done(new Error("Timeout zum Drucker")));
    socket.once("error", (e) => done(e));

    socket.connect(port, printer.ip_address, () => {
      socket.write(buf, () => {
        // kurze Wartezeit, damit der Drucker alle Bytes verarbeitet
        setTimeout(() => done(), 250);
      });
    });
  });
}

// Probiert eine TCP-Verbindung zu einer IP/Port mit Timeout.
// Liefert true wenn der Port offen ist (typisch für Bondrucker auf 9100).
function probe(ip, port, timeout = 400) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    try {
      socket.connect(port, ip);
    } catch {
      finish(false);
    }
  });
}

// Findet die eigenen IPv4-Subnetze (z.B. 192.168.1.0/24) im lokalen Netz.
function getLocalSubnets() {
  const subnets = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      if (info.family !== "IPv4" || info.internal) continue;
      // Nur /24-Subnetze scannen
      const parts = info.address.split(".");
      if (parts.length !== 4) continue;
      const prefix = `${parts[0]}.${parts[1]}.${parts[2]}.`;
      subnets.push({ prefix, self: info.address });
    }
  }
  return subnets;
}

// Scannt das lokale Subnetz (.1-.254) auf offenen Port 9100 (Standard für Bondrucker).
// Liefert Liste aller gefundenen IPs.
async function discoverPrinters({ port = 9100, concurrency = 64 } = {}) {
  const subnets = getLocalSubnets();
  const found = [];
  for (const sub of subnets) {
    const ips = [];
    for (let i = 1; i <= 254; i++) ips.push(sub.prefix + i);

    let idx = 0;
    async function worker() {
      while (idx < ips.length) {
        const ip = ips[idx++];
        if (ip === sub.self) continue;
        const ok = await probe(ip, port, 350);
        if (ok) found.push({ ip_address: ip, port });
      }
    }
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);
  }
  // doppelte entfernen
  const seen = new Set();
  return found.filter((p) => {
    const k = `${p.ip_address}:${p.port}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

module.exports = { sendToPrinter, buildBuffer, discoverPrinters };

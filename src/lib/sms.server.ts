const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

/** Absender-Nummer (Twilio). Kann via Secret überschrieben werden. */
const DEFAULT_FROM = "+15672293363";

/** Swiss/international phone -> E.164 (e.g. "079 123 45 67" -> "+41791234567"). */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.replace(/[^\d+]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (s.startsWith("+")) s = s.slice(1);
  else if (s.startsWith("0")) s = `41${s.slice(1)}`;
  if (s.length < 10) return null;
  return `+${s}`;
}

/** Backwards-compatible helper (returns numeric MSISDN). */
export function toMsisdn(raw: string | null | undefined): number | null {
  const e = toE164(raw);
  if (!e) return null;
  const n = Number(e.slice(1));
  return Number.isFinite(n) ? n : null;
}

export async function sendSms(
  recipient: number | string,
  message: string,
  _reference?: string,
) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["TWILIO_API_KEY"];
  if (!lovableKey || !connectionKey) throw new Error("SMS ist nicht konfiguriert");

  const to = typeof recipient === "string" ? toE164(recipient) : `+${recipient}`;
  if (!to) throw new Error("Ungültige Empfängernummer");

  const from = process.env["TWILIO_FROM_NUMBER"] ?? DEFAULT_FROM;

  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: message }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[SMS] Twilio ${res.status}: ${body}`);
    let hint = "";
    try {
      const j = JSON.parse(body) as { code?: number; message?: string };
      if (j.code === 21608)
        hint =
          " (Twilio Testphase: Empfängernummer muss zuerst im Twilio-Konto verifiziert werden)";
      if (j.code === 21606 || j.code === 21659)
        hint = " (Absendernummer nicht für SMS in die Schweiz freigegeben)";
      if (j.message) return Promise.reject(new Error(`SMS fehlgeschlagen: ${j.message}${hint}`));
    } catch {
      /* raw body below */
    }
    throw new Error(`SMS fehlgeschlagen [${res.status}]: ${body}${hint}`);
  }
  return true;
}

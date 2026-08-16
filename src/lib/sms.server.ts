const GATEWAY_URL = "https://connector-gateway.lovable.dev/gatewayapi";

/** Swiss/international phone -> MSISDN integer (e.g. "079 123 45 67" -> 41791234567). */
export function toMsisdn(raw: string | null | undefined): number | null {
  if (!raw) return null;
  let s = raw.replace(/[^\d+]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (s.startsWith("+")) s = s.slice(1);
  else if (s.startsWith("0")) s = `41${s.slice(1)}`;
  const n = Number(s);
  return Number.isFinite(n) && s.length >= 10 ? n : null;
}

export async function sendSms(recipient: number, message: string, reference?: string) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GATEWAYAPI_API_KEY"];
  if (!lovableKey || !connectionKey) throw new Error("SMS ist nicht konfiguriert");

  const urlMatch = message.match(/https:\/\/\S+/);
  const messages = urlMatch
    ? [
        "Piratino: Deine Bestellung ist jetzt unterwegs.",
        `Live-Standort und Ankunftszeit: ${urlMatch[0]}`,
      ]
    : [message];

  for (const [index, text] of messages.entries()) {
    const res = await fetch(`${GATEWAY_URL}/mobile/single`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: "Piratino",
        recipient,
        message: text,
        ...(reference ? { reference: `${reference}-${index + 1}` } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[SMS] GatewayAPI ${res.status}: ${body}`);
      throw new Error(`SMS fehlgeschlagen [${res.status}]: ${body}`);
    }
  }
  return true;
}

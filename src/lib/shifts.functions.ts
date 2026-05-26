import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";



const PublishSchema = z.object({
  shiftIds: z.array(z.string().uuid()).min(1).max(500),
});

type ShiftRow = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  position: string;
  notes: string | null;
  member: { id: string; name: string; email: string | null } | null;
};

function formatDate(d: string): string {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function htmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toIcsDate(date: string, time: string): string {
  return date.replace(/-/g, "") + "T" + time.replace(/:/g, "").slice(0, 6);
}

function buildIcs(memberName: string, shifts: ShiftRow[]): string {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events = shifts.map((s) => {
    const endDate = s.end_time <= s.start_time
      ? new Date(new Date(s.shift_date + "T00:00:00").getTime() + 86400000).toISOString().slice(0, 10)
      : s.shift_date;
    return [
      "BEGIN:VEVENT",
      `UID:${s.id}@saintsthebar.ch`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Europe/Zurich:${toIcsDate(s.shift_date, s.start_time)}`,
      `DTEND;TZID=Europe/Zurich:${toIcsDate(endDate, s.end_time)}`,
      `SUMMARY:${icsEscape("SAINTS – " + s.position)}`,
      `DESCRIPTION:${icsEscape(`Schicht: ${s.position}${s.notes ? "\n" + s.notes : ""}\nMitarbeiter: ${memberName}`)}`,
      "LOCATION:SAINTS Bar",
      "END:VEVENT",
    ].join("\r\n");
  }).join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SAINTS POS//Schichtplan//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Zurich",
    "BEGIN:STANDARD",
    "DTSTART:19701025T030000",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "TZNAME:CET",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700329T020000",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "TZNAME:CEST",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export const publishShifts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PublishSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (!userId) throw new Error("Nicht angemeldet");
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r) => r.role);
    if (!roles.includes("admin") && !roles.includes("manager")) {
      throw new Error("Nur Manager dürfen Schichtpläne veröffentlichen");
    }

    const { data: shifts, error } = await supabase
      .from("shifts")
      .select("id, shift_date, start_time, end_time, position, notes, member:team_members!inner(id, name, email)")
      .in("id", data.shiftIds);
    if (error) throw error;

    const list = (shifts ?? []) as unknown as ShiftRow[];

    // Group by member
    const byMember = new Map<string, ShiftRow[]>();
    for (const s of list) {
      if (!s.member?.email) continue;
      const key = s.member.id;
      if (!byMember.has(key)) byMember.set(key, []);
      byMember.get(key)!.push(s);
    }

    const results: { name: string; email: string; status: "sent" | "failed"; error?: string }[] = [];

    for (const [, memberShifts] of byMember) {
      const m = memberShifts[0].member!;
      memberShifts.sort((a, b) =>
        (a.shift_date + a.start_time).localeCompare(b.shift_date + b.start_time)
      );
      const rows = memberShifts
        .map(
          (s) => `
            <tr style="border-bottom:1px solid #eee">
              <td style="padding:10px 8px;font-size:14px">${formatDate(s.shift_date)}</td>
              <td style="padding:10px 8px;font-size:14px;font-variant-numeric:tabular-nums">${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}</td>
              <td style="padding:10px 8px;font-size:14px">${htmlEscape(s.position)}</td>
              <td style="padding:10px 8px;font-size:13px;color:#666">${s.notes ? htmlEscape(s.notes) : ""}</td>
            </tr>`
        )
        .join("");
      const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fafafa;padding:24px;color:#111">
        <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #eee">
          <h1 style="margin:0 0 8px;font-size:22px">Hallo ${htmlEscape(m.name)},</h1>
          <p style="margin:0 0 20px;color:#555;font-size:14px">hier ist dein neuer Schichtplan:</p>
          <table style="width:100%;border-collapse:collapse;margin-top:8px">
            <thead><tr style="text-align:left;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">
              <th style="padding:8px">Datum</th><th style="padding:8px">Zeit</th><th style="padding:8px">Position</th><th style="padding:8px">Notiz</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top:24px;color:#888;font-size:12px">SAINTS — bei Fragen melde dich bei deinem Manager.</p>
        </div></body></html>`;
      try {
        const text = `Hallo ${m.name},\n\nhier ist dein neuer Schichtplan:\n\n` +
          memberShifts.map((s) => `• ${formatDate(s.shift_date)} ${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)} ${s.position}${s.notes ? " ("+s.notes+")" : ""}`).join("\n") +
          `\n\nSAINTS`;

        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY fehlt");
        if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY fehlt");

        const from = process.env.RESEND_FROM || "SAINTS <onboarding@resend.dev>";

        const ics = buildIcs(m.name, memberShifts);
        const icsBase64 = Buffer.from(ics, "utf-8").toString("base64");

        const res = await fetch(`${RESEND_GATEWAY}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from,
            to: [m.email!],
            subject: "Dein Schichtplan",
            html,
            text,
            attachments: [
              {
                filename: "schichtplan.ics",
                content: icsBase64,
                content_type: "text/calendar; charset=utf-8; method=PUBLISH",
              },
            ],
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend ${res.status}: ${body}`);
        }
        results.push({ name: m.name, email: m.email!, status: "sent" });
      } catch (e) {
        results.push({
          name: m.name,
          email: m.email!,
          status: "failed",
          error: e instanceof Error ? e.message : "Unbekannter Fehler",
        });
      }

    }


    // Mark as published
    await supabase
      .from("shifts")
      .update({ published_at: new Date().toISOString() })
      .in("id", data.shiftIds);

    const skipped = list.filter((s) => !s.member?.email).length;
    return { results, skipped, total: list.length };
  });

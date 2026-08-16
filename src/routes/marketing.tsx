import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Megaphone, Send, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getNewsletterDashboard, sendNewsletterCampaign } from "@/lib/marketing.functions";

export const Route = createFileRoute("/marketing")({
  head: () => ({
    meta: [
      { title: "Newsletter & Bewertungen — Piratino POS" },
      {
        name: "description",
        content: "Kundenbewertungen ansehen und Angebote an Newsletter-Abonnenten senden.",
      },
      { property: "og:title", content: "Newsletter & Bewertungen — Piratino POS" },
      {
        property: "og:description",
        content: "Kundenbewertungen ansehen und Angebote an Newsletter-Abonnenten senden.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketingPage,
});

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MarketingPage() {
  const qc = useQueryClient();
  const { operator } = useAuth();
  const load = useServerFn(getNewsletterDashboard);
  const send = useServerFn(sendNewsletterCampaign);
  const [message, setMessage] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["marketing-dashboard"],
    queryFn: () => load(),
    refetchInterval: 60000,
  });

  const campaign = useMutation({
    mutationFn: async () =>
      send({ data: { message: message.trim(), sentBy: operator?.name ?? undefined } }),
    onSuccess: (r) => {
      setMessage("");
      qc.invalidateQueries({ queryKey: ["marketing-dashboard"] });
      toast.success(`Angebot gesendet an ${r.sent} Kund:innen${r.failed ? ` · ${r.failed} fehlgeschlagen` : ""}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Versand fehlgeschlagen"),
  });

  const stats = data?.stats;

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Newsletter & Bewertungen</h1>
        <p className="text-sm text-muted-foreground">
          Kund:innen erhalten 30 Minuten nach der Lieferung automatisch eine Bewertungs-SMS.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<Users className="size-5" />} label="Newsletter-Zusagen" value={String(stats?.subscriberCount ?? 0)} />
            <StatCard label="Abgelehnt" value={String(stats?.declinedCount ?? 0)} />
            <StatCard icon={<Star className="size-5" />} label="Ø Bewertung" value={stats?.avgRating ? stats.avgRating.toFixed(1) : "—"} />
            <StatCard label="Bewertungen" value={String(stats?.reviewCount ?? 0)} />
          </div>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground">
              <Megaphone className="size-5" /> Neues Angebot senden
            </h2>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={400}
              placeholder="z. B. Piratino: Heute 20% auf alle Pizzen! Bestell jetzt unter 044 000 00 00."
              className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Empfänger: {stats?.subscriberCount ?? 0} · {message.length}/400 Zeichen
              </span>
              <button
                type="button"
                disabled={message.trim().length < 5 || campaign.isPending || !stats?.subscriberCount}
                onClick={() => campaign.mutate()}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
              >
                {campaign.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Senden
              </button>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold text-card-foreground">
                Newsletter-Kund:innen ({data?.subscribers.length ?? 0})
              </h2>
              <ul className="mt-3 divide-y divide-border">
                {(data?.subscribers ?? []).map((s: any) => (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.phone} {s.city ? `· ${s.city}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{fmt(s.optInAt)}</span>
                  </li>
                ))}
                {!data?.subscribers.length && (
                  <li className="py-6 text-center text-sm text-muted-foreground">Noch keine Zusagen</li>
                )}
              </ul>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold text-card-foreground">Letzte Bewertungen</h2>
              <ul className="mt-3 divide-y divide-border">
                {(data?.reviews ?? []).map((r: any) => (
                  <li key={r.id} className="py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{r.customerName ?? "Kunde"}</span>
                      <span className="text-xs text-muted-foreground">{fmt(r.respondedAt ?? r.sentAt)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-primary">
                      {r.rating
                        ? Array.from({ length: r.rating }).map((_, i) => (
                            <Star key={i} className="size-3.5 fill-primary" />
                          ))
                        : <span className="text-xs text-muted-foreground">
                            {r.sendError ? `SMS-Fehler: ${r.sendError}` : r.sentAt ? "Noch keine Antwort" : "SMS geplant"}
                          </span>}
                    </div>
                    {r.comment && <p className="mt-1 text-xs text-muted-foreground">{r.comment}</p>}
                  </li>
                ))}
                {!data?.reviews.length && (
                  <li className="py-6 text-center text-sm text-muted-foreground">Noch keine Bewertungen</li>
                )}
              </ul>
            </section>
          </div>

          {!!data?.campaigns.length && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold text-card-foreground">Gesendete Angebote</h2>
              <ul className="mt-3 divide-y divide-border">
                {data.campaigns.map((c: any) => (
                  <li key={c.id} className="py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">{c.message}</span>
                      <span className="ml-3 shrink-0 text-xs text-muted-foreground">{fmt(c.createdAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.recipientCount} gesendet{c.failedCount ? ` · ${c.failedCount} fehlgeschlagen` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

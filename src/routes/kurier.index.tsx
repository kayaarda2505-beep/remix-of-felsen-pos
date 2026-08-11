import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Bike, Loader2, LogOut, MapPin } from "lucide-react";

import { listMyCourierOrders } from "@/lib/courier.functions";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/kurier/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Meine Lieferungen — Piratino Kurier" },
      { name: "description", content: "Zugewiesene Lieferungen und die eigene Lieferhistorie für Kuriere von Piratino." },
      { property: "og:title", content: "Meine Lieferungen — Piratino Kurier" },
      { property: "og:description", content: "Zugewiesene Lieferungen und Lieferhistorie für Kuriere." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CourierHome,
});

function CourierHome() {
  const qc = useQueryClient();
  const listOrders = useServerFn(listMyCourierOrders);

  const { data, isLoading } = useQuery({
    queryKey: ["my-courier-orders"],
    queryFn: () => listOrders({ data: {} as never }),
    refetchInterval: 20_000,
  });

  const courier = data?.courier ?? null;
  const active = data?.active ?? [];
  const history = data?.history ?? [];

  const logout = async () => {
    await supabase.auth.signOut();
    qc.clear();
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-16 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bike className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-semibold">{courier?.name ?? "Kurier"}</h1>
        </div>
        <button onClick={logout} className="glass rounded-xl px-3 py-2 text-xs flex items-center gap-1">
          <LogOut className="w-3.5 h-3.5" /> Abmelden
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && !courier && (
        <div className="glass-strong rounded-3xl p-6 text-sm text-muted-foreground">
          Dieses Konto ist noch keinem Kurier zugeordnet. Bitte im Team-Bereich verknüpfen lassen.
        </div>
      )}

      {courier && (
        <>
          <section className="glass-strong rounded-3xl p-4 mb-4">
            <h2 className="font-semibold mb-3">Meine Lieferungen ({active.length})</h2>
            {active.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aktuell keine zugewiesenen Lieferungen.</div>
            ) : (
              <div className="space-y-2">
                {active.map((o: any) => (
                  <Link
                    key={o.id}
                    to="/kurier/$id"
                    params={{ id: o.id }}
                    className="glass rounded-xl px-3 py-3 flex items-center justify-between gap-3 hover:border-accent/40"
                  >
                    <div className="min-w-0">
                      <div className="text-sm truncate flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
                        {o.delivery_address ?? "Lieferung"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.opened_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                        {o.courier_started_at ? " · unterwegs" : " · bereit"}
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0">CHF {Number(o.total).toFixed(2)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="glass-strong rounded-3xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Historie</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {history.length} · CHF {history.reduce((s: number, o: any) => s + Number(o.total || 0), 0).toFixed(2)}
              </span>
            </div>
            {history.length === 0 ? (
              <div className="text-sm text-muted-foreground">Noch keine abgeschlossenen Lieferungen.</div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {history.map((o: any) => (
                  <div key={o.id} className="glass rounded-xl px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm truncate">{o.delivery_address ?? "Lieferung"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.closed_at ?? o.opened_at).toLocaleDateString("de-CH", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })}
                        {" · "}
                        {new Date(o.closed_at ?? o.opened_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[10px] uppercase tracking-wider ${o.status === "paid" ? "text-emerald-400" : "text-muted-foreground"}`}>
                        {o.status === "paid" ? "Geliefert" : "Storniert"}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">CHF {Number(o.total).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

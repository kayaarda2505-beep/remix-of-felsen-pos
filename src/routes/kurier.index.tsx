import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bike, Loader2, LogOut, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { listMyCourierOrders } from "@/lib/courier.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/kurier/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Kurier-Login — Piratino Lieferungen" },
      { name: "description", content: "Als Kurier mit E-Mail und Passwort anmelden, zugewiesene Lieferungen sehen und die eigene Lieferhistorie prüfen." },
      { property: "og:title", content: "Kurier-Login — Piratino Lieferungen" },
      { property: "og:description", content: "Zugewiesene Lieferungen und Lieferhistorie für Kuriere." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CourierHome,
});

function CourierHome() {
  const [session, setSession] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const qc = useQueryClient();

  const listOrders = useServerFn(listMyCourierOrders);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const doLogin = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error("E-Mail oder Passwort falsch");
    },
    onSuccess: () => {
      setPassword("");
      qc.invalidateQueries({ queryKey: ["my-courier-orders"] });
      toast.success("Angemeldet");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["my-courier-orders"],
    enabled: session === true,
    queryFn: () => listOrders({ data: {} as never }),
    refetchInterval: 20_000,
  });

  if (session !== true) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            doLogin.mutate();
          }}
          className="glass-strong rounded-3xl p-6 w-full max-w-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <Bike className="w-5 h-5 text-accent" />
            <h1 className="text-lg font-semibold">Kurier-Anmeldung</h1>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">E-Mail</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass rounded-xl px-3 py-3 w-full text-base outline-none bg-transparent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Passwort</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass rounded-xl px-3 py-3 w-full text-base outline-none bg-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={doLogin.isPending || !email || password.length < 6}
              className="w-full rounded-xl py-3 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40"
            >
              {doLogin.isPending ? "Prüfen…" : "Anmelden"}
            </button>
          </div>
        </form>
      </div>
    );
  }

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

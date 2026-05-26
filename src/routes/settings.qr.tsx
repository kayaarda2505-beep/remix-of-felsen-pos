import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { QrCode, RefreshCw, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { SettingsPage } from "@/components/SettingsPage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings/qr")({
  component: QrPage,
});

type T = { id: string; name: string; qr_token: string | null; seats: number };

function deriveDefaultBase() {
  if (typeof window === "undefined") return "";
  const origin = window.location.origin;
  // On the in-app preview the origin requires Lovable login — fall back to the published site.
  if (/\.lovable\.dev$|id-preview--|--.*\.lovable\.app$/.test(window.location.host)) {
    return "https://glass-flow-pos.lovable.app";
  }
  return origin;
}

function QrPage() {
  const [tables, setTables] = useState<T[]>([]);
  const [baseUrl, setBaseUrl] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("saints.qr.baseUrl") || deriveDefaultBase();
  });

  const saveBase = (v: string) => {
    const clean = v.trim().replace(/\/$/, "");
    setBaseUrl(clean);
    if (typeof window !== "undefined") localStorage.setItem("saints.qr.baseUrl", clean);
  };

  const load = async () => {
    const { data } = await supabase.from("dining_tables").select("id,name,qr_token,seats").order("sort_order");
    setTables(data ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const regenerate = async (id: string) => {
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const { error } = await supabase.from("dining_tables").update({ qr_token: token }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Neuer QR-Token");
    load();
  };

  const link = (t: T) => `${baseUrl}/order/${t.qr_token ?? ""}`;
  const qrImg = (t: T) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(link(t))}`;

  const copyLink = async (t: T) => {
    await navigator.clipboard.writeText(link(t));
    toast.success("Link kopiert");
  };

  const empty = useMemo(() => tables.length === 0, [tables]);

  return (
    <SettingsPage title="QR-Bestellung" subtitle="Gäste scannen am Tisch und bestellen direkt">
      <div className="glass rounded-2xl p-4 mb-4">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Öffentliche Bestell-URL</label>
        <input
          value={baseUrl}
          onChange={(e) => saveBase(e.target.value)}
          placeholder="https://deine-domain.ch"
          className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent/50"
        />
        <p className="text-[11px] text-muted-foreground mt-2">
          Diese URL wird in die QR-Codes geschrieben. Standard: deine veröffentlichte Seite.
        </p>
      </div>
      {empty ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Noch keine Tische — füge zuerst Tische im Tisch-Manager an, dann erscheinen sie hier.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tables.map((t) => (
            <div key={t.id} className="glass rounded-2xl p-5 flex flex-col items-center">
              <div className="font-semibold mb-1">{t.name}</div>
              <div className="text-[10px] text-muted-foreground mb-3 uppercase tracking-wider">
                {t.seats} Plätze
              </div>
              <div className="bg-white p-3 rounded-2xl mb-3">
                {t.qr_token ? (
                  <img src={qrImg(t)} alt={`QR ${t.name}`} width={200} height={200} />
                ) : (
                  <div className="w-[200px] h-[200px] flex items-center justify-center text-black/40">
                    <QrCode className="w-12 h-12" />
                  </div>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground truncate w-full text-center mb-3 font-mono">
                {t.qr_token ?? "kein Token"}
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => copyLink(t)}
                  className="flex-1 rounded-lg bg-white/5 hover:bg-white/10 py-2 text-xs flex items-center justify-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Link
                </button>
                <a
                  href={qrImg(t)}
                  download={`saints-${t.name}.png`}
                  className="flex-1 rounded-lg bg-white/5 hover:bg-white/10 py-2 text-xs flex items-center justify-center gap-1"
                >
                  <Download className="w-3 h-3" /> PNG
                </a>
                <button
                  onClick={() => regenerate(t.id)}
                  className="flex-1 rounded-lg bg-white/5 hover:bg-white/10 py-2 text-xs flex items-center justify-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Neu
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsPage>
  );
}

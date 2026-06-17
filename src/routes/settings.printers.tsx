import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Printer, Wifi, MonitorSmartphone, Globe, Search, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { SettingsPage } from "@/components/SettingsPage";
import { supabase } from "@/integrations/supabase/client";
import {
  isPrintAgentConfigured,
  getPrintAgentUrl,
  setPrintAgentUrl,
  pingPrintAgent,
  getAgentPrinters,
  testPrinter,
  discoverPrintersOnNetwork,
} from "@/lib/printer-bridge";

export const Route = createFileRoute("/settings/printers")({
  component: PrintersPage,
});

type P = {
  id: string;
  name: string;
  type: string;
  ip_address: string | null;
  port: number | null;
  active: boolean;
};

const TYPES = ["bon", "kueche", "bar", "rechnung"] as const;

function PrintersPage() {
  const [items, setItems] = useState<P[]>([]);
  const [form, setForm] = useState({ name: "", type: "bon", ip_address: "", port: 9100 });
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<Array<{ ip_address: string; port: number }>>([]);
  const [agentPrinters, setAgentPrinters] = useState<Array<{ name: string; isDefault: boolean; status?: string }>>([]);
  const [agentUrl, setAgentUrl] = useState<string>(getPrintAgentUrl() ?? "");
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [pinging, setPinging] = useState(false);
  const [loadingAgentPrinters, setLoadingAgentPrinters] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("printers").select("*").order("created_at");
    setItems(data ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const refreshPing = async () => {
    if (!isPrintAgentConfigured()) {
      setAgentOnline(null);
      return;
    }
    setPinging(true);
    const ok = await pingPrintAgent();
    setAgentOnline(ok);
    setPinging(false);
  };

  useEffect(() => {
    refreshPing();
  }, []);

  const saveAgentUrl = async () => {
    const v = agentUrl.trim();
    if (v && !/^https?:\/\//i.test(v)) {
      return toast.error("URL muss mit http:// oder https:// beginnen");
    }
    setPrintAgentUrl(v || null);
    toast.success(v ? "Print-Agent gespeichert" : "Print-Agent entfernt");
    await refreshPing();
  };

  const scan = async () => {
    if (!isPrintAgentConfigured()) {
      return toast.error("Bitte zuerst Print-Agent-URL konfigurieren");
    }
    setScanning(true);
    setFound([]);
    try {
      toast.message("Netzwerk wird durchsucht…", { description: "Dauert ca. 10–30 Sekunden" });
      const r = await discoverPrintersOnNetwork({ port: 9100 });
      if (!r.ok) throw new Error(r.error ?? "Fehler bei der Suche");
      const results = r.results ?? [];
      const existing = new Set(items.map((p) => p.ip_address).filter(Boolean));
      const fresh = results.filter((x) => !existing.has(x.ip_address));
      setFound(fresh);
      if (fresh.length === 0) toast.message("Keine neuen Drucker gefunden");
      else toast.success(`${fresh.length} Drucker gefunden`);
    } catch (e: any) {
      toast.error(e?.message ?? "Suche fehlgeschlagen");
    } finally {
      setScanning(false);
    }
  };

  const addFromScan = async (ip: string, port: number) => {
    const name = `Drucker ${ip.split(".").pop()}`;
    const { error } = await supabase.from("printers").insert({
      name,
      type: "bon",
      ip_address: ip,
      port,
    });
    if (error) return toast.error(error.message);
    toast.success(`${name} hinzugefügt`);
    setFound((f) => f.filter((x) => x.ip_address !== ip));
    load();
  };

  const create = async () => {
    if (!form.name.trim()) return toast.error("Name fehlt");
    const { error } = await supabase.from("printers").insert({
      name: form.name,
      type: form.type,
      ip_address: form.ip_address || null,
      port: form.port || 9100,
    });
    if (error) return toast.error(error.message);
    toast.success("Drucker hinzugefügt");
    setForm({ name: "", type: "bon", ip_address: "", port: 9100 });
    load();
  };

  const loadAgentPrinters = async () => {
    if (!isPrintAgentConfigured()) {
      return toast.error("Bitte zuerst Print-Agent-URL konfigurieren");
    }
    setLoadingAgentPrinters(true);
    try {
      const r = await getAgentPrinters();
      if (!r.ok) throw new Error(r.error ?? "Drucker konnten nicht geladen werden");
      const existing = new Set(items.map((p) => p.name));
      const fresh = (r.printers ?? []).filter((p) => !existing.has(p.name));
      setAgentPrinters(fresh);
      if (fresh.length === 0) toast.message("Keine neuen Windows-Drucker gefunden");
      else toast.success(`${fresh.length} Windows-Drucker gefunden`);
    } catch (e: any) {
      toast.error(e?.message ?? "Drucker konnten nicht geladen werden");
    } finally {
      setLoadingAgentPrinters(false);
    }
  };

  const addAgentPrinter = async (name: string) => {
    const { error } = await supabase.from("printers").insert({
      name,
      type: "bon",
      ip_address: null,
      port: 9100,
    });
    if (error) return toast.error(error.message);
    toast.success(`${name} hinzugefügt`);
    setAgentPrinters((list) => list.filter((p) => p.name !== name));
    load();
  };

  const testPrint = async (p: P) => {
    if (!isPrintAgentConfigured()) {
      return toast.error("Bitte zuerst Print-Agent-URL konfigurieren");
    }
    const r = await testPrinter(p);
    if (r.ok) toast.success(`Test-Druck an ${p.name} gesendet`);
    else toast.error(r.error ?? "Druckfehler");
  };
  const configured = isPrintAgentConfigured();
  const online = configured && agentOnline === true;

  const toggle = async (p: P) => {
    await supabase.from("printers").update({ active: !p.active }).eq("id", p.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Löschen?")) return;
    await supabase.from("printers").delete().eq("id", id);
    load();
  };

  return (
    <SettingsPage title="Drucker" subtitle="Bon-, Küchen- und Bar-Drucker konfigurieren">
      <div
        className={`glass rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 text-sm border ${
          online
            ? "border-success/40 bg-success/5"
            : configured
            ? "border-warning/40 bg-warning/5"
            : "border-warning/40 bg-warning/5"
        }`}
      >
        {online ? (
          <MonitorSmartphone className="w-4 h-4 text-success shrink-0" />
        ) : (
          <Globe className="w-4 h-4 text-warning shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium">
            {online
              ? "Print-Agent verbunden"
              : configured
              ? "Print-Agent nicht erreichbar"
              : "Kein Print-Agent konfiguriert"}
          </div>
          <div className="text-xs text-muted-foreground">
            {online
              ? "Bons werden über den lokalen Agent an die Windows-Drucker gesendet."
              : configured
              ? "Agent-URL ist gesetzt, aber der Agent antwortet nicht. Läuft das Programm im lokalen Netz?"
              : "Druck erst aktiv, wenn unten eine Agent-URL hinterlegt und der Agent erreichbar ist."}
          </div>
        </div>
        <button
          onClick={refreshPing}
          disabled={pinging || !configured}
          className="text-[10px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-40"
        >
          {pinging ? "…" : "Verbindung prüfen"}
        </button>
        <button
          onClick={async () => {
            const r = await getAgentPrinters();
            const def = r.printers?.find((p) => p.isDefault) ?? r.printers?.[0];
            if (!def) return toast.error("Kein Windows-Drucker am Agent gefunden");
            const res = await testPrinter({ id: "test", name: def.name, type: "bon", ip_address: null, port: null });
            if (res.ok) toast.success(`Testdruck an ${def.name} gesendet`);
            else toast.error(res.error ?? "Druckfehler");
          }}
          disabled={!online}
          className="text-[10px] px-2 py-1 rounded-md bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-40"
        >
          Testdruck
        </button>
      </div>

      <div className="glass rounded-3xl p-6 mb-4">
        <div className="text-sm font-medium mb-1">Print-Agent URL</div>
        <div className="text-xs text-muted-foreground mb-3">
          Auf dem Drucker-PC <code>http://localhost:9110</code>, vom Tablet <code>http://PC-IP:9110</code>. Wird nur in diesem Browser gespeichert.
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <input
            value={agentUrl}
            onChange={(e) => setAgentUrl(e.target.value)}
            placeholder="http://192.168.1.10:9110"
            className="rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm flex-1"
          />
          <button
            onClick={saveAgentUrl}
            className="rounded-xl bg-accent text-accent-foreground font-medium px-4 py-2.5 text-sm hover:opacity-90 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> Speichern
          </button>
        </div>
      </div>

      <div className="glass rounded-3xl p-6 mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-sm font-medium">Windows-Drucker vom Print-Agent laden</div>
            <div className="text-xs text-muted-foreground">
              Für USB-Drucker wie EPSON TM-T20III Receipt: Windows-Druckername übernehmen, keine IP nötig.
            </div>
          </div>
          <button
            onClick={loadAgentPrinters}
            disabled={loadingAgentPrinters || !configured}
            className="rounded-xl bg-accent/20 hover:bg-accent/30 text-accent px-4 py-2 text-sm font-medium flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            title={configured ? "Windows-Drucker laden" : "Erst Print-Agent konfigurieren"}
          >
            {loadingAgentPrinters ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Lade…</>
            ) : (
              <><Printer className="w-4 h-4" /> Laden</>
            )}
          </button>
        </div>
        {agentPrinters.length > 0 && (
          <div className="space-y-2 mt-2">
            {agentPrinters.map((p) => (
              <div key={p.name} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
                <Printer className="w-4 h-4 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.isDefault ? "Standarddrucker" : "Windows-Drucker"}</div>
                </div>
                <button
                  onClick={() => addAgentPrinter(p.name)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-accent text-accent-foreground hover:opacity-90 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Hinzufügen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-3xl p-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium">Drucker im Netzwerk suchen</div>
            <div className="text-xs text-muted-foreground">
              Scannt das lokale Netzwerk auf Bondrucker (Port 9100).
            </div>
          </div>
          <button
            onClick={scan}
            disabled={scanning || !configured}
            className="rounded-xl bg-accent/20 hover:bg-accent/30 text-accent px-4 py-2 text-sm font-medium flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            title={configured ? "Netzwerk scannen" : "Erst Print-Agent konfigurieren"}
          >
            {scanning ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Suche…</>
            ) : (
              <><Search className="w-4 h-4" /> Suchen</>
            )}
          </button>
        </div>
        {found.length > 0 && (
          <div className="space-y-2 mt-2">
            {found.map((f) => (
              <div key={f.ip_address} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
                <Printer className="w-4 h-4 text-accent shrink-0" />
                <div className="flex-1 text-sm font-mono">{f.ip_address}:{f.port}</div>
                <button
                  onClick={() => addFromScan(f.ip_address, f.port)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-accent text-accent-foreground hover:opacity-90 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Hinzufügen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-3xl p-6 mb-6">
        <div className="text-sm font-medium mb-4">Drucker manuell hinzufügen</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name"
            className="rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm md:col-span-2"
          />
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={form.port}
            onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
            placeholder="Port"
            className="rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm"
          />
          <input
            value={form.ip_address}
            onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
            placeholder="IP-Adresse optional – bei USB/Windows leer lassen"
            className="rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm md:col-span-3"
          />
          <button
            onClick={create}
            className="rounded-xl bg-accent text-accent-foreground font-medium py-2.5 text-sm md:col-span-4 hover:opacity-90 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Hinzufügen
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Keine Drucker eingerichtet
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <div key={p.id} className="glass rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Printer className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.type} · {p.ip_address ? `${p.ip_address}:${p.port}` : "Windows/USB über Print-Agent"}
                </div>
              </div>
              <button
                onClick={() => testPrint(p)}
                className="text-[10px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 flex items-center gap-1"
              >
                <Wifi className="w-3 h-3" /> Test
              </button>
              <button
                onClick={() => toggle(p)}
                className={`text-[10px] px-2 py-1 rounded-md ${
                  p.active ? "bg-success/15 text-success" : "bg-white/5 text-muted-foreground"
                }`}
              >
                {p.active ? "Aktiv" : "Aus"}
              </button>
              <button
                onClick={() => remove(p.id)}
                className="p-2 rounded-lg hover:bg-destructive/15 hover:text-destructive transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </SettingsPage>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Trash2, Sparkles, Database } from "lucide-react";
import { toast } from "sonner";
import { SettingsPage } from "@/components/SettingsPage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings/database")({
  component: DatabasePage,
});

const TABLES = ["ingredients", "dining_tables", "team_members", "happy_hour_rules", "payment_methods", "members", "printers", "locations"] as const;

function DatabasePage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const result: Record<string, number> = {};
    await Promise.all(
      TABLES.map(async (t) => {
        const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
        result[t] = count ?? 0;
      }),
    );
    setCounts(result);
  };

  useEffect(() => {
    refresh();
  }, []);

  const exportAll = async () => {
    setBusy(true);
    const dump: Record<string, unknown[]> = {};
    for (const t of TABLES) {
      const { data } = await supabase.from(t).select("*");
      dump[t] = data ?? [];
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saints-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBusy(false);
    toast.success("Backup heruntergeladen");
  };

  const seedDemo = async () => {
    if (!confirm("Demo-Tische, Zahlungsmethoden und Happy Hour einfügen?")) return;
    setBusy(true);
    try {
      const { data: loc } = await supabase.from("locations").select("id").limit(1).single();
      let locationId = loc?.id;
      if (!locationId) {
        const { data: newLoc } = await supabase
          .from("locations")
          .insert({ name: "SAINTS Bar", address: "Hauptstandort" })
          .select("id")
          .single();
        locationId = newLoc?.id;
      }
      if (locationId) {
        await supabase.from("dining_tables").insert(
          Array.from({ length: 12 }, (_, i) => ({
            location_id: locationId!,
            name: `T${i + 1}`,
            seats: 2 + (i % 4),
            sort_order: i,
          })),
        );
      }
      await supabase.from("payment_methods").insert([
        { name: "Bargeld", type: "cash", sort_order: 0 },
        { name: "Karte", type: "card", fee_pct: 0.7, sort_order: 1 },
        { name: "TWINT", type: "twint", sort_order: 2 },
        { name: "Apple Pay", type: "apple_pay", sort_order: 3 },
      ]);
      await supabase.from("happy_hour_rules").insert({
        name: "After Work",
        start_time: "17:00",
        end_time: "19:00",
        discount_pct: 20,
        days_of_week: [1, 2, 3, 4, 5],
      });
      toast.success("Demo-Daten geladen");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const wipe = async (table: string) => {
    if (!confirm(`Alle Einträge aus "${table}" wirklich löschen?`)) return;
    const { error } = await supabase.from(table as (typeof TABLES)[number]).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) return toast.error(error.message);
    toast.success(`${table} geleert`);
    refresh();
  };

  return (
    <SettingsPage title="Datenbank" subtitle="Backup, Demo-Daten und Wartung">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <button
          onClick={exportAll}
          disabled={busy}
          className="glass rounded-2xl p-5 text-left hover:border-accent/30 transition-all disabled:opacity-50"
        >
          <Download className="w-5 h-5 text-accent mb-3" />
          <div className="font-medium">Backup (JSON)</div>
          <div className="text-xs text-muted-foreground mt-1">Komplette Datenbank exportieren</div>
        </button>
        <button
          onClick={seedDemo}
          disabled={busy}
          className="glass rounded-2xl p-5 text-left hover:border-accent/30 transition-all disabled:opacity-50"
        >
          <Sparkles className="w-5 h-5 text-accent mb-3" />
          <div className="font-medium">Demo-Daten laden</div>
          <div className="text-xs text-muted-foreground mt-1">Tische, Zahlungen, Happy Hour</div>
        </button>
        <div className="glass rounded-2xl p-5">
          <Database className="w-5 h-5 text-accent mb-3" />
          <div className="font-medium">Sync-Status</div>
          <div className="text-xs text-success mt-1">● Live verbunden</div>
        </div>
      </div>

      <div className="glass rounded-3xl p-6">
        <div className="text-sm font-medium mb-4">Tabellen</div>
        <div className="space-y-1">
          {TABLES.map((t) => (
            <div
              key={t}
              className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/5"
            >
              <div className="font-mono text-xs">{t}</div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground">{counts[t] ?? "—"} Einträge</div>
                <button
                  onClick={() => wipe(t)}
                  className="p-1.5 rounded-md hover:bg-destructive/15 hover:text-destructive transition-colors"
                  title="Tabelle leeren"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SettingsPage>
  );
}

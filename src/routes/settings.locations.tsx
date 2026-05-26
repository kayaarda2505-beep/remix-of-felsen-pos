import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { SettingsPage } from "@/components/SettingsPage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings/locations")({
  component: LocationsPage,
});

type Loc = {
  id: string;
  name: string;
  address: string | null;
  currency: string;
  timezone: string;
  active: boolean;
};

function LocationsPage() {
  const [items, setItems] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", address: "", currency: "CHF", timezone: "Europe/Zurich" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("locations").select("*").order("created_at");
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.name.trim()) return toast.error("Name fehlt");
    const { error } = await supabase.from("locations").insert({ ...form, address: form.address || null });
    if (error) return toast.error(error.message);
    toast.success("Standort hinzugefügt");
    setForm({ name: "", address: "", currency: "CHF", timezone: "Europe/Zurich" });
    load();
  };

  const toggleActive = async (l: Loc) => {
    await supabase.from("locations").update({ active: !l.active }).eq("id", l.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Standort wirklich löschen?")) return;
    const { error } = await supabase.from("locations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Gelöscht");
    load();
  };

  return (
    <SettingsPage title="Standorte" subtitle="Multi-Location Setup">
      <div className="glass rounded-3xl p-6 mb-6">
        <div className="text-sm font-medium mb-4">Neuer Standort</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name (z. B. SAINTS Bar)"
            className="rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm md:col-span-2"
          />
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Adresse"
            className="rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm md:col-span-2"
          />
          <input
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })}
            placeholder="CHF"
            className="rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm"
          />
          <input
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            placeholder="Europe/Zurich"
            className="rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm md:col-span-2"
          />
          <button
            onClick={create}
            className="rounded-xl bg-accent text-accent-foreground font-medium py-2.5 text-sm hover:opacity-90 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Hinzufügen
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Lade…</div>
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Noch keine Standorte
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((l) => (
            <div key={l.id} className="glass rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{l.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {l.address || "Keine Adresse"} · {l.currency} · {l.timezone}
                </div>
              </div>
              <button
                onClick={() => toggleActive(l)}
                className={`text-[10px] px-2 py-1 rounded-md ${
                  l.active ? "bg-success/15 text-success" : "bg-white/5 text-muted-foreground"
                }`}
              >
                {l.active ? "Aktiv" : "Inaktiv"}
              </button>
              <button
                onClick={() => remove(l.id)}
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

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Bell } from "lucide-react";
import { toast } from "sonner";
import { SettingsPage } from "@/components/SettingsPage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings/happy-hour")({
  component: HappyHourPage,
});

type Rule = {
  id: string;
  name: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  discount_pct: number;
  category_filter: string | null;
  active: boolean;
};

const DAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function HappyHourPage() {
  const [items, setItems] = useState<Rule[]>([]);
  const [form, setForm] = useState({
    name: "",
    start_time: "17:00",
    end_time: "19:00",
    discount_pct: 20,
    category_filter: "",
    days: [1, 2, 3, 4, 5] as number[],
  });

  const load = async () => {
    const { data } = await supabase.from("happy_hour_rules").select("*").order("created_at");
    setItems(data ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const toggleDay = (d: number) =>
    setForm((f) => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort(),
    }));

  const create = async () => {
    if (!form.name.trim()) return toast.error("Name fehlt");
    if (form.days.length === 0) return toast.error("Mindestens 1 Tag wählen");
    const { error } = await supabase.from("happy_hour_rules").insert({
      name: form.name,
      start_time: form.start_time,
      end_time: form.end_time,
      discount_pct: form.discount_pct,
      category_filter: form.category_filter || null,
      days_of_week: form.days,
    });
    if (error) return toast.error(error.message);
    toast.success("Happy Hour Regel angelegt");
    setForm({ name: "", start_time: "17:00", end_time: "19:00", discount_pct: 20, category_filter: "", days: [1, 2, 3, 4, 5] });
    load();
  };

  const toggleActive = async (r: Rule) => {
    await supabase.from("happy_hour_rules").update({ active: !r.active }).eq("id", r.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Regel löschen?")) return;
    await supabase.from("happy_hour_rules").delete().eq("id", id);
    load();
  };

  return (
    <SettingsPage title="Happy Hour" subtitle="Zeitfenster mit automatischem Rabatt">
      <div className="glass rounded-3xl p-6 mb-6 space-y-4">
        <div className="text-sm font-medium">Neue Regel</div>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Name (z. B. After-Work)"
          className="w-full rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm"
        />
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase mb-1">Start</div>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className="w-full rounded-xl bg-white/5 border border-border/40 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase mb-1">Ende</div>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className="w-full rounded-xl bg-white/5 border border-border/40 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase mb-1">Rabatt %</div>
            <input
              type="number"
              value={form.discount_pct}
              onChange={(e) => setForm({ ...form, discount_pct: Number(e.target.value) })}
              className="w-full rounded-xl bg-white/5 border border-border/40 px-3 py-2.5 text-sm"
            />
          </div>
        </div>
        <input
          value={form.category_filter}
          onChange={(e) => setForm({ ...form, category_filter: e.target.value })}
          placeholder="Kategorie-Filter (leer = alle, z. B. Cocktails)"
          className="w-full rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm"
        />
        <div>
          <div className="text-[10px] text-muted-foreground uppercase mb-2">Tage</div>
          <div className="flex gap-1.5">
            {DAYS.map((d, i) => {
              const active = form.days.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                    active ? "bg-accent text-accent-foreground" : "bg-white/5 text-muted-foreground"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        <button
          onClick={create}
          className="w-full rounded-xl bg-accent text-accent-foreground font-medium py-2.5 text-sm hover:opacity-90 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Regel speichern
        </button>
      </div>

      {items.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Noch keine Happy Hour Regeln
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Bell className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.days_of_week.map((d) => DAYS[d]).join(", ")} · {r.start_time.slice(0, 5)}–
                  {r.end_time.slice(0, 5)} · −{r.discount_pct}%
                  {r.category_filter ? ` · ${r.category_filter}` : ""}
                </div>
              </div>
              <button
                onClick={() => toggleActive(r)}
                className={`text-[10px] px-2 py-1 rounded-md ${
                  r.active ? "bg-success/15 text-success" : "bg-white/5 text-muted-foreground"
                }`}
              >
                {r.active ? "Aktiv" : "Aus"}
              </button>
              <button
                onClick={() => remove(r.id)}
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

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { SettingsPage } from "@/components/SettingsPage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings/members")({
  component: MembersPage,
});

type Level = "bronze" | "silver" | "gold" | "platinum";
type M = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  level: Level;
  points: number;
};

const LEVEL_STYLE: Record<Level, string> = {
  bronze: "bg-amber-700/20 text-amber-500",
  silver: "bg-slate-400/20 text-slate-300",
  gold: "bg-yellow-500/20 text-yellow-400",
  platinum: "bg-violet-400/20 text-violet-300",
};

function MembersPage() {
  const [items, setItems] = useState<M[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", level: "bronze" as Level });

  const load = async () => {
    const { data } = await supabase.from("members").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as M[]);
  };
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.name.trim()) return toast.error("Name fehlt");
    const { error } = await supabase.from("members").insert({
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      level: form.level,
    });
    if (error) return toast.error(error.message);
    toast.success("Mitglied angelegt");
    setForm({ name: "", email: "", phone: "", level: "bronze" });
    load();
  };

  const changeLevel = async (m: M, level: Level) => {
    await supabase.from("members").update({ level }).eq("id", m.id);
    load();
  };

  const addPoints = async (m: M, delta: number) => {
    await supabase.from("members").update({ points: Math.max(0, m.points + delta) }).eq("id", m.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Mitglied löschen?")) return;
    await supabase.from("members").delete().eq("id", id);
    load();
  };

  const filtered = useMemo(
    () =>
      items.filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q.toLowerCase()) ||
          m.email?.toLowerCase().includes(q.toLowerCase()) ||
          m.phone?.includes(q),
      ),
    [items, q],
  );

  return (
    <SettingsPage title="Mitgliederprogramm" subtitle="VIPs, Levels und Punkte">
      <div className="glass rounded-3xl p-6 mb-6">
        <div className="text-sm font-medium mb-4">Neues Mitglied</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name"
            className="rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm md:col-span-2"
          />
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="E-Mail"
            className="rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm md:col-span-2"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Telefon"
            className="rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm md:col-span-2"
          />
          <select
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value as Level })}
            className="rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm"
          >
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="platinum">Platinum</option>
          </select>
          <button
            onClick={create}
            className="rounded-xl bg-accent text-accent-foreground font-medium py-2.5 text-sm hover:opacity-90 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Hinzufügen
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Suchen…"
          className="w-full rounded-xl bg-white/5 border border-border/40 pl-10 pr-4 py-2.5 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Noch keine Mitglieder
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <div key={m.id} className="glass rounded-2xl p-4 flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1 min-w-[180px]">
                <div className="font-medium flex items-center gap-2">
                  {m.name}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md uppercase tracking-wider ${LEVEL_STYLE[m.level]}`}>
                    {m.level}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {[m.email, m.phone].filter(Boolean).join(" · ") || "Keine Kontaktdaten"}
                </div>
              </div>
              <select
                value={m.level}
                onChange={(e) => changeLevel(m, e.target.value as Level)}
                className="text-xs rounded-lg bg-white/5 border border-border/40 px-2 py-1.5"
              >
                <option value="bronze">Bronze</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="platinum">Platinum</option>
              </select>
              <div className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1">
                <button onClick={() => addPoints(m, -10)} className="px-2 text-muted-foreground hover:text-foreground">
                  −
                </button>
                <span className="text-xs font-mono w-12 text-center">{m.points} P</span>
                <button onClick={() => addPoints(m, 10)} className="px-2 text-muted-foreground hover:text-foreground">
                  +
                </button>
              </div>
              <button
                onClick={() => remove(m.id)}
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

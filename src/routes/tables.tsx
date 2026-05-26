import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Clock, LayoutGrid, Plus, X, Trash2, Loader2, Sofa, TreePine, Wine, Move, Check } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/tables")({
  head: () => ({ meta: [{ title: "Tische — SAINTS POS" }] }),
  component: Tables,
});

type Area = "indoor" | "outdoor" | "bar";
type Status = "free" | "occupied" | "bill" | "pending";

interface DiningTable {
  id: string;
  name: string;
  seats: number;
  status: Status;
  area: Area;
  guests: number | null;
  opened_at: string | null;
  location_id: string;
  sort_order: number;
}

const statusConfig: Record<Status, { label: string; dot: string; ring: string; text: string; bg: string; glow: string }> = {
  free: { label: "Frei", dot: "bg-success", ring: "border-white/10", text: "text-muted-foreground", bg: "", glow: "" },
  occupied: {
    label: "Besetzt",
    dot: "bg-emerald-300",
    ring: "border-emerald-300",
    text: "text-emerald-50",
    bg: "bg-emerald-400/25",
    glow: "shadow-[0_0_24px_rgba(74,222,128,0.55),inset_0_0_18px_rgba(134,239,172,0.35)]",
  },
  bill: { label: "Rechnung", dot: "bg-chart-3", ring: "border-chart-3/40", text: "text-foreground", bg: "", glow: "" },
  pending: { label: "Zahlung", dot: "bg-warning", ring: "border-warning/40", text: "text-foreground", bg: "", glow: "" },
};

const AREAS: { value: Area; label: string; icon: typeof Sofa }[] = [
  { value: "indoor", label: "Drinnen", icon: Sofa },
  { value: "outdoor", label: "Draussen", icon: TreePine },
  { value: "bar", label: "An der Bar", icon: Wine },
];

function Tables() {
  const qc = useQueryClient();
  const { operator, session } = useAuth();
  // Only managers may rearrange table positions
  const canEdit = operator?.role === "manager";
  void session;
  const [addOpen, setAddOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Area | "all">("all");

  const { data: tables = [], isLoading } = useQuery<DiningTable[]>({
    queryKey: ["dining_tables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dining_tables")
        .select("*")
        .order("area")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as DiningTable[];
    },
  });

  const deleteTable = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dining_tables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dining_tables"] });
      toast.success("Tisch entfernt");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const reorder = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const src = tables.find((t) => t.id === sourceId);
    const tgt = tables.find((t) => t.id === targetId);
    if (!src || !tgt) return;
    // Reorder within the same area (and filter scope)
    const scope = tables
      .filter((t) => t.area === src.area)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const without = scope.filter((t) => t.id !== sourceId);
    const tgtIdx = without.findIndex((t) => t.id === targetId);
    if (tgtIdx < 0) return;
    without.splice(tgtIdx, 0, src);
    const updates = without.map((t, i) => ({ id: t.id, sort_order: i + 1 }));
    // Optimistic
    qc.setQueryData<DiningTable[]>(["dining_tables"], (old) =>
      (old ?? []).map((t) => {
        const u = updates.find((x) => x.id === t.id);
        return u ? { ...t, sort_order: u.sort_order } : t;
      }),
    );
    const errors: string[] = [];
    for (const u of updates) {
      const { error } = await supabase.from("dining_tables").update({ sort_order: u.sort_order }).eq("id", u.id);
      if (error) errors.push(error.message);
    }
    if (errors.length) toast.error(errors[0]);
    qc.invalidateQueries({ queryKey: ["dining_tables"] });
  };

  const visible = filter === "all" ? tables : tables.filter((t) => t.area === filter);
  const counts = tables.reduce(
    (acc, t) => ({ ...acc, [t.status]: (acc[t.status] || 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <div className="p-4 md:p-6 lg:p-10 pb-28 md:pb-10 max-w-[1600px] mx-auto">
      <PageHeader
        title="Tische"
        subtitle="Bereiche verwalten — Drinnen, Draussen, Bar"
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            {(["free", "occupied", "bill", "pending"] as const).map((s) => (
              <div key={s} className="glass rounded-xl px-3 py-2 text-xs flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[s].dot}`} />
                {statusConfig[s].label}
                <span className="text-muted-foreground tabular-nums">{counts[s] || 0}</span>
              </div>
            ))}
            {canEdit && (
              <button
                onClick={() => setEditMode((v) => !v)}
                className={`rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-2 border-2 transition-all ${
                  editMode ? "border-success bg-success/10 text-success" : "glass border-transparent"
                }`}
              >
                {editMode ? <><Check className="w-4 h-4" /> Fertig</> : <><Move className="w-4 h-4" /> Position anpassen</>}
              </button>
            )}
            <button
              onClick={() => setAddOpen(true)}
              className="rounded-xl px-4 py-2 text-sm bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-medium flex items-center gap-2 shadow-[var(--shadow-gold)]"
            >
              <Plus className="w-4 h-4" /> Tisch hinzufügen
            </button>
          </div>
        }
      />

      <div className="flex gap-2 mb-6 flex-wrap">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={`Alle (${tables.length})`} />
        {AREAS.map((a) => {
          const Icon = a.icon;
          const n = tables.filter((t) => t.area === a.value).length;
          return (
            <FilterChip
              key={a.value}
              active={filter === a.value}
              onClick={() => setFilter(a.value)}
              label={`${a.label} (${n})`}
              icon={<Icon className="w-3.5 h-3.5" />}
            />
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <div className="glass rounded-3xl flex flex-col items-center justify-center text-center py-24 px-6">
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <LayoutGrid className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">Noch keine Tische</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-5">
            Lege jetzt deinen ersten Tisch an und wähle, ob er drinnen, draussen oder an der Bar steht.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="rounded-xl px-5 py-2.5 text-sm bg-primary text-primary-foreground font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Ersten Tisch anlegen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-4">
          {visible.map((t, i) => {
            const cfg = statusConfig[t.status];
            const area = AREAS.find((a) => a.value === t.area)!;
            const AreaIcon = area.icon;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
                whileHover={{ y: editMode ? 0 : -2 }}
                draggable={editMode}
                onDragStart={(e) => {
                  if (!editMode) return;
                  setDragId(t.id);
                  (e as unknown as React.DragEvent).dataTransfer?.setData("text/plain", t.id);
                }}
                onDragOver={(e) => {
                  if (editMode) (e as unknown as React.DragEvent).preventDefault();
                }}
                onDrop={(e) => {
                  if (!editMode) return;
                  (e as unknown as React.DragEvent).preventDefault();
                  const src = ((e as unknown as React.DragEvent).dataTransfer?.getData("text/plain")) || dragId;
                  if (src) reorder(src, t.id);
                  setDragId(null);
                }}
                onDragEnd={() => setDragId(null)}
                className={`glass rounded-2xl p-4 aspect-square flex flex-col text-left border-2 ${cfg.ring} ${cfg.bg} ${cfg.glow} transition-all relative group ${
                  editMode ? "cursor-grab active:cursor-grabbing ring-2 ring-accent/30" : ""
                } ${dragId === t.id ? "opacity-50" : ""}`}
              >
                {editMode && (
                  <div className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-black/40 backdrop-blur flex items-center justify-center pointer-events-none">
                    <Move className="w-3.5 h-3.5" />
                  </div>
                )}
                <button
                  onClick={() => {
                    if (confirm(`Tisch „${t.name}" wirklich entfernen?`)) deleteTable.mutate(t.id);
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/40 backdrop-blur opacity-0 group-hover:opacity-100 hover:bg-destructive/30 hover:text-destructive transition-all flex items-center justify-center z-10"
                  title="Tisch entfernen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-2xl font-semibold tracking-tight">{t.name}</div>
                    <div className={`text-[10px] uppercase tracking-wider mt-0.5 flex items-center gap-1 ${t.status === "occupied" ? "text-emerald-200/80" : "text-muted-foreground"}`}>
                      <AreaIcon className="w-3 h-3" /> {area.label} · {t.seats}P
                    </div>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${cfg.dot} ${t.status !== "free" ? "pulse-dot" : ""}`} />
                </div>

                <div className="mt-auto">
                  <div className={`text-[10px] font-medium uppercase tracking-wider ${cfg.text} mb-1`}>
                    {cfg.label}
                  </div>
                  {t.status !== "free" && (
                    <div className={`flex items-center gap-3 text-xs ${t.status === "occupied" ? "text-emerald-100/80" : "text-muted-foreground"}`}>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {t.guests ?? 0}
                      </span>
                      {t.opened_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(t.opened_at).toLocaleTimeString("de-CH", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {addOpen && <AddTableDialog onClose={() => setAddOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-xs flex items-center gap-1.5 border-2 transition-all ${
        active ? "border-accent bg-accent/10 text-foreground" : "border-transparent glass text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function AddTableDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [seats, setSeats] = useState(2);
  const [area, setArea] = useState<Area>("indoor");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Tischname fehlt");
      if (seats < 1) throw new Error("Mind. 1 Platz");
      const { data: loc, error: locErr } = await supabase
        .from("locations")
        .select("id")
        .eq("active", true)
        .order("created_at")
        .limit(1)
        .single();
      if (locErr || !loc) throw new Error("Kein Standort gefunden");

      const { error } = await supabase.from("dining_tables").insert({
        name: name.trim(),
        seats,
        area,
        location_id: loc.id,
        status: "free",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dining_tables"] });
      toast.success("Tisch angelegt");
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Fehler"),
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-3xl p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Neu</div>
            <h2 className="text-xl font-semibold">Tisch hinzufügen</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Bereich</label>
            <div className="grid grid-cols-3 gap-2">
              {AREAS.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.value}
                    onClick={() => setArea(a.value)}
                    className={`rounded-xl px-2 py-3 text-xs transition-all flex flex-col items-center gap-1.5 border-2 ${
                      area === a.value ? "border-accent bg-accent/10" : "border-transparent glass"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Name / Nr.</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={area === "bar" ? "B1" : area === "outdoor" ? "T1" : "1"}
                className="glass rounded-xl px-3 py-3 text-sm w-full outline-none bg-transparent"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Sitzplätze</label>
              <input
                type="number"
                min={1}
                max={20}
                value={seats}
                onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))}
                className="glass rounded-xl px-3 py-3 text-sm w-full outline-none bg-transparent tabular-nums"
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="w-full rounded-2xl py-3.5 bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-semibold shadow-[var(--shadow-gold)] flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Anlegen</>}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, Pencil, X, Search, ChevronDown, ChevronUp, Power } from "lucide-react";
import { toast } from "sonner";
import { SettingsPage } from "@/components/SettingsPage";
import { supabase } from "@/integrations/supabase/client";
import { useProducts, type Product, type ModifierGroup, type ModifierItem } from "@/hooks/use-products";

export const Route = createFileRoute("/settings/products")({
  head: () => ({ meta: [{ title: "Produkte — SAINTS POS" }] }),
  component: ProductsAdmin,
});

type Draft = {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  meta: string;
  active: boolean;
  sort_order: number;
  modifier_groups: ModifierGroup[];
};

const emptyDraft = (sort_order: number): Draft => ({
  id: "",
  name: "",
  category: "",
  price: 0,
  description: "",
  meta: "",
  active: true,
  sort_order,
  modifier_groups: [],
});

const fromProduct = (p: Product): Draft => ({
  id: p.id,
  name: p.name,
  category: p.category,
  price: p.price,
  description: p.description ?? "",
  meta: p.meta ?? "",
  active: p.active,
  sort_order: p.sort_order,
  modifier_groups: p.modifier_groups ?? [],
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function ProductsAdmin() {
  const qc = useQueryClient();
  const { allProducts, categories, isLoading } = useProducts();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [filterCat, setFilterCat] = useState<string>("");

  const allCategories = useMemo(() => {
    const set = new Set<string>(categories);
    allProducts.forEach((p) => set.add(p.category));
    return Array.from(set).sort();
  }, [categories, allProducts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProducts.filter(
      (p) =>
        (!filterCat || p.category === filterCat) &&
        (!q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)),
    );
  }, [allProducts, search, filterCat]);

  const grouped = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of filtered) {
      if (!m.has(p.category)) m.set(p.category, []);
      m.get(p.category)!.push(p);
    }
    return Array.from(m.entries());
  }, [filtered]);

  const save = async () => {
    if (!editing) return;
    const d = editing;
    if (!d.name.trim() || !d.category.trim()) {
      toast.error("Name und Kategorie sind Pflicht");
      return;
    }
    const id = (d.id || slugify(d.name) || `p-${Date.now()}`).slice(0, 60);
    const row = {
      id,
      name: d.name.trim(),
      category: d.category.trim(),
      price: Number(d.price) || 0,
      description: d.description.trim() || null,
      meta: d.meta.trim() || null,
      active: d.active,
      sort_order: d.sort_order,
      modifier_groups: d.modifier_groups as unknown as never,
    };
    const { error } = await supabase.from("products").upsert(row, { onConflict: "id" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Gespeichert");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Produkt wirklich löschen?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Gelöscht");
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const toggleActive = async (p: Product) => {
    const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  return (
    <SettingsPage
      title="Produkte"
      subtitle="Karte verwalten — Beschreibung, Preise und Zusatzauswahl pro Produkt"
      actions={
        <button
          onClick={() => setEditing(emptyDraft(allProducts.length))}
          className="rounded-xl px-4 py-2 bg-accent text-accent-foreground text-sm font-medium inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Neues Produkt
        </button>
      }
    >
      {/* Filter */}
      <div className="glass rounded-2xl p-3 mb-4 flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche nach Name oder ID…"
            className="bg-transparent outline-none flex-1 text-sm"
          />
        </div>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="bg-white/5 rounded-xl px-3 py-2 text-sm outline-none"
        >
          <option value="">Alle Kategorien</option>
          {allCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Lade…</div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([cat, items]) => (
            <div key={cat}>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                {cat}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map((p) => (
                  <div
                    key={p.id}
                    className={`glass rounded-xl p-3 flex items-center gap-3 ${!p.active ? "opacity-50" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{p.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          CHF {p.price.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.description || p.meta || p.id}
                        {p.modifier_groups.length > 0 && (
                          <span className="ml-2 text-accent">
                            · {p.modifier_groups.length} Zusatz-Gruppe(n)
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleActive(p)}
                      title={p.active ? "Deaktivieren" : "Aktivieren"}
                      className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditing(fromProduct(p))}
                      className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="w-9 h-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {grouped.length === 0 && (
            <div className="text-sm text-muted-foreground">Keine Produkte gefunden.</div>
          )}
        </div>
      )}

      {editing && (
        <EditDialog
          draft={editing}
          allCategories={allCategories}
          onClose={() => setEditing(null)}
          onChange={setEditing}
          onSave={save}
        />
      )}
    </SettingsPage>
  );
}

function EditDialog({
  draft,
  allCategories,
  onClose,
  onChange,
  onSave,
}: {
  draft: Draft;
  allCategories: string[];
  onClose: () => void;
  onChange: (d: Draft) => void;
  onSave: () => void;
}) {
  const update = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });

  const addGroup = () =>
    update({
      modifier_groups: [
        ...draft.modifier_groups,
        { label: "Neue Gruppe", multi: true, items: [] },
      ],
    });

  const updateGroup = (i: number, patch: Partial<ModifierGroup>) => {
    const next = draft.modifier_groups.slice();
    next[i] = { ...next[i], ...patch };
    update({ modifier_groups: next });
  };
  const removeGroup = (i: number) =>
    update({ modifier_groups: draft.modifier_groups.filter((_, idx) => idx !== i) });

  const moveGroup = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.modifier_groups.length) return;
    const next = draft.modifier_groups.slice();
    [next[i], next[j]] = [next[j], next[i]];
    update({ modifier_groups: next });
  };

  const addItem = (gi: number) => {
    const g = draft.modifier_groups[gi];
    updateGroup(gi, { items: [...g.items, { label: "Neue Option" }] });
  };
  const updateItem = (gi: number, ii: number, patch: Partial<ModifierItem>) => {
    const g = draft.modifier_groups[gi];
    const items = g.items.slice();
    items[ii] = { ...items[ii], ...patch };
    updateGroup(gi, { items });
  };
  const removeItem = (gi: number, ii: number) => {
    const g = draft.modifier_groups[gi];
    updateGroup(gi, { items: g.items.filter((_, x) => x !== ii) });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong w-full md:max-w-2xl rounded-t-3xl md:rounded-3xl border border-border/40 max-h-[92vh] flex flex-col"
      >
        <div className="p-5 border-b border-border/40 flex items-center justify-between">
          <h3 className="font-semibold text-lg">
            {draft.id ? "Produkt bearbeiten" : "Neues Produkt"}
          </h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Basisdaten */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Name">
              <input
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
                className="input"
                placeholder="z.B. Aperol Spritz"
              />
            </Field>
            <Field label="Kategorie">
              <input
                list="cat-list"
                value={draft.category}
                onChange={(e) => update({ category: e.target.value })}
                className="input"
                placeholder="z.B. Cocktails"
              />
              <datalist id="cat-list">
                {allCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Preis (CHF)">
              <input
                type="number"
                step="0.5"
                min="0"
                value={draft.price}
                onChange={(e) => update({ price: parseFloat(e.target.value) || 0 })}
                className="input tabular-nums"
              />
            </Field>
            <Field label="Sortierung">
              <input
                type="number"
                value={draft.sort_order}
                onChange={(e) => update({ sort_order: parseInt(e.target.value) || 0 })}
                className="input tabular-nums"
              />
            </Field>
            <Field label="Beschreibung" full>
              <textarea
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
                className="input min-h-[60px]"
                placeholder="Zutaten / kurze Beschreibung"
              />
            </Field>
            <Field label="Meta (z.B. 33cl · 4.6%)" full>
              <input
                value={draft.meta}
                onChange={(e) => update({ meta: e.target.value })}
                className="input"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => update({ active: e.target.checked })}
              />
              Aktiv (in Karte sichtbar)
            </label>
            {draft.id && (
              <div className="text-xs text-muted-foreground md:col-span-2">ID: {draft.id}</div>
            )}
          </section>

          {/* Modifier Groups */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-medium">Zusatzauswahl</div>
                <div className="text-xs text-muted-foreground">
                  Gruppen wie „Eis", „Sirup-Sorte" – nur das hier Definierte erscheint im POS.
                  Leer lassen, wenn keine Zusätze nötig sind.
                </div>
              </div>
              <button
                onClick={addGroup}
                className="rounded-lg px-3 py-1.5 text-xs bg-accent/20 text-accent inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Gruppe
              </button>
            </div>
            <div className="space-y-3">
              {draft.modifier_groups.map((g, gi) => (
                <div key={gi} className="rounded-xl border border-border/40 p-3 bg-white/[0.02]">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      value={g.label}
                      onChange={(e) => updateGroup(gi, { label: e.target.value })}
                      className="input flex-1"
                      placeholder="Gruppenname"
                    />
                    <label className="text-xs flex items-center gap-1.5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={g.multi ?? true}
                        onChange={(e) => updateGroup(gi, { multi: e.target.checked })}
                      />
                      Mehrfach
                    </label>
                    <button
                      onClick={() => moveGroup(gi, -1)}
                      className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveGroup(gi, 1)}
                      className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeGroup(gi)}
                      className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {g.items.map((it, ii) => (
                      <div key={ii} className="flex items-center gap-2">
                        <input
                          value={it.label}
                          onChange={(e) => updateItem(gi, ii, { label: e.target.value })}
                          className="input flex-1"
                          placeholder="Option (z.B. Ohne Eis)"
                        />
                        <input
                          type="number"
                          step="0.5"
                          value={it.price_delta ?? 0}
                          onChange={(e) =>
                            updateItem(gi, ii, { price_delta: parseFloat(e.target.value) || 0 })
                          }
                          className="input w-24 tabular-nums"
                          placeholder="+CHF"
                          title="Aufpreis (kann 0 sein)"
                        />
                        <button
                          onClick={() => removeItem(gi, ii)}
                          className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addItem(gi)}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Option hinzufügen
                    </button>
                  </div>
                </div>
              ))}
              {draft.modifier_groups.length === 0 && (
                <div className="text-xs text-muted-foreground italic">
                  Keine Zusätze definiert.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-border/40 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 bg-white/5 text-sm"
          >
            Abbrechen
          </button>
          <button
            onClick={onSave}
            className="rounded-xl px-4 py-2 bg-accent text-accent-foreground text-sm font-medium inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Speichern
          </button>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 0.625rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus { border-color: hsl(var(--accent) / 0.5); }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}

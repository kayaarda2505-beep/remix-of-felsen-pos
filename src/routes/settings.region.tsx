import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { SettingsPage } from "@/components/SettingsPage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings/region")({
  component: RegionPage,
});

const LANGS = [
  { value: "de-CH", label: "Deutsch (Schweiz)" },
  { value: "de-DE", label: "Deutsch (Deutschland)" },
  { value: "en-US", label: "English (US)" },
  { value: "fr-CH", label: "Français (Suisse)" },
  { value: "it-CH", label: "Italiano (Svizzera)" },
];

function RegionPage() {
  const [form, setForm] = useState({
    business_name: "SAINTS",
    language: "de-CH",
    currency: "CHF",
    region: "CH",
    tips: "0,5,10,15",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data)
          setForm({
            business_name: data.business_name,
            language: data.language,
            currency: data.currency,
            region: data.region,
            tips: data.default_tip_percentages.join(","),
          });
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const tips = form.tips
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n));
    const { error } = await supabase
      .from("app_settings")
      .update({
        business_name: form.business_name,
        language: form.language,
        currency: form.currency,
        region: form.region,
        default_tip_percentages: tips,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Gespeichert");
  };

  return (
    <SettingsPage title="Sprache & Region" subtitle="Lokalisierung und Standardwerte">
      <div className="glass rounded-3xl p-6 space-y-4 max-w-xl">
        <Field label="Betriebsname">
          <input
            value={form.business_name}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
            className="w-full rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm"
          />
        </Field>
        <Field label="Sprache">
          <select
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
            className="w-full rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm"
          >
            {LANGS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Währung">
            <input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })}
              className="w-full rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm"
            />
          </Field>
          <Field label="Land">
            <input
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value.toUpperCase().slice(0, 2) })}
              className="w-full rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm"
            />
          </Field>
        </div>
        <Field label="Trinkgeld-Vorschläge (kommagetrennt, %)">
          <input
            value={form.tips}
            onChange={(e) => setForm({ ...form, tips: e.target.value })}
            placeholder="0,5,10,15"
            className="w-full rounded-xl bg-white/5 border border-border/40 px-4 py-2.5 text-sm"
          />
        </Field>
        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-accent text-accent-foreground font-medium py-2.5 text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" /> {saving ? "Speichere…" : "Speichern"}
        </button>
      </div>
    </SettingsPage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">{label}</div>
      {children}
    </div>
  );
}

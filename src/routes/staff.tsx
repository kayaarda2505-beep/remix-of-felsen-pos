import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Trash2,
  Plus,
  UserPlus,
  ShieldCheck,
  Loader2,
  X,
  KeyRound,
  Users as UsersIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/staff")({
  head: () => ({ meta: [{ title: "Team — SAINTS POS" }] }),
  component: TeamManagement,
});

type TeamRole = "manager" | "barkeeper" | "service" | "kueche";

interface TeamMember {
  id: string;
  name: string;
  role: TeamRole;
  color: string;
  active: boolean;
  created_at: string;
  account_number: number | null;
  email: string | null;
}

const ROLE_OPTIONS: { value: TeamRole; label: string; color: string }[] = [
  { value: "manager", label: "Manager", color: "oklch(0.78 0.13 75)" },
  { value: "barkeeper", label: "Barkeeper", color: "oklch(0.7 0.17 155)" },
  { value: "service", label: "Service", color: "oklch(0.65 0.18 250)" },
  { value: "kueche", label: "Küche", color: "oklch(0.7 0.2 350)" },
];


function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}


function TeamManagement() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: team = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, role, color, active, created_at, account_number, email")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team_members"] }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("team_members").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team_members"] }),
  });

  const updateEmail = useMutation({
    mutationFn: async ({ id, email }: { id: string; email: string }) => {
      const trimmed = email.trim();
      const { error } = await supabase.from("team_members").update({ email: trimmed || null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team_members"] }),
  });

  return (
    <div className="p-6 lg:p-10 pb-28 md:pb-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Team"
        subtitle="Mitarbeiter mit PIN-Login verwalten — kein eigenes Konto nötig"
        actions={
          <button
            onClick={() => setAddOpen(true)}
            className="rounded-xl px-4 py-2.5 text-sm bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-medium shadow-[var(--shadow-gold)] flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Mitarbeiter hinzufügen
          </button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : team.length === 0 ? (
        <div className="glass rounded-3xl flex flex-col items-center justify-center text-center py-24 px-6">
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <UsersIcon className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">Noch keine Mitarbeiter</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Lege ein Profil mit Name, Rolle und PIN an. Der PIN ist der einzige Login für Service & Bar.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="rounded-xl px-5 py-2.5 text-sm bg-primary text-primary-foreground font-medium flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Erstes Team-Mitglied
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {team.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`glass rounded-3xl p-5 flex flex-col items-center text-center relative ${
                !m.active ? "opacity-50" : ""
              }`}
            >
              <button
                onClick={() => deleteMember.mutate(m.id)}
                className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-white/5 hover:bg-destructive/20 hover:text-destructive transition-colors flex items-center justify-center"
                title="Entfernen"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold text-background mb-3"
                style={{ background: m.color }}
              >
                {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="font-medium">{m.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {ROLE_OPTIONS.find((r) => r.value === m.role)?.label ?? m.role}
              </div>
              {m.account_number != null && (
                <div className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/20">
                  Konto&nbsp;Nr.&nbsp;<span className="tabular-nums font-semibold">{m.account_number}</span>
                </div>
              )}

              <button
                onClick={() => toggleActive.mutate({ id: m.id, active: !m.active })}
                className={`mt-4 inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-md transition-colors ${
                  m.active
                    ? "bg-success/15 text-success hover:bg-success/25"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10"
                }`}
              >
                <span className={`w-1 h-1 rounded-full ${m.active ? "bg-success" : "bg-muted-foreground"}`} />
                {m.active ? "Aktiv" : "Inaktiv"}
              </button>

              <input
                defaultValue={m.email ?? ""}
                type="email"
                placeholder="E-Mail für Schichtplan"
                onBlur={(e) => {
                  if ((e.target.value || "") !== (m.email ?? "")) {
                    updateEmail.mutate({ id: m.id, email: e.target.value });
                  }
                }}
                className="mt-3 w-full glass rounded-lg px-2.5 py-1.5 text-[11px] outline-none bg-transparent text-center placeholder:text-muted-foreground/60"
              />
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {addOpen && <AddMemberDialog onClose={() => setAddOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

function AddMemberDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [role, setRole] = useState<TeamRole>("service");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [ahvNumber, setAhvNumber] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [iban, setIban] = useState("");
  const [hourlyWage, setHourlyWage] = useState("");
  const [withholdingTax, setWithholdingTax] = useState(false);
  const [withholdingTaxRate, setWithholdingTaxRate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const color = ROLE_OPTIONS.find((r) => r.value === role)!.color;

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name fehlt");
      if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN muss 4 bis 6 Ziffern sein");
      const { error } = await supabase.rpc("create_team_member", {
        _name: name.trim(),
        _role: role,
        _pin: pin,
        _color: color,
        _email: email.trim() || null,
        _phone: phone.trim() || null,
        _address: address.trim() || null,
        _ahv_number: ahvNumber.trim() || null,
        _birthdate: birthdate || null,
        _iban: iban.trim() || null,
        _hourly_wage: Number(hourlyWage) || 0,
        _withholding_tax: withholdingTax,
        _withholding_tax_rate: Number(withholdingTaxRate) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_members"] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Fehler"),
  });

  const inputCls = "glass rounded-xl px-3 py-2.5 text-sm w-full outline-none bg-transparent";

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
        className="glass-strong rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Neu</div>
            <h2 className="text-xl font-semibold">Team-Mitglied anlegen</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name *">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Lena Müller" className={inputCls} />
          </Field>
          <Field label="Rolle *">
            <select value={role} onChange={(e) => setRole(e.target.value as TeamRole)} className={inputCls}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>

          <Field label="PIN (4–6 Ziffern) *">
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" placeholder="••••" className={inputCls + " tabular-nums tracking-[0.3em]"} />
          </Field>
          <Field label="E-Mail">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="lena@example.ch" className={inputCls} />
          </Field>

          <Field label="Telefon">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+41 79 123 45 67" className={inputCls} />
          </Field>
          <Field label="Geburtsdatum">
            <input value={birthdate} onChange={(e) => setBirthdate(e.target.value)} type="date" className={inputCls} />
          </Field>

          <div className="md:col-span-2">
            <Field label="Adresse">
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Strasse, PLZ Ort" className={inputCls} />
            </Field>
          </div>

          <Field label="AHV-Nummer">
            <input value={ahvNumber} onChange={(e) => setAhvNumber(e.target.value)} placeholder="756.xxxx.xxxx.xx" className={inputCls} />
          </Field>
          <Field label="IBAN">
            <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="CH00 0000 0000 0000 0000 0" className={inputCls} />
          </Field>

          <Field label="Stundenlohn (CHF) *">
            <input value={hourlyWage} onChange={(e) => setHourlyWage(e.target.value.replace(",", "."))} type="number" step="0.01" placeholder="28.00" className={inputCls} />
          </Field>
          <Field label="Quellensteuer-Satz (%)">
            <input value={withholdingTaxRate} onChange={(e) => setWithholdingTaxRate(e.target.value.replace(",", "."))} type="number" step="0.01" placeholder="0" disabled={!withholdingTax} className={inputCls + (withholdingTax ? "" : " opacity-50")} />
          </Field>

          <div className="md:col-span-2">
            <label className="flex items-center gap-3 glass rounded-xl px-3 py-3 cursor-pointer">
              <input type="checkbox" checked={withholdingTax} onChange={(e) => setWithholdingTax(e.target.checked)} className="w-4 h-4 accent-accent" />
              <span className="text-sm">Quellensteuer-pflichtig</span>
              <span className="text-xs text-muted-foreground ml-auto">z.B. Grenzgänger / Ausländer ohne C-Bewilligung</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-4 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="mt-6 w-full rounded-2xl py-3.5 bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-semibold shadow-[var(--shadow-gold)] flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {create.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" /> Anlegen
            </>
          )}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

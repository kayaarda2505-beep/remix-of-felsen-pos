import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Clock, FileText, Download, Trash2, Plus, Calculator, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/mitarbeiter")({
  head: () => ({ meta: [{ title: "Mitarbeiter — Lohn & Stunden — SAINTS" }] }),
  component: MitarbeiterPage,
});

// Schweizer Sozialversicherungs-Standardsätze 2025 (Arbeitnehmer-Anteil)
const SWISS_RATES = {
  ahv_iv_eo: 5.3, // AHV/IV/EO
  alv: 1.1, // Arbeitslosenversicherung (bis 148'200 CHF Jahreslohn)
  nbu: 1.4, // Nichtberufsunfall (Richtwert, abhängig vom Versicherer)
};

type Member = {
  id: string;
  name: string;
  role: string;
  color: string;
  active: boolean;
  email: string | null;
  phone: string | null;
  address: string | null;
  ahv_number: string | null;
  birthdate: string | null;
  iban: string | null;
  hourly_wage: number;
  withholding_tax: boolean;
  withholding_tax_rate: number;
  account_number: number | null;
};

type TimeEntry = {
  id: string;
  member_id: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  note: string | null;
};

type Payroll = {
  id: string;
  member_id: string;
  period_start: string;
  period_end: string;
  hours: number;
  hourly_wage: number;
  gross: number;
  ahv_iv_eo: number;
  alv: number;
  nbu: number;
  withholding_tax: number;
  total_deductions: number;
  net: number;
  created_at: string;
};

function firstOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function lastOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function MitarbeiterPage() {
  const { operator } = useAuth();
  const isManager = operator?.role === "manager";
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: allMembers = [], isLoading } = useQuery<Member[]>({
    queryKey: ["mitarbeiter_full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Member[];
    },
  });

  const members = isManager ? allMembers : allMembers.filter((m) => m.id === operator?.id);
  const selected = members.find((m) => m.id === selectedId) ?? members[0] ?? null;

  return (
    <div className="p-4 md:p-6 lg:p-10 pb-28 md:pb-10 max-w-[1400px] mx-auto">
      <PageHeader
        title="Mitarbeiter"
        subtitle="Stunden, Stundenlohn und Lohnabrechnungen (CH Sozialversicherung)"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <p className="text-muted-foreground">Noch keine Mitarbeiter. Lege zuerst unter „Team" jemanden an.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <div className="space-y-2">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`w-full text-left glass rounded-2xl p-3 flex items-center gap-3 transition-all ${
                  selected?.id === m.id ? "ring-2 ring-accent" : "hover:bg-white/5"
                }`}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-background shrink-0"
                  style={{ background: m.color }}
                >
                  {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    CHF {Number(m.hourly_wage).toFixed(2)}/h · {m.role}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {selected && <MemberPanel member={selected} isManager={isManager} />}
        </div>
      )}
    </div>
  );
}

function MemberPanel({ member, isManager }: { member: Member; isManager: boolean }) {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(lastOfMonth());
  const [editing, setEditing] = useState(false);

  const { data: entries = [], refetch: refetchEntries } = useQuery<TimeEntry[]>({
    queryKey: ["time_entries", member.id, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("member_id", member.id)
        .gte("clock_in", `${from}T00:00:00`)
        .lte("clock_in", `${to}T23:59:59`)
        .order("clock_in", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TimeEntry[];
    },
  });

  const { data: payrolls = [], refetch: refetchPayrolls } = useQuery<Payroll[]>({
    queryKey: ["payrolls", member.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payrolls")
        .select("*")
        .eq("member_id", member.id)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payroll[];
    },
  });

  const totalHours = useMemo(() => {
    return entries.reduce((sum, e) => {
      if (!e.clock_out) return sum;
      const ms = new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime();
      const h = Math.max(0, ms / 3_600_000 - (e.break_minutes || 0) / 60);
      return sum + h;
    }, 0);
  }, [entries]);

  const gross = totalHours * Number(member.hourly_wage || 0);

  return (
    <div className="space-y-6">
      {/* Stammdaten */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <UserIcon className="w-4 h-4 text-accent" />
          <h2 className="font-semibold">Stammdaten</h2>
          {isManager && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"
            >
              Bearbeiten
            </button>
          )}
        </div>
        {editing ? (
          <MemberEditForm member={member} onClose={() => setEditing(false)} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <Info label="Name" value={member.name} />
            <Info label="Rolle" value={member.role} />
            <Info label="Konto-Nr." value={member.account_number?.toString() ?? "—"} />
            <Info label="E-Mail" value={member.email ?? "—"} />
            <Info label="Telefon" value={member.phone ?? "—"} />
            <Info label="Geburtsdatum" value={member.birthdate ?? "—"} />
            <Info label="Adresse" value={member.address ?? "—"} />
            <Info label="AHV-Nr." value={member.ahv_number ?? "—"} />
            <Info label="IBAN" value={member.iban ?? "—"} />
            <Info label="Stundenlohn" value={`CHF ${Number(member.hourly_wage).toFixed(2)}`} />
            <Info
              label="Quellensteuer"
              value={member.withholding_tax ? `Ja · ${Number(member.withholding_tax_rate).toFixed(2)}%` : "Nein"}
            />
          </div>
        )}
      </div>


      {/* Zeitraum + Stunden */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-accent" />
            <h2 className="font-semibold">Arbeitszeit & Lohn</h2>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="glass rounded-lg px-2 py-1.5 bg-transparent outline-none" />
            <span className="text-muted-foreground">–</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="glass rounded-lg px-2 py-1.5 bg-transparent outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <Stat label="Stunden" value={totalHours.toFixed(2)} suffix="h" />
          <Stat label="Brutto" value={`CHF ${gross.toFixed(2)}`} />
          <Stat label="Einträge" value={entries.length.toString()} />
        </div>

        <ManualEntry memberId={member.id} onSaved={() => refetchEntries()} />

        <div className="mt-4 space-y-1.5 max-h-96 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Keine Einträge in diesem Zeitraum.</div>
          ) : (
            entries.map((e) => <EntryRow key={e.id} entry={e} onChange={() => refetchEntries()} />)
          )}
        </div>
      </div>

      {/* Lohnabrechnung */}
      <PayrollCreator
        member={member}
        from={from}
        to={to}
        hours={totalHours}
        gross={gross}
        onCreated={() => refetchPayrolls()}
      />

      {/* Historie */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-4 h-4 text-accent" />
          <h2 className="font-semibold">Lohnabrechnungen</h2>
        </div>
        {payrolls.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Noch keine Lohnabrechnungen erstellt.</div>
        ) : (
          <div className="space-y-2">
            {payrolls.map((p) => (
              <PayrollRow key={p.id} payroll={p} member={member} onDeleted={() => refetchPayrolls()} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="truncate">{value}</div>
    </div>
  );
}

const TEAM_ROLES = ["manager", "barkeeper", "service", "kueche"] as const;

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}

function MemberEditForm({ member, onClose }: { member: Member; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: member.name ?? "",
    role: member.role ?? "service",
    email: member.email ?? "",
    phone: member.phone ?? "",
    address: member.address ?? "",
    birthdate: member.birthdate ?? "",
    ahv_number: member.ahv_number ?? "",
    iban: member.iban ?? "",
    color: member.color ?? "#888888",
    account_number: member.account_number?.toString() ?? "",
    hourly_wage: Number(member.hourly_wage ?? 0).toString(),
    withholding_tax: !!member.withholding_tax,
    withholding_tax_rate: Number(member.withholding_tax_rate ?? 0).toString(),
    active: member.active,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.name.trim()) return toast.error("Name fehlt");
    setSaving(true);
    const payload = {
      name: f.name.trim(),
      role: f.role as (typeof TEAM_ROLES)[number],
      email: f.email.trim() || null,
      phone: f.phone.trim() || null,
      address: f.address.trim() || null,
      birthdate: f.birthdate || null,
      ahv_number: f.ahv_number.trim() || null,
      iban: f.iban.trim() || null,
      color: f.color || "#888888",
      account_number: f.account_number ? Number(f.account_number) : null,
      hourly_wage: Number(f.hourly_wage) || 0,
      withholding_tax: f.withholding_tax,
      withholding_tax_rate: Number(f.withholding_tax_rate) || 0,
      active: f.active,
    };
    const { error } = await supabase.from("team_members").update(payload).eq("id", member.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Stammdaten gespeichert");
    qc.invalidateQueries({ queryKey: ["mitarbeiter_full"] });
    onClose();
  };

  const inputCls =
    "w-full rounded-lg bg-white/5 border border-border/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Field label="Name">
        <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Rolle">
        <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          {TEAM_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Konto-Nr.">
        <input
          type="number"
          className={inputCls}
          value={f.account_number}
          onChange={(e) => setF({ ...f, account_number: e.target.value })}
        />
      </Field>
      <Field label="E-Mail">
        <input className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </Field>
      <Field label="Telefon">
        <input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </Field>
      <Field label="Geburtsdatum">
        <input
          type="date"
          className={inputCls}
          value={f.birthdate}
          onChange={(e) => setF({ ...f, birthdate: e.target.value })}
        />
      </Field>
      <Field label="Adresse" className="md:col-span-2">
        <input className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
      </Field>
      <Field label="Farbe">
        <input
          type="color"
          className="w-full h-[38px] rounded-lg bg-white/5 border border-border/40 cursor-pointer"
          value={f.color}
          onChange={(e) => setF({ ...f, color: e.target.value })}
        />
      </Field>
      <Field label="AHV-Nr.">
        <input
          className={inputCls}
          value={f.ahv_number}
          onChange={(e) => setF({ ...f, ahv_number: e.target.value })}
        />
      </Field>
      <Field label="IBAN">
        <input className={inputCls} value={f.iban} onChange={(e) => setF({ ...f, iban: e.target.value })} />
      </Field>
      <Field label="Stundenlohn (CHF)">
        <input
          type="number"
          step="0.05"
          className={inputCls}
          value={f.hourly_wage}
          onChange={(e) => setF({ ...f, hourly_wage: e.target.value })}
        />
      </Field>
      <Field label="Quellensteuer">
        <label className="flex items-center gap-2 h-[38px] px-3 rounded-lg bg-white/5 border border-border/40 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={f.withholding_tax}
            onChange={(e) => setF({ ...f, withholding_tax: e.target.checked })}
          />
          Aktiv
        </label>
      </Field>
      <Field label="QSt-Satz (%)">
        <input
          type="number"
          step="0.01"
          disabled={!f.withholding_tax}
          className={inputCls + (f.withholding_tax ? "" : " opacity-40")}
          value={f.withholding_tax_rate}
          onChange={(e) => setF({ ...f, withholding_tax_rate: e.target.value })}
        />
      </Field>
      <Field label="Status">
        <label className="flex items-center gap-2 h-[38px] px-3 rounded-lg bg-white/5 border border-border/40 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={f.active}
            onChange={(e) => setF({ ...f, active: e.target.checked })}
          />
          Aktiv (im Team sichtbar)
        </label>
      </Field>
      <div className="md:col-span-3 flex justify-end gap-2 pt-2">
        <button
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm"
        >
          Abbrechen
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
      </div>
    </div>
  );
}


function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">
        {value}
        {suffix && <span className="text-sm text-muted-foreground ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

function EntryRow({ entry, onChange }: { entry: TimeEntry; onChange: () => void }) {
  const qc = useQueryClient();
  const dur = entry.clock_out
    ? (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3_600_000 -
      (entry.break_minutes || 0) / 60
    : null;

  const closeNow = async () => {
    const { error } = await supabase
      .from("time_entries")
      .update({ clock_out: new Date().toISOString() })
      .eq("id", entry.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Eingecheckt-Eintrag geschlossen");
      qc.invalidateQueries({ queryKey: ["time_entries"] });
      onChange();
    }
  };

  const del = async () => {
    if (!confirm("Eintrag löschen?")) return;
    await supabase.from("time_entries").delete().eq("id", entry.id);
    onChange();
  };

  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" }) : "—");

  return (
    <div className="flex items-center gap-3 glass rounded-xl px-3 py-2 text-sm">
      <div className="flex-1 min-w-0">
        <div className="font-medium tabular-nums">{fmt(entry.clock_in)} → {fmt(entry.clock_out)}</div>
        {entry.note && <div className="text-[11px] text-muted-foreground truncate">{entry.note}</div>}
      </div>
      <div className="tabular-nums text-xs text-muted-foreground">
        {dur !== null ? `${dur.toFixed(2)} h` : <span className="text-success">offen</span>}
      </div>
      {!entry.clock_out && (
        <button onClick={closeNow} className="text-[11px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10">
          Auschecken
        </button>
      )}
      <button onClick={del} className="p-1.5 rounded-md hover:bg-destructive/15 hover:text-destructive">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ManualEntry({ memberId, onSaved }: { memberId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [breakMin, setBreakMin] = useState("0");

  const save = async () => {
    if (!clockIn) return toast.error("Start fehlt");
    const { error } = await supabase.from("time_entries").insert({
      member_id: memberId,
      clock_in: new Date(clockIn).toISOString(),
      clock_out: clockOut ? new Date(clockOut).toISOString() : null,
      break_minutes: Number(breakMin) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Eintrag gespeichert");
    setOpen(false);
    setClockIn("");
    setClockOut("");
    setBreakMin("0");
    onSaved();
  };

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"
      >
        <Plus className="w-3 h-3" /> Eintrag manuell hinzufügen
      </button>
    );

  return (
    <div className="glass rounded-xl p-3 flex flex-wrap items-end gap-2">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Start</div>
        <input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="glass rounded-lg px-2 py-1.5 text-sm bg-transparent outline-none" />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Ende</div>
        <input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className="glass rounded-lg px-2 py-1.5 text-sm bg-transparent outline-none" />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Pause (Min)</div>
        <input type="number" value={breakMin} onChange={(e) => setBreakMin(e.target.value)} className="glass rounded-lg px-2 py-1.5 text-sm w-24 bg-transparent outline-none" />
      </div>
      <button onClick={save} className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-xs font-medium">
        Speichern
      </button>
      <button onClick={() => setOpen(false)} className="rounded-lg bg-white/5 px-3 py-2 text-xs">
        Abbrechen
      </button>
    </div>
  );
}

function PayrollCreator({
  member,
  from,
  to,
  hours,
  gross,
  onCreated,
}: {
  member: Member;
  from: string;
  to: string;
  hours: number;
  gross: number;
  onCreated: () => void;
}) {
  const calc = useMemo(() => {
    const ahv = +(gross * SWISS_RATES.ahv_iv_eo / 100).toFixed(2);
    const alv = +(gross * SWISS_RATES.alv / 100).toFixed(2);
    const nbu = +(gross * SWISS_RATES.nbu / 100).toFixed(2);
    const qst = member.withholding_tax ? +(gross * Number(member.withholding_tax_rate) / 100).toFixed(2) : 0;
    const totalDed = +(ahv + alv + nbu + qst).toFixed(2);
    const net = +(gross - totalDed).toFixed(2);
    return { ahv, alv, nbu, qst, totalDed, net };
  }, [gross, member.withholding_tax, member.withholding_tax_rate]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payrolls").insert({
        member_id: member.id,
        period_start: from,
        period_end: to,
        hours: +hours.toFixed(2),
        hourly_wage: Number(member.hourly_wage),
        gross: +gross.toFixed(2),
        ahv_iv_eo: calc.ahv,
        alv: calc.alv,
        nbu: calc.nbu,
        withholding_tax: calc.qst,
        total_deductions: calc.totalDed,
        net: calc.net,
        rates: {
          ahv_iv_eo: SWISS_RATES.ahv_iv_eo,
          alv: SWISS_RATES.alv,
          nbu: SWISS_RATES.nbu,
          withholding_tax: member.withholding_tax ? Number(member.withholding_tax_rate) : 0,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lohnabrechnung erstellt");
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <Calculator className="w-4 h-4 text-accent" />
        <h2 className="font-semibold">Lohnabrechnung erstellen</h2>
        <span className="text-[10px] text-muted-foreground ml-auto">CH Sozialversicherung Standard</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <Calc label="Brutto" value={gross} bold />
        <Calc label={`AHV/IV/EO ${SWISS_RATES.ahv_iv_eo}%`} value={-calc.ahv} />
        <Calc label={`ALV ${SWISS_RATES.alv}%`} value={-calc.alv} />
        <Calc label={`NBU ${SWISS_RATES.nbu}%`} value={-calc.nbu} />
        {member.withholding_tax && (
          <Calc label={`Quellensteuer ${Number(member.withholding_tax_rate).toFixed(2)}%`} value={-calc.qst} />
        )}
        <Calc label="Abzüge total" value={-calc.totalDed} />
        <Calc label="Netto" value={calc.net} bold highlight />
      </div>
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending || hours <= 0}
        className="mt-5 rounded-xl bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-semibold px-4 py-2.5 text-sm shadow-[var(--shadow-gold)] disabled:opacity-60 inline-flex items-center gap-2"
      >
        {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        Lohnabrechnung speichern
      </button>
    </div>
  );
}

function Calc({ label, value, bold, highlight }: { label: string; value: number; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={`glass rounded-xl px-3 py-2 ${highlight ? "ring-1 ring-accent/40" : ""}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`tabular-nums ${bold ? "font-semibold text-base" : "text-sm"} ${value < 0 ? "text-destructive" : ""}`}>
        {value < 0 ? "− " : ""}CHF {Math.abs(value).toFixed(2)}
      </div>
    </div>
  );
}

function PayrollRow({ payroll: p, member, onDeleted }: { payroll: Payroll; member: Member; onDeleted: () => void }) {
  const download = () => {
    const html = renderPayslipHTML(p, member);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Lohnabrechnung_${member.name.replace(/\s+/g, "_")}_${p.period_start}_${p.period_end}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const print = () => {
    const html = renderPayslipHTML(p, member);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const del = async () => {
    if (!confirm("Lohnabrechnung löschen?")) return;
    const { error } = await supabase.from("payrolls").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Gelöscht");
      onDeleted();
    }
  };

  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <div className="font-medium">
          {new Date(p.period_start).toLocaleDateString("de-CH")} – {new Date(p.period_end).toLocaleDateString("de-CH")}
        </div>
        <div className="text-xs text-muted-foreground">
          {Number(p.hours).toFixed(2)} h · Brutto CHF {Number(p.gross).toFixed(2)} · Abzüge CHF {Number(p.total_deductions).toFixed(2)}
        </div>
      </div>
      <div className="text-lg font-semibold tabular-nums">CHF {Number(p.net).toFixed(2)}</div>
      <button onClick={print} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 inline-flex items-center gap-1.5">
        <FileText className="w-3 h-3" /> Drucken
      </button>
      <button onClick={download} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 inline-flex items-center gap-1.5">
        <Download className="w-3 h-3" /> Download
      </button>
      <button onClick={del} className="p-2 rounded-lg hover:bg-destructive/15 hover:text-destructive">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function renderPayslipHTML(p: Payroll, m: Member): string {
  const fmt = (n: number) => `CHF ${Number(n).toFixed(2)}`;
  const row = (l: string, v: number, neg = false) =>
    `<tr><td>${l}</td><td style="text-align:right;color:${neg ? "#b91c1c" : "inherit"}">${neg ? "−" : ""} ${fmt(Math.abs(v))}</td></tr>`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"/><title>Lohnabrechnung ${m.name}</title>
<style>
  body{font-family:-apple-system,system-ui,Segoe UI,Helvetica,Arial,sans-serif;color:#111;max-width:720px;margin:2rem auto;padding:1.5rem}
  h1{font-size:1.4rem;margin:0 0 .25rem}
  .muted{color:#666;font-size:.85rem}
  table{width:100%;border-collapse:collapse;margin-top:1rem}
  td,th{padding:.45rem .6rem;border-bottom:1px solid #eee;font-size:.9rem}
  th{text-align:left;background:#f7f7f7}
  .net{font-weight:600;font-size:1.05rem;background:#f3f4f6}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:.25rem 1rem;margin-top:1rem;font-size:.85rem}
  .grid div b{color:#555;font-weight:500;display:inline-block;min-width:120px}
</style></head><body>
  <h1>Lohnabrechnung</h1>
  <div class="muted">Periode ${new Date(p.period_start).toLocaleDateString("de-CH")} – ${new Date(p.period_end).toLocaleDateString("de-CH")}</div>

  <h3 style="margin-top:1.5rem">Mitarbeiter</h3>
  <div class="grid">
    <div><b>Name</b> ${m.name}</div>
    <div><b>Rolle</b> ${m.role}</div>
    <div><b>AHV-Nr.</b> ${m.ahv_number ?? "—"}</div>
    <div><b>Geburtsdatum</b> ${m.birthdate ?? "—"}</div>
    <div><b>Adresse</b> ${m.address ?? "—"}</div>
    <div><b>IBAN</b> ${m.iban ?? "—"}</div>
  </div>

  <table>
    <thead><tr><th>Position</th><th style="text-align:right">Betrag</th></tr></thead>
    <tbody>
      <tr><td>Stunden × Stundenlohn</td><td style="text-align:right">${Number(p.hours).toFixed(2)} h × ${fmt(p.hourly_wage)}</td></tr>
      <tr><td><b>Bruttolohn</b></td><td style="text-align:right"><b>${fmt(p.gross)}</b></td></tr>
      ${row("AHV/IV/EO 5.3%", p.ahv_iv_eo, true)}
      ${row("ALV 1.1%", p.alv, true)}
      ${row("NBU 1.4%", p.nbu, true)}
      ${p.withholding_tax > 0 ? row(`Quellensteuer ${Number(m.withholding_tax_rate).toFixed(2)}%`, p.withholding_tax, true) : ""}
      <tr><td>Abzüge total</td><td style="text-align:right">− ${fmt(p.total_deductions)}</td></tr>
      <tr class="net"><td>Nettolohn</td><td style="text-align:right">${fmt(p.net)}</td></tr>
    </tbody>
  </table>

  <p class="muted" style="margin-top:1.5rem">Erstellt am ${new Date(p.created_at).toLocaleString("de-CH")}. Sozialversicherungs-Abzüge nach Schweizer Standard (Arbeitnehmer-Anteil). NBU-Satz kann je nach Versicherer abweichen. Diese Abrechnung dient als Übersicht und ersetzt keine Lohnausweis-Bescheinigung.</p>
</body></html>`;
}

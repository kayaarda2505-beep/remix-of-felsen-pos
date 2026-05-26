import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import {
  CalendarDays, Plus, Trash2, Send, ChevronLeft, ChevronRight, Loader2, X, Mail, CheckCircle2, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { publishShifts } from "@/lib/shifts.functions";

export const Route = createFileRoute("/schichtplan")({
  head: () => ({ meta: [{ title: "Schichtplanung — SAINTS POS" }] }),
  component: SchedulePage,
});

type Member = { id: string; name: string; color: string; email: string | null; role: string };
type Shift = {
  id: string;
  member_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  position: string;
  notes: string | null;
  published_at: string | null;
};

// ===== Time helpers =====
const HOUR_START = 10;          // 10:00
const HOUR_END = 28;            // 04:00 nächster Tag
const HOURS = HOUR_END - HOUR_START;
const PX_PER_HOUR = 22;
const SNAP_MIN = 15;
const COL_HEIGHT = HOURS * PX_PER_HOUR;
const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
function fmtISO(d: Date): string { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function timeToMin(t: string): number { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minToTime(m: number): string {
  const total = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function shiftSpanMin(s: { start_time: string; end_time: string }) {
  let start = timeToMin(s.start_time);
  let end = timeToMin(s.end_time);
  if (end <= start) end += 24 * 60;
  return { start, end };
}
function minToTopPx(m: number) { return (m / 60 - HOUR_START) * PX_PER_HOUR; }
function snap(min: number) { return Math.round(min / SNAP_MIN) * SNAP_MIN; }

function SchedulePage() {
  const qc = useQueryClient();
  const { operator } = useAuth();
  const isManager = operator?.role === "manager";
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [editing, setEditing] = useState<{ memberId: string; date: string; shift?: Shift; defaults?: { start: string; end: string } } | null>(null);
  const [dayDetail, setDayDetail] = useState<string | null>(null);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["team_members_with_email"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, color, email, role, active")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ["shifts", fmtISO(weekStart), fmtISO(weekEnd)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, member_id, shift_date, start_time, end_time, position, notes, published_at")
        .gte("shift_date", fmtISO(weekStart))
        .lte("shift_date", fmtISO(weekEnd));
      if (error) throw error;
      return (data ?? []) as Shift[];
    },
  });

  // shifts grouped by member|date
  const shiftMap = useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const s of shifts) {
      const key = `${s.member_id}|${s.shift_date}`;
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    return m;
  }, [shifts]);

  const memberById = useMemo(() => {
    const m = new Map<string, Member>();
    for (const x of members) m.set(x.id, x);
    return m;
  }, [members]);

  const updateShift = useMutation({
    mutationFn: async (p: { id: string; shift_date: string; start_time: string; end_time: string }) => {
      const { error } = await supabase.from("shifts")
        .update({ shift_date: p.shift_date, start_time: p.start_time, end_time: p.end_time, published_at: null })
        .eq("id", p.id);
      if (error) throw error;
    },
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: ["shifts"] });
      const prev = qc.getQueryData<Shift[]>(["shifts", fmtISO(weekStart), fmtISO(weekEnd)]);
      qc.setQueryData<Shift[]>(["shifts", fmtISO(weekStart), fmtISO(weekEnd)], (old) =>
        (old ?? []).map((s) => s.id === p.id ? { ...s, ...p, published_at: null } : s),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["shifts", fmtISO(weekStart), fmtISO(weekEnd)], ctx.prev);
      toast.error("Konnte Schicht nicht aktualisieren");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });

  const deleteShift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shifts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });

  const publish = useServerFn(publishShifts);
  const publishMut = useMutation({
    mutationFn: async () => {
      const ids = shifts.map((s) => s.id);
      if (ids.length === 0) throw new Error("Keine Schichten in dieser Woche");
      return await publish({ data: { shiftIds: ids } });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      const sent = r.results.filter((x) => x.status === "sent").length;
      const failed = r.results.filter((x) => x.status === "failed").length;
      if (failed === 0 && sent > 0) toast.success(`Schichtplan an ${sent} Mitarbeiter gesendet`);
      else if (sent > 0) toast.warning(`${sent} gesendet · ${failed} fehlgeschlagen`);
      else toast.error(`Versand fehlgeschlagen`);
      if (r.skipped > 0) toast.info(`${r.skipped} Schichten ohne E-Mail übersprungen`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler beim Senden"),
  });

  if (!isManager) {
    return (
      <div className="p-6 lg:p-10 max-w-2xl mx-auto">
        <PageHeader title="Schichtplanung" subtitle="Nur für Manager zugänglich" />
        <div className="glass rounded-3xl p-10 text-center text-muted-foreground">
          Diese Ansicht ist Managern vorbehalten.
        </div>
      </div>
    );
  }

  const weekLabel = `${weekStart.toLocaleDateString("de-CH", { day: "2-digit", month: "short" })} – ${weekEnd.toLocaleDateString("de-CH", { day: "2-digit", month: "short", year: "numeric" })}`;
  const totalShifts = shifts.length;
  const membersWithoutEmail = members.filter((m) => !m.email).length;

  return (
    <div className="p-4 lg:p-10 pb-28 md:pb-10 max-w-[1800px] mx-auto">
      <PageHeader
        title="Schichtplanung"
        subtitle="Interaktiver Kalender · ziehen, verlängern, klicken"
        actions={
          <>
            <div className="flex items-center gap-1 glass rounded-xl p-1">
              <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="px-3 h-9 rounded-lg text-xs hover:bg-white/10">Heute</button>
              <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => publishMut.mutate()}
              disabled={publishMut.isPending || totalShifts === 0}
              className="rounded-xl px-4 py-2.5 text-sm bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-medium shadow-[var(--shadow-gold)] flex items-center gap-2 disabled:opacity-50"
            >
              {publishMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Veröffentlichen & Senden
            </button>
          </>
        }
      />

      <div className="glass rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 text-sm">
        <CalendarDays className="w-4 h-4 text-accent" />
        <span className="font-medium">{weekLabel}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{totalShifts} Schichten</span>
        <span className="text-muted-foreground hidden md:inline">·</span>
        <span className="text-muted-foreground hidden md:inline text-xs">Tippe auf einen Tag oben für Stunden-Übersicht</span>
        {membersWithoutEmail > 0 && (
          <span className="ml-auto text-xs text-amber-400 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> {membersWithoutEmail} ohne E-Mail
          </span>
        )}
      </div>

      <CalendarGrid
        members={members}
        weekDays={weekDays}
        shiftMap={shiftMap}
        onOpenDay={(iso) => setDayDetail(iso)}
        onEditShift={(s) => setEditing({ memberId: s.member_id, date: s.shift_date, shift: s })}
        onCreateAt={(memberId, date, startMin) => {
          const start = minToTime(snap(startMin));
          const end = minToTime(snap(startMin + 4 * 60));
          setEditing({ memberId, date, defaults: { start, end } });
        }}
        onMoveOrResize={(payload) => updateShift.mutate(payload)}
      />

      <AnimatePresence>
        {editing && (
          <ShiftDialog
            memberId={editing.memberId}
            date={editing.date}
            shift={editing.shift}
            defaults={editing.defaults}
            memberName={members.find((m) => m.id === editing.memberId)?.name ?? ""}
            onClose={() => setEditing(null)}
            onDelete={editing.shift ? () => {
              deleteShift.mutate(editing.shift!.id);
              setEditing(null);
            } : undefined}
          />
        )}
        {dayDetail && (
          <DayDetail
            iso={dayDetail}
            shifts={shifts.filter((s) => s.shift_date === dayDetail)}
            memberById={memberById}
            onClose={() => setDayDetail(null)}
            onEdit={(s) => { setDayDetail(null); setEditing({ memberId: s.member_id, date: s.shift_date, shift: s }); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Calendar grid (rows = members, columns = days, each cell = vertical timeline) =====

type MoveResizePayload = { id: string; shift_date: string; start_time: string; end_time: string };

function CalendarGrid({
  members, weekDays, shiftMap, onOpenDay, onEditShift, onCreateAt, onMoveOrResize,
}: {
  members: Member[];
  weekDays: Date[];
  shiftMap: Map<string, Shift[]>;
  onOpenDay: (iso: string) => void;
  onEditShift: (s: Shift) => void;
  onCreateAt: (memberId: string, date: string, startMin: number) => void;
  onMoveOrResize: (p: MoveResizePayload) => void;
}) {
  return (
    <div className="glass rounded-3xl overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[1100px]">
          {/* Header */}
          <div className="grid grid-cols-[180px_40px_repeat(7,1fr)] border-b border-border/40 bg-white/[0.02]">
            <div className="p-3 text-[11px] uppercase tracking-wider text-muted-foreground">Mitarbeiter</div>
            <div />
            {weekDays.map((d, i) => {
              const iso = fmtISO(d);
              const isToday = iso === fmtISO(new Date());
              return (
                <button
                  key={i}
                  onClick={() => onOpenDay(iso)}
                  className={`p-3 text-center border-l border-border/30 transition-colors hover:bg-white/[0.04] ${isToday ? "bg-accent/5" : ""}`}
                >
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{DAY_LABELS[i]}</div>
                  <div className={`text-sm font-semibold tabular-nums mt-0.5 ${isToday ? "text-accent" : ""}`}>
                    {d.getDate()}.{(d.getMonth() + 1).toString().padStart(2, "0")}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Body */}
          {members.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Noch keine aktiven Mitarbeiter. Lege zuerst Mitglieder im Team an.
            </div>
          ) : (
            members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                weekDays={weekDays}
                shiftMap={shiftMap}
                onEditShift={onEditShift}
                onCreateAt={onCreateAt}
                onMoveOrResize={onMoveOrResize}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MemberRow({
  member, weekDays, shiftMap, onEditShift, onCreateAt, onMoveOrResize,
}: {
  member: Member;
  weekDays: Date[];
  shiftMap: Map<string, Shift[]>;
  onEditShift: (s: Shift) => void;
  onCreateAt: (memberId: string, date: string, startMin: number) => void;
  onMoveOrResize: (p: MoveResizePayload) => void;
}) {
  const dayCellsRef = useRef<(HTMLDivElement | null)[]>([]);

  return (
    <div className="grid grid-cols-[180px_40px_repeat(7,1fr)] border-b border-border/30 last:border-0">
      {/* Member name */}
      <div className="p-3 flex items-center gap-2 min-w-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-background shrink-0"
          style={{ background: member.color }}
        >
          {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{member.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {member.email ? member.email : <span className="text-amber-400">keine E-Mail</span>}
          </div>
        </div>
      </div>

      {/* Hour ruler */}
      <div className="relative border-l border-border/30 text-[9px] text-muted-foreground" style={{ height: COL_HEIGHT }}>
        {Array.from({ length: HOURS + 1 }, (_, i) => {
          const h = (HOUR_START + i) % 24;
          return (
            <div key={i} className="absolute right-1 -translate-y-1/2 tabular-nums" style={{ top: i * PX_PER_HOUR }}>
              {String(h).padStart(2, "0")}
            </div>
          );
        })}
      </div>

      {/* Day cells */}
      {weekDays.map((d, di) => {
        const iso = fmtISO(d);
        const list = shiftMap.get(`${member.id}|${iso}`) ?? [];
        return (
          <div
            key={di}
            ref={(el) => { dayCellsRef.current[di] = el; }}
            data-day-cell
            data-date={iso}
            className="relative border-l border-border/30 bg-white/[0.005]"
            style={{ height: COL_HEIGHT }}
            onDoubleClick={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const y = e.clientY - rect.top;
              const min = (y / PX_PER_HOUR + HOUR_START) * 60;
              onCreateAt(member.id, iso, min);
            }}
          >
            {/* hour grid lines */}
            {Array.from({ length: HOURS }, (_, i) => (
              <div
                key={i}
                className={`absolute left-0 right-0 ${i % 2 === 0 ? "border-t border-border/15" : "border-t border-border/5"}`}
                style={{ top: i * PX_PER_HOUR }}
              />
            ))}

            {/* shifts */}
            {list.map((s) => (
              <ShiftBar
                key={s.id}
                shift={s}
                member={member}
                rowRef={dayCellsRef}
                weekDays={weekDays}
                onClick={() => onEditShift(s)}
                onCommit={onMoveOrResize}
              />
            ))}

            {/* empty hint */}
            {list.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[10px] text-muted-foreground/40">Doppelklick</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ===== Drag & resize shift bar =====
type DragMode = "move" | "resize-top" | "resize-bottom";

function ShiftBar({
  shift, member, rowRef, weekDays, onClick, onCommit,
}: {
  shift: Shift;
  member: Member;
  rowRef: React.MutableRefObject<(HTMLDivElement | null)[]>;
  weekDays: Date[];
  onClick: () => void;
  onCommit: (p: MoveResizePayload) => void;
}) {
  const [drag, setDrag] = useState<{
    mode: DragMode;
    startMin: number; // start time min from 00:00
    endMin: number;
    dayIndex: number;
  } | null>(null);
  const movedRef = useRef(false);

  const baseSpan = shiftSpanMin(shift);
  const baseTop = minToTopPx(baseSpan.start);
  const baseHeight = (baseSpan.end - baseSpan.start) / 60 * PX_PER_HOUR;

  const displayTop = drag ? minToTopPx(drag.startMin) : baseTop;
  const displayHeight = drag
    ? (drag.endMin - drag.startMin) / 60 * PX_PER_HOUR
    : baseHeight;
  const displayDayIndex = drag?.dayIndex ?? weekDays.findIndex((d) => fmtISO(d) === shift.shift_date);

  // When dragging across day cells, we want to render the bar in the new cell.
  // For simplicity, render absolutely positioned inside cell, but when dayIndex differs,
  // use a fixed-position overlay following pointer? Easier: portal via transform translateX.
  // We'll translateX by (dayIndex difference) * cellWidth using ref measurement.
  const originalIndex = weekDays.findIndex((d) => fmtISO(d) === shift.shift_date);
  const dayOffsetPx = useMemo(() => {
    if (!drag || displayDayIndex === originalIndex) return 0;
    const fromCell = rowRef.current[originalIndex];
    const toCell = rowRef.current[displayDayIndex];
    if (!fromCell || !toCell) return 0;
    const fromRect = fromCell.getBoundingClientRect();
    const toRect = toCell.getBoundingClientRect();
    return toRect.left - fromRect.left;
  }, [drag, displayDayIndex, originalIndex, rowRef]);

  function beginDrag(e: React.PointerEvent, mode: DragMode) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    movedRef.current = false;

    const startSpan = shiftSpanMin(shift);
    let dragState = {
      mode,
      startMin: startSpan.start,
      endMin: startSpan.end,
      dayIndex: originalIndex,
    };
    setDrag(dragState);

    const startY = e.clientY;
    const startX = e.clientX;

    function onMove(ev: PointerEvent) {
      const dy = ev.clientY - startY;
      const dx = ev.clientX - startX;
      if (Math.abs(dy) > 3 || Math.abs(dx) > 3) movedRef.current = true;
      const dMin = snap((dy / PX_PER_HOUR) * 60);

      if (mode === "move") {
        let newStart = startSpan.start + dMin;
        let newEnd = startSpan.end + dMin;
        // clamp
        const minStart = HOUR_START * 60;
        const maxEnd = HOUR_END * 60;
        const len = newEnd - newStart;
        if (newStart < minStart) { newStart = minStart; newEnd = newStart + len; }
        if (newEnd > maxEnd) { newEnd = maxEnd; newStart = newEnd - len; }

        // figure out day index by X position
        let newDayIndex = originalIndex;
        const cells = rowRef.current;
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          if (!cell) continue;
          const r = cell.getBoundingClientRect();
          if (ev.clientX >= r.left && ev.clientX <= r.right) { newDayIndex = i; break; }
        }
        dragState = { ...dragState, startMin: newStart, endMin: newEnd, dayIndex: newDayIndex };
      } else if (mode === "resize-bottom") {
        let newEnd = startSpan.end + dMin;
        if (newEnd <= startSpan.start + SNAP_MIN) newEnd = startSpan.start + SNAP_MIN;
        if (newEnd > HOUR_END * 60) newEnd = HOUR_END * 60;
        dragState = { ...dragState, endMin: newEnd };
      } else if (mode === "resize-top") {
        let newStart = startSpan.start + dMin;
        if (newStart >= startSpan.end - SNAP_MIN) newStart = startSpan.end - SNAP_MIN;
        if (newStart < HOUR_START * 60) newStart = HOUR_START * 60;
        dragState = { ...dragState, startMin: newStart };
      }
      setDrag({ ...dragState });
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);

      if (movedRef.current) {
        const newDate = fmtISO(weekDays[dragState.dayIndex]);
        const newStart = minToTime(dragState.startMin);
        const newEnd = minToTime(dragState.endMin);
        const changed = newDate !== shift.shift_date
          || newStart !== shift.start_time.slice(0, 5)
          || newEnd !== shift.end_time.slice(0, 5);
        if (changed) onCommit({ id: shift.id, shift_date: newDate, start_time: newStart, end_time: newEnd });
      }
      setDrag(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  const startLabel = drag ? minToTime(drag.startMin) : shift.start_time.slice(0, 5);
  const endLabel = drag ? minToTime(drag.endMin) : shift.end_time.slice(0, 5);

  return (
    <div
      onPointerDown={(e) => beginDrag(e, "move")}
      onClick={(e) => { e.stopPropagation(); if (!movedRef.current) onClick(); }}
      className="absolute left-1 right-1 rounded-lg cursor-grab active:cursor-grabbing select-none overflow-hidden shadow-sm group"
      style={{
        top: displayTop,
        height: Math.max(displayHeight, 18),
        transform: `translateX(${dayOffsetPx}px)`,
        background: `color-mix(in oklab, ${member.color} 28%, transparent)`,
        border: `1px solid color-mix(in oklab, ${member.color} 55%, transparent)`,
        zIndex: drag ? 30 : 10,
        backdropFilter: "blur(4px)",
      }}
    >
      {/* top resize handle */}
      <div
        onPointerDown={(e) => beginDrag(e, "resize-top")}
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-white/20"
      />
      <div className="px-2 py-1 text-[11px] leading-tight pointer-events-none">
        <div className="font-semibold tabular-nums">{startLabel}–{endLabel}</div>
        <div className="text-[10px] opacity-80 truncate">{shift.position}</div>
        {shift.published_at && !drag && (
          <CheckCircle2 className="w-3 h-3 mt-0.5 text-success/80" />
        )}
      </div>
      {/* bottom resize handle */}
      <div
        onPointerDown={(e) => beginDrag(e, "resize-bottom")}
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-white/20"
      />
    </div>
  );
}

// ===== Day detail modal =====
function DayDetail({
  iso, shifts, memberById, onClose, onEdit,
}: {
  iso: string;
  shifts: Shift[];
  memberById: Map<string, Member>;
  onClose: () => void;
  onEdit: (s: Shift) => void;
}) {
  // Compute hourly breakdown: for each hour 10..28, who is working & doing what
  const hours = Array.from({ length: HOURS }, (_, i) => HOUR_START + i);
  const sorted = [...shifts].sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time));

  function isActiveInHour(s: Shift, hourAbs: number) {
    const { start, end } = shiftSpanMin(s);
    const hStart = hourAbs * 60;
    const hEnd = hStart + 60;
    return start < hEnd && end > hStart;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
    >
      <motion.div
        initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-3xl p-6 w-full max-w-3xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tagesübersicht</div>
            <h2 className="text-xl font-semibold capitalize">
              {new Date(iso + "T00:00:00").toLocaleDateString("de-CH", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </h2>
            <div className="text-xs text-muted-foreground mt-0.5">{shifts.length} Schichten</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {sorted.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">Keine Schichten an diesem Tag.</div>
          ) : (
            <>
              {/* Shift list */}
              <div className="space-y-2 mb-6">
                {sorted.map((s) => {
                  const m = memberById.get(s.member_id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => onEdit(s)}
                      className="w-full glass rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-white/[0.05] text-left"
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-background shrink-0"
                        style={{ background: m?.color ?? "#888" }}
                      >
                        {m?.name.split(" ").map((n) => n[0]).join("").slice(0, 2) ?? "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{m?.name ?? "Unbekannt"}</div>
                        <div className="text-[11px] text-muted-foreground">{s.position}{s.notes ? ` · ${s.notes}` : ""}</div>
                      </div>
                      <div className="text-sm tabular-nums font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-accent" />
                        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Hourly breakdown */}
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">Stunden-Übersicht</div>
              <div className="space-y-1">
                {hours.map((h) => {
                  const active = sorted.filter((s) => isActiveInHour(s, h));
                  if (active.length === 0) return null;
                  const hh = h % 24;
                  return (
                    <div key={h} className="flex items-start gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.03]">
                      <div className="text-xs tabular-nums font-semibold text-accent w-12 shrink-0 pt-0.5">
                        {String(hh).padStart(2, "0")}:00
                      </div>
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {active.map((s) => {
                          const m = memberById.get(s.member_id);
                          return (
                            <span
                              key={s.id}
                              className="text-[11px] px-2 py-0.5 rounded-md"
                              style={{
                                background: `color-mix(in oklab, ${m?.color ?? "#888"} 25%, transparent)`,
                                border: `1px solid color-mix(in oklab, ${m?.color ?? "#888"} 50%, transparent)`,
                              }}
                            >
                              {m?.name ?? "?"} · {s.position}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ===== Shift create/edit dialog =====
function ShiftDialog({
  memberId, date, shift, defaults, memberName, onClose, onDelete,
}: {
  memberId: string;
  date: string;
  shift?: Shift;
  defaults?: { start: string; end: string };
  memberName: string;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const qc = useQueryClient();
  const [start, setStart] = useState(shift?.start_time.slice(0, 5) ?? defaults?.start ?? "17:00");
  const [end, setEnd] = useState(shift?.end_time.slice(0, 5) ?? defaults?.end ?? "23:00");
  const [position, setPosition] = useState(shift?.position ?? "Service");
  const [notes, setNotes] = useState(shift?.notes ?? "");

  const save = useMutation({
    mutationFn: async () => {
      if (shift) {
        const { error } = await supabase.from("shifts")
          .update({ start_time: start, end_time: end, position, notes: notes || null, published_at: null })
          .eq("id", shift.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shifts").insert({
          member_id: memberId, shift_date: date,
          start_time: start, end_time: end, position, notes: notes || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shifts"] }); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-3xl p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{shift ? "Bearbeiten" : "Neue Schicht"}</div>
            <h2 className="text-xl font-semibold">{memberName}</h2>
            <div className="text-xs text-muted-foreground mt-0.5">{new Date(date + "T00:00:00").toLocaleDateString("de-CH", { weekday: "long", day: "2-digit", month: "long" })}</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Von</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                className="glass rounded-xl px-3 py-3 text-sm w-full outline-none bg-transparent tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Bis</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
                className="glass rounded-xl px-3 py-3 text-sm w-full outline-none bg-transparent tabular-nums" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Position</label>
            <div className="grid grid-cols-4 gap-2">
              {["Service", "Bar", "Küche", "Float"].map((p) => (
                <button key={p} onClick={() => setPosition(p)}
                  className={`rounded-xl px-2 py-2.5 text-xs transition-all border-2 ${position === p ? "border-accent bg-white/[0.04]" : "border-transparent glass"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Notiz (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="z.B. Einarbeitung neuer Kollege"
              className="glass rounded-xl px-3 py-3 text-sm w-full outline-none bg-transparent" />
          </div>

          <div className="flex gap-2 pt-2">
            {onDelete && (
              <button onClick={onDelete}
                className="rounded-xl px-3 py-3 bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => save.mutate()} disabled={save.isPending}
              className="flex-1 rounded-2xl py-3.5 bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground font-semibold shadow-[var(--shadow-gold)] flex items-center justify-center gap-2 disabled:opacity-60">
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Speichern"}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

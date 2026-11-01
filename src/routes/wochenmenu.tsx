import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Camera, FileDown, FileText, ImageIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import logoAsset from "@/assets/piratino-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractWeeklyMenu, type WeeklyDish } from "@/lib/weekly-menu.functions";

export const Route = createFileRoute("/wochenmenu")({
  head: () => ({
    meta: [
      { title: "Wochenmenü gestalten — Piratino POS" },
      { name: "description", content: "Aus einem Notizfoto ein elegantes Wochenmenü als PDF oder Word erstellen." },
      { property: "og:title", content: "Wochenmenü gestalten — Piratino POS" },
      { property: "og:description", content: "Aus einem Notizfoto ein elegantes Wochenmenü als PDF oder Word erstellen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WochenmenuPage,
});

function defaultWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - day + (day >= 5 ? 7 : 0));
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  const m = (x: Date) => x.toLocaleDateString("de-CH", { day: "numeric", month: "long" });
  return `${m(mon)} – ${m(fri)} ${fri.getFullYear()}`;
}

async function fileToDataUrl(file: File): Promise<string> {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  return c.toDataURL("image/jpeg", 0.85);
}

function priceLabel(p: string) {
  const t = p.trim();
  if (!t) return "";
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? `CHF ${n.toFixed(2)}` : t;
}

const EMPTY: WeeklyDish = { name: "", description: "", price: "" };

function WochenmenuPage() {
  const extract = useServerFn(extractWeeklyMenu);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [week, setWeek] = useState(defaultWeek);
  const [subtitle, setSubtitle] = useState("Menù della Settimana");
  const [dishes, setDishes] = useState<WeeklyDish[]>([]);
  const [footer, setFooter] = useState("Montag bis Freitag · 11 – 14 Uhr");

  const onFile = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const url = await fileToDataUrl(f);
      const r = await extract({ data: { imageDataUrl: url } });
      if (!r.ok || !r.dishes) throw new Error(r.error ?? "Fehler");
      setDishes(r.dishes);
      toast.success(`${r.dishes.length} Gerichte erkannt – bitte kurz prüfen`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const update = (i: number, k: keyof WeeklyDish, v: string) =>
    setDishes((ds) => ds.map((d, j) => (j === i ? { ...d, [k]: v } : d)));

  const downloadWord = async () => {
    try {
      const { buildWeeklyMenuDocx } = await import("@/lib/weekly-menu-docx");
      const blob = await buildWeeklyMenuDocx({ week, subtitle, dishes, footer, logoUrl: logoAsset.url });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Wochenmenue-${week.replace(/[^\w]+/g, "-")}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    } catch (e) {
      toast.error("Word-Datei fehlgeschlagen: " + (e as Error).message);
    }
  };

  const valid = dishes.filter((d) => d.name.trim());

  return (
    <div className="p-4 md:p-8 grid gap-8 lg:grid-cols-[minmax(320px,440px)_1fr]">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Wochenmenü</h1>
          <p className="text-sm text-muted-foreground">
            Foto der Notizen hochladen, Gerichte prüfen, dann als PDF oder Word speichern.
          </p>
        </div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Camera />}
            Kamera
          </Button>
          <Button size="lg" variant="outline" onClick={() => galleryRef.current?.click()} disabled={busy}>
            <ImageIcon />
            Aus Galerie
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Woche</label>
          <Input value={week} onChange={(e) => setWeek(e.target.value)} />
          <label className="text-xs font-medium text-muted-foreground">Untertitel</label>
          <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          <label className="text-xs font-medium text-muted-foreground">Fusszeile</label>
          <Input value={footer} onChange={(e) => setFooter(e.target.value)} />
        </div>

        <div className="space-y-3">
          {dishes.map((d, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2 bg-card">
              <div className="flex gap-2">
                <Input placeholder="Gericht" value={d.name} onChange={(e) => update(i, "name", e.target.value)} />
                <Input className="w-24" placeholder="Preis" value={d.price} onChange={(e) => update(i, "price", e.target.value)} />
                <Button variant="ghost" size="icon" onClick={() => setDishes((ds) => ds.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
              <Input placeholder="Beschreibung (z.B. an Rosmarinkartoffeln)" value={d.description} onChange={(e) => update(i, "description", e.target.value)} />
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={() => setDishes((ds) => [...ds, { ...EMPTY }])}>
            <Plus /> Gericht hinzufügen
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button disabled={!valid.length} onClick={() => window.print()}>
            <FileDown /> PDF / Drucken
          </Button>
          <Button variant="secondary" disabled={!valid.length} onClick={downloadWord}>
            <FileText /> Word
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          PDF: im Druckfenster «Als PDF speichern» wählen oder direkt drucken (A4, Ränder «Keine»).
        </p>
      </div>

      <div className="overflow-auto">
        <div className="menu-preview-scale origin-top-left scale-[0.55] sm:scale-75 xl:scale-90 w-[210mm]">
          <MenuSheet week={week} subtitle={subtitle} dishes={valid} footer={footer} />
        </div>
      </div>
    </div>
  );
}

function Ornament() {
  return (
    <div className="flex items-center justify-center gap-3" style={{ color: "var(--menu-gold)" }}>
      <span className="h-px w-16" style={{ background: "var(--menu-gold)" }} />
      <span className="text-[9px]">◆</span>
      <span className="h-px w-16" style={{ background: "var(--menu-gold)" }} />
    </div>
  );
}

function MenuSheet({ week, subtitle, dishes, footer }: { week: string; subtitle: string; dishes: WeeklyDish[]; footer: string }) {
  const many = dishes.length > 6;
  return (
    <div id="menu-sheet" className="menu-sheet relative shadow-2xl" style={{ width: "210mm", height: "297mm" }}>
      <div className="absolute" style={{ inset: "10mm", border: "0.6pt solid var(--menu-gold)" }} />
      <div className="absolute" style={{ inset: "11.5mm", border: "0.3pt solid var(--menu-gold)" }} />
      <div className="relative h-full flex flex-col items-center text-center" style={{ padding: "22mm 26mm 20mm" }}>
        <img src={logoAsset.url} alt="Piratino" style={{ width: "30mm", height: "30mm", objectFit: "contain" }} />
        <div className="menu-caps mt-3 text-[10pt] tracking-[0.45em]" style={{ color: "var(--menu-muted)" }}>
          PIRATINO
        </div>
        <div className="menu-serif italic mt-6 text-[34pt] leading-none">{subtitle}</div>
        <div className="menu-caps mt-4 text-[9pt] tracking-[0.35em]" style={{ color: "var(--menu-muted)" }}>
          WOCHENMENÜ · {week.toUpperCase()}
        </div>
        <div className="mt-7"><Ornament /></div>

        <div className={`flex-1 flex flex-col justify-center w-full ${many ? "gap-5" : "gap-8"}`}>
          {dishes.map((d, i) => (
            <div key={i}>
              <div className={`menu-caps ${many ? "text-[12pt]" : "text-[14pt]"} tracking-[0.2em]`}>{d.name.toUpperCase()}</div>
              {d.description && (
                <div className={`menu-serif italic mt-1 ${many ? "text-[12pt]" : "text-[14pt]"}`} style={{ color: "var(--menu-muted)" }}>
                  {d.description}
                </div>
              )}
              {d.price && (
                <div className="menu-serif mt-1 text-[12pt] tracking-[0.1em]" style={{ color: "var(--menu-gold)" }}>
                  {priceLabel(d.price)}
                </div>
              )}
            </div>
          ))}
        </div>

        <Ornament />
        <div className="menu-serif italic mt-4 text-[16pt]">Buon appetito</div>
        {footer && (
          <div className="menu-caps mt-2 text-[8pt] tracking-[0.3em]" style={{ color: "var(--menu-muted)" }}>
            {footer.toUpperCase()}
          </div>
        )}
        <div className="menu-caps mt-1 text-[7.5pt] tracking-[0.3em]" style={{ color: "var(--menu-muted)" }}>
          BADENERSTRASSE 696 · 8048 ZÜRICH
        </div>
      </div>
    </div>
  );
}

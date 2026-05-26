import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  Building2,
  
  Bell,
  Printer,
  Globe,
  Database,
  QrCode,
  Sparkles,
  Music2,
  Speaker,
  FlaskConical,
  Wine,
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/settings/")({
  component: SettingsIndex,
});

const sections = [
  { to: "/settings/locations", icon: Building2, title: "Standorte", desc: "Multi-Location verwalten" },
  { to: "/settings/products", icon: Wine, title: "Produkte / Karte", desc: "Produkte anlegen, Beschreibungen, Zusatz-Optionen" },
  
  { to: "/settings/happy-hour", icon: Bell, title: "Happy Hour", desc: "Zeitgesteuerte Preise" },
  { to: "/settings/recipes", icon: FlaskConical, title: "Rezepturen", desc: "Produkte mit Lager verknüpfen" },
  { to: "/settings/printers", icon: Printer, title: "Drucker", desc: "Bons, Küchen, Bar" },
  { to: "/settings/qr", icon: QrCode, title: "QR-Bestellung", desc: "Tisch-QR Codes generieren" },
  { to: "/settings/region", icon: Globe, title: "Sprache & Region", desc: "Sprache, Währung, Trinkgeld" },
  { to: "/settings/database", icon: Database, title: "Datenbank", desc: "Backup, Reset, Demo-Daten" },
  { to: "/settings/members", icon: Sparkles, title: "Mitgliederprogramm", desc: "VIP-Level, Punkte" },
  { to: "/settings/spotify", icon: Music2, title: "Spotify", desc: "Bar-Musik direkt steuern" },
  { to: "/spotify-player", icon: Speaker, title: "PC-Lautsprecher", desc: "Diesen PC als Spotify-Gerät nutzen" },
] as const;

function SettingsIndex() {
  return (
    <div className="p-4 md:p-6 lg:p-10 pb-28 md:pb-10 max-w-[1400px] mx-auto">
      <PageHeader title="Einstellungen" subtitle="System konfigurieren" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((s, i) => (
          <motion.div
            key={s.to}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              to={s.to}
              className="glass rounded-2xl p-5 flex items-center gap-4 text-left hover:border-accent/30 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <s.icon className="w-5 h-5 text-accent" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{s.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

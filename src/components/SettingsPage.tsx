import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export function SettingsPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="p-4 md:p-6 lg:p-10 pb-28 md:pb-10 max-w-[1200px] mx-auto">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 md:mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Einstellungen
      </Link>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs md:text-sm text-muted-foreground mt-1 md:mt-1.5">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex gap-2 flex-wrap md:shrink-0 md:flex-nowrap md:items-end">{actions}</div>
        )}
      </div>
      {children}
    </div>
  );
}

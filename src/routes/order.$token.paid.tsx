import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Star } from "lucide-react";
import { SaintsLogo } from "@/components/SaintsLogo";

const REVIEW_URL = "https://share.google/mz2iRMKXm9jDlQol1";

export const Route = createFileRoute("/order/$token/paid")({
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: PaidPage,
});

function PaidPage() {
  const { token } = Route.useParams();
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="glass-strong rounded-3xl p-10 max-w-md w-full text-center space-y-5">
        <div className="flex justify-center"><SaintsLogo size={48} /></div>
        <div className="w-16 h-16 mx-auto rounded-full bg-accent/20 text-accent flex items-center justify-center">
          <Check className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-semibold">Zahlung erfolgreich</h1>
        <p className="text-sm text-muted-foreground">
          Vielen Dank! Deine Rechnung wurde online bezahlt.
        </p>

        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 space-y-3">
          <div className="flex justify-center gap-1 text-yellow-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-6 h-6 fill-current" />
            ))}
          </div>
          <h2 className="font-semibold">Hat es dir gefallen?</h2>
          <p className="text-sm text-muted-foreground">
            Wir freuen uns über eine Google-Bewertung – das hilft uns enorm!
          </p>
          <a
            href={REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block w-full rounded-2xl bg-gradient-to-br from-accent to-neutral-300 text-accent-foreground px-6 py-3 font-semibold"
          >
            Jetzt auf Google bewerten
          </a>
        </div>

        <Link
          to="/order/$token"
          params={{ token }}
          className="inline-block text-sm text-muted-foreground hover:text-foreground underline"
        >
          Zurück zur Karte
        </Link>
      </div>
    </div>
  );
}

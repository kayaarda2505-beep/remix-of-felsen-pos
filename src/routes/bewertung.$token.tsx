import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, Loader2, Star } from "lucide-react";
import { getReviewRequest, setNewsletterOptIn, submitReview } from "@/lib/reviews.functions";

export const Route = createFileRoute("/bewertung/$token")({
  head: () => ({
    meta: [
      { title: "Bewertung — Piratino" },
      { name: "description", content: "Bewerte deine Piratino-Lieferung in wenigen Sekunden." },
      { property: "og:title", content: "Bewertung — Piratino" },
      { property: "og:description", content: "Bewerte deine Piratino-Lieferung in wenigen Sekunden." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewPage,
});

type Phase = "newsletter" | "done";

const GOOGLE_REVIEW_URL = "https://maps.google.com/?cid=4104131751984087472";

function ReviewPage() {
  const { token } = Route.useParams();
  const load = useServerFn(getReviewRequest);
  const optIn = useServerFn(setNewsletterOptIn);

  const { data, isLoading } = useQuery({
    queryKey: ["review", token],
    queryFn: () => load({ data: { token } }),
  });

  const [phase, setPhase] = useState<Phase>("newsletter");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    const r = data?.review;
    if (!r) return;
    if (r.newsletterOptIn != null) {
      setAccepted(r.newsletterOptIn);
      setPhase("done");
    }
  }, [data]);

  if (isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!data?.review) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-center">
        <p className="text-muted-foreground">Dieser Link ist nicht mehr gültig.</p>
      </main>
    );
  }

  const choose = async (value: boolean) => {
    setBusy(true);
    try {
      await optIn({ data: { token, optIn: value } });
      setAccepted(value);
      setPhase("done");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh bg-background px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Piratino</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.review.customerName ? `Hallo ${data.review.customerName}! ` : ""}
            Danke für deine Bestellung.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <Star className="mx-auto size-9 fill-primary text-primary" />
          <h2 className="mt-3 text-lg font-semibold text-card-foreground">
            Bewerte uns bei Google
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Deine Bewertung hilft uns enorm — dauert nur 10 Sekunden.
          </p>
          <a
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
          >
            Bei Google bewerten
          </a>
        </section>

        {phase === "newsletter" && (
          <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-card-foreground">Angebote per SMS?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Dürfen wir dich über neue Angebote und Aktionen informieren?
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => choose(true)}
                className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
              >
                Ja, gerne
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => choose(false)}
                className="rounded-xl border border-border px-4 py-3 font-semibold text-foreground disabled:opacity-50"
              >
                Nein, danke
              </button>
            </div>
          </section>
        )}

        {phase === "done" && (
          <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <Check className="mx-auto size-10 text-primary" />
            <h2 className="mt-3 text-lg font-semibold text-card-foreground">Vielen Dank!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {accepted
                ? "Du erhältst künftig unsere Angebote per SMS."
                : "Wir freuen uns auf deine nächste Bestellung."}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

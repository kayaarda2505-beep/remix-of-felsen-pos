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

type Phase = "rating" | "google" | "newsletter" | "done";

const GOOGLE_REVIEW_URL =
  "https://www.google.com/maps/place/Piratino+Pizzeria+Take+Away/@47.3886642,8.483878,14z/data=!4m12!1m2!2m1!1spiratino!3m8!1s0x47900bb6780dea29:0x38f4ce157469c1b0!8m2!3d47.3886642!4d8.483878!9m1!1b1!15sCghwaXJhdGlub1oKIghwaXJhdGlub5IBCnJlc3RhdXJhbnTgAQA!16s%2Fg%2F11fhnhw7bw";

function ReviewPage() {
  const { token } = Route.useParams();
  const load = useServerFn(getReviewRequest);
  const save = useServerFn(submitReview);
  const optIn = useServerFn(setNewsletterOptIn);

  const { data, isLoading } = useQuery({
    queryKey: ["review", token],
    queryFn: () => load({ data: { token } }),
  });

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [phase, setPhase] = useState<Phase>("rating");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    const r = data?.review;
    if (!r) return;
    if (r.rating) {
      setRating(r.rating);
      setPhase(r.newsletterOptIn == null ? "newsletter" : "done");
      setAccepted(r.newsletterOptIn);
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
        <p className="text-muted-foreground">Dieser Bewertungslink ist nicht mehr gültig.</p>
      </main>
    );
  }

  const submit = async () => {
    if (rating < 1) return;
    setBusy(true);
    try {
      await save({ data: { token, rating, comment: comment.trim() || undefined } });
      setPhase(rating >= 4 ? "google" : "newsletter");
    } finally {
      setBusy(false);
    }
  };

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

        {phase === "rating" && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-card-foreground">Wie war deine Lieferung?</h2>
            <div className="mt-4 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} Sterne`}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  className="p-1"
                >
                  <Star
                    className={`size-9 transition ${
                      n <= (hover || rating)
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Möchtest du uns noch etwas mitteilen? (optional)"
              className="mt-4 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={rating < 1 || busy}
              onClick={submit}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Bewertung senden
            </button>
          </section>
        )}

        {phase === "google" && (
          <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-card-foreground">Danke für die {rating} Sterne!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Würdest du uns die Bewertung auch bei Google hinterlassen? Das hilft uns enorm.
            </p>
            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setPhase("newsletter")}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
            >
              Bei Google bewerten
            </a>
            <button
              type="button"
              onClick={() => setPhase("newsletter")}
              className="mt-3 w-full rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground"
            >
              Später
            </button>
          </section>
        )}

        {phase === "newsletter" && (
          <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-card-foreground">Danke für deine Bewertung!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Dürfen wir dich per SMS über neue Angebote und Aktionen informieren?
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

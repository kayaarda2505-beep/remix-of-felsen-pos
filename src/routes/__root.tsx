import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/hooks/use-auth";
import { AuthGate } from "@/components/AuthGate";
import { Toaster } from "@/components/ui/sonner";
import { OnScreenKeyboard } from "@/components/OnScreenKeyboard";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass rounded-3xl p-10 max-w-md text-center">
        <h1 className="text-7xl font-semibold text-gradient-gold">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Diese Seite existiert nicht.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Zum Service
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass rounded-3xl p-10 max-w-md text-center">
        <h1 className="text-xl font-semibold">Etwas ist schiefgelaufen</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "SAINTS POS — Modernes Kassensystem" },
      {
        name: "description",
        content:
          "SAINTS POS — Apple-inspiriertes Kassensystem für Bars, Restaurants und Cafés. Schnell, touch-optimiert, elegant.",
      },
      { name: "theme-color", content: "#0a0a0a" },
      { property: "og:title", content: "SAINTS POS — Modernes Kassensystem" },
      { property: "og:description", content: "Felsen POS is a modern, touch-optimized point-of-sale system for bars, restaurants, and cafes." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "SAINTS POS — Modernes Kassensystem" },
      { name: "description", content: "Felsen POS is a modern, touch-optimized point-of-sale system for bars, restaurants, and cafes." },
      { name: "twitter:description", content: "Felsen POS is a modern, touch-optimized point-of-sale system for bars, restaurants, and cafes." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/eb16b3f4-06f0-4ef3-b7a8-8d6f936d963a/id-preview-8971f7c1--f212b137-89e0-4643-a3f9-8e9610390f92.lovable.app-1779364056265.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/eb16b3f4-06f0-4ef3-b7a8-8d6f936d963a/id-preview-8971f7c1--f212b137-89e0-4643-a3f9-8e9610390f92.lovable.app-1779364056265.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "SAINTS POS" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPublicGuest = pathname.startsWith("/order/");

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {isPublicGuest ? (
          <Outlet />
        ) : (
          <AuthGate>
            <AppShell>
              <Outlet />
            </AppShell>
          </AuthGate>
        )}
        <Toaster position="top-center" theme="dark" richColors />
        <OnScreenKeyboard />
      </AuthProvider>
    </QueryClientProvider>
  );
}

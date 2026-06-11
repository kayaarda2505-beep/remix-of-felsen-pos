// Entry point for the static / Electron build.
// - No SSR, no TanStack-Start server entry.
// - Server-Functions (`createServerFn`) und `/api/*`-Routen werden via globalem
//   `fetch`-Interceptor an die gehostete Lovable-URL umgeleitet.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import {
  RouterProvider,
  createRouter,
  createHashHistory,
} from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

// --- API-Basis-URL für Server-Funktionen ---------------------------------
// Override per Build-time-Env `VITE_ELECTRON_API_BASE` möglich.
const API_BASE =
  (import.meta.env.VITE_ELECTRON_API_BASE as string | undefined)?.replace(
    /\/+$/,
    "",
  ) || "https://project--ed8af55d-d935-4e82-b767-d8edd9659f9f.lovable.app";

// Pfad-Präfixe, die zum gehosteten Server umgeleitet werden müssen.
const REMOTE_PREFIXES = ["/_serverFn", "/_server", "/api/"];

function shouldRewrite(url: string): boolean {
  // Absolute URLs (http/https) niemals anfassen — z. B. Supabase, Stripe.
  if (/^[a-z]+:\/\//i.test(url)) return false;
  // file:// pfade die mit ./ oder ../ anfangen lassen wir auch in Ruhe.
  if (!url.startsWith("/")) return false;
  return REMOTE_PREFIXES.some((p) => url.startsWith(p));
}

if (typeof window !== "undefined") {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      if (typeof input === "string" && shouldRewrite(input)) {
        return originalFetch(API_BASE + input, init);
      }
      if (input instanceof URL) {
        // URLs sind bereits absolut → passthrough.
        return originalFetch(input, init);
      }
      if (typeof Request !== "undefined" && input instanceof Request) {
        // Request-Objekt mit relativer URL kommt nur vor wenn jemand
        // `new Request("/api/...")` baut — dann neu konstruieren.
        const reqUrl = input.url;
        // `new Request("/x")` resolved gegen file:// → endet auf "file:///x"
        if (reqUrl.startsWith("file://")) {
          const path = reqUrl.replace(/^file:\/\//, "");
          if (shouldRewrite(path)) {
            return originalFetch(
              new Request(API_BASE + path, input as RequestInit),
            );
          }
        }
        return originalFetch(input, init);
      }
      return originalFetch(input as RequestInfo, init);
    } catch {
      return originalFetch(input as RequestInfo, init);
    }
  };
}

// --- Router (Hash-History für file://) -----------------------------------
const queryClient = new QueryClient();

const router = createRouter({
  routeTree,
  context: { queryClient },
  history: createHashHistory(),
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootEl = document.getElementById("app");
if (!rootEl) throw new Error("#app root element missing");

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

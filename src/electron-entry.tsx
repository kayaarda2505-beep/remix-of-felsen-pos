import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { createHashHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

// Mark as electron so CSS can disable expensive effects (backdrop-filter, fixed bg)
document.documentElement.classList.add("is-electron");

// Inject perf overrides
const style = document.createElement("style");
style.textContent = `
  html.is-electron body {
    background-image: none !important;
    background-attachment: scroll !important;
  }
  html.is-electron .glass,
  html.is-electron .glass-strong {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    background: oklch(0.18 0.006 270) !important;
  }
  html.is-electron * {
    -webkit-font-smoothing: antialiased;
  }
`;
document.head.appendChild(style);

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

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}

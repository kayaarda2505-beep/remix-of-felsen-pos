import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { createHashHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

// Disable expensive backdrop-filter blur in Electron (causes input lag on Windows)
const style = document.createElement("style");
style.textContent = `
  .glass, .glass-strong {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  .glass-strong {
    background: oklch(0.2 0.006 270) !important;
  }
  body {
    background-attachment: scroll !important;
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

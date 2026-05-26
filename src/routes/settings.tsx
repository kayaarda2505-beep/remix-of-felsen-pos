import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Einstellungen — SAINTS POS" }] }),
  component: () => <Outlet />,
});

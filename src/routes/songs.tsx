import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/songs")({
  beforeLoad: () => {
    throw redirect({ to: "/musik", search: { tab: "wuensche" } as any });
  },
  component: () => null,
});

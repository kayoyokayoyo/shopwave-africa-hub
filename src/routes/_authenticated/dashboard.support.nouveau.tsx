import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/support/nouveau")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/support" });
  },
  component: () => null,
});

import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/guest")({
  head: () => ({
    meta: [
      { title: "Play as guest — JEE Ranked" },
      {
        name: "description",
        content:
          "Try JEE Ranked without an account. Play unranked solo or against a bot — no account, no personal data saved.",
      },
    ],
  }),
  component: GuestLayout,
});

function GuestLayout() {
  return <Outlet />;
}

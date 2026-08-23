import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";

/**
 * Server-only gate for admin operations. Composes on top of
 * requireSupabaseAuth (JWT verification) and additionally checks that the
 * caller's user id is present in the locked-down `admins` table.
 *
 * The admins table has RLS enabled with zero policies and no grants for
 * anon/authenticated roles, so this check can only ever pass via the
 * service-role client here — clients cannot read or write admin state,
 * and nothing about being an admin is ever stored anywhere a user could
 * modify.
 */
export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ context, next }) => {
    const { adminClient } = await import("@/lib/game.server");
    const { data, error } = await adminClient()
      .from("admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !data) throw new Error("Forbidden");
    return next({ context });
  });

/**
 * adminGuard — tRPC Middleware
 * HU-027: Admin role protection for all backoffice procedures
 *
 * Usage:
 *   import { adminProcedure } from "../infrastructure/adminGuard";
 *
 *   export const promptVaultRouter = router({
 *     list: adminProcedure.query(async ({ ctx }) => { ... }),
 *   });
 *
 * Security guarantees:
 *  - Throws FORBIDDEN (HTTP 403) if user is not authenticated
 *  - Throws FORBIDDEN if user.role !== 'admin'
 *  - The check runs server-side on every request — frontend route
 *    guards are UX-only and not relied upon for security
 */

import { TRPCError } from "@trpc/server";
import { t } from "../_core/trpc"; // your existing tRPC instance

export const adminGuard = t.middleware(({ ctx, next }) => {
  // ctx.user is populated by your existing auth middleware
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Debes iniciar sesi\u00f3n para acceder al backoffice.",
    });
  }

  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acceso denegado. Esta secci\u00f3n es solo para administradores.",
    });
  }

  return next({ ctx });
});

/**
 * adminProcedure — use this instead of t.procedure for any backoffice endpoint.
 * It automatically enforces the admin role check before the handler runs.
 */
export const adminProcedure = t.procedure.use(adminGuard);

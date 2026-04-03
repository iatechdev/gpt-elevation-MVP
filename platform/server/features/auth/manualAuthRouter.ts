/**
 * Manual Authentication Router — Feature: Auth
 *
 * Handles email + password registration and login.
 *
 * Security measures implemented (OWASP):
 * - A02: Passwords hashed with bcrypt (cost 12). Emails encrypted AES-256-GCM.
 * - A07: Generic error messages to prevent user enumeration.
 *        Constant-time password comparison via bcrypt.compare.
 *        Session cookies: HttpOnly + Secure + SameSite=Strict.
 * - A03: All inputs validated and sanitized via Zod before DB access.
 * - A04: Rate limiting is applied at the Express middleware layer (see index.ts).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { publicProcedure, router } from "../../_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../../_core/cookies";
import { hashPassword, verifyPassword } from "../../infrastructure/passwordService";
import { encryptEmail, decryptEmail, isEncryptedEmail } from "../../infrastructure/emailEncryption";
import { sdk } from "../../_core/sdk";
import { getDb } from "../../db";
import { users } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Input schemas ────────────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128, "La contraseña no puede superar los 128 caracteres"),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1).max(128),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generates a deterministic, non-reversible openId for email-based users.
 * Format: "email:<sha256_prefix>" — unique per email address.
 */
function buildEmailOpenId(email: string): string {
  const hash = createHash("sha256").update(email).digest("hex").slice(0, 32);
  return `email:${hash}`;
}

/**
 * Finds a user by their encrypted email address.
 *
 * NOTE: This performs a full-table scan because emails are stored encrypted.
 * For production scale, add an HMAC-SHA256 index column alongside the
 * encrypted email to enable O(1) lookup. The HMAC key must differ from
 * the AES encryption key.
 */
async function findUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;

  const emailUsers = await db
    .select()
    .from(users)
    .where(eq(users.loginMethod, "email"));

  for (const user of emailUsers) {
    if (!user.email) continue;
    try {
      const decrypted = isEncryptedEmail(user.email)
        ? decryptEmail(user.email)
        : user.email;
      if (decrypted === email) return user;
    } catch {
      // Tampered or legacy data — skip silently
    }
  }
  return null;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const manualAuthRouter = router({
  /**
   * Register a new user with email + password.
   * Issues a session cookie on success.
   */
  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Servicio temporalmente no disponible",
        });
      }

      // Check for duplicate email (user enumeration is acceptable at registration)
      const existing = await findUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ya existe una cuenta con ese correo electrónico",
        });
      }

      const [passwordHash, encryptedEmail] = await Promise.all([
        hashPassword(input.password),
        Promise.resolve(encryptEmail(input.email)),
      ]);

      const openId = buildEmailOpenId(input.email);

      await db.insert(users).values({
        openId,
        name: input.name,
        email: encryptedEmail,
        passwordHash,
        loginMethod: "email",
        role: "user",
        lastSignedIn: new Date(),
      });

      // Issue session JWT using the existing SDK session signing
      const token = await sdk.signSession(
        { openId, appId: "", name: input.name },
        { expiresInMs: 1000 * 60 * 60 * 24 * 30 }, // 30 days
      );
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

      return { success: true } as const;
    }),

  /**
   * Login with email + password.
   * Issues a session cookie on success.
   */
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ ctx, input }) => {
      // Generic error prevents user enumeration (OWASP A07)
      const GENERIC_ERROR = "Correo o contraseña incorrectos";

      const user = await findUserByEmail(input.email);

      if (!user || !user.passwordHash) {
        // Run bcrypt anyway to prevent timing attacks
        await verifyPassword("dummy_timing_prevention", "$2b$12$invalidhashfortimingprotection");
        throw new TRPCError({ code: "UNAUTHORIZED", message: GENERIC_ERROR });
      }

      const isValid = await verifyPassword(input.password, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: GENERIC_ERROR });
      }

      // Update last sign-in timestamp
      const db = await getDb();
      if (db) {
        await db
          .update(users)
          .set({ lastSignedIn: new Date() })
          .where(eq(users.id, user.id));
      }

      const token = await sdk.signSession(
        { openId: user.openId, appId: "", name: user.name ?? "" },
        { expiresInMs: 1000 * 60 * 60 * 24 * 30 },
      );
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

      return { success: true } as const;
    }),
});

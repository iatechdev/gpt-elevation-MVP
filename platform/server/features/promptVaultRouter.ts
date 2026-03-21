/**
 * promptVaultRouter — tRPC Router
 * HU-029 + HU-030: Backoffice prompt management endpoints
 *
 * ALL procedures use adminProcedure — any non-admin request
 * is rejected with 403 before the handler even runs.
 *
 * Mount this router in routers.ts under the 'admin' namespace:
 *   admin: router({ promptVault: promptVaultRouter })
 */

import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure } from "../infrastructure/adminGuard";
import {
  listPromptKeys,
  getPromptHistory,
  saveDraftPrompt,
  submitForReview,
  approvePromptVersion,
  rejectPromptVersion,
  rollbackToVersion,
  decryptPrompt,
} from "../infrastructure/promptVaultService";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { promptVersions } from "../../drizzle/schema";
import type { PromptKey } from "../../drizzle/schema";

const promptKeySchema = z.enum(["act_base", "crisis_protocol", "session_close", "welcome"]);

export const promptVaultRouter = router({
  /**
   * List all prompt keys with their active version summary.
   * Used by the backoffice sidebar.
   */
  list: adminProcedure.query(async () => {
    return listPromptKeys();
  }),

  /**
   * Get the decrypted content of the active version for a key.
   * Used when opening the prompt editor.
   */
  getActive: adminProcedure
    .input(z.object({ key: promptKeySchema }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [row] = await db
        .select()
        .from(promptVersions)
        .where(and(
          eq(promptVersions.promptKey, input.key),
          eq(promptVersions.status, "active")
        ))
        .limit(1);

      if (!row) return null;

      return {
        id: row.id,
        key: row.promptKey,
        version: row.version,
        status: row.status,
        plaintext: decryptPrompt(row.contentEncrypted), // decrypted in memory, never stored plain
        changeNote: row.changeNote,
        createdAt: row.createdAt,
        approvedAt: row.approvedAt,
      };
    }),

  /**
   * Get full version history for a prompt key (all statuses).
   * Used by the history panel in the editor.
   * NOTE: Returns metadata only — no decrypted content in the list.
   * Use getVersionContent to decrypt a specific version.
   */
  getHistory: adminProcedure
    .input(z.object({ key: promptKeySchema }))
    .query(async ({ input }) => {
      const history = await getPromptHistory(input.key as PromptKey);
      // Return metadata only — never return decrypted content in list views
      return history.map(row => ({
        id: row.id,
        key: row.promptKey,
        version: row.version,
        status: row.status,
        changeNote: row.changeNote,
        createdBy: row.createdBy,
        approvedBy: row.approvedBy,
        createdAt: row.createdAt,
        approvedAt: row.approvedAt,
      }));
    }),

  /**
   * Get the decrypted content of any specific version.
   * Used when comparing versions in the history panel.
   */
  getVersionContent: adminProcedure
    .input(z.object({ versionId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [row] = await db
        .select()
        .from(promptVersions)
        .where(eq(promptVersions.id, input.versionId))
        .limit(1);

      if (!row) return null;

      return {
        id: row.id,
        version: row.version,
        status: row.status,
        plaintext: decryptPrompt(row.contentEncrypted),
        changeNote: row.changeNote,
      };
    }),

  /**
   * Count versions in pending_review status.
   * Used for the badge in the backoffice navigation menu.
   */
  pendingCount: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return 0;
    const rows = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.status, "pending_review"));
    return rows.length;
  }),

  /**
   * Save a new draft version of a prompt.
   * The currently active prompt is NOT affected.
   */
  saveDraft: adminProcedure
    .input(z.object({
      key: promptKeySchema,
      plaintext: z.string().min(10, "El prompt no puede estar vac\u00edo"),
      changeNote: z.string().max(500).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await saveDraftPrompt(
        input.key as PromptKey,
        input.plaintext,
        ctx.user!.id,
        input.changeNote
      );
      return { id, message: "Borrador guardado correctamente" };
    }),

  /**
   * Submit a draft for review.
   * Moves status from 'draft' to 'pending_review'.
   */
  submitForReview: adminProcedure
    .input(z.object({ versionId: z.number() }))
    .mutation(async ({ input }) => {
      await submitForReview(input.versionId);
      return { message: "Cambio enviado para revisi\u00f3n" };
    }),

  /**
   * Approve a pending_review version.
   * Archives the current active version and activates this one.
   * Invalidates the server-side cache so the next conversation
   * picks up the new prompt immediately.
   */
  approve: adminProcedure
    .input(z.object({ versionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await approvePromptVersion(input.versionId, ctx.user!.id);
      return { message: "Prompt activado correctamente. Los pr\u00f3ximos chats usar\u00e1n el nuevo prompt." };
    }),

  /**
   * Reject a pending_review version with feedback.
   * Moves it back to draft so the author can iterate.
   */
  reject: adminProcedure
    .input(z.object({
      versionId: z.number(),
      feedback: z.string().min(1, "El feedback no puede estar vac\u00edo"),
    }))
    .mutation(async ({ input }) => {
      await rejectPromptVersion(input.versionId, input.feedback);
      return { message: "Versi\u00f3n rechazada. El autor puede ver el feedback y corregir." };
    }),

  /**
   * Rollback to a previously archived version.
   * Useful for emergency revert if a new prompt causes issues.
   */
  rollback: adminProcedure
    .input(z.object({ versionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await rollbackToVersion(input.versionId, ctx.user!.id);
      return { message: "Rollback exitoso. La versi\u00f3n anterior est\u00e1 activa nuevamente." };
    }),
});

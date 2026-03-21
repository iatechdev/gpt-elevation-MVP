/**
 * PromptVaultService — Infrastructure Layer
 * HU-028: Prompt Vault — encrypted prompt storage
 *
 * All AI prompts (system prompts, crisis protocol, etc.) are stored
 * encrypted in the database using AES-256-GCM. This service handles
 * encryption/decryption and provides a typed interface for the rest
 * of the server to read the active prompt for any given key.
 *
 * The plaintext of a prompt NEVER:
 *  - Lives in source code or git history
 *  - Gets written to logs
 *  - Leaves the server process
 *
 * Setup:
 *  Add PROMPT_ENCRYPTION_KEY to your .env file:
 *  PROMPT_ENCRYPTION_KEY=<64-char hex string>
 *  Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { promptVersions, type PromptKey, type PromptStatus } from "../../drizzle/schema";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV — optimal for GCM
const TAG_BYTES = 16;

// ─── In-memory cache ────────────────────────────────────────────────────────
// Avoids a DB round-trip on every chat message.
// Invalidated explicitly when a prompt is approved (see invalidateCache).
const _cache = new Map<PromptKey, { plaintext: string; version: number }>();

// ─── Key management ──────────────────────────────────────────────────────────
function getEncryptionKey(): Buffer {
  const hex = process.env.PROMPT_ENCRYPTION_KEY ?? "";
  if (hex.length !== 64) {
    throw new Error(
      "[PromptVault] PROMPT_ENCRYPTION_KEY must be a 64-char hex string (32 bytes).\n" +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Validates that PROMPT_ENCRYPTION_KEY is present and correctly sized.
 * Call this at server startup to fail fast if misconfigured.
 */
export function validatePromptVaultConfig(): void {
  getEncryptionKey(); // throws if invalid
}

// ─── Encryption / Decryption ─────────────────────────────────────────────────

/**
 * Encrypts a prompt string.
 * Returns "iv:authTag:ciphertext" (all hex-encoded).
 */
export function encryptPrompt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/**
 * Decrypts a prompt string previously encrypted with encryptPrompt.
 * Throws if the ciphertext has been tampered with (GCM auth failure).
 */
export function decryptPrompt(encryptedValue: string): string {
  const key = getEncryptionKey();
  const parts = encryptedValue.split(":");
  if (parts.length !== 3) throw new Error("[PromptVault] Invalid encrypted format — expected iv:authTag:ciphertext");

  const [ivHex, tagHex, ciphertextHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  if (iv.length !== IV_BYTES || authTag.length !== TAG_BYTES) {
    throw new Error("[PromptVault] Invalid encrypted format — wrong IV or tag length");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// ─── Cache invalidation ───────────────────────────────────────────────────────

/**
 * Removes a specific key from the in-memory cache.
 * Call this after approving a new prompt version so the next
 * conversation picks up the updated prompt immediately.
 */
export function invalidatePromptCache(key: PromptKey): void {
  _cache.delete(key);
}

/**
 * Clears the entire prompt cache. Useful for testing or after bulk changes.
 */
export function clearPromptCache(): void {
  _cache.clear();
}

// ─── Active prompt reader ─────────────────────────────────────────────────────

/**
 * Returns the decrypted plaintext of the currently active prompt for the given key.
 * Results are cached in memory until invalidatePromptCache(key) is called.
 *
 * Returns null if no active prompt exists for that key yet.
 * The caller should fall back to the hardcoded default (elevation-act-prompt.ts)
 * during the migration period.
 */
export async function getActivePrompt(key: PromptKey): Promise<string | null> {
  // 1. Check cache first
  const cached = _cache.get(key);
  if (cached) return cached.plaintext;

  // 2. Query DB for active version
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(promptVersions)
    .where(and(eq(promptVersions.promptKey, key), eq(promptVersions.status, "active")))
    .limit(1);

  if (!rows[0]) return null;

  // 3. Decrypt and cache
  const plaintext = decryptPrompt(rows[0].contentEncrypted);
  _cache.set(key, { plaintext, version: rows[0].version });
  return plaintext;
}

// ─── Vault write operations ───────────────────────────────────────────────────
// These are called by the tRPC promptVault router (admin only)

/**
 * Saves a new draft version of a prompt.
 * Does NOT affect the currently active prompt.
 */
export async function saveDraftPrompt(
  key: PromptKey,
  plaintext: string,
  createdBy: number,
  changeNote?: string
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("[PromptVault] Database unavailable");

  // Get next version number for this key
  const existing = await db
    .select({ version: promptVersions.version })
    .from(promptVersions)
    .where(eq(promptVersions.promptKey, key))
    .orderBy(promptVersions.version);

  const nextVersion = existing.length > 0
    ? Math.max(...existing.map(r => r.version)) + 1
    : 1;

  const contentEncrypted = encryptPrompt(plaintext);
  const [result] = await db.insert(promptVersions).values({
    promptKey: key,
    contentEncrypted,
    version: nextVersion,
    status: "draft",
    changeNote: changeNote ?? null,
    createdBy,
  }).$returningId();

  return result.id;
}

/**
 * Moves a draft to pending_review.
 * The prompt is now visible to approvers but still not active.
 */
export async function submitForReview(versionId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("[PromptVault] Database unavailable");
  await db
    .update(promptVersions)
    .set({ status: "pending_review" })
    .where(and(eq(promptVersions.id, versionId), eq(promptVersions.status, "draft")));
}

/**
 * Approves a pending_review version:
 *  1. Archives the currently active version (if any)
 *  2. Activates the approved version
 *  3. Invalidates the in-memory cache for that key
 */
export async function approvePromptVersion(
  versionId: number,
  approvedBy: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("[PromptVault] Database unavailable");

  // Get the version being approved
  const [target] = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.id, versionId))
    .limit(1);

  if (!target) throw new Error("[PromptVault] Version not found");
  if (target.status !== "pending_review") {
    throw new Error("[PromptVault] Only pending_review versions can be approved");
  }

  // Archive the current active version for this key
  await db
    .update(promptVersions)
    .set({ status: "archived" })
    .where(and(
      eq(promptVersions.promptKey, target.promptKey),
      eq(promptVersions.status, "active")
    ));

  // Activate the approved version
  await db
    .update(promptVersions)
    .set({ status: "active", approvedBy, approvedAt: new Date() })
    .where(eq(promptVersions.id, versionId));

  // Invalidate cache so next conversation uses the new prompt
  invalidatePromptCache(target.promptKey as PromptKey);
}

/**
 * Rejects a pending_review version with optional feedback.
 * Moves it back to draft so the author can iterate.
 */
export async function rejectPromptVersion(
  versionId: number,
  feedback: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("[PromptVault] Database unavailable");
  await db
    .update(promptVersions)
    .set({ status: "draft", changeNote: feedback })
    .where(and(eq(promptVersions.id, versionId), eq(promptVersions.status, "pending_review")));
}

/**
 * Rolls back to a previously archived version:
 *  1. Archives the current active version
 *  2. Activates the specified archived version
 *  3. Invalidates cache
 */
export async function rollbackToVersion(
  versionId: number,
  approvedBy: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("[PromptVault] Database unavailable");

  const [target] = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.id, versionId))
    .limit(1);

  if (!target) throw new Error("[PromptVault] Version not found");
  if (target.status !== "archived") {
    throw new Error("[PromptVault] Only archived versions can be rolled back to");
  }

  // Archive current active
  await db
    .update(promptVersions)
    .set({ status: "archived" })
    .where(and(
      eq(promptVersions.promptKey, target.promptKey),
      eq(promptVersions.status, "active")
    ));

  // Activate the rollback target
  await db
    .update(promptVersions)
    .set({ status: "active", approvedBy, approvedAt: new Date() })
    .where(eq(promptVersions.id, versionId));

  invalidatePromptCache(target.promptKey as PromptKey);
}

/**
 * Returns the full version history for a given prompt key.
 * Used by the backoffice to display the history panel.
 */
export async function getPromptHistory(key: PromptKey) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.promptKey, key))
    .orderBy(promptVersions.version);
}

/**
 * Returns all prompt keys with their current active version summary.
 * Used by the backoffice sidebar list.
 */
export async function listPromptKeys() {
  const db = await getDb();
  if (!db) return [];

  const KEYS: PromptKey[] = ["act_base", "crisis_protocol", "session_close", "welcome"];
  const results = [];

  for (const key of KEYS) {
    const rows = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.promptKey, key))
      .orderBy(promptVersions.version);

    const active = rows.find(r => r.status === "active");
    const pendingCount = rows.filter(r => r.status === "pending_review").length;

    results.push({
      key,
      activeVersion: active?.version ?? null,
      status: active?.status ?? "no_active",
      pendingReviewCount: pendingCount,
      totalVersions: rows.length,
      lastUpdated: active?.approvedAt ?? active?.createdAt ?? null,
    });
  }

  return results;
}

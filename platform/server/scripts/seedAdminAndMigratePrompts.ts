/**
 * Seed Script: Admin user + Prompt migration
 * HU-027 + HU-028
 *
 * What this does:
 *  1. Sets the user defined by ADMIN_SEED_OPENID to role='admin'
 *  2. Migrates the existing ACT prompt from elevation-act-prompt.ts
 *     into the Prompt Vault (encrypted in DB) as the first active version
 *
 * Run ONCE after applying migration 0003_prompt_vault.sql:
 *   pnpm tsx platform/server/scripts/seedAdminAndMigratePrompts.ts
 *
 * Required env vars:
 *   DATABASE_URL
 *   PROMPT_ENCRYPTION_KEY   (64-char hex)
 *   ADMIN_SEED_OPENID       (the openId of Alejo's account in the DB)
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import {
  validatePromptVaultConfig,
  encryptPrompt,
} from "../infrastructure/promptVaultService";
import { promptVersions } from "../../drizzle/schema";

// The current ACT prompt content — read from the existing file at migration time.
// After migration, the file is kept as reference but the DB version is authoritative.
import { buildActPrompt } from "../elevation-act-prompt";

async function main() {
  console.log("[Seed] Starting admin seed and prompt migration...");

  // Validate config first — fail fast if env vars are missing
  validatePromptVaultConfig();

  const adminOpenId = process.env.ADMIN_SEED_OPENID;
  if (!adminOpenId) {
    throw new Error("ADMIN_SEED_OPENID env var is required");
  }

  const db = await getDb();
  if (!db) throw new Error("[Seed] Database unavailable");

  // ─── Step 1: Set admin role ────────────────────────────────────────────────
  const [adminUser] = await db
    .select()
    .from(users)
    .where(eq(users.openId, adminOpenId))
    .limit(1);

  if (!adminUser) {
    throw new Error(`[Seed] User with openId '${adminOpenId}' not found. Make sure Alejo has logged in at least once.`);
  }

  await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.openId, adminOpenId));

  console.log(`[Seed] User ${adminUser.name ?? adminOpenId} → role set to 'admin'`);

  // ─── Step 2: Migrate ACT base prompt ──────────────────────────────────────
  // Check if act_base already has an active version (idempotent)
  const existing = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.promptKey, "act_base"))
    .limit(1);

  if (existing.length > 0) {
    console.log("[Seed] act_base prompt already exists in vault — skipping migration.");
  } else {
    // Build the prompt with placeholder context (migration snapshot)
    const promptPlaintext = buildActPrompt({
      userName: "{{USER_NAME}}",
      communicationStyle: "empathetic",
      personalGoals: null,
    });

    const contentEncrypted = encryptPrompt(promptPlaintext);

    await db.insert(promptVersions).values({
      promptKey: "act_base",
      contentEncrypted,
      version: 1,
      status: "active",
      changeNote: "Migraci\u00f3n inicial desde elevation-act-prompt.ts",
      createdBy: adminUser.id,
      approvedBy: adminUser.id,
      approvedAt: new Date(),
    });

    console.log("[Seed] act_base prompt migrated to Prompt Vault successfully.");
  }

  console.log("[Seed] Done. Prompt Vault is ready.");
  process.exit(0);
}

main().catch(err => {
  console.error("[Seed] Fatal error:", err);
  process.exit(1);
});

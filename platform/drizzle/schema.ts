import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  smallint,
  json,
} from "drizzle-orm/mysql-core";

// ─── Core Users Table ───────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
  consentVersion: varchar("consentVersion", { length: 20 }),
  consentTimestamp: timestamp("consentTimestamp"),
  dataRetentionDays: int("dataRetentionDays").default(365),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// ─── User Profiles ──────────────────────────────────────────────────────────
export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  communicationStyle: mysqlEnum("communicationStyle", [
    "empathetic",
    "direct",
    "analytical",
    "creative",
  ]).default("empathetic"),
  notificationFrequency: mysqlEnum("notificationFrequency", [
    "daily",
    "weekly",
    "none",
  ]).default("none"),
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  language: varchar("language", { length: 10 }).default("es"),
  personalGoals: text("personalGoals"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Consent Log ─────────────────────────────────────────────────────────────
export const consentLog = mysqlTable("consent_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  consentType: varchar("consentType", { length: 50 }).notNull(),
  granted: boolean("granted").notNull(),
  version: varchar("version", { length: 20 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// ─── Sessions ─────────────────────────────────────────────────────────────────
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  channel: mysqlEnum("channel", ["web", "telegram", "mobile"]).default("web"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  moodPre: smallint("moodPre"),
  moodPost: smallint("moodPost"),
  messageCount: int("messageCount").default(0),
  durationSeconds: int("durationSeconds"),
  crisisTriggered: boolean("crisisTriggered").default(false),
});

// ─── Messages ─────────────────────────────────────────────────────────────────
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  tokensUsed: int("tokensUsed"),
  flaggedForReview: boolean("flaggedForReview").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Reflections ──────────────────────────────────────────────────────────────
export const reflections = mysqlTable("reflections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sessionId: int("sessionId"),
  title: varchar("title", { length: 200 }),
  content: text("content").notNull(),
  tags: json("tags").$type<string[]>().default([]),
  isPinned: boolean("isPinned").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Crisis Flags ─────────────────────────────────────────────────────────────
export const crisisFlags = mysqlTable("crisis_flags", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  userId: int("userId").notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high"]).notNull(),
  resourceShown: varchar("resourceShown", { length: 200 }),
  acknowledgedAt: timestamp("acknowledgedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Reminders ────────────────────────────────────────────────────────────────
export const reminders = mysqlTable("reminders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  label: varchar("label", { length: 100 }).notNull().default("Momento de reflexi\u00f3n"),
  message: text("message"),
  timeOfDay: varchar("timeOfDay", { length: 5 }).notNull(),
  daysOfWeek: json("daysOfWeek").$type<number[]>().notNull().default([1, 3, 5]),
  isActive: boolean("isActive").default(true).notNull(),
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Prompt Vault (HU-028) ────────────────────────────────────────────────────
// Stores all AI prompts encrypted at rest with AES-256-GCM.
// Prompts are NEVER stored in plaintext. Never in code. Never in .env.
// The server decrypts in memory only when needed to serve a conversation.
//
// Prompt keys (promptKey field):
//   'act_base'         → Main ACT system prompt (Hexaflex)
//   'crisis_protocol'  → Crisis detection and response protocol
//   'session_close'    → Ritual session-closing phrase generation
//   'welcome'          → First-time user welcome message
export const promptVersions = mysqlTable("prompt_versions", {
  id: int("id").autoincrement().primaryKey(),

  // Logical name of the prompt (e.g. 'act_base', 'crisis_protocol')
  promptKey: varchar("promptKey", { length: 50 }).notNull(),

  // Encrypted content: "iv:authTag:ciphertext" (all hex) — AES-256-GCM
  // Use PROMPT_ENCRYPTION_KEY env var (64-char hex = 32 bytes)
  contentEncrypted: text("contentEncrypted").notNull(),

  // Auto-incremented per promptKey to track evolution
  version: int("version").notNull().default(1),

  // Lifecycle: draft → pending_review → active → archived
  status: mysqlEnum("status", ["draft", "pending_review", "active", "archived"])
    .notNull()
    .default("draft"),

  // Optional note describing what changed and why
  changeNote: varchar("changeNote", { length: 500 }),

  // Who created and who approved (both must be admin users)
  createdBy: int("createdBy").notNull(),
  approvedBy: int("approvedBy"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  approvedAt: timestamp("approvedAt"),
});

// ─── Types ───────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type ConsentLog = typeof consentLog.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Reflection = typeof reflections.$inferSelect;
export type CrisisFlag = typeof crisisFlags.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type InsertReminder = typeof reminders.$inferInsert;
export type PromptVersion = typeof promptVersions.$inferSelect;
export type InsertPromptVersion = typeof promptVersions.$inferInsert;
export type PromptStatus = "draft" | "pending_review" | "active" | "archived";
export type PromptKey = "act_base" | "crisis_protocol" | "session_close" | "welcome";

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
  // Bcrypt hash for manual email+password auth. NULL for OAuth users.
  // NEVER store plaintext passwords. OWASP A02.
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Onboarding state
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
  consentVersion: varchar("consentVersion", { length: 20 }),
  consentTimestamp: timestamp("consentTimestamp"),
  // Data retention preference (days): 30, 90, 365, or 0 = indefinite
  dataRetentionDays: int("dataRetentionDays").default(365),
  // Soft delete for right to erasure
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// ─── User Profiles (Non-sensitive preferences) ──────────────────────────────
export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Communication style preference
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
  // Personal goals (optional, user-provided)
  personalGoals: text("personalGoals"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Consent Log (Granular consent audit trail) ──────────────────────────────
export const consentLog = mysqlTable("consent_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Types: privacy_policy, ai_interaction, session_data, research, notifications
  consentType: varchar("consentType", { length: 50 }).notNull(),
  granted: boolean("granted").notNull(),
  version: varchar("version", { length: 20 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// ─── Sessions (Pseudonymized interaction metadata) ───────────────────────────
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  channel: mysqlEnum("channel", ["web", "telegram", "mobile"]).default("web"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  // Optional mood tracking (1=very low, 5=very high) - user chooses to share
  moodPre: smallint("moodPre"),
  moodPost: smallint("moodPost"),
  messageCount: int("messageCount").default(0),
  durationSeconds: int("durationSeconds"),
  // Crisis flag: was a crisis protocol triggered?
  crisisTriggered: boolean("crisisTriggered").default(false),
});

// ─── Messages (Encrypted conversation content) ───────────────────────────────
// NOTE: In production, content should be encrypted at application level before storage
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  // Content stored as text; in production encrypt with AES-256 before insert
  content: text("content").notNull(),
  tokensUsed: int("tokensUsed"),
  // Flag if crisis keywords detected
  flaggedForReview: boolean("flaggedForReview").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Reflections (User-saved insights with tags) ─────────────────────────────
export const reflections = mysqlTable("reflections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sessionId: int("sessionId"),
  title: varchar("title", { length: 200 }),
  content: text("content").notNull(),
  // JSON array of tags e.g. ["ansiedad", "trabajo", "relaciones"]
  tags: json("tags").$type<string[]>().default([]),
  isPinned: boolean("isPinned").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Crisis Flags (Restricted access, anonymized) ────────────────────────────
export const crisisFlags = mysqlTable("crisis_flags", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  userId: int("userId").notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high"]).notNull(),
  // Which resource was shown (not the user's message content)
  resourceShown: varchar("resourceShown", { length: 200 }),
  acknowledgedAt: timestamp("acknowledgedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Reminders (Practice scheduling) ───────────────────────────────────────
export const reminders = mysqlTable("reminders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Label for the reminder
  label: varchar("label", { length: 100 }).notNull().default("Momento de reflexión"),
  // Custom message shown in the notification
  message: text("message"),
  // Time of day in HH:MM format (24h, user's local time)
  timeOfDay: varchar("timeOfDay", { length: 5 }).notNull(),
  // JSON array of weekday numbers: 0=Sun, 1=Mon, ..., 6=Sat
  daysOfWeek: json("daysOfWeek").$type<number[]>().notNull().default([1, 3, 5]),
  isActive: boolean("isActive").default(true).notNull(),
  // Timezone for scheduling
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  // Last time this reminder was triggered
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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

import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { buildSystemPrompt as buildACTPrompt } from "./elevation-act-prompt";
import { manualAuthRouter } from "./features/auth/manualAuthRouter";
import { detectCrisis as detectCrisisDomain } from "./domain/crisisDetector";
import { anonymizeForLLM as anonymizePII } from "./domain/piiAnonymizer";
import {
  completeOnboarding,
  createCrisisFlag,
  createReflection,
  createSession,
  deleteReflection,
  deleteUserData,
  endSession,
  exportUserData,
  getUserById,
  getUserConsents,
  getUserInsights,
  getUserProfile,
  getUserReflections,
  getUserSessions,
  getSessionMessages,
  logConsent,
  saveMessage,
  updateReflection,
  updateSessionMessageCount,
  upsertUserProfile,
  // Reminders
  getUserReminders,
  createReminder,
  updateReminder,
  deleteReminder,
} from "./db";

// ─── Domain services (imported from domain layer) ────────────────────────────
// Crisis detection and PII anonymization are now in dedicated domain modules.
// These thin wrappers maintain backward compatibility with existing router code.
function detectCrisis(text: string) {
  return detectCrisisDomain(text);
}
function anonymizeForLLM(text: string): string {
  return anonymizePII(text).anonymizedText;
}

// ─── ACT System Prompt ────────────────────────────────────────────────────────
// buildACTPrompt imported from ./elevation-act-prompt.ts
export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    // Manual email+password auth (OWASP A02, A07)
    manual: manualAuthRouter,
  }),

  // ─── Onboarding ────────────────────────────────────────────────────────────
  onboarding: router({
    complete: protectedProcedure
      .input(z.object({
        consents: z.record(z.string(), z.boolean()),
        communicationStyle: z.enum(["empathetic", "direct", "analytical", "creative"]).optional(),
        personalGoals: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        const version = "1.0";
        // Log each consent type
        for (const [type, grantedVal] of Object.entries(input.consents)) {
          await logConsent(userId, type, Boolean(grantedVal), version);
        }
        // Save profile preferences
        await upsertUserProfile(userId, {
          communicationStyle: input.communicationStyle ?? "empathetic",
          personalGoals: input.personalGoals,
        });
        // Mark onboarding complete
        await completeOnboarding(userId, version);
        return { success: true };
      }),
  }),

  // ─── Profile ───────────────────────────────────────────────────────────────
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const [user, profile, consents] = await Promise.all([
        getUserById(ctx.user.id),
        getUserProfile(ctx.user.id),
        getUserConsents(ctx.user.id),
      ]);
      return { user, profile, consents };
    }),
    update: protectedProcedure
      .input(z.object({
        communicationStyle: z.enum(["empathetic", "direct", "analytical", "creative"]).optional(),
        notificationFrequency: z.enum(["daily", "weekly", "none"]).optional(),
        personalGoals: z.string().max(500).optional(),
        timezone: z.string().max(50).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await upsertUserProfile(ctx.user.id, input);
        return { success: true };
      }),
    updateConsent: protectedProcedure
      .input(z.object({ consentType: z.string(), granted: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await logConsent(ctx.user.id, input.consentType, input.granted, "1.0");
        return { success: true };
      }),
    exportData: protectedProcedure.mutation(async ({ ctx }) => {
      const data = await exportUserData(ctx.user.id);
      return data;
    }),
    deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
      await deleteUserData(ctx.user.id);
      return { success: true };
    }),
  }),

  // ─── Chat / Sessions ───────────────────────────────────────────────────────
  chat: router({
    startSession: protectedProcedure
      .input(z.object({ moodPre: z.number().min(1).max(5).optional() }))
      .mutation(async ({ ctx, input }) => {
        const sessionId = await createSession(ctx.user.id, input.moodPre);
        return { sessionId };
      }),

    endSession: protectedProcedure
      .input(z.object({ sessionId: z.number(), moodPost: z.number().min(1).max(5).optional() }))
      .mutation(async ({ ctx, input }) => {
        await endSession(input.sessionId, input.moodPost);
        return { success: true };
      }),

    getHistory: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const msgs = await getSessionMessages(input.sessionId);
        return msgs;
      }),

    sendMessage: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        message: z.string().min(1).max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;

        // 1. Crisis detection BEFORE sending to LLM
        const crisis = detectCrisis(input.message);
        if (crisis.severity === "high") {
          await saveMessage(input.sessionId, userId, "user", input.message, 0, true);
          await createCrisisFlag(input.sessionId, userId, "high", crisis.resource);
          const crisisResponse = `Noto que estás pasando por un momento muy difícil. Quiero que sepas que no estás solo/a, y que hay personas preparadas para acompañarte ahora mismo.\n\n**Línea de crisis disponible 24/7:**\n${crisis.resource}\n\nPor favor, comunícate con ellos. Tu bienestar importa profundamente.`;
          await saveMessage(input.sessionId, userId, "assistant", crisisResponse, 0, false);
          return { response: crisisResponse, crisis: true, crisisResource: crisis.resource };
        }

        // 2. Anonymize before sending to LLM
        const anonymizedMessage = anonymizeForLLM(input.message);

        // 3. Get conversation history + user context for ACT prompt
        const history = await getSessionMessages(input.sessionId);
        const profile = await getUserProfile(userId);
        const userSessions = await getUserSessions(userId, 50);
        const userReflections = await getUserReflections(userId);
        // Extract recent themes from reflection tags
        const recentThemes = userReflections
          .slice(0, 10)
          .flatMap((r) => (Array.isArray(r.tags) ? (r.tags as string[]) : []))
          .filter((t, i, arr) => arr.indexOf(t) === i)
          .slice(0, 5);
        // Build ACT-based system prompt with user context
        const systemPrompt = buildACTPrompt({
          name: ctx.user.name ?? null,
          moodBefore: null, // moodPre is on the session; we use the history mood if available
          sessionCount: userSessions.length,
          recentThemes,
        });

        // 4. Call LLM (server-side only, API key never exposed to client)
        const llmMessages: import("./_core/llm").Message[] = [
          { role: "system", content: systemPrompt },
          ...history.slice(-8).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "user", content: anonymizedMessage },
        ];
        const llmResponse = await invokeLLM({ messages: llmMessages });

        const rawContent = llmResponse.choices[0]?.message?.content;
        const assistantContent: string = typeof rawContent === "string" ? rawContent : "Estoy aquí contigo. ¿Puedes contarme más?";
        const tokensUsed = llmResponse.usage?.total_tokens ?? 0;

        // 5. Save both messages
        await saveMessage(input.sessionId, userId, "user", input.message, 0, false);
        await saveMessage(input.sessionId, userId, "assistant", assistantContent, tokensUsed, false);

        // 6. Update session message count
        const updatedHistory = await getSessionMessages(input.sessionId);
        await updateSessionMessageCount(input.sessionId, updatedHistory.length);

        // 7. Medium crisis: add resource note but continue conversation
        if (crisis.severity === "medium") {
          await createCrisisFlag(input.sessionId, userId, "medium", crisis.resource);
          return {
            response: assistantContent,
            crisis: false,
            supportNote: `Si en algún momento necesitas apoyo inmediato: ${crisis.resource}`,
          };
        }

        return { response: assistantContent, crisis: false };
      }),
  }),

  // ─── Sessions History ──────────────────────────────────────────────────────
  sessions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserSessions(ctx.user.id, 20);
    }),
  }),

  // ─── Reflections ───────────────────────────────────────────────────────────
  reflections: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserReflections(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        content: z.string().min(1).max(5000),
        title: z.string().max(200).optional(),
        tags: z.array(z.string()).max(10).optional(),
        sessionId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createReflection(
          ctx.user.id,
          input.content,
          input.title,
          input.tags,
          input.sessionId,
        );
        return { id };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        content: z.string().min(1).max(5000).optional(),
        title: z.string().max(200).optional(),
        tags: z.array(z.string()).max(10).optional(),
        isPinned: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateReflection(id, ctx.user.id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteReflection(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Insights ──────────────────────────────────────────────────────────────────
  insights: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getUserInsights(ctx.user.id);
    }),
  }),

  // ─── Reminders ───────────────────────────────────────────────────────────────
  reminders: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserReminders(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        label: z.string().min(1).max(100).default("Momento de reflexión"),
        message: z.string().max(300).optional(),
        timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:MM requerido"),
        daysOfWeek: z.array(z.number().min(0).max(6)).min(1).max(7),
        timezone: z.string().max(50).default("UTC"),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createReminder({
          userId: ctx.user.id,
          label: input.label,
          message: input.message ?? null,
          timeOfDay: input.timeOfDay,
          daysOfWeek: input.daysOfWeek,
          timezone: input.timezone,
          isActive: true,
        });
        return { id, success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        label: z.string().min(1).max(100).optional(),
        message: z.string().max(300).optional(),
        timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
        daysOfWeek: z.array(z.number().min(0).max(6)).min(1).max(7).optional(),
        isActive: z.boolean().optional(),
        timezone: z.string().max(50).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateReminder(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteReminder(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Session Close (Ritual de Cierre) ───────────────────────────────────────────────────────────────────────────────────
  sessionClose: router({
    close: protectedProcedure
      .input(z.object({
        sessionId: z.number().int().positive(),
        moodPost: z.number().int().min(1).max(5),
        moodPre: z.number().int().min(1).max(5).optional(),
        messageCount: z.number().int().min(0).default(0),
        topThemes: z.array(z.string()).max(5).default([]),
      }))
      .mutation(async ({ ctx, input }) => {
        // 1. Persist session end with moodPost
        await endSession(input.sessionId, input.moodPost);

        // 2. Calculate mood delta
        const moodDelta = input.moodPre != null ? input.moodPost - input.moodPre : null;

        // 3. Generate ACT closing phrase via LLM
        const moodLabels: Record<number, string> = {
          1: "muy bajo, con mucho peso",
          2: "bajo, con cansancio o tristeza",
          3: "neutro, en proceso",
          4: "bien, con más ligereza",
          5: "muy bien, con energía y claridad",
        };
        const moodPreLabel = input.moodPre != null ? moodLabels[input.moodPre] ?? "desconocido" : null;
        const moodPostLabel = moodLabels[input.moodPost] ?? "desconocido";
        const themesText = input.topThemes.length > 0
          ? `Los temas que surgieron en la conversación fueron: ${input.topThemes.join(", ")}.`
          : "";
        const deltaText = moodDelta != null
          ? moodDelta > 0
            ? `El estado emocional mejoró ${moodDelta} punto${moodDelta !== 1 ? "s" : ""} durante la sesión.`
            : moodDelta < 0
            ? `El estado emocional bajó ${Math.abs(moodDelta)} punto${Math.abs(moodDelta) !== 1 ? "s" : ""} durante la sesión (lo cual puede ser parte del proceso de contactar con emociones difíciles).`
            : "El estado emocional se mantuvo estable durante la sesión."
          : "";

        const closingPrompt = `Eres Elevation, un acompañante de bienestar emocional basado en Terapia de Aceptación y Compromiso (ACT).

El usuario acaba de terminar una sesión de reflexión. Estos son los datos del cierre:
- Estado emocional al inicio: ${moodPreLabel ?? "no registrado"}
- Estado emocional al final: ${moodPostLabel}
- Mensajes intercambiados: ${input.messageCount}
${deltaText}
${themesText}

Escribe UNA sola frase de cierre para esta sesión. La frase debe:
1. Reconocer el esfuerzo de haber estado presente
2. Conectar con lo que emergió en la sesión (sin repetir los datos literalmente)
3. Dejar una semilla de reflexión o una invitación suave para el camino
4. Ser cálida, breve (máximo 3 oraciones) y en segunda persona (tú)
5. NO usar negritas, listas ni markdown
6. Sonar como el cierre de un ritual, no como un resumen de datos

Escribe solo la frase, sin encabezados ni explicaciones.`;

        let closingPhrase = "Gracias por este tiempo contigo mismo. Lo que emergió hoy tiene su propio valor, aunque aún no puedas verlo del todo. Sigue caminando con curiosidad.";
        try {
          const llmResponse = await invokeLLM({
            messages: [
              { role: "system", content: closingPrompt },
              { role: "user", content: "Genera la frase de cierre." },
            ],
          });
          const generated = llmResponse?.choices?.[0]?.message?.content;
          if (typeof generated === "string" && generated.trim().length > 10) {
            closingPhrase = generated.trim();
          }
        } catch {
          // Fallback to default phrase if LLM fails
        }

        return {
          closingPhrase,
          moodPre: input.moodPre ?? null,
          moodPost: input.moodPost,
          moodDelta,
          messageCount: input.messageCount,
          sessionId: input.sessionId,
        };
      }),
  }),

  // ─── Export ───────────────────────────────────────────────────────────────────
  export: router({
    reflections: protectedProcedure
      .input(z.object({
        format: z.enum(["csv", "pdf"]),
        dateFrom: z.string().optional(), // ISO date string
        dateTo: z.string().optional(),
        includeTags: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const allReflections = await getUserReflections(ctx.user.id);

        // Apply optional date filters
        const filtered = allReflections.filter((r) => {
          const d = new Date(r.createdAt);
          if (input.dateFrom && d < new Date(input.dateFrom)) return false;
          if (input.dateTo && d > new Date(input.dateTo)) return false;
          return true;
        });

        if (input.format === "csv") {
          // Build CSV manually (no external dep needed)
          const header = ["Fecha", "Título", "Contenido", ...(input.includeTags ? ["Etiquetas"] : [])].join(",");
          const rows = filtered.map((r) => {
            const fecha = new Date(r.createdAt).toLocaleDateString("es-ES", { year: "numeric", month: "2-digit", day: "2-digit" });
            const titulo = `"${(r.title ?? "Sin título").replace(/"/g, '""')}"`;
            const contenido = `"${(r.content ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
            const tags = input.includeTags ? `"${(Array.isArray(r.tags) ? (r.tags as string[]).join(", ") : "")}"` : null;
            return [fecha, titulo, contenido, ...(tags ? [tags] : [])].join(",");
          });
          const csv = [header, ...rows].join("\n");
          return { format: "csv" as const, data: csv, count: filtered.length };
        }

        // PDF: return structured data; client renders with jsPDF
        const user = await getUserById(ctx.user.id);
        return {
          format: "pdf" as const,
          data: null,
          count: filtered.length,
          pdfPayload: {
            userName: user?.name ?? "Usuario",
            exportedAt: new Date().toISOString(),
            reflections: filtered.map((r) => ({
              id: r.id,
              title: r.title ?? "Sin título",
              content: r.content,
              tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
              isPinned: r.isPinned ?? false,
              createdAt: new Date(r.createdAt).toLocaleDateString("es-ES", {
                year: "numeric", month: "long", day: "numeric",
              }),
            })),
          },
        };
      }),
  }),
});
export type AppRouter = typeof appRouter;
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  activities,
  activityCompletions,
  quickNotes,
  studySessions,
  subjects,
  weeklyGoals,
} from "../drizzle/schema";
import { getDb } from "./db";
import { getAchievementsForUser, recalculateAchievements } from "./services/achievements";
import { accountIdForEmail, allowAuthAttempt, allowAuthAttemptGlobal, establishSession, hashPassword, isAdminBootstrapConfigured, isPublicSignupEnabled, normalizeEmail, revokeCurrentSession, toPublicUser, verifyAdminBootstrapCode, verifyPasswordForLogin } from "./_core/localAuth";
import { createLocalUser, getUserByEmail, setLastSignedIn, setPasswordForExistingUser } from "./db";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";

const activityType = z.enum(["tarefa", "prova", "trabalho", "projeto"]);
const priority = z.enum(["baixa", "media", "alta"]);
const activityStatus = z.enum(["pendente", "em_andamento", "concluida"]);

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  }
  return db;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function weekStartKey() {
  const value = startOfToday();
  const weekday = value.getDay();
  value.setDate(value.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return dateKey(value);
}

const subjectInput = z.object({
  name: z.string().trim().min(2).max(120),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  teacher: z.string().trim().max(120).optional().nullable(),
  schedule: z.string().trim().max(160).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
});

const activityInput = z.object({
  subjectId: z.number().int().positive(),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(5000).optional().nullable(),
  type: activityType,
  priority,
  status: activityStatus,
  dueDate: z.date().optional().nullable(),
  resourceUrl: z.union([z.string().url().max(2048), z.literal("")]).optional().nullable(),
  estimatedMinutes: z.number().int().min(5).max(1440),
});

async function activityList(db: Awaited<ReturnType<typeof databaseOrThrow>>, userId: number) {
  const rows = await db
    .select({ activity: activities, subject: subjects })
    .from(activities)
    .innerJoin(subjects, eq(activities.subjectId, subjects.id))
    .orderBy(asc(activities.dueDate), desc(activities.createdAt));
  const completions = await db
    .select({ activityId: activityCompletions.activityId, completedAt: activityCompletions.completedAt })
    .from(activityCompletions)
    .where(eq(activityCompletions.userId, userId));
  const completionByActivity = new Map(completions.map(item => [item.activityId, item.completedAt]));

  return rows.map(({ activity, subject }) => ({
    ...activity,
    subject,
    completed: completionByActivity.has(activity.id),
    completedAt: completionByActivity.get(activity.id) ?? null,
  }));
}

async function dashboardData(db: Awaited<ReturnType<typeof databaseOrThrow>>, userId: number) {
  const [items, sessions] = await Promise.all([
    activityList(db, userId),
    db
      .select({ durationMinutes: studySessions.durationMinutes, completedAt: studySessions.completedAt })
      .from(studySessions)
      .where(eq(studySessions.userId, userId))
      .orderBy(asc(studySessions.completedAt)),
  ]);
  const today = startOfToday();
  const completed = items.filter(item => item.completed);
  const pending = items.filter(item => !item.completed);
  const overdue = pending.filter(item => item.dueDate && item.dueDate < today);
  const upcoming = pending
    .filter(item => item.dueDate)
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
    .slice(0, 5);
  const subjectProgress = [...new Map(items.map(item => [item.subject.id, item.subject])).values()].map(subject => {
    const subjectItems = items.filter(item => item.subjectId === subject.id);
    const done = subjectItems.filter(item => item.completed).length;
    return { ...subject, total: subjectItems.length, completed: done, progress: subjectItems.length ? Math.round((done / subjectItems.length) * 100) : 0 };
  });
  const dailyKeys = Array.from({ length: 7 }, (_, index) => {
    const date = startOfToday();
    date.setDate(date.getDate() - (6 - index));
    return dateKey(date);
  });
  const weekdayLabel = (date: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(`${date}T12:00:00`)).replace(".", "");

  return {
    summary: { total: items.length, completed: completed.length, pending: pending.length, overdue: overdue.length, progress: items.length ? Math.round((completed.length / items.length) * 100) : 0 },
    upcoming,
    subjectProgress,
    completionSeries: dailyKeys.map(date => ({ date, label: weekdayLabel(date), concluídas: completed.filter(item => item.completedAt && dateKey(item.completedAt) === date).length })),
    studySeries: dailyKeys.map(date => ({ date, label: weekdayLabel(date), horas: Number((sessions.filter(session => dateKey(session.completedAt) === date).reduce((sum, session) => sum + session.durationMinutes, 0) / 60).toFixed(1)) })),
    activityDistribution: subjectProgress.map(subject => ({ name: subject.name, value: subject.total, color: subject.color })),
  };
}

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => toPublicUser(opts.ctx.user)),
    signupStatus: publicProcedure.query(() => ({ enabled: isPublicSignupEnabled() })),
    register: publicProcedure
      .input(z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(320), password: z.string().min(10).max(128), adminCode: z.string().max(256).optional() }))
      .mutation(async ({ ctx, input }) => {
        const signupEmailBucket = `register:${accountIdForEmail(normalizeEmail(input.email))}`;
        if (!(await allowAuthAttempt(ctx.req, "register", 50, 60 * 60 * 1000))
          || !(await allowAuthAttemptGlobal(signupEmailBucket, 5, 60 * 60 * 1000))) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas de cadastro. Tente novamente mais tarde." });
        }
        const email = normalizeEmail(input.email);
        const existing = await getUserByEmail(email);
        const rejectSignup = async (): Promise<never> => {
          await hashPassword(input.password);
          throw new TRPCError({ code: "CONFLICT", message: "Não foi possível concluir o cadastro. Verifique os dados informados ou tente entrar." });
        };
        let user;

        if (existing?.role === "admin") {
          if (!isAdminBootstrapConfigured()) return rejectSignup();
          if (!(await allowAuthAttemptGlobal(`admin-bootstrap:${existing.accountId}`, 5, 60 * 60 * 1000))) return rejectSignup();
          if (!verifyAdminBootstrapCode(input.adminCode)) return rejectSignup();
          if (existing.passwordHash) return rejectSignup();
          const passwordHash = await hashPassword(input.password);
          user = await setPasswordForExistingUser({ id: existing.id, passwordHash, name: existing.name || input.name });
          if (!user) return rejectSignup();
        } else {
          if (existing || !isPublicSignupEnabled()) return rejectSignup();
          const passwordHash = await hashPassword(input.password);
          try {
            user = await createLocalUser({ accountId: accountIdForEmail(email), name: input.name, email, passwordHash, role: "user" });
          } catch (error) {
            if (typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ER_DUP_ENTRY") return rejectSignup();
            throw error;
          }
        }

        if (!user) return rejectSignup();
        await establishSession(user, ctx.req, ctx.res);
        return toPublicUser(user);
      }),
    login: publicProcedure
      .input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(128) }))
      .mutation(async ({ ctx, input }) => {
        const email = normalizeEmail(input.email);
        const bucket = accountIdForEmail(email);
        if (!(await allowAuthAttempt(ctx.req, bucket, 10, 15 * 60 * 1000))
          || !(await allowAuthAttemptGlobal(`login:${bucket}`, 20, 15 * 60 * 1000))) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde antes de tentar novamente." });
        }
        const user = await getUserByEmail(email);
        const passwordMatches = await verifyPasswordForLogin(input.password, user?.passwordHash);
        if (!user || !passwordMatches) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });
        await setLastSignedIn(user.id);
        await establishSession(user, ctx.req, ctx.res);
        return toPublicUser(user);
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await revokeCurrentSession(ctx.req, ctx.res);
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    summary: protectedProcedure.query(async ({ ctx }) => dashboardData(await databaseOrThrow(), ctx.user.id)),
  }),
  subjects: router({
    list: protectedProcedure.query(async () => (await databaseOrThrow()).select().from(subjects).orderBy(asc(subjects.name))),
    create: adminProcedure.input(subjectInput).mutation(async ({ input }) => {
      const result = await (await databaseOrThrow()).insert(subjects).values(input);
      return { id: Number(result[0].insertId) };
    }),
    update: adminProcedure.input(subjectInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const { id, ...values } = input;
      await (await databaseOrThrow()).update(subjects).set(values).where(eq(subjects.id, id));
      return { success: true };
    }),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      await (await databaseOrThrow()).delete(subjects).where(eq(subjects.id, input.id));
      return { success: true };
    }),
  }),
  activities: router({
    list: protectedProcedure
      .input(z.object({ search: z.string().trim().optional(), subjectId: z.number().int().positive().optional(), type: activityType.optional(), priority: priority.optional(), state: z.enum(["todas", "concluidas", "pendentes", "atrasadas"]).optional() }).optional())
      .query(async ({ ctx, input }) => {
        let result = await activityList(await databaseOrThrow(), ctx.user.id);
        if (input?.search) {
          const needle = input.search.toLocaleLowerCase("pt-BR");
          result = result.filter(item => `${item.title} ${item.description ?? ""} ${item.subject.name}`.toLocaleLowerCase("pt-BR").includes(needle));
        }
        if (input?.subjectId) result = result.filter(item => item.subjectId === input.subjectId);
        if (input?.type) result = result.filter(item => item.type === input.type);
        if (input?.priority) result = result.filter(item => item.priority === input.priority);
        if (input?.state === "concluidas") result = result.filter(item => item.completed);
        if (input?.state === "pendentes") result = result.filter(item => !item.completed);
        if (input?.state === "atrasadas") result = result.filter(item => !item.completed && Boolean(item.dueDate && item.dueDate < startOfToday()));
        return result;
      }),
    create: adminProcedure.input(activityInput).mutation(async ({ input }) => {
      const result = await (await databaseOrThrow()).insert(activities).values({ ...input, resourceUrl: input.resourceUrl || null });
      return { id: Number(result[0].insertId) };
    }),
    update: adminProcedure.input(activityInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const { id, ...values } = input;
      await (await databaseOrThrow()).update(activities).set({ ...values, resourceUrl: values.resourceUrl || null }).where(eq(activities.id, id));
      return { success: true };
    }),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      await (await databaseOrThrow()).delete(activities).where(eq(activities.id, input.id));
      return { success: true };
    }),
  }),
  completions: router({
    toggle: protectedProcedure.input(z.object({ activityId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      const existing = await db.select({ id: activityCompletions.id }).from(activityCompletions).where(and(eq(activityCompletions.userId, ctx.user.id), eq(activityCompletions.activityId, input.activityId))).limit(1);
      let completed: boolean;
      if (existing[0]) {
        await db.delete(activityCompletions).where(eq(activityCompletions.id, existing[0].id));
        completed = false;
      } else {
        await db.insert(activityCompletions).values({ userId: ctx.user.id, activityId: input.activityId });
        completed = true;
      }
      const achievements = await recalculateAchievements(db, ctx.user.id);
      return { completed, newlyUnlocked: achievements.newlyUnlocked };
    }),
  }),
  study: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const db = await databaseOrThrow();
      const sessions = await db.select().from(studySessions).where(eq(studySessions.userId, ctx.user.id)).orderBy(desc(studySessions.completedAt));
      const totalMinutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
      const weekStart = startOfToday();
      const weekday = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - (weekday === 0 ? 6 : weekday - 1));
      const currentWeek = sessions.filter(session => session.completedAt >= weekStart);
      const weekMinutes = currentWeek.reduce((sum, session) => sum + session.durationMinutes, 0);
      const achievements = await getAchievementsForUser(db, ctx.user.id);
      const streak = achievements.find(item => item.code === "seven_day_streak")?.rawProgress ?? 0;
      const daily = new Map<string, number>();
      sessions.forEach(session => daily.set(dateKey(session.completedAt), (daily.get(dateKey(session.completedAt)) ?? 0) + 1));
      return { totalMinutes, totalSessions: sessions.length, weekMinutes, weekSessions: currentWeek.length, streak, sessionsByDay: [...daily.entries()].map(([date, value]) => ({ date, value })), recent: sessions.slice(0, 5) };
    }),
    record: protectedProcedure.input(z.object({ durationMinutes: z.number().int().min(1).max(600), subjectId: z.number().int().positive().nullable().optional(), activityId: z.number().int().positive().nullable().optional(), kind: z.enum(["pomodoro", "livre"]).default("pomodoro") })).mutation(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      if (input.subjectId) {
        const subject = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.id, input.subjectId)).limit(1);
        if (!subject[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Matéria não encontrada." });
      }
      const linkedActivity = input.activityId ? await db.select({ id: activities.id, subjectId: activities.subjectId }).from(activities).where(eq(activities.id, input.activityId)).limit(1) : [];
      if (input.activityId && !linkedActivity[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Atividade não encontrada." });
      if (input.subjectId && linkedActivity[0] && linkedActivity[0].subjectId !== input.subjectId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A atividade não pertence à matéria selecionada." });
      }
      const now = new Date();
      await db.insert(studySessions).values({ userId: ctx.user.id, durationMinutes: input.durationMinutes, subjectId: input.subjectId ?? linkedActivity[0]?.subjectId ?? null, activityId: input.activityId ?? null, kind: input.kind, startedAt: new Date(now.getTime() - input.durationMinutes * 60_000), completedAt: now });
      const achievements = await recalculateAchievements(db, ctx.user.id);
      return { success: true, newlyUnlocked: achievements.newlyUnlocked };
    }),
  }),
  achievements: router({
    list: protectedProcedure.query(async ({ ctx }) => getAchievementsForUser(await databaseOrThrow(), ctx.user.id)),
  }),
  planner: router({
    note: protectedProcedure.query(async ({ ctx }) => (await (await databaseOrThrow()).select().from(quickNotes).where(eq(quickNotes.userId, ctx.user.id)).limit(1))[0] ?? { content: "" }),
    saveNote: protectedProcedure.input(z.object({ content: z.string().max(5000) })).mutation(async ({ ctx, input }) => {
      await (await databaseOrThrow()).insert(quickNotes).values({ userId: ctx.user.id, content: input.content }).onDuplicateKeyUpdate({ set: { content: input.content } });
      return { success: true };
    }),
    goal: protectedProcedure.query(async ({ ctx }) => {
      const weekStart = weekStartKey();
      return (await (await databaseOrThrow()).select().from(weeklyGoals).where(and(eq(weeklyGoals.userId, ctx.user.id), eq(weeklyGoals.weekStart, weekStart))).limit(1))[0] ?? { weekStart, targetMinutes: 120, targetSessions: 4 };
    }),
    saveGoal: protectedProcedure.input(z.object({ targetMinutes: z.number().int().min(15).max(2400), targetSessions: z.number().int().min(1).max(50) })).mutation(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      await db.insert(weeklyGoals).values({ userId: ctx.user.id, weekStart: weekStartKey(), ...input }).onDuplicateKeyUpdate({ set: input });
      return { success: true };
    }),
  }),
  export: router({
    data: protectedProcedure.query(async ({ ctx }) => {
      const db = await databaseOrThrow();
      const [items, sessions, achievementRows] = await Promise.all([activityList(db, ctx.user.id), db.select().from(studySessions).where(eq(studySessions.userId, ctx.user.id)), getAchievementsForUser(db, ctx.user.id)]);
      const payload = { exportedAt: new Date().toISOString(), activities: items, studySessions: sessions, achievements: achievementRows };
      const csvRows = items.map(item => [item.title, item.subject.name, item.dueDate?.toISOString().slice(0, 10) ?? "", item.completed ? "sim" : "não", item.estimatedMinutes].map(value => `"${String(value).replaceAll('"', '""')}"`).join(","));
      return { json: JSON.stringify(payload, null, 2), csv: ["atividade,matéria,prazo,concluída,estimativa_minutos", ...csvRows].join("\n"), fileName: `dashboard-2b-${dateKey(new Date())}` };
    }),
  }),
});

export type AppRouter = typeof appRouter;

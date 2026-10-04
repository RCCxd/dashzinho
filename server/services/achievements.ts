import { and, count, eq, inArray, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  achievementDefinitions,
  activities,
  activityCompletions,
  studySessions,
  subjects,
  userAchievements,
} from "../../drizzle/schema";

export const ACHIEVEMENT_CATALOG = [
  { code: "first_completion", title: "Primeiro passo", description: "Conclua sua primeira atividade.", icon: "Sparkles", target: 1, category: "atividades" },
  { code: "ten_completions", title: "Ritmo de estudo", description: "Conclua 10 atividades.", icon: "CheckCheck", target: 10, category: "atividades" },
  { code: "hundred_completions", title: "Centurião", description: "Conclua 100 atividades.", icon: "Trophy", target: 100, category: "atividades" },
  { code: "seven_day_streak", title: "Semana em chamas", description: "Estude por 7 dias seguidos.", icon: "Flame", target: 7, category: "foco" },
  { code: "ten_pomodoro_hours", title: "Hora do foco", description: "Acumule 10 horas de Pomodoro.", icon: "Timer", target: 600, category: "foco" },
  { code: "subject_mastery", title: "Matéria em dia", description: "Conclua todas as atividades de uma matéria.", icon: "GraduationCap", target: 1, category: "atividades" },
  { code: "five_days_week", title: "Semana produtiva", description: "Estude em 5 dias nesta semana.", icon: "CalendarDays", target: 5, category: "foco" },
] as const;

type Db = MySql2Database<Record<string, unknown>>;

type AchievementProgress = Record<(typeof ACHIEVEMENT_CATALOG)[number]["code"], number>;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function calculateStudyStreak(dates: Date[]): number {
  const days = new Set(dates.map(dayKey));
  if (days.size === 0) return 0;

  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  if (!days.has(dayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function currentWeekStart() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const weekday = start.getUTCDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}

export async function recalculateAchievements(db: Db, userId: number) {
  await db
    .insert(achievementDefinitions)
    .values([...ACHIEVEMENT_CATALOG])
    .onDuplicateKeyUpdate({
      set: {
        title: sql`VALUES(title)`,
        description: sql`VALUES(description)`,
        icon: sql`VALUES(icon)`,
        target: sql`VALUES(target)`,
        category: sql`VALUES(category)`,
      },
    });

  const [completionResult] = await db
    .select({ value: count() })
    .from(activityCompletions)
    .where(eq(activityCompletions.userId, userId));
  const sessions = await db
    .select({ durationMinutes: studySessions.durationMinutes, completedAt: studySessions.completedAt, kind: studySessions.kind })
    .from(studySessions)
    .where(eq(studySessions.userId, userId));

  const activityRows = await db.select({ id: activities.id, subjectId: activities.subjectId }).from(activities);
  const completionRows = await db
    .select({ activityId: activityCompletions.activityId })
    .from(activityCompletions)
    .where(eq(activityCompletions.userId, userId));
  const completedIds = new Set(completionRows.map(row => row.activityId));
  const bySubject = new Map<number, number[]>();
  activityRows.forEach(activity => {
    const list = bySubject.get(activity.subjectId) ?? [];
    list.push(activity.id);
    bySubject.set(activity.subjectId, list);
  });

  const hasFinishedSubject = [...bySubject.values()].some(
    activityIds => activityIds.length > 0 && activityIds.every(id => completedIds.has(id))
  );
  const totalPomodoroMinutes = sessions
    .filter(session => session.kind === "pomodoro")
    .reduce((sum, session) => sum + session.durationMinutes, 0);
  const sessionDates = sessions.map(session => session.completedAt);
  const weekStart = currentWeekStart();
  const weekDays = new Set(
    sessions.filter(session => session.completedAt >= weekStart).map(session => dayKey(session.completedAt))
  ).size;

  const progress: AchievementProgress = {
    first_completion: completionResult?.value ?? 0,
    ten_completions: completionResult?.value ?? 0,
    hundred_completions: completionResult?.value ?? 0,
    seven_day_streak: calculateStudyStreak(sessionDates),
    ten_pomodoro_hours: totalPomodoroMinutes,
    subject_mastery: hasFinishedSubject ? 1 : 0,
    five_days_week: weekDays,
  };

  const existing = await db
    .select({ achievementCode: userAchievements.achievementCode, unlockedAt: userAchievements.unlockedAt })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));
  const existingByCode = new Map(existing.map(row => [row.achievementCode, row]));
  const newlyUnlocked: string[] = [];

  for (const definition of ACHIEVEMENT_CATALOG) {
    const value = progress[definition.code];
    const wasUnlocked = Boolean(existingByCode.get(definition.code)?.unlockedAt);
    const nowUnlocked = value >= definition.target;
    const unlockedAt = wasUnlocked ? existingByCode.get(definition.code)?.unlockedAt ?? null : nowUnlocked ? new Date() : null;
    if (nowUnlocked && !wasUnlocked) newlyUnlocked.push(definition.code);

    await db
      .insert(userAchievements)
      .values({ userId, achievementCode: definition.code, progress: value, unlockedAt })
      .onDuplicateKeyUpdate({ set: { progress: value, unlockedAt } });
  }

  return { newlyUnlocked, progress };
}

export async function getAchievementsForUser(db: Db, userId: number) {
  await recalculateAchievements(db, userId);
  const rows = await db
    .select({ achievementCode: userAchievements.achievementCode, progress: userAchievements.progress, unlockedAt: userAchievements.unlockedAt })
    .from(userAchievements)
    .where(and(eq(userAchievements.userId, userId), inArray(userAchievements.achievementCode, ACHIEVEMENT_CATALOG.map(item => item.code))));
  const byCode = new Map(rows.map(row => [row.achievementCode, row]));

  return ACHIEVEMENT_CATALOG.map(definition => {
    const value = byCode.get(definition.code);
    return {
      ...definition,
      progress: Math.min(value?.progress ?? 0, definition.target),
      rawProgress: value?.progress ?? 0,
      unlockedAt: value?.unlockedAt ?? null,
      unlocked: Boolean(value?.unlockedAt),
    };
  });
}

export async function subjectNames(db: Db) {
  return db.select({ id: subjects.id, name: subjects.name, color: subjects.color }).from(subjects);
}

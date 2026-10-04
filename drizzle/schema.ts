import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Local account identity; the existing storage column is retained for imported account IDs. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  accountId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, table => [uniqueIndex("users_email_uq").on(table.email)]);

export const authSessions = mysqlTable(
  "auth_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("auth_sessions_user_idx").on(table.userId), index("auth_sessions_expiry_idx").on(table.expiresAt)]
);

/** Shared, hashed rate-limit buckets so serverless instances enforce the same limits. */
export const authRateLimits = mysqlTable("auth_rate_limits", {
  bucketHash: varchar("bucketHash", { length: 64 }).primaryKey(),
  windowStartedAt: timestamp("windowStartedAt").notNull(),
  attempts: int("attempts").notNull(),
}, table => [index("auth_rate_limits_window_idx").on(table.windowStartedAt)]);

export const subjects = mysqlTable("subjects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  color: varchar("color", { length: 16 }).notNull().default("#5B6CFF"),
  teacher: varchar("teacher", { length: 120 }),
  schedule: varchar("schedule", { length: 160 }),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const activities = mysqlTable(
  "activities",
  {
    id: int("id").autoincrement().primaryKey(),
    subjectId: int("subjectId")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description"),
    type: mysqlEnum("type", ["tarefa", "prova", "trabalho", "projeto"])
      .notNull()
      .default("tarefa"),
    priority: mysqlEnum("priority", ["baixa", "media", "alta"])
      .notNull()
      .default("media"),
    status: mysqlEnum("status", ["pendente", "em_andamento", "concluida"])
      .notNull()
      .default("pendente"),
    dueDate: timestamp("dueDate"),
    resourceUrl: varchar("resourceUrl", { length: 2048 }),
    estimatedMinutes: int("estimatedMinutes").notNull().default(30),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("activities_due_date_idx").on(table.dueDate),
    index("activities_subject_idx").on(table.subjectId),
  ]
);

export const activityCompletions = mysqlTable(
  "activity_completions",
  {
    id: int("id").autoincrement().primaryKey(),
    activityId: int("activityId")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    completedAt: timestamp("completedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("activity_completion_user_activity_uq").on(
      table.userId,
      table.activityId
    ),
    index("activity_completion_user_idx").on(table.userId),
  ]
);

export const studySessions = mysqlTable(
  "study_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
    activityId: int("activityId").references(() => activities.id, { onDelete: "set null" }),
    durationMinutes: int("durationMinutes").notNull(),
    kind: mysqlEnum("kind", ["pomodoro", "livre"])
      .notNull()
      .default("pomodoro"),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt").defaultNow().notNull(),
  },
  table => [index("study_session_user_completed_idx").on(table.userId, table.completedAt)]
);

export const achievementDefinitions = mysqlTable("achievement_definitions", {
  code: varchar("code", { length: 64 }).primaryKey(),
  title: varchar("title", { length: 120 }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  icon: varchar("icon", { length: 48 }).notNull(),
  target: int("target").notNull(),
  category: varchar("category", { length: 48 }).notNull(),
});

export const userAchievements = mysqlTable(
  "user_achievements",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementCode: varchar("achievementCode", { length: 64 })
      .notNull()
      .references(() => achievementDefinitions.code, { onDelete: "cascade" }),
    progress: int("progress").notNull().default(0),
    unlockedAt: timestamp("unlockedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("user_achievement_user_code_uq").on(table.userId, table.achievementCode),
  ]
);

export const quickNotes = mysqlTable(
  "quick_notes",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("quick_note_user_uq").on(table.userId)]
);

export const weeklyGoals = mysqlTable(
  "weekly_goals",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: varchar("weekStart", { length: 10 }).notNull(),
    targetMinutes: int("targetMinutes").notNull().default(120),
    targetSessions: int("targetSessions").notNull().default(4),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("weekly_goal_user_week_uq").on(table.userId, table.weekStart)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Subject = typeof subjects.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;

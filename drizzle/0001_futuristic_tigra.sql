CREATE TABLE `achievement_definitions` (
	`code` varchar(64) NOT NULL,
	`title` varchar(120) NOT NULL,
	`description` varchar(255) NOT NULL,
	`icon` varchar(48) NOT NULL,
	`target` int NOT NULL,
	`category` varchar(48) NOT NULL,
	CONSTRAINT `achievement_definitions_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
INSERT INTO `achievement_definitions` (`code`,`title`,`description`,`icon`,`target`,`category`) VALUES
('first_completion','Primeiro passo','Conclua sua primeira atividade.','Sparkles',1,'atividades'),
('ten_completions','Ritmo de estudo','Conclua 10 atividades.','CheckCheck',10,'atividades'),
('hundred_completions','Centurião','Conclua 100 atividades.','Trophy',100,'atividades'),
('seven_day_streak','Semana em chamas','Estude por 7 dias seguidos.','Flame',7,'foco'),
('ten_pomodoro_hours','Hora do foco','Acumule 10 horas de Pomodoro.','Timer',600,'foco'),
('subject_mastery','Matéria em dia','Conclua todas as atividades de uma matéria.','GraduationCap',1,'atividades'),
('five_days_week','Semana produtiva','Estude em 5 dias nesta semana.','CalendarDays',5,'foco')
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`),`description`=VALUES(`description`),`icon`=VALUES(`icon`),`target`=VALUES(`target`),`category`=VALUES(`category`);
--> statement-breakpoint
CREATE TABLE `activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`description` text,
	`type` enum('tarefa','prova','trabalho','projeto') NOT NULL DEFAULT 'tarefa',
	`priority` enum('baixa','media','alta') NOT NULL DEFAULT 'media',
	`status` enum('pendente','em_andamento','concluida') NOT NULL DEFAULT 'pendente',
	`dueDate` timestamp,
	`resourceUrl` varchar(2048),
	`estimatedMinutes` int NOT NULL DEFAULT 30,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activity_completions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`activityId` int NOT NULL,
	`userId` int NOT NULL,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `activity_completions_id` PRIMARY KEY(`id`),
	CONSTRAINT `activity_completion_user_activity_uq` UNIQUE(`userId`,`activityId`)
);
--> statement-breakpoint
CREATE TABLE `quick_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quick_notes_id` PRIMARY KEY(`id`),
	CONSTRAINT `quick_note_user_uq` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subjectId` int,
	`activityId` int,
	`durationMinutes` int NOT NULL,
	`kind` enum('pomodoro','livre') NOT NULL DEFAULT 'pomodoro',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `study_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`color` varchar(16) NOT NULL DEFAULT '#5B6CFF',
	`teacher` varchar(120),
	`schedule` varchar(160),
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subjects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_achievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`achievementCode` varchar(64) NOT NULL,
	`progress` int NOT NULL DEFAULT 0,
	`unlockedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_achievements_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_achievement_user_code_uq` UNIQUE(`userId`,`achievementCode`)
);
--> statement-breakpoint
CREATE TABLE `weekly_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`weekStart` varchar(10) NOT NULL,
	`targetMinutes` int NOT NULL DEFAULT 120,
	`targetSessions` int NOT NULL DEFAULT 4,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_goals_id` PRIMARY KEY(`id`),
	CONSTRAINT `weekly_goal_user_week_uq` UNIQUE(`userId`,`weekStart`)
);
--> statement-breakpoint
ALTER TABLE `activities` ADD CONSTRAINT `activities_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `activity_completions` ADD CONSTRAINT `activity_completions_activityId_activities_id_fk` FOREIGN KEY (`activityId`) REFERENCES `activities`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `activity_completions` ADD CONSTRAINT `activity_completions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `quick_notes` ADD CONSTRAINT `quick_notes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `study_sessions` ADD CONSTRAINT `study_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `study_sessions` ADD CONSTRAINT `study_sessions_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `study_sessions` ADD CONSTRAINT `study_sessions_activityId_activities_id_fk` FOREIGN KEY (`activityId`) REFERENCES `activities`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `user_achievements` ADD CONSTRAINT `user_achievements_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `user_achievements` ADD CONSTRAINT `ua_definition_fk` FOREIGN KEY (`achievementCode`) REFERENCES `achievement_definitions`(`code`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `weekly_goals` ADD CONSTRAINT `wg_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `activities_due_date_idx` ON `activities` (`dueDate`);
--> statement-breakpoint
CREATE INDEX `activities_subject_idx` ON `activities` (`subjectId`);
--> statement-breakpoint
CREATE INDEX `activity_completion_user_idx` ON `activity_completions` (`userId`);
--> statement-breakpoint
CREATE INDEX `study_session_user_completed_idx` ON `study_sessions` (`userId`,`completedAt`);

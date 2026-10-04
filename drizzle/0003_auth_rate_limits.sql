CREATE TABLE `auth_rate_limits` (
	`bucketHash` varchar(64) NOT NULL,
	`windowStartedAt` timestamp NOT NULL,
	`attempts` int NOT NULL,
	CONSTRAINT `auth_rate_limits_bucketHash` PRIMARY KEY(`bucketHash`)
);
--> statement-breakpoint
CREATE INDEX `auth_rate_limits_window_idx` ON `auth_rate_limits` (`windowStartedAt`);
CREATE TABLE `analysis_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`name` text NOT NULL,
	`outcome` text NOT NULL,
	`question` text NOT NULL,
	`intent_id` text NOT NULL,
	`schedule` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'personal' NOT NULL,
	`source_insight_id` text,
	`created_at` text NOT NULL,
	`created_at_moment` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_run_insight_id` text,
	`last_run_at` text,
	`run_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analysis_agents_role_idx` ON `analysis_agents` (`run_id`,`role_id`);
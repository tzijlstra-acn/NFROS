CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`name` text NOT NULL,
	`request` text DEFAULT '' NOT NULL,
	`spec` text NOT NULL,
	`schedule` text DEFAULT 'manual' NOT NULL,
	`drafted_via` text NOT NULL,
	`created_at` text NOT NULL,
	`created_at_moment` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_run_at` text,
	`last_run_moment` text,
	`last_run_matched` integer,
	`last_run_in_scope` integer,
	`last_run_audit_event_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_name_unq` ON `skills` (`run_id`,`user_id`,`role_id`,`name`);--> statement-breakpoint
CREATE INDEX `skills_role_idx` ON `skills` (`run_id`,`role_id`);
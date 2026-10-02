CREATE TABLE `action_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`action_id` text NOT NULL,
	`at` text NOT NULL,
	`author_user_id` text,
	`author_kind` text NOT NULL,
	`note` text NOT NULL,
	`evidence_ids` text NOT NULL,
	`status_after` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `action_updates_run_idx` ON `action_updates` (`run_id`,`action_id`);--> statement-breakpoint
CREATE TABLE `ai_routines` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`role_id` text NOT NULL,
	`name` text NOT NULL,
	`trigger_type` text NOT NULL,
	`trigger_config` text NOT NULL,
	`status` text NOT NULL,
	`authority_class` text NOT NULL,
	`output_kind` text NOT NULL,
	`last_run_at` text,
	`next_run_at` text
);
--> statement-breakpoint
CREATE INDEX `ai_routines_run_role_idx` ON `ai_routines` (`run_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `meeting_minutes` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`meeting_id` text NOT NULL,
	`role_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`fact_items` text NOT NULL,
	`decision_ids` text NOT NULL,
	`action_ids` text NOT NULL,
	`unresolved_items` text NOT NULL,
	`evidence_ids` text NOT NULL,
	`participant_user_ids` text NOT NULL,
	`status` text NOT NULL,
	`prepared_by` text NOT NULL,
	`confirmed_by_user_id` text,
	`confirmed_at` text,
	`distributed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meeting_minutes_run_idx` ON `meeting_minutes` (`run_id`,`meeting_id`);--> statement-breakpoint
CREATE TABLE `role_app_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`role_app_run_id` text NOT NULL,
	`stage_id` text NOT NULL,
	`artifact_kind` text NOT NULL,
	`label` text NOT NULL,
	`content` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `role_app_artifacts_run_idx` ON `role_app_artifacts` (`run_id`,`role_app_run_id`);--> statement-breakpoint
CREATE TABLE `role_app_events` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`role_app_run_id` text NOT NULL,
	`stage_id` text,
	`event_kind` text NOT NULL,
	`actor_kind` text NOT NULL,
	`actor_id` text,
	`payload` text,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `role_app_events_run_idx` ON `role_app_events` (`run_id`,`role_app_run_id`);--> statement-breakpoint
CREATE TABLE `role_app_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`role_app_id` text NOT NULL,
	`role_id` text NOT NULL,
	`subject_kind` text NOT NULL,
	`subject_id` text NOT NULL,
	`current_stage_id` text NOT NULL,
	`status` text NOT NULL,
	`mode` text DEFAULT 'offline' NOT NULL,
	`started_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	`blocked_reason` text
);
--> statement-breakpoint
CREATE INDEX `role_app_runs_run_idx` ON `role_app_runs` (`run_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `role_app_stage_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`role_app_run_id` text NOT NULL,
	`stage_id` text NOT NULL,
	`status` text NOT NULL,
	`opened_at` text,
	`completed_at` text,
	`completed_by_user_id` text,
	`ai_output_id` text
);
--> statement-breakpoint
CREATE INDEX `role_app_stage_runs_run_idx` ON `role_app_stage_runs` (`run_id`,`role_app_run_id`);--> statement-breakpoint
CREATE TABLE `role_app_stage_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`stage_run_id` text NOT NULL,
	`task_kind` text NOT NULL,
	`label` text NOT NULL,
	`status` text NOT NULL,
	`required_for_completion` integer DEFAULT true NOT NULL,
	`completed_at` text,
	`output` text
);
--> statement-breakpoint
CREATE INDEX `role_app_stage_tasks_run_idx` ON `role_app_stage_tasks` (`run_id`,`stage_run_id`);
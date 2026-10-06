CREATE TABLE `os_events` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`type` text NOT NULL,
	`role_id` text,
	`at_moment` text NOT NULL,
	`occurred_at` text NOT NULL,
	`actor_kind` text NOT NULL,
	`actor_user_id` text,
	`subject_kind` text,
	`subject_id` text,
	`process_run_id` text,
	`stage_id` text,
	`correlation_id` text,
	`summary` text NOT NULL,
	`summary_de` text NOT NULL,
	`payload` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`audit_event_id` text,
	`activity_entry_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `os_events_idempotency_unq` ON `os_events` (`run_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `os_events_run_seq_idx` ON `os_events` (`run_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `os_events_role_seq_idx` ON `os_events` (`run_id`,`role_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `os_events_process_idx` ON `os_events` (`run_id`,`process_run_id`);--> statement-breakpoint
CREATE INDEX `os_events_subject_idx` ON `os_events` (`run_id`,`subject_kind`,`subject_id`);--> statement-breakpoint
ALTER TABLE `role_app_artifacts` ADD `stage_run_id` text;--> statement-breakpoint
ALTER TABLE `role_app_artifacts` ADD `artifact_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `role_app_artifacts` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `role_app_artifacts` ADD `content_digest` text;--> statement-breakpoint
ALTER TABLE `role_app_artifacts` ADD `produced_by` text;--> statement-breakpoint
ALTER TABLE `role_app_artifacts` ADD `mode` text;--> statement-breakpoint
ALTER TABLE `role_app_artifacts` ADD `created_by_user_id` text;--> statement-breakpoint
CREATE INDEX `role_app_artifacts_key_idx` ON `role_app_artifacts` (`role_app_run_id`,`stage_id`,`artifact_key`);--> statement-breakpoint
ALTER TABLE `role_app_stage_runs` ADD `preparation_job_id` text;--> statement-breakpoint
ALTER TABLE `role_app_stage_runs` ADD `completion_approval_id` text;--> statement-breakpoint
ALTER TABLE `role_app_stage_runs` ADD `completion_rationale` text;--> statement-breakpoint
DELETE FROM `role_app_stage_runs` WHERE rowid NOT IN (SELECT min(rowid) FROM `role_app_stage_runs` GROUP BY `role_app_run_id`, `stage_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `role_app_stage_runs_stage_unq` ON `role_app_stage_runs` (`role_app_run_id`,`stage_id`);--> statement-breakpoint
ALTER TABLE `role_app_stage_tasks` ADD `task_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `role_app_stage_tasks` ADD `created_at` text;--> statement-breakpoint
ALTER TABLE `role_app_stage_tasks` ADD `completed_by_user_id` text;--> statement-breakpoint
ALTER TABLE `role_app_stage_tasks` ADD `approval_id` text;--> statement-breakpoint
ALTER TABLE `role_app_stage_tasks` ADD `status_reason` text;--> statement-breakpoint
UPDATE `role_app_stage_tasks` SET `task_key` = `id` WHERE `task_key` = '';--> statement-breakpoint
CREATE UNIQUE INDEX `role_app_stage_tasks_key_unq` ON `role_app_stage_tasks` (`stage_run_id`,`task_key`);--> statement-breakpoint
INSERT INTO `os_events` (`id`, `run_id`, `sequence`, `type`, `role_id`, `at_moment`, `occurred_at`, `actor_kind`, `actor_user_id`, `subject_kind`, `subject_id`, `process_run_id`, `stage_id`, `correlation_id`, `summary`, `summary_de`, `payload`, `idempotency_key`, `audit_event_id`, `activity_entry_id`)
SELECT e.`id`, e.`run_id`, ROW_NUMBER() OVER (PARTITION BY e.`run_id` ORDER BY e.`at`, e.`id`),
  CASE e.`event_kind` WHEN 'stage-completed' THEN 'stage-completed' WHEN 'stage-entered' THEN 'stage-opened' WHEN 'run-completed' THEN 'process-completed' WHEN 'ai-prepared' THEN 'ai-preparation-completed' WHEN 'human-decided' THEN 'decision-recorded' WHEN 'tool-executed' THEN 'tool-executed' ELSE 'stage-opened' END,
  r.`role_id`, '', e.`at`, CASE e.`actor_kind` WHEN 'ai' THEN 'ai' WHEN 'human' THEN 'human' ELSE 'system' END, e.`actor_id`,
  r.`subject_kind`, r.`subject_id`, e.`role_app_run_id`, e.`stage_id`, NULL,
  'Process event carried over from the earlier process log.', 'Prozessereignis aus dem frueheren Prozessprotokoll uebernommen.',
  COALESCE(e.`payload`, '{}'), 'legacy:' || e.`id`, NULL, NULL
FROM `role_app_events` e LEFT JOIN `role_app_runs` r ON r.`id` = e.`role_app_run_id`;--> statement-breakpoint
DROP TABLE `role_app_events`;

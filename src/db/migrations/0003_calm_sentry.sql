CREATE TABLE `audit_chain_records` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`chain_scope` text NOT NULL,
	`audit_event_id` text NOT NULL,
	`event_kind` text NOT NULL,
	`canonical_payload` text NOT NULL,
	`previous_hash` text NOT NULL,
	`event_hash` text NOT NULL,
	`hash_algorithm` text DEFAULT 'sha256' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `acr_scope_seq_idx` ON `audit_chain_records` (`chain_scope`,`sequence`);--> statement-breakpoint
CREATE INDEX `acr_audit_event_idx` ON `audit_chain_records` (`audit_event_id`);--> statement-breakpoint
CREATE INDEX `acr_run_idx` ON `audit_chain_records` (`run_id`);--> statement-breakpoint
CREATE TABLE `background_job_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`job_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`outcome` text,
	`error_code` text,
	`error_redacted` text,
	`lease_owner` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `background_job_attempts_job_idx` ON `background_job_attempts` (`run_id`,`job_id`);--> statement-breakpoint
CREATE TABLE `background_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`job_kind` text NOT NULL,
	`status` text NOT NULL,
	`priority` integer DEFAULT 5 NOT NULL,
	`scheduled_at` text NOT NULL,
	`lease_owner` text,
	`lease_expires_at` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`last_error_code` text,
	`last_error_redacted` text,
	`related_role_id` text,
	`related_process_run_id` text,
	`related_object_kind` text,
	`related_object_id` text,
	`payload` text,
	`result_summary` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `background_jobs_idempotency_key_unique` ON `background_jobs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `background_jobs_run_idx` ON `background_jobs` (`run_id`,`status`);--> statement-breakpoint
CREATE INDEX `background_jobs_schedule_idx` ON `background_jobs` (`status`,`scheduled_at`,`priority`);
CREATE TABLE `control_test_results` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`control_id` text NOT NULL,
	`period` text NOT NULL,
	`result` text NOT NULL,
	`exceptions` integer NOT NULL,
	`sample_size` integer NOT NULL,
	`tested_on` text,
	`control_test_id` text
);
--> statement-breakpoint
CREATE INDEX `control_test_results_run_idx` ON `control_test_results` (`run_id`,`control_id`);--> statement-breakpoint
CREATE TABLE `insight_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`role_id` text NOT NULL,
	`question` text NOT NULL,
	`intent_id` text NOT NULL,
	`context_kind` text,
	`context_id` text,
	`response` text NOT NULL,
	`generated_at` text NOT NULL,
	`generated_at_moment` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`saved_at` text,
	`saved_title` text,
	`audit_event_id` text
);
--> statement-breakpoint
CREATE INDEX `insight_runs_role_idx` ON `insight_runs` (`run_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `kri_history` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`kri_id` text NOT NULL,
	`period` text NOT NULL,
	`period_end` text NOT NULL,
	`value` real NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `kri_history_run_idx` ON `kri_history` (`run_id`,`kri_id`);--> statement-breakpoint
CREATE TABLE `portfolio_provider_links` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`third_party_id` text NOT NULL,
	`provider_key` text NOT NULL,
	`provider_name` text NOT NULL,
	`provider_domicile` text NOT NULL,
	`service_id` text NOT NULL,
	`supports_critical_function` integer NOT NULL,
	`declared` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `portfolio_provider_links_run_idx` ON `portfolio_provider_links` (`run_id`,`provider_key`);--> statement-breakpoint
CREATE TABLE `portfolio_third_parties` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`name` text NOT NULL,
	`domicile` text NOT NULL,
	`category` text NOT NULL,
	`criticality` text NOT NULL,
	`is_outsourcing` integer NOT NULL,
	`entity_ids` text NOT NULL,
	`status` text NOT NULL,
	`relationship_owner_user_id` text NOT NULL,
	`annual_spend` integer NOT NULL,
	`last_assessment_date` text NOT NULL,
	`next_assessment_due` text NOT NULL,
	`assurance_report_date` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `portfolio_third_parties_run_idx` ON `portfolio_third_parties` (`run_id`);--> statement-breakpoint
CREATE TABLE `risk_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`reference` text NOT NULL,
	`risk_id` text NOT NULL,
	`subject_kind` text NOT NULL,
	`subject_id` text NOT NULL,
	`subject_label` text NOT NULL,
	`entity_id` text NOT NULL,
	`title` text NOT NULL,
	`rationale` text NOT NULL,
	`conditions` text NOT NULL,
	`conditions_met` integer NOT NULL,
	`granted_on` text NOT NULL,
	`expires_on` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`approver_user_id` text NOT NULL,
	`status` text NOT NULL,
	`evidence_document_id` text,
	`issue_id` text
);
--> statement-breakpoint
CREATE INDEX `risk_acceptances_run_idx` ON `risk_acceptances` (`run_id`);--> statement-breakpoint
CREATE TABLE `service_resilience_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`service_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`reference` text NOT NULL,
	`source` text NOT NULL,
	`tested_on` text NOT NULL,
	`scenario` text NOT NULL,
	`tolerance_minutes` integer NOT NULL,
	`observed_minutes` integer NOT NULL,
	`finding` text NOT NULL,
	`unmapped_dependency` text,
	`open_actions` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `service_resilience_tests_run_idx` ON `service_resilience_tests` (`run_id`);--> statement-breakpoint
CREATE TABLE `third_party_monthly_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`third_party_id` text NOT NULL,
	`period` text NOT NULL,
	`availability_pct` real NOT NULL,
	`sla_breaches` integer NOT NULL,
	`incidents` integer NOT NULL,
	`risk_score` integer NOT NULL,
	`assurance_status` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `third_party_monthly_metrics_run_idx` ON `third_party_monthly_metrics` (`run_id`,`third_party_id`);--> statement-breakpoint
UPDATE `brand_profiles` SET `product_name` = 'NFR Workspace', `short_name` = 'NFR Workspace' WHERE `product_name` = 'NFROS';

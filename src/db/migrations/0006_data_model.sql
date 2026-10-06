CREATE TABLE `ai_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`role_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`task_kind` text NOT NULL,
	`configuration_id` text,
	`prompt_version` text,
	`model_profile_id` text,
	`source_refs` text NOT NULL,
	`process_run_id` text,
	`stage_id` text,
	`comment` text DEFAULT '' NOT NULL,
	`at_moment` text NOT NULL,
	`created_at` text NOT NULL,
	`product_feedback_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aif_once_unq` ON `ai_feedback` (`run_id`,`user_id`,`target_kind`,`target_id`,`kind`);--> statement-breakpoint
CREATE INDEX `aif_target_idx` ON `ai_feedback` (`run_id`,`target_kind`,`target_id`);--> statement-breakpoint
CREATE INDEX `aif_config_idx` ON `ai_feedback` (`configuration_id`,`kind`);--> statement-breakpoint
CREATE TABLE `ai_routine_run_outputs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`routine_run_id` text NOT NULL,
	`object_kind` text NOT NULL,
	`object_id` text NOT NULL,
	`effect` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `arro_output_unq` ON `ai_routine_run_outputs` (`routine_run_id`,`object_kind`,`object_id`);--> statement-breakpoint
CREATE INDEX `arro_object_idx` ON `ai_routine_run_outputs` (`run_id`,`object_kind`,`object_id`);--> statement-breakpoint
CREATE TABLE `ai_routine_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`routine_id` text NOT NULL,
	`role_id` text NOT NULL,
	`trigger_kind` text NOT NULL,
	`trigger_ref` text,
	`status` text NOT NULL,
	`outcome` text,
	`summary` text DEFAULT '' NOT NULL,
	`summary_de` text DEFAULT '' NOT NULL,
	`mode` text NOT NULL,
	`configuration_id` text,
	`job_id` text,
	`os_event_id` text,
	`at_moment` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`error_redacted` text,
	`idempotency_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `arr_idempotency_unq` ON `ai_routine_runs` (`run_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `arr_role_idx` ON `ai_routine_runs` (`run_id`,`role_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `arr_routine_idx` ON `ai_routine_runs` (`run_id`,`routine_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `ai_suggestion_dispositions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`suggestion_id` text NOT NULL,
	`role_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`from_disposition` text NOT NULL,
	`to_disposition` text NOT NULL,
	`actor_kind` text NOT NULL,
	`actor_user_id` text,
	`at` text NOT NULL,
	`at_moment` text NOT NULL,
	`modification` text,
	`reason` text DEFAULT '' NOT NULL,
	`result_kind` text,
	`result_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asd_sequence_unq` ON `ai_suggestion_dispositions` (`suggestion_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `asd_run_role_idx` ON `ai_suggestion_dispositions` (`run_id`,`role_id`,`at`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`role_id` text NOT NULL,
	`user_id` text,
	`category` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`source_kind` text NOT NULL,
	`source_id` text NOT NULL,
	`subject_kind` text,
	`subject_id` text,
	`budget_outcome` text NOT NULL,
	`held_back_reason` text,
	`raised_at` text NOT NULL,
	`raised_at_moment` text NOT NULL,
	`read_at` text,
	`read_by_user_id` text,
	`settled_at` text,
	`settled_by_event_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ntf_thing_unq` ON `notifications` (`run_id`,`role_id`,`dedupe_key`);--> statement-breakpoint
CREATE INDEX `ntf_role_raised_idx` ON `notifications` (`run_id`,`role_id`,`raised_at`);--> statement-breakpoint
CREATE TABLE `partner_contexts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`legal_entity_id` text,
	`selected_object_kind` text,
	`selected_object_id` text,
	`process_run_id` text,
	`stage_id` text,
	`meeting_id` text,
	`action_id` text,
	`inbox_message_id` text,
	`decision_id` text,
	`chat_thread_id` text,
	`source_freshness` text NOT NULL,
	`prior_decision_ids` text NOT NULL,
	`user_edits` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_at_moment` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pctx_person_role_unq` ON `partner_contexts` (`run_id`,`user_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `ai_configuration_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`configuration_id` text NOT NULL,
	`role_id` text NOT NULL,
	`task_kind` text NOT NULL,
	`decision` text NOT NULL,
	`evaluation_run_id` text,
	`supersedes_configuration_id` text,
	`rationale` text NOT NULL,
	`decided_at` text NOT NULL,
	`decided_by_label` text NOT NULL,
	`decided_by_user_id` text,
	`approval_id` text,
	`rolled_back_at` text,
	`rolled_back_by_label` text,
	`rollback_reason` text,
	`restored_configuration_id` text
);
--> statement-breakpoint
CREATE INDEX `acr_role_task_idx` ON `ai_configuration_releases` (`role_id`,`task_kind`,`decided_at`);--> statement-breakpoint
CREATE TABLE `ai_evaluation_case_results` (
	`id` text PRIMARY KEY NOT NULL,
	`evaluation_run_id` text NOT NULL,
	`case_id` text NOT NULL,
	`role_id` text NOT NULL,
	`task_kind` text NOT NULL,
	`stage_id` text,
	`language` text,
	`mandatory` integer DEFAULT false NOT NULL,
	`status` text NOT NULL,
	`grader_results` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`latency_ms` integer,
	`cost_usd` real,
	`output_digest` text,
	`output` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aecr_case_unq` ON `ai_evaluation_case_results` (`evaluation_run_id`,`case_id`);--> statement-breakpoint
CREATE INDEX `aecr_status_idx` ON `ai_evaluation_case_results` (`evaluation_run_id`,`status`);--> statement-breakpoint
CREATE TABLE `ai_evaluation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`configuration_id` text NOT NULL,
	`configuration_status` text NOT NULL,
	`role_id` text NOT NULL,
	`task_kind` text NOT NULL,
	`prompt_version` text NOT NULL,
	`model_profile_id` text NOT NULL,
	`output_schema_version` text NOT NULL,
	`evaluation_suite_id` text NOT NULL,
	`role_app_version_id` text,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`total_cases` integer DEFAULT 0 NOT NULL,
	`passed` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`not_run` integer DEFAULT 0 NOT NULL,
	`mandatory_failed` integer DEFAULT 0 NOT NULL,
	`job_id` text,
	`results_path` text,
	`triggered_by_label` text NOT NULL,
	`triggered_by_user_id` text,
	`started_at` text NOT NULL,
	`completed_at` text,
	`error_redacted` text
);
--> statement-breakpoint
CREATE INDEX `aer_config_idx` ON `ai_evaluation_runs` (`configuration_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `aer_role_task_idx` ON `ai_evaluation_runs` (`role_id`,`task_kind`,`started_at`);--> statement-breakpoint
CREATE TABLE `data_quality_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`kind` text NOT NULL,
	`connector_instance_id` text NOT NULL,
	`source_mapping_id` text,
	`external_reference_id` text,
	`integration_event_id` text,
	`canonical_type` text,
	`canonical_id` text,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`detected_at` text NOT NULL,
	`detected_at_moment` text NOT NULL,
	`detected_by` text NOT NULL,
	`resolved_at` text,
	`resolved_by_label` text,
	`resolution` text DEFAULT '' NOT NULL,
	`product_config_change_id` text
);
--> statement-breakpoint
CREATE INDEX `dqi_run_status_idx` ON `data_quality_issues` (`run_id`,`status`,`detected_at`);--> statement-breakpoint
CREATE INDEX `dqi_connector_idx` ON `data_quality_issues` (`connector_instance_id`);--> statement-breakpoint
CREATE TABLE `experience_events` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`kind` text NOT NULL,
	`role_id` text NOT NULL,
	`legal_entity_id` text,
	`process_id` text,
	`process_run_id` text,
	`stage_id` text,
	`cohort_id` text,
	`mode` text NOT NULL,
	`subject_kind` text,
	`subject_id` text,
	`at_moment` text NOT NULL,
	`occurred_at` text NOT NULL,
	`idempotency_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `xev_idempotency_unq` ON `experience_events` (`run_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `xev_kind_idx` ON `experience_events` (`run_id`,`kind`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `xev_role_idx` ON `experience_events` (`run_id`,`role_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `integration_incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`connector_instance_id` text NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`affected_role_ids` text NOT NULL,
	`affected_process_run_ids` text NOT NULL,
	`affected_user_count` integer,
	`failed_command_ids` text NOT NULL,
	`dead_letter_ids` text NOT NULL,
	`recovery_note` text DEFAULT '' NOT NULL,
	`release_version` text,
	`opened_at` text NOT NULL,
	`opened_at_moment` text NOT NULL,
	`opened_by_label` text NOT NULL,
	`resolved_at` text,
	`resolved_by_label` text
);
--> statement-breakpoint
CREATE INDEX `ii_run_status_idx` ON `integration_incidents` (`run_id`,`status`,`opened_at`);--> statement-breakpoint
CREATE TABLE `pilot_exit_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`pilot_id` text NOT NULL,
	`outcome` text NOT NULL,
	`evidence` text NOT NULL,
	`unresolved_conditions` text NOT NULL,
	`control_findings` text NOT NULL,
	`commercial_implication` text DEFAULT '' NOT NULL,
	`next_wave_recommendation` text DEFAULT '' NOT NULL,
	`rationale` text NOT NULL,
	`decided_at` text NOT NULL,
	`decided_by_label` text NOT NULL,
	`decided_by_user_id` text,
	`approval_id` text
);
--> statement-breakpoint
CREATE INDEX `ped_pilot_idx` ON `pilot_exit_decisions` (`pilot_id`,`decided_at`);--> statement-breakpoint
CREATE TABLE `pilot_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`pilot_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`owner_label` text,
	`raised_at` text NOT NULL,
	`raised_by_label` text NOT NULL,
	`resolved_at` text,
	`resolution` text DEFAULT '' NOT NULL,
	`product_feedback_id` text,
	`role_app_id` text,
	`integration_incident_id` text
);
--> statement-breakpoint
CREATE INDEX `pi_pilot_idx` ON `pilot_issues` (`pilot_id`,`status`);--> statement-breakpoint
CREATE TABLE `pilot_measure_readings` (
	`id` text PRIMARY KEY NOT NULL,
	`pilot_id` text NOT NULL,
	`measure_id` text NOT NULL,
	`week_starting` text NOT NULL,
	`status` text NOT NULL,
	`value` real,
	`source` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`recorded_at` text NOT NULL,
	`recorded_by_label` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pmr_week_unq` ON `pilot_measure_readings` (`measure_id`,`week_starting`);--> statement-breakpoint
CREATE TABLE `pilot_measures` (
	`id` text PRIMARY KEY NOT NULL,
	`pilot_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`label_de` text NOT NULL,
	`kind` text NOT NULL,
	`unit` text NOT NULL,
	`direction` text NOT NULL,
	`method` text NOT NULL,
	`method_de` text NOT NULL,
	`source` text NOT NULL,
	`target` real,
	`baseline_status` text NOT NULL,
	`baseline_value` real,
	`baseline_period` text,
	`baseline_recorded_at` text,
	`baseline_recorded_by_label` text,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pm_key_unq` ON `pilot_measures` (`pilot_id`,`key`);--> statement-breakpoint
CREATE TABLE `pilot_programmes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_de` text NOT NULL,
	`status` text NOT NULL,
	`business_area` text NOT NULL,
	`business_area_de` text NOT NULL,
	`legal_entity_ids` text NOT NULL,
	`cohort_id` text,
	`role_ids` text NOT NULL,
	`role_app_ids` text NOT NULL,
	`source_system_ids` text NOT NULL,
	`authority` text NOT NULL,
	`support_contacts` text NOT NULL,
	`planned_start_on` text,
	`planned_end_on` text,
	`started_at` text,
	`closed_at` text,
	`created_at` text NOT NULL,
	`created_by_label` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_cohorts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_de` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`user_ids` text NOT NULL,
	`role_ids` text NOT NULL,
	`legal_entity_ids` text NOT NULL,
	`pilot_programme_id` text,
	`created_at` text NOT NULL,
	`created_by_label` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`summary` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`submitted_by_user_id` text,
	`submitted_at` text NOT NULL,
	`context_run_id` text,
	`role_id` text,
	`legal_entity_id` text,
	`route` text,
	`subject_kind` text,
	`subject_id` text,
	`process_run_id` text,
	`ai_feedback_id` text,
	`status` text DEFAULT 'new' NOT NULL,
	`severity` text,
	`owner_label` text,
	`owner_user_id` text,
	`triaged_at` text,
	`triaged_by_label` text,
	`resolution` text DEFAULT '' NOT NULL,
	`closed_at` text,
	`feature_key` text,
	`role_app_id` text,
	`stage_id` text,
	`release_version` text
);
--> statement-breakpoint
CREATE INDEX `pfb_status_idx` ON `product_feedback` (`status`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `pfb_app_stage_idx` ON `product_feedback` (`role_app_id`,`stage_id`);--> statement-breakpoint
CREATE TABLE `product_release_events` (
	`id` text PRIMARY KEY NOT NULL,
	`release_version` text NOT NULL,
	`kind` text NOT NULL,
	`rollout_status` text,
	`gate_run_id` text,
	`evidence_pack_ref` text,
	`evidence_pack_digest` text,
	`rollback_plan` text,
	`rollback_to_version` text,
	`note` text DEFAULT '' NOT NULL,
	`at` text NOT NULL,
	`actor_label` text NOT NULL,
	`actor_user_id` text,
	`approval_id` text
);
--> statement-breakpoint
CREATE INDEX `pre_version_idx` ON `product_release_events` (`release_version`,`at`);--> statement-breakpoint
CREATE TABLE `release_gate_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`release_version` text NOT NULL,
	`status` text NOT NULL,
	`results` text NOT NULL,
	`mandatory_total` integer DEFAULT 0 NOT NULL,
	`mandatory_failed` integer DEFAULT 0 NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`triggered_by_label` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rgr_version_idx` ON `release_gate_runs` (`release_version`,`started_at`);--> statement-breakpoint
CREATE TABLE `role_app_enablements` (
	`id` text PRIMARY KEY NOT NULL,
	`role_app_id` text NOT NULL,
	`version_id` text,
	`scope_kind` text NOT NULL,
	`scope_id` text NOT NULL,
	`enabled` integer NOT NULL,
	`changed_at` text NOT NULL,
	`changed_by_label` text NOT NULL,
	`changed_by_user_id` text,
	`reason` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rae_scope_unq` ON `role_app_enablements` (`role_app_id`,`scope_kind`,`scope_id`);--> statement-breakpoint
CREATE TABLE `role_app_lifecycle_events` (
	`id` text PRIMARY KEY NOT NULL,
	`role_app_id` text NOT NULL,
	`version_id` text,
	`kind` text NOT NULL,
	`from_state` text,
	`to_state` text,
	`scope_kind` text,
	`scope_id` text,
	`actor_kind` text NOT NULL,
	`actor_user_id` text,
	`actor_label` text NOT NULL,
	`at` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`approval_id` text,
	`evaluation_run_id` text
);
--> statement-breakpoint
CREATE INDEX `rale_app_idx` ON `role_app_lifecycle_events` (`role_app_id`,`at`);--> statement-breakpoint
CREATE TABLE `role_app_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`role_app_id` text NOT NULL,
	`role_id` text NOT NULL,
	`version` text NOT NULL,
	`lifecycle_state` text NOT NULL,
	`is_current` integer DEFAULT false NOT NULL,
	`process_id` text,
	`process_definition_digest` text,
	`process_stage_ids` text NOT NULL,
	`implemented_stage_ids` text NOT NULL,
	`source_requirements` text NOT NULL,
	`tools` text NOT NULL,
	`authority` text NOT NULL,
	`evaluations` text NOT NULL,
	`connector_dependencies` text NOT NULL,
	`migration_tag` text,
	`release_notes` text DEFAULT '' NOT NULL,
	`release_notes_de` text DEFAULT '' NOT NULL,
	`support_state` text NOT NULL,
	`evaluation_run_id` text,
	`approval_id` text,
	`created_at` text NOT NULL,
	`created_by_label` text NOT NULL,
	`released_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rav_app_version_unq` ON `role_app_versions` (`role_app_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `rav_current_unq` ON `role_app_versions` (`role_app_id`) WHERE "role_app_versions"."is_current" = 1;--> statement-breakpoint
CREATE TABLE `saved_views` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`surface` text NOT NULL,
	`name` text NOT NULL,
	`filters` text NOT NULL,
	`sort` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sview_name_unq` ON `saved_views` (`run_id`,`user_id`,`role_id`,`surface`,`name`);--> statement-breakpoint
CREATE TABLE `user_object_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`list` text NOT NULL,
	`object_kind` text NOT NULL,
	`object_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`touched_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uol_entry_unq` ON `user_object_lists` (`run_id`,`user_id`,`role_id`,`list`,`object_kind`,`object_id`);--> statement-breakpoint
CREATE INDEX `uol_list_idx` ON `user_object_lists` (`run_id`,`user_id`,`role_id`,`list`,`position`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`user_id` text NOT NULL,
	`language` text,
	`theme` text,
	`default_work_tab` text,
	`notification_preference` text DEFAULT 'standard' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `upref_person_unq` ON `user_preferences` (`run_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `inbox_messages` ADD `converted_by_user_id` text;--> statement-breakpoint
ALTER TABLE `inbox_messages` ADD `converted_at` text;--> statement-breakpoint
ALTER TABLE `decisions` ADD `due_at` text;--> statement-breakpoint
ALTER TABLE `ai_suggestions` ADD `disposition` text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_suggestions` ADD `disposition_at` text;--> statement-breakpoint
ALTER TABLE `ai_suggestions` ADD `disposition_by_user_id` text;--> statement-breakpoint
UPDATE `inbox_messages` SET
  `converted_by_user_id` = (SELECT e.`actor_user_id` FROM `os_events` e WHERE e.`run_id` = `inbox_messages`.`run_id` AND (substr(e.`idempotency_key`, 1, length('inbox-converted:' || `inbox_messages`.`id` || ':action:')) = 'inbox-converted:' || `inbox_messages`.`id` || ':action:' OR substr(e.`idempotency_key`, 1, length('inbox-converted:' || `inbox_messages`.`id` || ':decision:')) = 'inbox-converted:' || `inbox_messages`.`id` || ':decision:') ORDER BY e.`sequence` LIMIT 1),
  `converted_at` = (SELECT e.`occurred_at` FROM `os_events` e WHERE e.`run_id` = `inbox_messages`.`run_id` AND (substr(e.`idempotency_key`, 1, length('inbox-converted:' || `inbox_messages`.`id` || ':action:')) = 'inbox-converted:' || `inbox_messages`.`id` || ':action:' OR substr(e.`idempotency_key`, 1, length('inbox-converted:' || `inbox_messages`.`id` || ':decision:')) = 'inbox-converted:' || `inbox_messages`.`id` || ':decision:') ORDER BY e.`sequence` LIMIT 1)
WHERE `converted_at` IS NULL
  AND (`linked_action_id` IS NOT NULL OR `linked_decision_id` IS NOT NULL)
  AND EXISTS (SELECT 1 FROM `os_events` e WHERE e.`run_id` = `inbox_messages`.`run_id` AND (substr(e.`idempotency_key`, 1, length('inbox-converted:' || `inbox_messages`.`id` || ':action:')) = 'inbox-converted:' || `inbox_messages`.`id` || ':action:' OR substr(e.`idempotency_key`, 1, length('inbox-converted:' || `inbox_messages`.`id` || ':decision:')) = 'inbox-converted:' || `inbox_messages`.`id` || ':decision:'));--> statement-breakpoint
UPDATE `decisions` SET `due_at` = CASE `id`
  WHEN 'DEC-2026-0745' THEN '2026-10-06T10:30:00.000Z'
  WHEN 'DEC-2026-0772' THEN '2026-10-06T12:00:00.000Z'
  WHEN 'DEC-2026-0782' THEN '2026-10-08T12:00:00.000Z'
  END
WHERE `due_at` IS NULL AND `run_id` = 'run-001'
  AND ((`id` = 'DEC-2026-0745' AND `reference` = 'RCSA-D3')
    OR (`id` = 'DEC-2026-0772' AND `reference` = 'RCSA-D4')
    OR (`id` = 'DEC-2026-0782' AND `reference` = 'RCSA-D5'));
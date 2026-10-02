CREATE TABLE `active_product_config` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_profile_id` text NOT NULL,
	`brand_profile_id_override` text,
	`updated_at` text NOT NULL,
	`updated_by` text DEFAULT 'system' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `brand_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`product_name` text NOT NULL,
	`short_name` text NOT NULL,
	`client_name` text NOT NULL,
	`operator_name` text,
	`primary_logo_url` text,
	`secondary_logo_url` text,
	`favicon_url` text,
	`support_label` text,
	`support_url` text,
	`legal_notice` text,
	`accent_token` text,
	`synthetic_disclosure` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deployment_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`region` text NOT NULL,
	`identity_mode` text NOT NULL,
	`model_endpoint_profile` text NOT NULL,
	`data_retention_profile` text NOT NULL,
	`observability_profile` text NOT NULL,
	`environment` text NOT NULL,
	`version` text NOT NULL,
	`implemented_here` integer NOT NULL,
	`outstanding_work` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entitlement_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`function_packs` text NOT NULL,
	`connector_packs` text NOT NULL,
	`ai_features` text NOT NULL,
	`admin_features` text NOT NULL,
	`deployment_profile` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `function_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_de` text NOT NULL,
	`version` text NOT NULL,
	`description` text NOT NULL,
	`primary_role_id` text NOT NULL,
	`domain_objects` text NOT NULL,
	`roles` text NOT NULL,
	`tools` text NOT NULL,
	`screens` text NOT NULL,
	`evaluations` text NOT NULL,
	`connector_dependencies` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `organisation_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`countries` text NOT NULL,
	`legal_entity_ids` text NOT NULL,
	`default_locale` text NOT NULL,
	`supported_locales` text NOT NULL,
	`timezone` text NOT NULL,
	`date_format` text NOT NULL,
	`time_format` text NOT NULL,
	`terminology_profile_id` text NOT NULL,
	`brand_profile_id` text NOT NULL,
	`entitlement_profile_id` text NOT NULL,
	`deployment_profile_id` text NOT NULL,
	`working_day_start` text DEFAULT '07:00' NOT NULL,
	`working_day_end` text DEFAULT '19:00' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_config_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`area` text NOT NULL,
	`summary` text NOT NULL,
	`previous_value` text,
	`new_value` text,
	`changed_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pcc_area_idx` ON `product_config_changes` (`area`,`at`);--> statement-breakpoint
CREATE TABLE `terminology_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`terms` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `connector_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`pack_id` text NOT NULL,
	`connector_key` text NOT NULL,
	`display_name` text NOT NULL,
	`source_system` text NOT NULL,
	`mode` text NOT NULL,
	`health_state` text NOT NULL,
	`health_message` text DEFAULT '' NOT NULL,
	`capabilities` text NOT NULL,
	`endpoint_label` text DEFAULT '' NOT NULL,
	`secret_status` text NOT NULL,
	`write_enabled` integer DEFAULT false NOT NULL,
	`event_subscription_status` text NOT NULL,
	`last_sync_at` text,
	`last_sync_status` text,
	`deep_link_template` text,
	`required_by_packs` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ci_pack_idx` ON `connector_instances` (`pack_id`);--> statement-breakpoint
CREATE INDEX `ci_mode_idx` ON `connector_instances` (`mode`);--> statement-breakpoint
CREATE TABLE `connector_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`family` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`named_adapters` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `connector_sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`connector_instance_id` text NOT NULL,
	`object_type` text NOT NULL,
	`last_cursor` text,
	`last_sync_at` text,
	`last_sync_status` text DEFAULT 'never-run' NOT NULL,
	`records_seen` integer DEFAULT 0 NOT NULL,
	`records_changed` integer DEFAULT 0 NOT NULL,
	`records_conflicted` integer DEFAULT 0 NOT NULL,
	`staleness_threshold_minutes` integer DEFAULT 120 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `css_run_idx` ON `connector_sync_state` (`run_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `css_instance_type_unq` ON `connector_sync_state` (`connector_instance_id`,`object_type`);--> statement-breakpoint
CREATE TABLE `dead_letter_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`command_id` text NOT NULL,
	`connector_instance_id` text NOT NULL,
	`reason` text NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`attempts` integer NOT NULL,
	`payload_digest` text NOT NULL,
	`entered_at` text NOT NULL,
	`at_moment` text NOT NULL,
	`resolved_at` text,
	`resolution` text DEFAULT '' NOT NULL,
	`retryable` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dle_run_idx` ON `dead_letter_entries` (`run_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dle_command_unq` ON `dead_letter_entries` (`command_id`);--> statement-breakpoint
CREATE TABLE `external_execution_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`command_id` text NOT NULL,
	`connector_instance_id` text NOT NULL,
	`target_system` text NOT NULL,
	`external_type` text NOT NULL,
	`external_id` text NOT NULL,
	`external_url` text,
	`external_version` text,
	`statement` text NOT NULL,
	`statement_de` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`status_detail` text DEFAULT '' NOT NULL,
	`retry_state` text DEFAULT '' NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	`completed_at` text,
	`at_moment` text NOT NULL,
	`audit_event_id` text,
	`decision_id` text,
	`sequence` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `eer_command_idx` ON `external_execution_receipts` (`command_id`);--> statement-breakpoint
CREATE INDEX `eer_decision_idx` ON `external_execution_receipts` (`decision_id`);--> statement-breakpoint
CREATE INDEX `eer_run_idx` ON `external_execution_receipts` (`run_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `external_references` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`connector_instance_id` text NOT NULL,
	`source_system` text NOT NULL,
	`external_type` text NOT NULL,
	`external_id` text NOT NULL,
	`external_url` text,
	`external_version` text,
	`source_updated_at` text,
	`synced_at` text NOT NULL,
	`freshness_status` text NOT NULL,
	`canonical_type` text NOT NULL,
	`canonical_id` text NOT NULL,
	`conflicted` integer DEFAULT false NOT NULL,
	`conflict_note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `er_canonical_idx` ON `external_references` (`canonical_type`,`canonical_id`);--> statement-breakpoint
CREATE INDEX `er_run_idx` ON `external_references` (`run_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `er_identity_unq` ON `external_references` (`connector_instance_id`,`external_type`,`external_id`);--> statement-breakpoint
CREATE TABLE `integration_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`connector_instance_id` text NOT NULL,
	`command_kind` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`acting_user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`actor_kind` text NOT NULL,
	`authority_class` text NOT NULL,
	`approval_id` text,
	`decision_id` text,
	`tool_name` text DEFAULT '' NOT NULL,
	`source_canonical_type` text DEFAULT '' NOT NULL,
	`source_canonical_id` text DEFAULT '' NOT NULL,
	`target_external_type` text NOT NULL,
	`target_external_id` text,
	`expected_version` text,
	`payload` text NOT NULL,
	`payload_digest` text NOT NULL,
	`intent_statement` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`next_attempt_at` text,
	`last_error` text DEFAULT '' NOT NULL,
	`correlation_id` text NOT NULL,
	`trace_id` text NOT NULL,
	`at_moment` text NOT NULL,
	`created_at` text NOT NULL,
	`queued_at` text,
	`executed_at` text,
	`acknowledged_at` text,
	`sequence` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ic_run_status_idx` ON `integration_commands` (`run_id`,`status`);--> statement-breakpoint
CREATE INDEX `ic_decision_idx` ON `integration_commands` (`decision_id`);--> statement-breakpoint
CREATE INDEX `ic_connector_idx` ON `integration_commands` (`connector_instance_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ic_idempotency_unq` ON `integration_commands` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `integration_events` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`connector_instance_id` text NOT NULL,
	`direction` text NOT NULL,
	`event_key` text NOT NULL,
	`external_event_id` text,
	`event_type` text NOT NULL,
	`payload_digest` text NOT NULL,
	`canonical_type` text DEFAULT '' NOT NULL,
	`canonical_id` text DEFAULT '' NOT NULL,
	`external_reference_id` text,
	`summary` text NOT NULL,
	`severity` text DEFAULT 'informational' NOT NULL,
	`received_at` text NOT NULL,
	`at_moment` text NOT NULL,
	`processed_at` text,
	`status` text NOT NULL,
	`rejection_reason` text DEFAULT '' NOT NULL,
	`correlation_id` text NOT NULL,
	`trace_id` text NOT NULL,
	`live_event_id` text
);
--> statement-breakpoint
CREATE INDEX `ie_run_direction_idx` ON `integration_events` (`run_id`,`direction`);--> statement-breakpoint
CREATE INDEX `ie_moment_idx` ON `integration_events` (`run_id`,`at_moment`);--> statement-breakpoint
CREATE UNIQUE INDEX `ie_event_key_unq` ON `integration_events` (`connector_instance_id`,`event_key`);--> statement-breakpoint
CREATE TABLE `source_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`connector_instance_id` text NOT NULL,
	`external_type` text NOT NULL,
	`canonical_type` text NOT NULL,
	`field_mappings` text NOT NULL,
	`taxonomy_mappings` text NOT NULL,
	`conflict_policy` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sm_connector_idx` ON `source_mappings` (`connector_instance_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sm_connector_type_unq` ON `source_mappings` (`connector_instance_id`,`external_type`);--> statement-breakpoint
CREATE TABLE `source_requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`context_type` text NOT NULL,
	`context_id` text NOT NULL,
	`connector_instance_id` text NOT NULL,
	`object_type` text NOT NULL,
	`necessity` text NOT NULL,
	`rationale` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sr_context_idx` ON `source_requirements` (`context_type`,`context_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sr_unq` ON `source_requirements` (`context_type`,`context_id`,`connector_instance_id`,`object_type`);--> statement-breakpoint
CREATE TABLE `ai_activity_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`role_id` text NOT NULL,
	`at_moment` text NOT NULL,
	`sequence` integer NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`label_de` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`object_type` text DEFAULT '' NOT NULL,
	`object_id` text DEFAULT '' NOT NULL,
	`tool_name` text DEFAULT '' NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`outcome` text DEFAULT '' NOT NULL,
	`authority_class` text DEFAULT '' NOT NULL,
	`audit_event_id` text,
	`tool_call_id` text,
	`evidence_ids` text NOT NULL,
	`suggestion_id` text,
	`event_id` text,
	`connector_instance_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `aae_run_role_seq_idx` ON `ai_activity_entries` (`run_id`,`role_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `aae_suggestion_idx` ON `ai_activity_entries` (`suggestion_id`);--> statement-breakpoint
CREATE INDEX `aae_moment_idx` ON `ai_activity_entries` (`run_id`,`at_moment`);--> statement-breakpoint
CREATE TABLE `ai_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`role_id` text NOT NULL,
	`event_id` text,
	`object_type` text NOT NULL,
	`object_id` text NOT NULL,
	`at_moment` text NOT NULL,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`headline` text NOT NULL,
	`change_summary` text NOT NULL,
	`why_it_matters` text NOT NULL,
	`checks_completed` text NOT NULL,
	`actions_completed` text NOT NULL,
	`recommended_action` text,
	`alternatives` text NOT NULL,
	`evidence_ids` text NOT NULL,
	`confidence` integer NOT NULL,
	`uncertainty` text NOT NULL,
	`decision_required` integer NOT NULL,
	`authority_class` text NOT NULL,
	`decision_id` text,
	`source` text NOT NULL,
	`constrained` integer DEFAULT false NOT NULL,
	`missing_required_sources` text NOT NULL,
	`source_connector_ids` text NOT NULL,
	`stages` text NOT NULL,
	`state_digest` text NOT NULL,
	`agent_run_id` text,
	`model` text DEFAULT '' NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`validated_at` text,
	`created_at` text NOT NULL,
	`dismissed_at` text,
	`snoozed_until_moment` text
);
--> statement-breakpoint
CREATE INDEX `ais_run_role_idx` ON `ai_suggestions` (`run_id`,`role_id`,`at_moment`);--> statement-breakpoint
CREATE INDEX `ais_event_idx` ON `ai_suggestions` (`event_id`);--> statement-breakpoint
CREATE INDEX `ais_digest_idx` ON `ai_suggestions` (`state_digest`);--> statement-breakpoint
CREATE INDEX `ais_object_idx` ON `ai_suggestions` (`object_type`,`object_id`);--> statement-breakpoint
CREATE TABLE `chat_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`role_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`started_at_moment` text NOT NULL,
	`last_active_at_moment` text NOT NULL,
	`agent_session_id` text,
	`created_at` text NOT NULL,
	`closed_at` text
);
--> statement-breakpoint
CREATE INDEX `ct_run_role_idx` ON `chat_threads` (`run_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `chat_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`run_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`author` text NOT NULL,
	`at_moment` text NOT NULL,
	`context_object_type` text DEFAULT '' NOT NULL,
	`context_object_id` text DEFAULT '' NOT NULL,
	`context_event_id` text,
	`context_decision_id` text,
	`parts` text NOT NULL,
	`plain_text` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'seeded' NOT NULL,
	`agent_run_id` text,
	`model` text DEFAULT '' NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ctn_thread_seq_idx` ON `chat_turns` (`thread_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `ctn_run_idx` ON `chat_turns` (`run_id`);--> statement-breakpoint
CREATE TABLE `live_player_state` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`playing` integer DEFAULT false NOT NULL,
	`speed` integer DEFAULT 1 NOT NULL,
	`viewed_moment` text NOT NULL,
	`paused_by_decision_id` text,
	`paused_reason` text DEFAULT '' NOT NULL,
	`catch_up_active` integer DEFAULT false NOT NULL,
	`catch_up_index` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workday_live_event_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`event_id` text NOT NULL,
	`role_id` text NOT NULL,
	`read_at` text,
	`acknowledged_at` text,
	`reviewed_in_catch_up` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wler_run_role_idx` ON `workday_live_event_reads` (`run_id`,`role_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `wler_event_role_unq` ON `workday_live_event_reads` (`event_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `workday_live_events` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`at_moment` text NOT NULL,
	`sort_order` integer NOT NULL,
	`type` text NOT NULL,
	`role_ids` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`title_de` text NOT NULL,
	`summary` text NOT NULL,
	`summary_de` text NOT NULL,
	`object_type` text NOT NULL,
	`object_id` text NOT NULL,
	`evidence_ids` text NOT NULL,
	`requires_decision` integer NOT NULL,
	`auto_pause` integer NOT NULL,
	`decision_id` text,
	`derived_from` text NOT NULL,
	`derived_from_id` text DEFAULT '' NOT NULL,
	`integration_event_id` text,
	`source_connector_ids` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wle_run_moment_idx` ON `workday_live_events` (`run_id`,`at_moment`,`sort_order`);--> statement-breakpoint
CREATE INDEX `wle_decision_idx` ON `workday_live_events` (`decision_id`);
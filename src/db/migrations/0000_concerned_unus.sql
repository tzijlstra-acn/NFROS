CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`at_moment` text NOT NULL,
	`recorded_at` text NOT NULL,
	`category` text NOT NULL,
	`action` text NOT NULL,
	`object_kind` text NOT NULL,
	`object_id` text NOT NULL,
	`actor_user_id` text,
	`actor_kind` text NOT NULL,
	`role_id` text,
	`entity_id` text,
	`summary` text NOT NULL,
	`authority_class` text,
	`decision_id` text,
	`approval_id` text,
	`blocked` integer DEFAULT false NOT NULL,
	`blocked_reason` text,
	`reversible` integer DEFAULT false NOT NULL,
	`detail` text,
	`pre_existing` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_run_idx` ON `audit_events` (`run_id`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `audit_object_idx` ON `audit_events` (`object_kind`,`object_id`);--> statement-breakpoint
CREATE INDEX `audit_role_idx` ON `audit_events` (`run_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `legal_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`regulatory_bloc` text NOT NULL,
	`currency` text NOT NULL,
	`locations` text NOT NULL,
	`employee_count` integer NOT NULL,
	`supervisory_context` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`title` text NOT NULL,
	`title_de` text NOT NULL,
	`mandate` text NOT NULL,
	`hero_visual` text NOT NULL,
	`hero_visual_label` text NOT NULL,
	`holder_user_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`human_owned_decisions` text NOT NULL,
	`primary_objects` text NOT NULL,
	`specialist_agent` text NOT NULL,
	`sort_order` integer NOT NULL,
	`deeply_interactive` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scenario_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`scenario_date` text NOT NULL,
	`created_at` text NOT NULL,
	`current_moment` text NOT NULL,
	`active_role_id` text NOT NULL,
	`autonomy_level` text NOT NULL,
	`world_view` text NOT NULL,
	`language` text NOT NULL,
	`event_triggered` integer NOT NULL,
	`seeded_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `timeline_events` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`moment` text NOT NULL,
	`sort_order` integer NOT NULL,
	`title` text NOT NULL,
	`title_de` text NOT NULL,
	`dominant_lane` text NOT NULL,
	`is_shared_event` integer NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `timeline_run_sort_idx` ON `timeline_events` (`run_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `timeline_role_moments` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`timeline_event_id` text NOT NULL,
	`role_id` text NOT NULL,
	`work_object_kind` text NOT NULL,
	`work_object_id` text,
	`headline` text NOT NULL,
	`today_narrative` text NOT NULL,
	`today_signals` text NOT NULL,
	`future_narrative` text NOT NULL,
	`future_signals` text NOT NULL,
	`evidence_ids` text NOT NULL,
	`decision_ids` text NOT NULL,
	`uncertainty_note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `trm_run_role_idx` ON `timeline_role_moments` (`run_id`,`role_id`);--> statement-breakpoint
CREATE INDEX `trm_event_idx` ON `timeline_role_moments` (`timeline_event_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`name` text NOT NULL,
	`job_title` text NOT NULL,
	`entity_id` text NOT NULL,
	`role_id` text,
	`line` text NOT NULL,
	`department` text NOT NULL,
	`email` text NOT NULL,
	`persona` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `users_run_role_idx` ON `users` (`run_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `contract_obligations` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`contract_id` text NOT NULL,
	`clause_reference` text NOT NULL,
	`obligation_text` text NOT NULL,
	`category` text NOT NULL,
	`evidence_status` text NOT NULL,
	`evidence_document_ids` text NOT NULL,
	`note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contr_obl_idx` ON `contract_obligations` (`run_id`,`contract_id`);--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`reference` text NOT NULL,
	`title` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`document_type` text NOT NULL,
	`notice_period_days` integer,
	`audit_rights_secured` integer DEFAULT false NOT NULL,
	`subprocessor_consent_model` text DEFAULT '' NOT NULL,
	`evidence_document_id` text,
	`summary` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contracts_supplier_idx` ON `contracts` (`run_id`,`supplier_id`);--> statement-breakpoint
CREATE TABLE `controls` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`reference` text NOT NULL,
	`title` text NOT NULL,
	`title_de` text NOT NULL,
	`description` text NOT NULL,
	`risk_ids` text NOT NULL,
	`process_ids` text NOT NULL,
	`entity_ids` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`nature` text NOT NULL,
	`automation` text NOT NULL,
	`frequency` text NOT NULL,
	`is_key_control` integer NOT NULL,
	`current_effectiveness` text NOT NULL,
	`effectiveness_set_by` text DEFAULT 'seed' NOT NULL,
	`effectiveness_set_at` text,
	`first_line_effectiveness` text NOT NULL,
	`last_tested_on` text,
	`design_note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `controls_run_idx` ON `controls` (`run_id`);--> statement-breakpoint
CREATE TABLE `impact_tolerances` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`service_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`metric` text NOT NULL,
	`threshold_minutes` integer,
	`threshold_volume` integer,
	`unit` text NOT NULL,
	`statement` text NOT NULL,
	`consumed_minutes` integer DEFAULT 0 NOT NULL,
	`approved_by` text NOT NULL,
	`approved_on` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tol_service_idx` ON `impact_tolerances` (`run_id`,`service_id`);--> statement-breakpoint
CREATE TABLE `kri_readings` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`kri_id` text NOT NULL,
	`period` text NOT NULL,
	`period_end` text NOT NULL,
	`value` real NOT NULL,
	`status` text NOT NULL,
	`commentary` text DEFAULT '' NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `kri_read_idx` ON `kri_readings` (`run_id`,`kri_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `kris` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`reference` text NOT NULL,
	`name` text NOT NULL,
	`name_de` text NOT NULL,
	`risk_ids` text NOT NULL,
	`process_ids` text NOT NULL,
	`entity_id` text NOT NULL,
	`unit` text NOT NULL,
	`adverse_direction` text NOT NULL,
	`amber_threshold` real NOT NULL,
	`red_threshold` real NOT NULL,
	`owner_user_id` text NOT NULL,
	`definition` text NOT NULL,
	`current_status` text NOT NULL,
	`current_value` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `kris_run_idx` ON `kris` (`run_id`);--> statement-breakpoint
CREATE TABLE `processes` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`name` text NOT NULL,
	`name_de` text NOT NULL,
	`code` text NOT NULL,
	`parent_process_id` text,
	`service_id` text,
	`entity_ids` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`description` text NOT NULL,
	`monthly_volume` integer,
	`manual_touch_rate` real,
	`recent_change_note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `processes_run_idx` ON `processes` (`run_id`);--> statement-breakpoint
CREATE TABLE `risks` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`title` text NOT NULL,
	`title_de` text NOT NULL,
	`taxonomy_l1` text NOT NULL,
	`taxonomy_l2` text NOT NULL,
	`process_ids` text NOT NULL,
	`entity_ids` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`description` text NOT NULL,
	`inherent_likelihood` integer NOT NULL,
	`inherent_impact` integer NOT NULL,
	`appetite_statement` text DEFAULT '' NOT NULL,
	`appetite_position` text DEFAULT 'within' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `risks_run_idx` ON `risks` (`run_id`);--> statement-breakpoint
CREATE TABLE `service_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`from_kind` text NOT NULL,
	`from_id` text NOT NULL,
	`to_kind` text NOT NULL,
	`to_id` text NOT NULL,
	`dependency_strength` text NOT NULL,
	`single_point_of_failure` integer DEFAULT false NOT NULL,
	`affected_by_event` integer DEFAULT false NOT NULL,
	`note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `svcdep_run_idx` ON `service_dependencies` (`run_id`,`from_id`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`name` text NOT NULL,
	`name_de` text NOT NULL,
	`is_important_business_service` integer NOT NULL,
	`entity_ids` text NOT NULL,
	`owner_user_id` text,
	`domain` text NOT NULL,
	`description` text NOT NULL,
	`supplier_ids` text NOT NULL,
	`operational_status` text DEFAULT 'normal' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `services_run_idx` ON `services` (`run_id`);--> statement-breakpoint
CREATE TABLE `subprocessors` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`name` text NOT NULL,
	`domicile` text NOT NULL,
	`data_location` text NOT NULL,
	`function_provided` text NOT NULL,
	`declared_in` text NOT NULL,
	`is_discrepancy` integer DEFAULT false NOT NULL,
	`discrepancy_note` text DEFAULT '' NOT NULL,
	`supports_critical_function` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `subproc_supplier_idx` ON `subprocessors` (`run_id`,`supplier_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`name` text NOT NULL,
	`legal_form` text NOT NULL,
	`domicile` text NOT NULL,
	`criticality` text NOT NULL,
	`is_outsourcing` integer NOT NULL,
	`contracting_entity_ids` text NOT NULL,
	`status` text NOT NULL,
	`last_assessment_date` text,
	`next_assessment_due` text,
	`annual_spend` integer,
	`spend_currency` text,
	`relationship_owner_user_id` text,
	`description` text NOT NULL,
	`concentration_note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `suppliers_run_idx` ON `suppliers` (`run_id`);--> statement-breakpoint
CREATE TABLE `assessment_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`assessment_id` text NOT NULL,
	`risk_id` text NOT NULL,
	`control_ids` text NOT NULL,
	`inherent_likelihood` integer NOT NULL,
	`inherent_impact` integer NOT NULL,
	`control_effectiveness` text NOT NULL,
	`residual_likelihood` integer NOT NULL,
	`residual_impact` integer NOT NULL,
	`residual_rating` text NOT NULL,
	`appetite_position` text NOT NULL,
	`commentary` text DEFAULT '' NOT NULL,
	`change_from_previous` text DEFAULT '' NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assess_line_idx` ON `assessment_lines` (`run_id`,`assessment_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`kind` text NOT NULL,
	`reference` text NOT NULL,
	`title` text NOT NULL,
	`subject_kind` text NOT NULL,
	`subject_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`cycle` text NOT NULL,
	`performed_by_user_id` text NOT NULL,
	`approved_by_user_id` text,
	`performed_on` text NOT NULL,
	`approved_on` text,
	`superseded_by` text,
	`residual_risk` text NOT NULL,
	`overall_conclusion` text NOT NULL,
	`rationale` text DEFAULT '' NOT NULL,
	`created_by_session` integer DEFAULT false NOT NULL,
	`source_decision_id` text
);
--> statement-breakpoint
CREATE INDEX `assess_run_subject_idx` ON `assessments` (`run_id`,`subject_kind`,`subject_id`);--> statement-breakpoint
CREATE INDEX `assess_status_idx` ON `assessments` (`run_id`,`status`);--> statement-breakpoint
CREATE TABLE `control_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`reference` text NOT NULL,
	`control_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`title` text NOT NULL,
	`test_type` text NOT NULL,
	`tester_user_id` text NOT NULL,
	`period_from` text NOT NULL,
	`period_to` text NOT NULL,
	`population_size` integer NOT NULL,
	`sample_size` integer NOT NULL,
	`sampling_method` text NOT NULL,
	`sampling_rationale` text NOT NULL,
	`test_procedure` text NOT NULL,
	`status` text NOT NULL,
	`exception_count` integer DEFAULT 0 NOT NULL,
	`preliminary_conclusion` text DEFAULT '' NOT NULL,
	`assurance_conclusion` text,
	`concluded_by_user_id` text,
	`concluded_on` text,
	`management_response` text DEFAULT '' NOT NULL,
	`management_response_by` text,
	`includes_event_population` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ctest_run_control_idx` ON `control_tests` (`run_id`,`control_id`);--> statement-breakpoint
CREATE TABLE `incident_events` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`incident_id` text NOT NULL,
	`at_moment` text NOT NULL,
	`sort_order` integer NOT NULL,
	`channel` text NOT NULL,
	`source_label` text NOT NULL,
	`source_user_id` text,
	`provenance` text NOT NULL,
	`statement` text NOT NULL,
	`conflicts_with_id` text,
	`conflict_resolution` text DEFAULT '' NOT NULL,
	`confidence` real,
	`evidence_document_ids` text NOT NULL,
	`revealed_at_moment` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `incev_incident_idx` ON `incident_events` (`run_id`,`incident_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`reference` text NOT NULL,
	`title` text NOT NULL,
	`title_de` text NOT NULL,
	`entity_ids` text NOT NULL,
	`service_ids` text NOT NULL,
	`supplier_ids` text NOT NULL,
	`process_ids` text NOT NULL,
	`detected_at` text NOT NULL,
	`occurred_at` text,
	`closed_at` text,
	`kind` text NOT NULL,
	`severity` text,
	`severity_set_by_user_id` text,
	`proposed_severity` text,
	`status` text NOT NULL,
	`regulatory_classification` text,
	`notification_recommended` integer,
	`notification_rationale` text,
	`gross_loss_minor` integer,
	`loss_currency` text,
	`description` text NOT NULL,
	`lead_user_id` text,
	`is_shared_event` integer DEFAULT false NOT NULL,
	`lessons_learned` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `incidents_run_idx` ON `incidents` (`run_id`);--> statement-breakpoint
CREATE TABLE `obligations` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`publication_id` text NOT NULL,
	`paragraph_reference` text NOT NULL,
	`obligation_text` text NOT NULL,
	`extracted_summary` text NOT NULL,
	`extraction_confidence` real NOT NULL,
	`theme` text NOT NULL,
	`candidate_entity_ids` text NOT NULL,
	`applicability_decision` text,
	`applicability_rationale` text,
	`decided_by_user_id` text,
	`decided_on` text,
	`policy_ids` text NOT NULL,
	`process_ids` text NOT NULL,
	`control_ids` text NOT NULL,
	`is_unowned_gap` integer DEFAULT false NOT NULL,
	`gap_note` text DEFAULT '' NOT NULL,
	`owner_user_id` text,
	`implementation_priority` text,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `obl_pub_idx` ON `obligations` (`run_id`,`publication_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `obl_gap_idx` ON `obligations` (`run_id`,`is_unowned_gap`);--> statement-breakpoint
CREATE TABLE `policies` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`reference` text NOT NULL,
	`title` text NOT NULL,
	`title_de` text NOT NULL,
	`section` text NOT NULL,
	`section_title` text NOT NULL,
	`scope` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`version` text NOT NULL,
	`effective_from` text NOT NULL,
	`next_review_due` text,
	`body` text NOT NULL,
	`related_role_ids` text NOT NULL,
	`control_ids` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `policies_run_idx` ON `policies` (`run_id`);--> statement-breakpoint
CREATE TABLE `recovery_options` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`incident_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`estimated_minutes_to_restore` integer NOT NULL,
	`control_trade_off` text NOT NULL,
	`operational_risk` text NOT NULL,
	`availability` text NOT NULL,
	`requires_approval_from` text DEFAULT '' NOT NULL,
	`selected` integer DEFAULT false NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recopt_incident_idx` ON `recovery_options` (`run_id`,`incident_id`);--> statement-breakpoint
CREATE TABLE `regulatory_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`reference` text NOT NULL,
	`title` text NOT NULL,
	`issuer` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`published_on` text NOT NULL,
	`effective_from` text,
	`consultation_closes` text,
	`instrument_type` text NOT NULL,
	`summary` text NOT NULL,
	`full_text` text NOT NULL,
	`evidence_document_id` text
);
--> statement-breakpoint
CREATE INDEX `regpub_run_idx` ON `regulatory_publications` (`run_id`);--> statement-breakpoint
CREATE TABLE `test_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`control_test_id` text NOT NULL,
	`transaction_ref` text NOT NULL,
	`occurred_at` text NOT NULL,
	`entity_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`repair_reason` text NOT NULL,
	`repaired_by_user_id` text NOT NULL,
	`reviewer_user_id` text,
	`secondary_review_evidenced` integer NOT NULL,
	`review_evidence_ref` text,
	`in_sample` integer DEFAULT false NOT NULL,
	`outcome` text NOT NULL,
	`anomaly_kind` text,
	`exception_classification` text,
	`exception_scope` text,
	`root_cause` text,
	`classified_by_user_id` text,
	`classified_at` text,
	`from_fallback_route` integer DEFAULT false NOT NULL,
	`evidence_document_ids` text NOT NULL,
	`note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tcase_test_idx` ON `test_cases` (`run_id`,`control_test_id`);--> statement-breakpoint
CREATE INDEX `tcase_outcome_idx` ON `test_cases` (`run_id`,`outcome`);--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`role_id` text NOT NULL,
	`title` text NOT NULL,
	`title_de` text DEFAULT '' NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`moment_label` text,
	`location` text DEFAULT '' NOT NULL,
	`attendee_user_ids` text NOT NULL,
	`kind` text NOT NULL,
	`has_conflict` integer DEFAULT false NOT NULL,
	`conflict_with_id` text,
	`meeting_id` text,
	`preparation_status` text DEFAULT 'not-started' NOT NULL,
	`agenda` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cal_run_role_idx` ON `calendar_events` (`run_id`,`role_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `collaboration_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`from_role_id` text NOT NULL,
	`to_user_ids` text NOT NULL,
	`channel_name` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`sent_at_moment` text NOT NULL,
	`sent_at` text NOT NULL,
	`simulated_only` integer DEFAULT true NOT NULL,
	`related_object_kind` text,
	`related_object_id` text,
	`decision_id` text,
	`reply_body` text DEFAULT '' NOT NULL,
	`reply_from_user_id` text,
	`reply_at_moment` text
);
--> statement-breakpoint
CREATE INDEX `collab_run_idx` ON `collaboration_messages` (`run_id`,`from_role_id`);--> statement-breakpoint
CREATE TABLE `evidence_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`document_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`locator` text NOT NULL,
	`content` text NOT NULL,
	`embedding` text,
	`embedding_model` text,
	`embedded_at` text,
	`token_estimate` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `evchunk_doc_idx` ON `evidence_chunks` (`run_id`,`document_id`,`chunk_index`);--> statement-breakpoint
CREATE TABLE `evidence_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`reference` text NOT NULL,
	`title` text NOT NULL,
	`title_de` text DEFAULT '' NOT NULL,
	`source_type` text NOT NULL,
	`source_system` text NOT NULL,
	`author_label` text NOT NULL,
	`author_user_id` text,
	`document_date` text NOT NULL,
	`ingested_at` text NOT NULL,
	`entity_ids` text NOT NULL,
	`data_classification` text NOT NULL,
	`status` text NOT NULL,
	`requested_from_label` text,
	`requested_on` text,
	`is_stale` integer DEFAULT false NOT NULL,
	`staleness_note` text DEFAULT '' NOT NULL,
	`provenance` text NOT NULL,
	`body` text NOT NULL,
	`summary` text NOT NULL,
	`related_object_ids` text NOT NULL,
	`page_count` integer DEFAULT 1 NOT NULL,
	`from_shared_event` integer DEFAULT false NOT NULL,
	`revealed_at_moment` text DEFAULT '07:45' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `evdoc_run_idx` ON `evidence_documents` (`run_id`);--> statement-breakpoint
CREATE INDEX `evdoc_type_idx` ON `evidence_documents` (`run_id`,`source_type`);--> statement-breakpoint
CREATE TABLE `inbox_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`role_id` text NOT NULL,
	`channel` text NOT NULL,
	`from_user_id` text,
	`from_label` text NOT NULL,
	`subject` text NOT NULL,
	`subject_de` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`received_at` text NOT NULL,
	`revealed_at_moment` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`proposed_triage` text NOT NULL,
	`triage_rationale` text DEFAULT '' NOT NULL,
	`triage_confidence` real DEFAULT 0.8 NOT NULL,
	`confirmed_triage` text,
	`related_object_kind` text,
	`related_object_id` text,
	`linked_decision_id` text,
	`linked_action_id` text,
	`is_duplicate_of` text,
	`requires_response_by` text,
	`from_shared_event` integer DEFAULT false NOT NULL,
	`priority_rank` integer DEFAULT 50 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inbox_run_role_idx` ON `inbox_messages` (`run_id`,`role_id`,`priority_rank`);--> statement-breakpoint
CREATE INDEX `inbox_reveal_idx` ON `inbox_messages` (`run_id`,`revealed_at_moment`);--> statement-breakpoint
CREATE TABLE `meeting_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`meeting_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`speaker_user_id` text,
	`speaker_label` text NOT NULL,
	`speaker_kind` text NOT NULL,
	`at_moment` text NOT NULL,
	`content` text NOT NULL,
	`provenance` text NOT NULL,
	`contradicts_evidence_id` text,
	`contradiction_note` text DEFAULT '' NOT NULL,
	`is_scripted_anchor` integer DEFAULT true NOT NULL,
	`flag_dismissed` integer DEFAULT false NOT NULL,
	`correction_recorded` integer DEFAULT false NOT NULL,
	`correction_text` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meetmsg_idx` ON `meeting_messages` (`run_id`,`meeting_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`role_id` text NOT NULL,
	`reference` text NOT NULL,
	`title` text NOT NULL,
	`title_de` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`moment_label` text NOT NULL,
	`scheduled_for` text NOT NULL,
	`participant_user_ids` text NOT NULL,
	`objective` text NOT NULL,
	`preparation_summary` text DEFAULT '' NOT NULL,
	`evidence_document_ids` text NOT NULL,
	`prepared_questions` text NOT NULL,
	`status` text DEFAULT 'not-started' NOT NULL,
	`outcome` text DEFAULT '' NOT NULL,
	`concluded_at` text,
	`supports_voice` integer DEFAULT false NOT NULL,
	`subject_kind` text,
	`subject_id` text
);
--> statement-breakpoint
CREATE INDEX `meet_run_role_idx` ON `meetings` (`run_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `actions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`reference` text NOT NULL,
	`title` text NOT NULL,
	`title_de` text DEFAULT '' NOT NULL,
	`description` text NOT NULL,
	`kind` text NOT NULL,
	`issue_id` text,
	`raised_by_role_id` text,
	`owner_user_id` text,
	`owner_label` text DEFAULT '' NOT NULL,
	`entity_id` text NOT NULL,
	`created_on` text NOT NULL,
	`due_on` text,
	`completed_on` text,
	`status` text NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`is_unowned` integer DEFAULT false NOT NULL,
	`related_object_kind` text,
	`related_object_id` text,
	`source_decision_id` text,
	`created_by_session` integer DEFAULT false NOT NULL,
	`progress_note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `actions_run_idx` ON `actions` (`run_id`,`status`);--> statement-breakpoint
CREATE INDEX `actions_role_idx` ON `actions` (`run_id`,`raised_by_role_id`);--> statement-breakpoint
CREATE TABLE `agent_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`session_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`compacted` integer DEFAULT false NOT NULL,
	`token_estimate` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agmsg_idx` ON `agent_messages` (`run_id`,`session_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`session_id` text NOT NULL,
	`agent_name` text NOT NULL,
	`agent_kind` text NOT NULL,
	`parent_run_id` text,
	`model` text NOT NULL,
	`source_mode` text NOT NULL,
	`from_cache` integer DEFAULT false NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`duration_ms` integer,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`estimated_cost_usd` real DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`task` text NOT NULL,
	`output_schema` text,
	`error_summary` text,
	`guardrail_triggered` integer DEFAULT false NOT NULL,
	`guardrail_note` text
);
--> statement-breakpoint
CREATE INDEX `agrun_idx` ON `agent_runs` (`run_id`,`session_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `agent_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`created_at` text NOT NULL,
	`last_active_at` text NOT NULL,
	`rolling_summary` text DEFAULT '' NOT NULL,
	`working_memory` text NOT NULL,
	`compaction_count` integer DEFAULT 0 NOT NULL,
	`last_compacted_at` text,
	`total_input_tokens` integer DEFAULT 0 NOT NULL,
	`total_output_tokens` integer DEFAULT 0 NOT NULL,
	`total_cost_usd` real DEFAULT 0 NOT NULL,
	`turn_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sess_run_idx` ON `agent_sessions` (`run_id`,`user_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`decision_id` text,
	`tool_name` text NOT NULL,
	`authority_class` text NOT NULL,
	`approved_by_user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`authority_scope` text NOT NULL,
	`approved_at` text NOT NULL,
	`approved_at_moment` text NOT NULL,
	`rationale_confirmed` integer NOT NULL,
	`rationale` text NOT NULL,
	`autonomy_level` text NOT NULL,
	`consumed_at` text,
	`payload_fingerprint` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `appr_run_idx` ON `approvals` (`run_id`,`decision_id`);--> statement-breakpoint
CREATE TABLE `background_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`role_id` text NOT NULL,
	`kind` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`target_label` text NOT NULL,
	`description` text NOT NULL,
	`performed_at_moment` text NOT NULL,
	`performed_at` text NOT NULL,
	`authority_class` text NOT NULL,
	`autonomous` integer DEFAULT true NOT NULL,
	`evidence_ids` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bgact_idx` ON `background_actions` (`run_id`,`role_id`,`kind`);--> statement-breakpoint
CREATE TABLE `cached_ai_outputs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`beat_key` text NOT NULL,
	`role_id` text,
	`schema_name` text NOT NULL,
	`payload` text NOT NULL,
	`captured_from_model` text,
	`captured_at` text NOT NULL,
	`seeded` integer DEFAULT true NOT NULL,
	`simulated_latency_ms` integer DEFAULT 700 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cache_beat_idx` ON `cached_ai_outputs` (`run_id`,`beat_key`);--> statement-breakpoint
CREATE TABLE `committee_items` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`committee_ref` text NOT NULL,
	`committee_name` text NOT NULL,
	`meeting_date` text NOT NULL,
	`entity_id` text NOT NULL,
	`title` text NOT NULL,
	`title_de` text DEFAULT '' NOT NULL,
	`item_type` text NOT NULL,
	`raised_by_role_id` text,
	`summary` text NOT NULL,
	`agenda_position` integer,
	`on_agenda` integer DEFAULT false NOT NULL,
	`related_object_kind` text,
	`related_object_id` text,
	`source_decision_id` text,
	`created_by_session` integer DEFAULT false NOT NULL,
	`theme_id` text
);
--> statement-breakpoint
CREATE INDEX `comm_run_idx` ON `committee_items` (`run_id`,`committee_ref`);--> statement-breakpoint
CREATE TABLE `decision_options` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`decision_id` text NOT NULL,
	`label` text NOT NULL,
	`label_de` text DEFAULT '' NOT NULL,
	`description` text NOT NULL,
	`is_recommended` integer DEFAULT false NOT NULL,
	`recommendation_basis` text DEFAULT '' NOT NULL,
	`risk_implication` text DEFAULT '' NOT NULL,
	`consequences` text NOT NULL,
	`requires_approval` integer DEFAULT true NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `decopt_idx` ON `decision_options` (`run_id`,`decision_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`reference` text NOT NULL,
	`role_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`title` text NOT NULL,
	`title_de` text DEFAULT '' NOT NULL,
	`question` text NOT NULL,
	`judgment_kind` text NOT NULL,
	`presented_at_moment` text NOT NULL,
	`priority_rank` integer NOT NULL,
	`why_this_matters` text NOT NULL,
	`prepared_position` text NOT NULL,
	`supporting_evidence_ids` text NOT NULL,
	`opposing_evidence_ids` text NOT NULL,
	`uncertainty_note` text NOT NULL,
	`confidence` real NOT NULL,
	`required_authority` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`chosen_option_id` text,
	`recorded_rationale` text DEFAULT '' NOT NULL,
	`decided_by_user_id` text,
	`decided_at_moment` text,
	`decided_at` text,
	`related_object_kind` text,
	`related_object_id` text,
	`from_shared_event` integer DEFAULT false NOT NULL,
	`shared_thread_id` text
);
--> statement-breakpoint
CREATE INDEX `dec_run_role_idx` ON `decisions` (`run_id`,`role_id`,`priority_rank`);--> statement-breakpoint
CREATE INDEX `dec_thread_idx` ON `decisions` (`run_id`,`shared_thread_id`);--> statement-breakpoint
CREATE INDEX `dec_status_idx` ON `decisions` (`run_id`,`status`);--> statement-breakpoint
CREATE TABLE `execution_receipt_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`decision_id` text NOT NULL,
	`approval_id` text,
	`sort_order` integer NOT NULL,
	`statement` text NOT NULL,
	`statement_de` text DEFAULT '' NOT NULL,
	`object_kind` text NOT NULL,
	`object_id` text NOT NULL,
	`change_kind` text NOT NULL,
	`audit_event_id` text,
	`executed_at` text NOT NULL,
	`executed_at_moment` text NOT NULL,
	`reversible` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `receipt_idx` ON `execution_receipt_lines` (`run_id`,`decision_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `issues` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`reference` text NOT NULL,
	`title` text NOT NULL,
	`title_de` text DEFAULT '' NOT NULL,
	`description` text NOT NULL,
	`kind` text NOT NULL,
	`raised_by_user_id` text NOT NULL,
	`raised_on` text NOT NULL,
	`entity_id` text NOT NULL,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`owner_user_id` text,
	`due_on` text,
	`related_object_kind` text,
	`related_object_id` text,
	`control_ids` text NOT NULL,
	`supplier_ids` text NOT NULL,
	`created_by_session` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `issues_run_idx` ON `issues` (`run_id`,`status`);--> statement-breakpoint
CREATE TABLE `monitoring_activations` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`subject_kind` text NOT NULL,
	`subject_id` text NOT NULL,
	`kind` text NOT NULL,
	`description` text NOT NULL,
	`activated_by_user_id` text NOT NULL,
	`activated_at_moment` text NOT NULL,
	`activated_at` text NOT NULL,
	`review_frequency` text NOT NULL,
	`next_review_on` text,
	`source_decision_id` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mon_run_idx` ON `monitoring_activations` (`run_id`,`subject_id`);--> statement-breakpoint
CREATE TABLE `portfolio_themes` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`title` text NOT NULL,
	`title_de` text DEFAULT '' NOT NULL,
	`description` text NOT NULL,
	`contributing_role_ids` text NOT NULL,
	`decision_ids` text NOT NULL,
	`duplicate_report_count` integer DEFAULT 0 NOT NULL,
	`materiality` text,
	`materiality_decided_by` text,
	`confidence` real DEFAULT 0.7 NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `theme_run_idx` ON `portfolio_themes` (`run_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `tool_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`agent_run_id` text,
	`session_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`authority_class` text NOT NULL,
	`requested_at` text NOT NULL,
	`completed_at` text,
	`duration_ms` integer,
	`argument_summary` text NOT NULL,
	`outcome` text NOT NULL,
	`blocked_reason` text,
	`approval_id` text,
	`decision_id` text,
	`autonomy_level` text NOT NULL,
	`result_summary` text DEFAULT '' NOT NULL,
	`evidence_ids` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tool_run_idx` ON `tool_calls` (`run_id`,`session_id`,`requested_at`);--> statement-breakpoint
CREATE INDEX `tool_outcome_idx` ON `tool_calls` (`run_id`,`outcome`);
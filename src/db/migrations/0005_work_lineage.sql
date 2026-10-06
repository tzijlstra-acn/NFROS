ALTER TABLE `evidence_documents` ADD `source_minutes_id` text;--> statement-breakpoint
ALTER TABLE `evidence_documents` ADD `source_message_id` text;--> statement-breakpoint
CREATE INDEX `evdoc_minutes_idx` ON `evidence_documents` (`run_id`,`source_minutes_id`);--> statement-breakpoint
ALTER TABLE `meetings` ADD `held_by_user_id` text;--> statement-breakpoint
ALTER TABLE `meetings` ADD `held_at` text;--> statement-breakpoint
ALTER TABLE `meetings` ADD `process_run_id` text;--> statement-breakpoint
ALTER TABLE `meetings` ADD `stage_id` text;--> statement-breakpoint
CREATE INDEX `meet_process_idx` ON `meetings` (`run_id`,`process_run_id`,`stage_id`);--> statement-breakpoint
ALTER TABLE `actions` ADD `completion_condition` text;--> statement-breakpoint
ALTER TABLE `actions` ADD `completion_condition_by` text;--> statement-breakpoint
ALTER TABLE `actions` ADD `completion_condition_at` text;--> statement-breakpoint
ALTER TABLE `actions` ADD `blocked_reason` text;--> statement-breakpoint
ALTER TABLE `actions` ADD `blocked_since` text;--> statement-breakpoint
ALTER TABLE `actions` ADD `source_meeting_id` text;--> statement-breakpoint
ALTER TABLE `actions` ADD `source_minutes_id` text;--> statement-breakpoint
ALTER TABLE `actions` ADD `source_process_run_id` text;--> statement-breakpoint
ALTER TABLE `actions` ADD `source_stage_id` text;--> statement-breakpoint
ALTER TABLE `actions` ADD `source_stage_run_id` text;--> statement-breakpoint
ALTER TABLE `actions` ADD `source_message_id` text;--> statement-breakpoint
CREATE INDEX `actions_source_meeting_idx` ON `actions` (`run_id`,`source_meeting_id`);--> statement-breakpoint
CREATE INDEX `actions_source_process_idx` ON `actions` (`run_id`,`source_process_run_id`);--> statement-breakpoint
ALTER TABLE `approvals` ADD `target_kind` text;--> statement-breakpoint
ALTER TABLE `approvals` ADD `target_id` text;--> statement-breakpoint
CREATE INDEX `appr_target_idx` ON `approvals` (`run_id`,`target_kind`,`target_id`);--> statement-breakpoint
ALTER TABLE `action_updates` ADD `kind` text DEFAULT 'UPD' NOT NULL;--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `draft` text;--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `content_digest` text;--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `prepared_mode` text;--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `edited_by_user_id` text;--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `edited_at` text;--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `evidence_document_id` text;--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `distribution_user_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `distribution_message_id` text;--> statement-breakpoint
ALTER TABLE `meeting_minutes` ADD `confirmation_approval_id` text;--> statement-breakpoint
UPDATE `action_updates` SET `kind` = substr(`id`, 5, instr(substr(`id`, 5), '-') - 1) WHERE `id` LIKE 'AUP-%-%' AND substr(`id`, 5, instr(substr(`id`, 5), '-') - 1) IN ('UPD', 'CC', 'BLK', 'UNB', 'ASN', 'DUE', 'CMP', 'REO', 'ESC', 'RMD', 'REQ', 'MTG', 'CRT');--> statement-breakpoint
UPDATE `actions` SET
  `blocked_reason` = coalesce(
    (SELECT u.`note` FROM `action_updates` u WHERE u.`run_id` = `actions`.`run_id` AND u.`action_id` = `actions`.`id` AND u.`kind` = 'BLK' ORDER BY u.`at` DESC, u.`id` DESC LIMIT 1),
    (SELECT u.`note` FROM `action_updates` u WHERE u.`run_id` = `actions`.`run_id` AND u.`action_id` = `actions`.`id` ORDER BY u.`at` DESC, u.`id` DESC LIMIT 1)),
  `blocked_since` = coalesce(
    (SELECT u.`at` FROM `action_updates` u WHERE u.`run_id` = `actions`.`run_id` AND u.`action_id` = `actions`.`id` AND u.`kind` = 'BLK' ORDER BY u.`at` DESC, u.`id` DESC LIMIT 1),
    (SELECT u.`at` FROM `action_updates` u WHERE u.`run_id` = `actions`.`run_id` AND u.`action_id` = `actions`.`id` ORDER BY u.`at` DESC, u.`id` DESC LIMIT 1))
WHERE `status` NOT IN ('completed', 'cancelled') AND `blocked_reason` IS NULL
  AND (SELECT u.`status_after` FROM `action_updates` u WHERE u.`run_id` = `actions`.`run_id` AND u.`action_id` = `actions`.`id` ORDER BY u.`at` DESC, u.`id` DESC LIMIT 1) = 'blocked';--> statement-breakpoint
UPDATE `actions` SET
  `completion_condition` = (SELECT u.`note` FROM `action_updates` u WHERE u.`run_id` = `actions`.`run_id` AND u.`action_id` = `actions`.`id` AND u.`kind` = 'CC' AND u.`author_kind` = 'human' ORDER BY u.`at` DESC, u.`id` DESC LIMIT 1),
  `completion_condition_by` = (SELECT u.`author_user_id` FROM `action_updates` u WHERE u.`run_id` = `actions`.`run_id` AND u.`action_id` = `actions`.`id` AND u.`kind` = 'CC' AND u.`author_kind` = 'human' ORDER BY u.`at` DESC, u.`id` DESC LIMIT 1),
  `completion_condition_at` = (SELECT u.`at` FROM `action_updates` u WHERE u.`run_id` = `actions`.`run_id` AND u.`action_id` = `actions`.`id` AND u.`kind` = 'CC' AND u.`author_kind` = 'human' ORDER BY u.`at` DESC, u.`id` DESC LIMIT 1)
WHERE `completion_condition` IS NULL
  AND EXISTS (SELECT 1 FROM `action_updates` u WHERE u.`run_id` = `actions`.`run_id` AND u.`action_id` = `actions`.`id` AND u.`kind` = 'CC' AND u.`author_kind` = 'human');--> statement-breakpoint
UPDATE `actions` SET
  `source_minutes_id` = (SELECT m.`id` FROM `meeting_minutes` m, json_each(m.`action_ids`) j WHERE m.`run_id` = `actions`.`run_id` AND j.`value` = `actions`.`id` ORDER BY m.`created_at`, m.`id` LIMIT 1)
WHERE `source_minutes_id` IS NULL
  AND EXISTS (SELECT 1 FROM `meeting_minutes` m, json_each(m.`action_ids`) j WHERE m.`run_id` = `actions`.`run_id` AND j.`value` = `actions`.`id`);--> statement-breakpoint
UPDATE `actions` SET
  `source_meeting_id` = (SELECT m.`meeting_id` FROM `meeting_minutes` m WHERE m.`run_id` = `actions`.`run_id` AND m.`id` = `actions`.`source_minutes_id`)
WHERE `source_meeting_id` IS NULL AND `source_minutes_id` IS NOT NULL
  AND EXISTS (SELECT 1 FROM `meeting_minutes` m, `meetings` g WHERE m.`run_id` = `actions`.`run_id` AND m.`id` = `actions`.`source_minutes_id` AND g.`run_id` = m.`run_id` AND g.`id` = m.`meeting_id`);--> statement-breakpoint
UPDATE `approvals` SET `target_kind` = 'decision', `target_id` = `decision_id`
WHERE `target_kind` IS NULL AND `decision_id` IS NOT NULL
  AND EXISTS (SELECT 1 FROM `decisions` d WHERE d.`run_id` = `approvals`.`run_id` AND d.`id` = `approvals`.`decision_id`);--> statement-breakpoint
UPDATE `approvals` SET
  `target_kind` = (SELECT json_extract(a.`detail`, '$.subjectKind') FROM `audit_events` a WHERE a.`run_id` = `approvals`.`run_id` AND a.`object_kind` = 'approval' AND a.`object_id` = `approvals`.`id` AND json_extract(a.`detail`, '$.subjectKind') IS NOT NULL LIMIT 1),
  `target_id` = (SELECT json_extract(a.`detail`, '$.subjectId') FROM `audit_events` a WHERE a.`run_id` = `approvals`.`run_id` AND a.`object_kind` = 'approval' AND a.`object_id` = `approvals`.`id` AND json_extract(a.`detail`, '$.subjectKind') IS NOT NULL LIMIT 1)
WHERE `target_kind` IS NULL AND `decision_id` IS NULL
  AND EXISTS (SELECT 1 FROM `audit_events` a WHERE a.`run_id` = `approvals`.`run_id` AND a.`object_kind` = 'approval' AND a.`object_id` = `approvals`.`id` AND json_extract(a.`detail`, '$.subjectKind') IS NOT NULL AND json_extract(a.`detail`, '$.subjectId') IS NOT NULL);--> statement-breakpoint
UPDATE `approvals` SET
  `target_kind` = 'stage-run',
  `target_id` = (SELECT e.`correlation_id` FROM `os_events` e WHERE e.`run_id` = `approvals`.`run_id` AND e.`type` = 'approval-granted' AND json_extract(e.`payload`, '$.approvalId') = `approvals`.`id` AND e.`correlation_id` IS NOT NULL LIMIT 1)
WHERE `target_kind` IS NULL
  AND EXISTS (SELECT 1 FROM `os_events` e WHERE e.`run_id` = `approvals`.`run_id` AND e.`type` = 'approval-granted' AND json_extract(e.`payload`, '$.approvalId') = `approvals`.`id` AND e.`correlation_id` IS NOT NULL);--> statement-breakpoint
UPDATE `meetings` SET
  `held_by_user_id` = (SELECT r.`holder_user_id` FROM `roles` r WHERE r.`run_id` = `meetings`.`run_id` AND r.`id` = `meetings`.`role_id`),
  `held_at` = coalesce(
    (SELECT s.`scenario_date` || 'T' || a.`at_moment` || ':00.000Z' FROM `audit_events` a, `scenario_runs` s WHERE a.`run_id` = `meetings`.`run_id` AND s.`id` = a.`run_id` AND a.`category` = 'mutation' AND a.`action` = 'recordMeetingHeld' AND a.`object_id` = `meetings`.`id` ORDER BY a.`recorded_at` DESC LIMIT 1),
    `concluded_at`)
WHERE `status` = 'concluded' AND `held_by_user_id` IS NULL;--> statement-breakpoint
UPDATE `meetings` SET `process_run_id` = (
  SELECT r.`id` FROM `role_app_runs` r
  WHERE r.`run_id` = `meetings`.`run_id` AND r.`role_id` = `meetings`.`role_id` AND `meetings`.`subject_id` IS NOT NULL AND (
    r.`subject_id` = `meetings`.`subject_id`
    OR EXISTS (SELECT 1 FROM `assessments` a WHERE a.`run_id` = r.`run_id` AND a.`id` = r.`subject_id` AND a.`subject_id` = `meetings`.`subject_id`)
    OR EXISTS (SELECT 1 FROM `assessment_lines` l WHERE l.`run_id` = r.`run_id` AND l.`assessment_id` = r.`subject_id` AND (l.`risk_id` = `meetings`.`subject_id` OR EXISTS (SELECT 1 FROM json_each(l.`control_ids`) c WHERE c.`value` = `meetings`.`subject_id`)))
    OR EXISTS (SELECT 1 FROM `kris` k, `assessments` a WHERE k.`run_id` = r.`run_id` AND a.`run_id` = r.`run_id` AND a.`id` = r.`subject_id` AND k.`id` = `meetings`.`subject_id` AND EXISTS (SELECT 1 FROM json_each(k.`process_ids`) p WHERE p.`value` = a.`subject_id`))
    OR EXISTS (SELECT 1 FROM `contracts` c WHERE c.`run_id` = r.`run_id` AND c.`supplier_id` = r.`subject_id` AND c.`id` = `meetings`.`subject_id`)
    OR EXISTS (SELECT 1 FROM `subprocessors` s WHERE s.`run_id` = r.`run_id` AND s.`supplier_id` = r.`subject_id` AND s.`id` = `meetings`.`subject_id`))
  ORDER BY r.`started_at`, r.`id` LIMIT 1)
WHERE `process_run_id` IS NULL;--> statement-breakpoint
UPDATE `meetings` SET `stage_id` = CASE
  WHEN `role_id` = 'rcsa' AND `kind` = 'rcsa-workshop' THEN 'challenge-workshop'
  WHEN `role_id` = 'rcsa' AND `kind` = 'one-to-one' THEN 'first-line-input'
  WHEN `role_id` = 'rcsa' AND `kind` = 'workshop' THEN 'actions-approval'
  WHEN `role_id` = 'rcsa' AND `kind` = 'scope-confirmation' THEN 'scope-trigger'
  WHEN `role_id` = 'tprm' AND `kind` IN ('supplier-challenge', 'supplier-call') THEN 'evidence-review'
  WHEN `role_id` = 'tprm' AND `kind` = 'one-to-one' THEN 'specialist-reviews'
  WHEN `role_id` = 'tprm' AND `kind` = 'meeting' THEN 'contract-and-conditions'
  WHEN `role_id` = 'tprm' AND `kind` = 'committee' THEN 'decision-and-onboarding'
  ELSE NULL END
WHERE `process_run_id` IS NOT NULL AND `stage_id` IS NULL;--> statement-breakpoint
UPDATE `actions` SET
  `source_process_run_id` = (SELECT g.`process_run_id` FROM `meetings` g WHERE g.`run_id` = `actions`.`run_id` AND g.`id` = `actions`.`source_meeting_id`),
  `source_stage_id` = (SELECT g.`stage_id` FROM `meetings` g WHERE g.`run_id` = `actions`.`run_id` AND g.`id` = `actions`.`source_meeting_id`),
  `source_stage_run_id` = (SELECT s.`id` FROM `meetings` g, `role_app_stage_runs` s WHERE g.`run_id` = `actions`.`run_id` AND g.`id` = `actions`.`source_meeting_id` AND s.`run_id` = g.`run_id` AND s.`role_app_run_id` = g.`process_run_id` AND s.`stage_id` = g.`stage_id`)
WHERE `source_process_run_id` IS NULL AND `source_meeting_id` IS NOT NULL
  AND EXISTS (SELECT 1 FROM `meetings` g WHERE g.`run_id` = `actions`.`run_id` AND g.`id` = `actions`.`source_meeting_id` AND g.`process_run_id` IS NOT NULL);--> statement-breakpoint
INSERT INTO `evidence_documents` (`id`, `run_id`, `reference`, `title`, `title_de`, `source_type`, `source_system`, `author_label`, `author_user_id`, `document_date`, `ingested_at`, `entity_ids`, `data_classification`, `status`, `requested_from_label`, `requested_on`, `is_stale`, `staleness_note`, `provenance`, `body`, `summary`, `related_object_ids`, `page_count`, `from_shared_event`, `revealed_at_moment`, `source_minutes_id`, `source_message_id`)
SELECT 'EVD-' || m.`id`, m.`run_id`, m.`id`, m.`title`, m.`title`, 'meeting-minutes', 'Work Hub minutes',
  coalesce(u.`name` || ' (' || u.`id` || ')', m.`confirmed_by_user_id`, 'Meeting record'), m.`confirmed_by_user_id`,
  substr(coalesce(m.`confirmed_at`, m.`created_at`), 1, 10), coalesce(m.`confirmed_at`, m.`created_at`),
  json_array(coalesce(r.`entity_id`, 'ARC-DE')), 'internal', 'current', NULL, NULL, 0, '', 'approved-record',
  m.`summary` || coalesce(char(10) || char(10) || (SELECT group_concat(j.`value`, char(10)) FROM json_each(m.`fact_items`) j), ''),
  m.`summary`,
  CASE WHEN EXISTS (SELECT 1 FROM `meetings` g WHERE g.`run_id` = m.`run_id` AND g.`id` = m.`meeting_id`) THEN json_array(m.`meeting_id`, m.`id`) ELSE json_array(m.`id`) END,
  1, 0, '07:45', m.`id`, NULL
FROM `meeting_minutes` m
LEFT JOIN `users` u ON u.`run_id` = m.`run_id` AND u.`id` = m.`confirmed_by_user_id`
LEFT JOIN `roles` r ON r.`run_id` = m.`run_id` AND r.`id` = m.`role_id`
WHERE m.`status` IN ('confirmed', 'distributed') AND m.`evidence_document_id` IS NULL
  AND NOT EXISTS (SELECT 1 FROM `evidence_documents` e WHERE e.`id` = 'EVD-' || m.`id`);--> statement-breakpoint
INSERT INTO `evidence_chunks` (`id`, `run_id`, `document_id`, `chunk_index`, `locator`, `content`, `embedding`, `embedding_model`, `embedded_at`, `token_estimate`)
SELECT e.`id` || '-C00', e.`run_id`, e.`id`, 0, 'Section 1', e.`body`, NULL, NULL, NULL, (length(e.`body`) + 3) / 4
FROM `evidence_documents` e
WHERE e.`source_minutes_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `evidence_chunks` c WHERE c.`document_id` = e.`id`);--> statement-breakpoint
UPDATE `meeting_minutes` SET `evidence_document_id` = 'EVD-' || `id`
WHERE `status` IN ('confirmed', 'distributed') AND `evidence_document_id` IS NULL
  AND EXISTS (SELECT 1 FROM `evidence_documents` e WHERE e.`run_id` = `meeting_minutes`.`run_id` AND e.`id` = 'EVD-' || `meeting_minutes`.`id`);
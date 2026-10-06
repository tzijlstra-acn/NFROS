CREATE TABLE `process_stage_inputs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`process_run_id` text NOT NULL,
	`stage_id` text NOT NULL,
	`stage_run_id` text,
	`source_kind` text NOT NULL,
	`source_id` text NOT NULL,
	`added_by_user_id` text,
	`added_at` text NOT NULL,
	`added_at_moment` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`os_event_id` text,
	`audit_event_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `psi_source_unq` ON `process_stage_inputs` (`run_id`,`process_run_id`,`stage_id`,`source_kind`,`source_id`);--> statement-breakpoint
CREATE INDEX `psi_source_idx` ON `process_stage_inputs` (`run_id`,`source_kind`,`source_id`);--> statement-breakpoint
ALTER TABLE `collaboration_messages` ADD `kind` text DEFAULT 'message' NOT NULL;--> statement-breakpoint
ALTER TABLE `inbox_messages` ADD `conversion_kind` text;--> statement-breakpoint
ALTER TABLE `inbox_messages` ADD `triage_confirmed_by_user_id` text;--> statement-breakpoint
ALTER TABLE `inbox_messages` ADD `triage_confirmed_at` text;--> statement-breakpoint
ALTER TABLE `inbox_messages` ADD `triage_reason` text;--> statement-breakpoint
ALTER TABLE `inbox_messages` ADD `linked_evidence_document_id` text;--> statement-breakpoint
ALTER TABLE `inbox_messages` ADD `delegated_to_user_id` text;--> statement-breakpoint
UPDATE `collaboration_messages` SET `kind` = CASE
  WHEN `channel_name` = 'Inbox delegation' AND `related_object_kind` = 'inbox-message' THEN 'delegation'
  WHEN `channel_name` = 'Inbox reply' AND `related_object_kind` = 'inbox-message' THEN 'reply'
  WHEN `channel_name` = 'Meeting minutes' THEN 'minutes-distribution'
  WHEN `channel_name` = 'Factual validation' THEN 'validation-request'
  WHEN `channel_name` = 'Action follow-up' THEN 'follow-up'
  ELSE 'message' END
WHERE `kind` = 'message';--> statement-breakpoint
UPDATE `inbox_messages` SET
  `linked_evidence_document_id` = (SELECT d.`id` FROM `evidence_documents` d WHERE d.`run_id` = `inbox_messages`.`run_id` AND d.`source_message_id` = `inbox_messages`.`id` ORDER BY d.`ingested_at`, d.`id` LIMIT 1)
WHERE `linked_evidence_document_id` IS NULL
  AND EXISTS (SELECT 1 FROM `evidence_documents` d WHERE d.`run_id` = `inbox_messages`.`run_id` AND d.`source_message_id` = `inbox_messages`.`id`);--> statement-breakpoint
UPDATE `inbox_messages` SET
  `delegated_to_user_id` = (SELECT json_extract(c.`to_user_ids`, '$[0]') FROM `collaboration_messages` c WHERE c.`run_id` = `inbox_messages`.`run_id` AND c.`kind` = 'delegation' AND c.`related_object_id` = `inbox_messages`.`id` ORDER BY c.`sent_at`, c.`id` LIMIT 1)
WHERE `delegated_to_user_id` IS NULL
  AND EXISTS (SELECT 1 FROM `collaboration_messages` c WHERE c.`run_id` = `inbox_messages`.`run_id` AND c.`kind` = 'delegation' AND c.`related_object_id` = `inbox_messages`.`id`);--> statement-breakpoint
WITH `conversion` AS (
  SELECT m.`id` AS `message_id`, m.`run_id` AS `run_id`, e.`actor_user_id` AS `by_user`, e.`occurred_at` AS `at`, e.`sequence` AS `seq`,
    substr(substr(e.`idempotency_key`, length('inbox-converted:' || m.`id` || ':') + 1), 1, instr(substr(e.`idempotency_key`, length('inbox-converted:' || m.`id` || ':') + 1), ':') - 1) AS `kind`
  FROM `inbox_messages` m
  JOIN `os_events` e ON e.`run_id` = m.`run_id` AND substr(e.`idempotency_key`, 1, length('inbox-converted:' || m.`id` || ':')) = 'inbox-converted:' || m.`id` || ':'
), `work` AS (
  SELECT * FROM `conversion` WHERE `kind` IN ('action', 'decision', 'evidence', 'process', 'delegated')
), `first_work` AS (
  SELECT w.* FROM `work` w WHERE w.`seq` = (SELECT min(w2.`seq`) FROM `work` w2 WHERE w2.`message_id` = w.`message_id` AND w2.`run_id` = w.`run_id`)
)
UPDATE `inbox_messages` SET `conversion_kind` = f.`kind`, `converted_by_user_id` = f.`by_user`, `converted_at` = f.`at`
FROM `first_work` f WHERE f.`message_id` = `inbox_messages`.`id` AND f.`run_id` = `inbox_messages`.`run_id`;--> statement-breakpoint
UPDATE `inbox_messages` SET `conversion_kind` = CASE
  WHEN `linked_action_id` IS NOT NULL THEN 'action'
  WHEN `linked_decision_id` IS NOT NULL THEN 'decision'
  WHEN `linked_evidence_document_id` IS NOT NULL THEN 'evidence'
  WHEN `delegated_to_user_id` IS NOT NULL THEN 'delegated'
  END
WHERE `conversion_kind` IS NULL
  AND (`linked_action_id` IS NOT NULL OR `linked_decision_id` IS NOT NULL OR `linked_evidence_document_id` IS NOT NULL OR `delegated_to_user_id` IS NOT NULL);--> statement-breakpoint
WITH `noise` AS (
  SELECT m.`id` AS `message_id`, m.`run_id` AS `run_id`, e.`actor_user_id` AS `by_user`, e.`occurred_at` AS `at`, e.`sequence` AS `seq`
  FROM `inbox_messages` m
  JOIN `os_events` e ON e.`run_id` = m.`run_id` AND substr(e.`idempotency_key`, 1, length('inbox-triage:' || m.`id` || ':')) = 'inbox-triage:' || m.`id` || ':'
  WHERE json_extract(e.`payload`, '$.to') = 'noise'
), `latest_noise` AS (
  SELECT n.* FROM `noise` n WHERE n.`seq` = (SELECT max(n2.`seq`) FROM `noise` n2 WHERE n2.`message_id` = n.`message_id` AND n2.`run_id` = n.`run_id`)
)
UPDATE `inbox_messages` SET
  `conversion_kind` = 'dismissed',
  `converted_by_user_id` = (SELECT l.`by_user` FROM `latest_noise` l WHERE l.`message_id` = `inbox_messages`.`id` AND l.`run_id` = `inbox_messages`.`run_id`),
  `converted_at` = (SELECT l.`at` FROM `latest_noise` l WHERE l.`message_id` = `inbox_messages`.`id` AND l.`run_id` = `inbox_messages`.`run_id`)
WHERE `conversion_kind` IS NULL AND `confirmed_triage` = 'noise';--> statement-breakpoint
WITH `triage` AS (
  SELECT m.`id` AS `message_id`, m.`run_id` AS `run_id`, e.`actor_user_id` AS `by_user`, e.`occurred_at` AS `at`, coalesce(json_extract(e.`payload`, '$.reason'), '') AS `reason`, e.`sequence` AS `seq`
  FROM `inbox_messages` m
  JOIN `os_events` e ON e.`run_id` = m.`run_id` AND substr(e.`idempotency_key`, 1, length('inbox-triage:' || m.`id` || ':')) = 'inbox-triage:' || m.`id` || ':'
  WHERE json_extract(e.`payload`, '$.to') = m.`confirmed_triage`
), `latest_triage` AS (
  SELECT t.* FROM `triage` t WHERE t.`seq` = (SELECT max(t2.`seq`) FROM `triage` t2 WHERE t2.`message_id` = t.`message_id` AND t2.`run_id` = t.`run_id`)
)
UPDATE `inbox_messages` SET `triage_confirmed_by_user_id` = l.`by_user`, `triage_confirmed_at` = l.`at`, `triage_reason` = l.`reason`
FROM `latest_triage` l WHERE l.`message_id` = `inbox_messages`.`id` AND l.`run_id` = `inbox_messages`.`run_id` AND `inbox_messages`.`triage_confirmed_at` IS NULL;--> statement-breakpoint
UPDATE `inbox_messages` SET `triage_confirmed_by_user_id` = `converted_by_user_id`, `triage_confirmed_at` = `converted_at`
WHERE `triage_confirmed_at` IS NULL AND `confirmed_triage` IS NOT NULL AND `converted_at` IS NOT NULL
  AND `conversion_kind` IN ('action', 'decision', 'evidence', 'process', 'delegated');--> statement-breakpoint
INSERT OR IGNORE INTO `process_stage_inputs` (`id`, `run_id`, `process_run_id`, `stage_id`, `stage_run_id`, `source_kind`, `source_id`, `added_by_user_id`, `added_at`, `added_at_moment`, `note`, `os_event_id`, `audit_event_id`)
SELECT 'PSI-' || e.`id`, e.`run_id`, json_extract(e.`payload`, '$.processRunId'), json_extract(e.`payload`, '$.stageId'), json_extract(e.`payload`, '$.stageRunId'), 'message', json_extract(e.`payload`, '$.messageId'), e.`actor_user_id`, e.`occurred_at`, e.`at_moment`, '', e.`id`, e.`audit_event_id`
FROM `os_events` e
WHERE json_extract(e.`payload`, '$.source') = 'inbox' AND json_extract(e.`payload`, '$.operation') = 'process'
  AND json_extract(e.`payload`, '$.processRunId') IS NOT NULL AND json_extract(e.`payload`, '$.stageId') IS NOT NULL AND json_extract(e.`payload`, '$.messageId') IS NOT NULL;
ALTER TABLE `decisions` ADD `process_run_id` text;--> statement-breakpoint
ALTER TABLE `decisions` ADD `process_stage_id` text;--> statement-breakpoint
CREATE INDEX `dec_process_idx` ON `decisions` (`run_id`,`process_run_id`,`process_stage_id`);--> statement-breakpoint
UPDATE `decisions` SET
  `process_run_id` = 'RUN-RCSA-PAYOPS-Q4-2026',
  `process_stage_id` = CASE `id`
    WHEN 'DEC-2026-0771' THEN 'evidence-refresh'
    WHEN 'DEC-2026-0744' THEN 'risk-control-change'
    WHEN 'DEC-2026-0745' THEN 'first-line-input'
    WHEN 'DEC-2026-0772' THEN 'challenge-workshop'
    WHEN 'DEC-2026-0782' THEN 'actions-approval'
    END
WHERE `process_run_id` IS NULL AND `role_id` = 'rcsa'
  AND `id` IN ('DEC-2026-0771', 'DEC-2026-0744', 'DEC-2026-0745', 'DEC-2026-0772', 'DEC-2026-0782')
  AND EXISTS (SELECT 1 FROM `role_app_runs` r WHERE r.`run_id` = `decisions`.`run_id` AND r.`id` = 'RUN-RCSA-PAYOPS-Q4-2026' AND r.`role_app_id` = 'rcsa-cycle-assistant');
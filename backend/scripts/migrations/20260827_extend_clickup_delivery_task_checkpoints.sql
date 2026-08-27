-- CG-067: retry-safe ClickUp checklist checkpoints for provisioned delivery tasks.
ALTER TABLE `clickup_task_mapping`
  ADD COLUMN `clickup_checklist_id` VARCHAR(64) DEFAULT NULL AFTER `clickup_url`,
  ADD COLUMN `clickup_checklist_item_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `clickup_checklist_id`,
  ADD COLUMN `checklist_synced_at` DATETIME DEFAULT NULL AFTER `clickup_checklist_item_count`;

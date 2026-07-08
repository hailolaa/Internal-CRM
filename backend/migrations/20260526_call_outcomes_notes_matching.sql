ALTER TABLE ` call `
  ADD COLUMN outcome VARCHAR(100) COLLATE utf8mb4_unicode_ci NULL AFTER call_status,
  ADD COLUMN disposition VARCHAR(100) COLLATE utf8mb4_unicode_ci NULL AFTER outcome,
  ADD COLUMN source VARCHAR(100) COLLATE utf8mb4_unicode_ci NULL AFTER tracking_number,
  ADD COLUMN missed_recovery_status VARCHAR(100) COLLATE utf8mb4_unicode_ci NULL AFTER missed_call,
  ADD COLUMN missed_recovery_at DATETIME NULL AFTER missed_recovery_status,
  ADD COLUMN outcome_updated_by CHAR(36) COLLATE utf8mb4_unicode_ci NULL AFTER outcome,
  ADD COLUMN outcome_updated_at DATETIME NULL AFTER outcome_updated_by,
  ADD KEY idx_call_outcome (clinic_id, outcome),
  ADD KEY idx_call_disposition (clinic_id, disposition),
  ADD KEY idx_call_recovery (clinic_id, missed_recovery_status),
  ADD KEY idx_call_outcome_updated_by (outcome_updated_by),
  ADD CONSTRAINT fk_call_outcome_updated_by FOREIGN KEY (outcome_updated_by) REFERENCES user(id) ON DELETE SET NULL;

UPDATE ` call `
SET outcome = CASE
      WHEN missed_call = 1 THEN 'missed_no_answer'
      WHEN duration > 0 OR call_status = 'completed' THEN 'existing_patient'
      ELSE outcome
    END,
    disposition = CASE
      WHEN notes LIKE '%appointment%' THEN 'booked'
      WHEN missed_call = 1 THEN 'follow_up_needed'
      ELSE COALESCE(disposition, 'none')
    END,
    source = COALESCE(source, 'Call log')
WHERE outcome IS NULL OR disposition IS NULL OR source IS NULL;

ALTER TABLE task
  ADD COLUMN needs_qa TINYINT(1) NOT NULL DEFAULT 0 AFTER archived_at,
  ADD COLUMN qa_checklist JSON NULL AFTER needs_qa,
  ADD COLUMN approval_status ENUM('not_required', 'pending', 'approved', 'rejected', 'needs_changes') NOT NULL DEFAULT 'not_required' AFTER qa_checklist,
  ADD COLUMN reviewer_user_id CHAR(36) NULL AFTER approval_status,
  ADD COLUMN completion_proof_reference VARCHAR(500) NULL AFTER reviewer_user_id,
  ADD COLUMN missed_task TINYINT(1) NOT NULL DEFAULT 0 AFTER completion_proof_reference,
  ADD COLUMN escalation_flag TINYINT(1) NOT NULL DEFAULT 0 AFTER missed_task,
  ADD COLUMN freelancer_team_score DECIMAL(5,2) NULL AFTER escalation_flag,
  ADD COLUMN qa_updated_at TIMESTAMP NULL AFTER freelancer_team_score,
  ADD KEY idx_task_internal_qa (clinic_id, is_internal, needs_qa, approval_status, archived_at),
  ADD KEY idx_task_internal_flags (clinic_id, is_internal, missed_task, escalation_flag, archived_at),
  ADD KEY idx_task_reviewer_user (reviewer_user_id),
  ADD CONSTRAINT fk_task_reviewer_user FOREIGN KEY (reviewer_user_id) REFERENCES user(id) ON DELETE SET NULL;

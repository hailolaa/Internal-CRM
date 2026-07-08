CREATE TABLE IF NOT EXISTS background_job_state (
  job_key VARCHAR(100) NOT NULL,
  status ENUM('active', 'paused', 'error') NOT NULL DEFAULT 'active',
  last_run_at DATETIME NULL,
  next_run_at DATETIME NULL,
  last_status ENUM('started', 'completed', 'failed') NULL,
  last_duration_ms INT NULL,
  last_error_message TEXT NULL,
  success_count INT NOT NULL DEFAULT 0,
  failure_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (job_key),
  KEY idx_background_job_state_status_next (status, next_run_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS background_job_run (
  id CHAR(36) NOT NULL,
  job_key VARCHAR(100) NOT NULL,
  status ENUM('started', 'completed', 'failed') NOT NULL DEFAULT 'started',
  triggered_by ENUM('schedule', 'manual') NOT NULL DEFAULT 'schedule',
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  duration_ms INT NULL,
  error_message TEXT NULL,
  metadata JSON NULL,
  PRIMARY KEY (id),
  KEY idx_background_job_run_job_started (job_key, started_at),
  KEY idx_background_job_run_status_started (status, started_at),
  CONSTRAINT fk_background_job_run_state FOREIGN KEY (job_key) REFERENCES background_job_state(job_key) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

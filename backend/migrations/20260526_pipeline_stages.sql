CREATE TABLE IF NOT EXISTS pipeline_stage (
  id char(36) NOT NULL,
  clinic_id char(36) NOT NULL,
  pipeline_id char(36) NOT NULL,
  name varchar(100) NOT NULL,
  color varchar(50) NOT NULL DEFAULT 'bg-blue-500',
  position int NOT NULL DEFAULT 1,
  kind enum('open','won','lost') NOT NULL DEFAULT 'open',
  is_locked tinyint(1) NOT NULL DEFAULT 0,
  created_by char(36) DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at timestamp NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unique_pipeline_stage_position (pipeline_id, position, deleted_at),
  KEY idx_pipeline_stage_clinic (clinic_id),
  KEY idx_pipeline_stage_pipeline (pipeline_id),
  KEY idx_pipeline_stage_deleted (deleted_at),
  CONSTRAINT fk_pipeline_stage_clinic FOREIGN KEY (clinic_id) REFERENCES clinic (id) ON DELETE CASCADE,
  CONSTRAINT fk_pipeline_stage_pipeline FOREIGN KEY (pipeline_id) REFERENCES pipeline (id) ON DELETE CASCADE,
  CONSTRAINT fk_pipeline_stage_created_by FOREIGN KEY (created_by) REFERENCES user (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO pipeline (id, clinic_id, name, description, stages)
SELECT UUID(),
       c.id,
       'Revenue Pipeline',
       'Default conversion pipeline for lead and consult revenue tracking',
       JSON_ARRAY('New', 'Contacted', 'Qualified', 'Consult Booked', 'Consult Attended', 'Sold', 'Lost')
FROM clinic c
WHERE NOT EXISTS (
  SELECT 1
  FROM pipeline p
  WHERE p.clinic_id = c.id
    AND p.name = 'Revenue Pipeline'
    AND p.deleted_at IS NULL
);

INSERT INTO pipeline_stage (id, clinic_id, pipeline_id, name, color, position, kind, is_locked)
SELECT UUID(), p.clinic_id, p.id, stage.name, stage.color, stage.position, stage.kind, stage.is_locked
FROM pipeline p
JOIN (
  SELECT 'New' as name, 'bg-blue-500' as color, 1 as position, 'open' as kind, 0 as is_locked
  UNION ALL SELECT 'Contacted', 'bg-cyan-500', 2, 'open', 0
  UNION ALL SELECT 'Qualified', 'bg-violet-500', 3, 'open', 0
  UNION ALL SELECT 'Consult Booked', 'bg-amber-500', 4, 'open', 0
  UNION ALL SELECT 'Consult Attended', 'bg-orange-500', 5, 'open', 0
  UNION ALL SELECT 'Sold', 'bg-emerald-500', 6, 'won', 1
  UNION ALL SELECT 'Lost', 'bg-red-500', 7, 'lost', 1
) stage
WHERE p.name = 'Revenue Pipeline'
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pipeline_stage ps
    WHERE ps.pipeline_id = p.id
      AND ps.name = stage.name
      AND ps.deleted_at IS NULL
  );

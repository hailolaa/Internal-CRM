UPDATE pipeline_stage
SET name = 'New enquiry',
  position = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND name = 'New';

UPDATE pipeline_stage
SET name = 'Booked consultation',
  position = 4,
  updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND name = 'Consult Booked';

UPDATE pipeline_stage
SET name = 'Consultation attended',
  position = 5,
  updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND name = 'Consult Attended';

UPDATE pipeline_stage
SET name = 'Converted',
  position = 7,
  kind = 'won',
  is_locked = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND name = 'Sold';

UPDATE pipeline_stage
SET position = 2,
  updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND name = 'Contacted';

UPDATE pipeline_stage
SET position = 3,
  updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND name = 'Qualified';

UPDATE pipeline_stage
SET position = 8,
  kind = 'lost',
  is_locked = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND name = 'Lost';

INSERT INTO pipeline_stage (id, clinic_id, pipeline_id, name, color, position, kind, is_locked)
SELECT UUID(), p.clinic_id, p.id, stage.name, stage.color, stage.position, stage.kind, stage.is_locked
FROM pipeline p
JOIN (
  SELECT 'Treatment proposed' as name, 'bg-pink-500' as color, 6 as position, 'open' as kind, 0 as is_locked
  UNION ALL
  SELECT 'Follow-up needed' as name, 'bg-slate-500' as color, 9 as position, 'open' as kind, 0 as is_locked
) stage
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pipeline_stage ps
    WHERE ps.clinic_id = p.clinic_id
      AND ps.pipeline_id = p.id
      AND ps.name = stage.name
      AND ps.deleted_at IS NULL
  );

UPDATE pipeline p
SET stages = JSON_ARRAY(
    'New enquiry',
    'Contacted',
    'Qualified',
    'Booked consultation',
    'Consultation attended',
    'Treatment proposed',
    'Converted',
    'Lost',
    'Follow-up needed'
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE p.deleted_at IS NULL;

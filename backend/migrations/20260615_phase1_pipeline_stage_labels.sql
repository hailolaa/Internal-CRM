UPDATE pipeline
SET name = 'Clinic Grower Sales Pipeline',
    description = 'Internal Clinic Grower prospect pipeline from enquiry to won/lost',
    stages = JSON_ARRAY(
      'New Enquiry',
      'Contacted',
      'Qualified',
      'Discovery Call Booked',
      'Proposal Sent',
      'Follow-Up Needed',
      'Won',
      'Lost'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND name IN ('Revenue Pipeline', 'Clinic Grower Sales Pipeline');

UPDATE pipeline_stage
SET name = CASE name
    WHEN 'New' THEN 'New Enquiry'
    WHEN 'New enquiry' THEN 'New Enquiry'
    WHEN 'Booked consultation' THEN 'Discovery Call Booked'
    WHEN 'Consult Booked' THEN 'Discovery Call Booked'
    WHEN 'Consultation attended' THEN 'Proposal Sent'
    WHEN 'Consult Attended' THEN 'Proposal Sent'
    WHEN 'Treatment proposed' THEN 'Proposal Sent'
    WHEN 'Converted' THEN 'Won'
    WHEN 'Sold' THEN 'Won'
    WHEN 'Follow-up needed' THEN 'Follow-Up Needed'
    ELSE name
  END,
  position = CASE name
    WHEN 'New' THEN 1
    WHEN 'New enquiry' THEN 1
    WHEN 'New Enquiry' THEN 1
    WHEN 'Contacted' THEN 2
    WHEN 'Qualified' THEN 3
    WHEN 'Booked consultation' THEN 4
    WHEN 'Consult Booked' THEN 4
    WHEN 'Discovery Call Booked' THEN 4
    WHEN 'Consultation attended' THEN 5
    WHEN 'Consult Attended' THEN 5
    WHEN 'Treatment proposed' THEN 5
    WHEN 'Proposal Sent' THEN 5
    WHEN 'Follow-up needed' THEN 6
    WHEN 'Follow-Up Needed' THEN 6
    WHEN 'Converted' THEN 7
    WHEN 'Sold' THEN 7
    WHEN 'Won' THEN 7
    WHEN 'Lost' THEN 8
    ELSE position
  END,
  kind = CASE name
    WHEN 'Converted' THEN 'won'
    WHEN 'Sold' THEN 'won'
    WHEN 'Won' THEN 'won'
    WHEN 'Lost' THEN 'lost'
    ELSE 'open'
  END,
  is_locked = CASE name
    WHEN 'Converted' THEN 1
    WHEN 'Sold' THEN 1
    WHEN 'Won' THEN 1
    WHEN 'Lost' THEN 1
    ELSE is_locked
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND name IN (
    'New',
    'New enquiry',
    'New Enquiry',
    'Contacted',
    'Qualified',
    'Booked consultation',
    'Consult Booked',
    'Discovery Call Booked',
    'Consultation attended',
    'Consult Attended',
    'Treatment proposed',
    'Proposal Sent',
    'Follow-up needed',
    'Follow-Up Needed',
    'Converted',
    'Sold',
    'Won',
    'Lost'
  );

INSERT INTO pipeline_stage (id, clinic_id, pipeline_id, name, color, position, kind, is_locked)
SELECT UUID(), p.clinic_id, p.id, stage.name, stage.color, stage.position, stage.kind, stage.is_locked
FROM pipeline p
JOIN (
  SELECT 'New Enquiry' as name, 'bg-blue-500' as color, 1 as position, 'open' as kind, 0 as is_locked
  UNION ALL SELECT 'Contacted', 'bg-cyan-500', 2, 'open', 0
  UNION ALL SELECT 'Qualified', 'bg-violet-500', 3, 'open', 0
  UNION ALL SELECT 'Discovery Call Booked', 'bg-amber-500', 4, 'open', 0
  UNION ALL SELECT 'Proposal Sent', 'bg-orange-500', 5, 'open', 0
  UNION ALL SELECT 'Follow-Up Needed', 'bg-purple-500', 6, 'open', 0
  UNION ALL SELECT 'Won', 'bg-emerald-500', 7, 'won', 1
  UNION ALL SELECT 'Lost', 'bg-red-500', 8, 'lost', 1
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

UPDATE deal
SET stage = CASE stage
    WHEN 'New' THEN 'New Enquiry'
    WHEN 'New enquiry' THEN 'New Enquiry'
    WHEN 'Booked consultation' THEN 'Discovery Call Booked'
    WHEN 'Consult Booked' THEN 'Discovery Call Booked'
    WHEN 'Consultation attended' THEN 'Proposal Sent'
    WHEN 'Consult Attended' THEN 'Proposal Sent'
    WHEN 'Treatment proposed' THEN 'Proposal Sent'
    WHEN 'Converted' THEN 'Won'
    WHEN 'Sold' THEN 'Won'
    WHEN 'Follow-up needed' THEN 'Follow-Up Needed'
    ELSE stage
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE stage IN (
  'New',
  'New enquiry',
  'Booked consultation',
  'Consult Booked',
  'Consultation attended',
  'Consult Attended',
  'Treatment proposed',
  'Converted',
  'Sold',
  'Follow-up needed'
);

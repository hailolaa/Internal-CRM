ALTER TABLE contact
  ADD COLUMN account_name VARCHAR(255) NULL AFTER clinic_id,
  ADD COLUMN website VARCHAR(255) NULL AFTER phone,
  ADD INDEX idx_contact_account_name (clinic_id, account_name),
  ADD INDEX idx_contact_website (clinic_id, website);

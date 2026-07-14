ALTER TABLE contact
  ADD COLUMN contact_role VARCHAR(100) NULL AFTER account_name,
  ADD COLUMN communication_permissions JSON NULL AFTER contact_role;

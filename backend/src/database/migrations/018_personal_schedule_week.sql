ALTER TABLE schedule_items
  ADD COLUMN IF NOT EXISTS week_start date;

UPDATE schedule_items
   SET week_start = date_trunc('week', created_at)::date
 WHERE week_start IS NULL;

ALTER TABLE schedule_items
  ALTER COLUMN week_start SET NOT NULL;

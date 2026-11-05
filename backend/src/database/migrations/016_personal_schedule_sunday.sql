ALTER TABLE schedule_items
  DROP CONSTRAINT IF EXISTS schedule_items_day_of_week_check,
  ADD CONSTRAINT schedule_items_day_of_week_check CHECK (day_of_week BETWEEN 2 AND 8);

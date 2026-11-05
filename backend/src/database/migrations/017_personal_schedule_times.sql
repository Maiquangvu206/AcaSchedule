ALTER TABLE schedule_items
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;

UPDATE schedule_items
   SET start_time = COALESCE(start_time, make_time(7 + ((start_period - 1) * 55) / 60, ((start_period - 1) * 55) % 60, 0)),
       end_time = COALESCE(end_time, make_time(7 + ((end_period - 1) * 55 + 50) / 60, ((end_period - 1) * 55 + 50) % 60, 0))
 WHERE start_time IS NULL OR end_time IS NULL;

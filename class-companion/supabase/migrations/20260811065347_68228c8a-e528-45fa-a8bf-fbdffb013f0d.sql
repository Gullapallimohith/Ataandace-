ALTER TABLE public.attendance_snapshot ALTER COLUMN ltps SET DEFAULT '';
UPDATE public.attendance_snapshot SET ltps = '' WHERE ltps IS NULL;
ALTER TABLE public.attendance_snapshot ALTER COLUMN ltps SET NOT NULL;
ALTER TABLE public.attendance_snapshot DROP CONSTRAINT IF EXISTS attendance_snapshot_pkey;
ALTER TABLE public.attendance_snapshot ADD PRIMARY KEY (coursecode, section, ltps);
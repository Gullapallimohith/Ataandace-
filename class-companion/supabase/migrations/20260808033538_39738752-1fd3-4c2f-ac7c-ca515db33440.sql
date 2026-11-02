CREATE TABLE public.attendance_snapshot (
  coursecode text NOT NULL,
  coursedesc text,
  ltps text,
  section text NOT NULL,
  total_conducted integer NOT NULL DEFAULT 0,
  total_attended integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coursecode, section)
);
GRANT SELECT ON public.attendance_snapshot TO anon, authenticated;
GRANT ALL ON public.attendance_snapshot TO service_role;
ALTER TABLE public.attendance_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attendance snapshot is publicly readable" ON public.attendance_snapshot FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.attendance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coursecode text NOT NULL,
  coursedesc text,
  section text,
  status text NOT NULL CHECK (status IN ('present','absent')),
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.attendance_history TO anon, authenticated;
GRANT ALL ON public.attendance_history TO service_role;
ALTER TABLE public.attendance_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attendance history is publicly readable" ON public.attendance_history FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX attendance_history_created_at_idx ON public.attendance_history (created_at DESC);

CREATE TABLE public.erp_session (
  id integer PRIMARY KEY DEFAULT 1,
  csrf_token text,
  cookies text,
  status text NOT NULL DEFAULT 'expired',
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.erp_session FROM anon, authenticated;
GRANT ALL ON public.erp_session TO service_role;
ALTER TABLE public.erp_session ENABLE ROW LEVEL SECURITY;
INSERT INTO public.erp_session (id, status) VALUES (1, 'expired');

ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_snapshot;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_history;
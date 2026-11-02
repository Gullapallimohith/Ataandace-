CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  sync_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_single_row CHECK (id = 1)
);
GRANT SELECT, UPDATE ON public.app_settings TO anon;
GRANT SELECT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read sync setting" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can toggle sync setting" ON public.app_settings FOR UPDATE USING (true) WITH CHECK (id = 1);
INSERT INTO public.app_settings (id, sync_enabled) VALUES (1, false);
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_project_tasks_start
  ON public.project_tasks(start_at)
  WHERE start_at IS NOT NULL;

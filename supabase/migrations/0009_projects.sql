-- Project lifecycle
DO $$
BEGIN
  CREATE TYPE public.project_stage AS ENUM ('preproduccion', 'produccion', 'postproduccion', 'entrega', 'cerrado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.deliverable_status AS ENUM ('pending', 'in_progress', 'ready', 'delivered', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       UUID UNIQUE REFERENCES public.deals(id) ON DELETE SET NULL,
  contact_id    UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  stage         public.project_stage NOT NULL DEFAULT 'preproduccion',
  start_date    DATE,
  due_date      DATE,
  completed_at  TIMESTAMPTZ,
  assigned_to   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'blocked')),
  priority       TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_at         TIMESTAMPTZ,
  assigned_to    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at   TIMESTAMPTZ,
  created_by     UUID NOT NULL REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_deliverables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  status        public.deliverable_status NOT NULL DEFAULT 'pending',
  due_at        TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  approved_at   TIMESTAMPTZ,
  notes         TEXT,
  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id       UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  actor_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS projects_updated_at ON public.projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS project_tasks_updated_at ON public.project_tasks;
CREATE TRIGGER project_tasks_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS project_deliverables_updated_at ON public.project_deliverables;
CREATE TRIGGER project_deliverables_updated_at
  BEFORE UPDATE ON public.project_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_projects_contact ON public.projects(contact_id);
CREATE INDEX IF NOT EXISTS idx_projects_stage ON public.projects(stage);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned ON public.project_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_project_deliverables_project ON public.project_deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_project ON public.project_activity_log(project_id);

CREATE OR REPLACE FUNCTION public.sync_project_from_won_deal()
RETURNS TRIGGER LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stage = 'won' AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM NEW.stage) THEN
    INSERT INTO public.projects (
      deal_id,
      contact_id,
      title,
      description,
      assigned_to,
      created_by,
      start_date
    )
    VALUES (
      NEW.id,
      NEW.contact_id,
      COALESCE(NEW.title, 'Proyecto sin titulo'),
      NEW.notes,
      NEW.assigned_to,
      NEW.created_by,
      CURRENT_DATE
    )
    ON CONFLICT (deal_id)
    DO UPDATE SET
      contact_id = EXCLUDED.contact_id,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      assigned_to = EXCLUDED.assigned_to,
      updated_at = NOW();

    INSERT INTO public.project_activity_log (project_id, actor_id, event_type, payload)
    SELECT p.id, NEW.created_by, 'deal_won', jsonb_build_object('deal_id', NEW.id, 'stage', NEW.stage)
    FROM public.projects p
    WHERE p.deal_id = NEW.id
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_create_project_on_won ON public.deals;
CREATE TRIGGER deals_create_project_on_won
  AFTER INSERT OR UPDATE OF stage ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_from_won_deal();

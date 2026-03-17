-- ============================================================
-- 0022_projects_wbs_redesign.sql
-- WBS hierarchy, dependencies, non-contract projects, portfolio %
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Extend projects table
-- ----------------------------------------------------------------

-- Make contact_id nullable so internal/alliance projects don't need a contact
ALTER TABLE public.projects
  ALTER COLUMN contact_id DROP NOT NULL;

-- Project type: contract (from deal), internal, or alliance
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'contract'
    CHECK (project_type IN ('contract', 'internal', 'alliance'));

-- Progress tracking: computed from tasks, or manual override
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS progress_mode TEXT NOT NULL DEFAULT 'computed'
    CHECK (progress_mode IN ('computed', 'manual'));

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS progress_pct SMALLINT
    CHECK (progress_pct BETWEEN 0 AND 100);

-- Color for portfolio timeline bars (hex, e.g. '#C49A2A')
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS color TEXT;

-- ----------------------------------------------------------------
-- 2. project_wbs_nodes  — unified WBS hierarchy
--    level: macro (work package) → activity → task
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_wbs_nodes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES public.project_wbs_nodes(id) ON DELETE CASCADE,

  -- Hierarchy level
  level         TEXT NOT NULL DEFAULT 'task'
    CHECK (level IN ('macro', 'activity', 'task')),

  -- Sort order within the same parent
  position      SMALLINT NOT NULL DEFAULT 0,

  title         TEXT NOT NULL,
  description   TEXT,

  -- A task-level node can be a milestone (diamond on Gantt, no duration)
  is_milestone  BOOLEAN NOT NULL DEFAULT false,

  status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'done', 'blocked')),

  priority      TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  start_at      TIMESTAMPTZ,
  due_at        TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,

  assigned_to   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Progress: computed (roll-up from children) or manual override
  progress_mode TEXT NOT NULL DEFAULT 'computed'
    CHECK (progress_mode IN ('computed', 'manual')),
  progress_pct  SMALLINT CHECK (progress_pct BETWEEN 0 AND 100),

  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Macro nodes must be root-level (no parent)
  CONSTRAINT wbs_macro_no_parent CHECK (level != 'macro' OR parent_id IS NULL),
  -- Milestones only at task level
  CONSTRAINT wbs_milestone_only_task CHECK (is_milestone = false OR level = 'task')
);

CREATE INDEX IF NOT EXISTS idx_wbs_project    ON public.project_wbs_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_wbs_parent     ON public.project_wbs_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_wbs_assigned   ON public.project_wbs_nodes(assigned_to);
CREATE INDEX IF NOT EXISTS idx_wbs_start      ON public.project_wbs_nodes(start_at) WHERE start_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wbs_due        ON public.project_wbs_nodes(due_at)   WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wbs_project_level ON public.project_wbs_nodes(project_id, level);

DROP TRIGGER IF EXISTS wbs_nodes_updated_at ON public.project_wbs_nodes;
CREATE TRIGGER wbs_nodes_updated_at
  BEFORE UPDATE ON public.project_wbs_nodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------
-- 3. project_dependencies — MS Project-style links
--    FS = Finish-to-Start (default)
--    SS = Start-to-Start
--    FF = Finish-to-Finish
--    SF = Start-to-Finish
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_dependencies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  predecessor_id UUID NOT NULL REFERENCES public.project_wbs_nodes(id) ON DELETE CASCADE,
  successor_id   UUID NOT NULL REFERENCES public.project_wbs_nodes(id) ON DELETE CASCADE,
  dep_type       TEXT NOT NULL DEFAULT 'FS'
    CHECK (dep_type IN ('FS', 'SS', 'FF', 'SF')),
  -- Positive = lag (gap), negative = lead (overlap) in days
  lag_days       SMALLINT NOT NULL DEFAULT 0,
  created_by     UUID NOT NULL REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT no_self_dependency CHECK (predecessor_id != successor_id),
  UNIQUE (predecessor_id, successor_id)
);

CREATE INDEX IF NOT EXISTS idx_dep_project     ON public.project_dependencies(project_id);
CREATE INDEX IF NOT EXISTS idx_dep_predecessor ON public.project_dependencies(predecessor_id);
CREATE INDEX IF NOT EXISTS idx_dep_successor   ON public.project_dependencies(successor_id);

-- ----------------------------------------------------------------
-- 4. RLS — project_wbs_nodes
-- ----------------------------------------------------------------

ALTER TABLE public.project_wbs_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_view_wbs_nodes" ON public.project_wbs_nodes
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_manage_wbs_nodes" ON public.project_wbs_nodes
  FOR ALL USING (public.is_internal_staff());

-- ----------------------------------------------------------------
-- 5. RLS — project_dependencies
-- ----------------------------------------------------------------

ALTER TABLE public.project_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_view_deps" ON public.project_dependencies
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_manage_deps" ON public.project_dependencies
  FOR ALL USING (public.is_internal_staff());

-- ----------------------------------------------------------------
-- 6. Helper: compute rolled-up progress for a WBS node
--    Returns 0-100 based on fraction of task-level descendants done
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.compute_project_progress(p_project_id UUID)
RETURNS SMALLINT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE LEAST(100, ROUND(
      SUM(CASE WHEN status = 'done' THEN 100.0 ELSE 0.0 END) / COUNT(*)
    ))::SMALLINT
  END
  FROM public.project_wbs_nodes
  WHERE project_id = p_project_id
    AND level = 'task';
$$;

CREATE OR REPLACE FUNCTION public.compute_wbs_node_progress(p_node_id UUID)
RETURNS SMALLINT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH RECURSIVE descendants AS (
    SELECT id, status, level FROM public.project_wbs_nodes WHERE id = p_node_id
    UNION ALL
    SELECT n.id, n.status, n.level FROM public.project_wbs_nodes n
    INNER JOIN descendants d ON n.parent_id = d.id
  )
  SELECT CASE
    WHEN COUNT(*) FILTER (WHERE level = 'task') = 0 THEN 0
    ELSE LEAST(100, ROUND(
      SUM(CASE WHEN status = 'done' AND level = 'task' THEN 100.0 ELSE 0.0 END)
      / COUNT(*) FILTER (WHERE level = 'task')
    ))::SMALLINT
  END
  FROM descendants;
$$;

-- ----------------------------------------------------------------
-- 7. Backfill: migrate existing project_tasks → project_wbs_nodes
--    Preserves all existing task data as level='task' nodes
-- ----------------------------------------------------------------

INSERT INTO public.project_wbs_nodes (
  id,
  project_id,
  parent_id,
  level,
  position,
  title,
  description,
  is_milestone,
  status,
  priority,
  start_at,
  due_at,
  completed_at,
  assigned_to,
  progress_mode,
  created_by,
  created_at,
  updated_at
)
SELECT
  id,
  project_id,
  NULL,           -- orphaned tasks become root-level tasks (no WBS parent)
  'task',
  ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) - 1,
  title,
  description,
  false,
  status,
  priority,
  start_at,
  due_at,
  completed_at,
  assigned_to,
  'computed',
  created_by,
  created_at,
  updated_at
FROM public.project_tasks
ON CONFLICT (id) DO NOTHING;

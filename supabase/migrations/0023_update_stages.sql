-- 0023_update_stages.sql
-- SOLO añade los nuevos valores al enum.
-- Los UPDATE que usan estos valores van en 0024 (transacción separada).

ALTER TYPE public.project_stage ADD VALUE IF NOT EXISTS 'primera_revision' AFTER 'preproduccion';
ALTER TYPE public.project_stage ADD VALUE IF NOT EXISTS 'segunda_revision' AFTER 'produccion';
ALTER TYPE public.project_stage ADD VALUE IF NOT EXISTS 'cierre'           AFTER 'entrega';

-- 0024_migrate_stage_data.sql
-- Migra filas que usan valores viejos del enum project_stage.
-- Debe correr en transacción SEPARADA de 0023 (Postgres no permite
-- usar nuevos valores de enum en la misma transacción en que se añadieron).

UPDATE public.projects SET stage = 'segunda_revision' WHERE stage = 'postproduccion';
UPDATE public.projects SET stage = 'cierre'           WHERE stage = 'cerrado';

ALTER TABLE public.projects ALTER COLUMN stage SET DEFAULT 'preproduccion';

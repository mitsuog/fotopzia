-- Recursos de ejemplo
INSERT INTO public.resources (name, type, color) VALUES
  ('Estudio Principal', 'studio', '#1C2B4A'),
  ('Estudio 2', 'studio', '#2E3F5E'),
  ('Cámara Sony A7R V', 'equipment', '#C49A2A'),
  ('Cámara Canon R5', 'equipment', '#DDB84A'),
  ('Drone DJI Air 3', 'equipment', '#8B7355'),
  ('Iluminación Godox', 'equipment', '#6B8E9F');

-- Template de contrato base
INSERT INTO public.contract_templates (name, content, variables, created_by)
SELECT
  'Contrato de Servicios Fotográficos',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"CONTRATO DE PRESTACIÓN DE SERVICIOS FOTOGRÁFICOS"}]}]}',
  '[{"key":"client_name","label":"Nombre del cliente"},{"key":"event_date","label":"Fecha del evento"},{"key":"total_amount","label":"Monto total"},{"key":"location","label":"Lugar"}]'::JSONB,
  id
FROM public.profiles WHERE role = 'admin' LIMIT 1;

# Fotopzia OS

Plataforma integral para Fotopzia con enfoque CRM + operacion de estudio + portal de cliente.

## Stack

- Next.js App Router (React 19)
- Supabase (Auth, Postgres, RLS, Storage)
- Tailwind CSS v4
- TanStack Query

## Modulos activos

- Dashboard con KPIs base
- CRM (contactos, deals, actividades)
- Cotizaciones + PDF
- Contratos (listado)
- Aprobaciones (listado)
- Calendario operativo
- Portafolios (albumes)
- Configuracion (usuarios + control-plane stats)
- Proyectos (seguimiento operativo)

## Migraciones importantes

- `0009_projects.sql`: proyectos, tareas, entregables y bitacora; autocreacion de proyecto cuando un deal pasa a `won`.
- `0010_admin_config.sql`: roles, permisos, role_permissions, catalogos, templates y branding.
- `0011_rls_extensions.sql`: politicas RLS para proyectos y control-plane admin.

## Endpoints internos agregados

- `GET/POST /api/projects`
- `GET/POST /api/projects/[id]/tasks`
- `GET /api/portal/[token]/summary`

## Calidad

Comandos de verificacion:

```bash
npx tsc --noEmit
npm run lint
```

Estado actual: ambos comandos en verde.

## Siguientes pasos sugeridos

1. Aplicar migraciones en Supabase y regenerar tipos (`supabase gen types`).
2. Implementar UI CRUD completa para proyectos/tareas/entregables.
3. Integrar settings con gestion real de roles/permisos/catálogos (alta/edicion desde UI).
4. Completar minisitios de cliente (galeria, cotizaciones, contratos, avance de proyecto).

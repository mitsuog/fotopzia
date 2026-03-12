# Auditoria E2E de Coherencia Funcional (Embudo Comercial Primero)

Fecha: 2026-03-12  
Repositorio: `e:\Fotopzia\fotopzia`  
Alcance: `CRM -> Cotizaciones -> Contratos -> Proyectos -> Calendarios -> Portafolios -> Settings -> Portal`

## Resumen Ejecutivo
- Se identificaron bloqueos funcionales criticos del embudo comercial: con la UX actual no es posible completar el flujo `lead -> won` sin intervencion manual en BD.
- El portal cliente tiene CTAs principales que apuntan a rutas no implementadas.
- El contrato de permisos existe en codigo, pero no se aplica en navegacion ni guardas de rutas.
- Se detectaron endpoints y capacidades de backend que no estan conectadas con UI (principalmente proyectos y portal summary).

## Contrato Definido de Navegacion y CTA
- Toda accion primaria debe cumplir: `etiqueta` = `resultado real` (navega a ruta existente o dispara accion concreta).
- Ningun CTA primario puede apuntar a rutas no implementadas.
- CTAs de creacion deben abrir flujo de alta (form/modal) o llevar a pantalla de alta real.
- Si una ruta es solo de lectura, los CTAs deben nombrarlo explicitamente (`Ver`, `Consultar`) y no sugerir creacion.

## Contrato Definido de Permisos UI/API
- `admin`: acceso total a modulos internos y gestion.
- `project_manager`: gestion operativa/comercial completa.
- `operator`: lectura comercial, gestion de proyectos/calendario, carga media.
- `client`: solo portal de cliente.

Regla de aplicacion:
- UI: visibilidad de modulos y CTAs basada en permiso efectivo.
- Rutas/paginas: guarda por rol/permiso (ademas de auth).
- APIs internas: autenticacion obligatoria + autorizacion explicita (no solo middleware).

## Contrato Definido de APIs Revisadas
- `GET /api/projects`: solo usuario autenticado interno, salida consistente con permisos RLS.
- `POST /api/projects`: autenticado interno + validacion de payload + respuesta de error de negocio clara.
- `GET /api/projects/[id]/tasks`: autenticado interno + autorizacion por proyecto.
- `POST /api/projects/[id]/tasks`: autenticado interno + validacion + registro en bitacora.
- `GET /api/portal/[token]/summary`: acceso por token activo/no expirado, solo agregados minimos (sin PII extra).

## Matriz de Coherencia por Modulo (6 Ejes)
Estado: `OK`, `PARCIAL`, `NO`.

| Modulo | Navegacion | Acciones | Estados UI | Reglas negocio | Permisos | Errores/mensajes |
|---|---|---|---|---|---|---|
| CRM | PARCIAL | PARCIAL | PARCIAL | PARCIAL | NO | PARCIAL |
| Cotizaciones | PARCIAL | PARCIAL | PARCIAL | NO | NO | PARCIAL |
| Contratos | PARCIAL | NO | PARCIAL | NO | NO | NO |
| Proyectos | PARCIAL | NO | PARCIAL | PARCIAL | NO | NO |
| Calendarios | OK | PARCIAL | PARCIAL | PARCIAL | NO | PARCIAL |
| Portafolios | PARCIAL | PARCIAL | PARCIAL | PARCIAL | NO | PARCIAL |
| Settings | PARCIAL | NO | PARCIAL | PARCIAL | NO | NO |
| Portal cliente | NO | NO | PARCIAL | PARCIAL | PARCIAL | PARCIAL |

## Hallazgos (Formato Fijo)

### F-001
- ID: `F-001`
- Severidad: `S0`
- Modulo: `CRM / Cotizaciones / Aprobaciones / Contratos`
- Evidencia (archivo:linea):
  - `supabase/migrations/0013_deal_pipeline_rules.sql:49` (calificado requiere aprobacion de cotizacion)
  - `supabase/migrations/0013_deal_pipeline_rules.sql:65` (negociacion requiere cotizacion enviada/vista/aprobada)
  - `supabase/migrations/0013_deal_pipeline_rules.sql:80` (won requiere cotizacion aprobada + contrato firmado)
  - `src/components/quotes/QuoteEditor.tsx:129` (las cotizaciones se crean en `draft`)
  - `src/app/(app)/approvals/page.tsx:6` (modulo solo lista, sin flujo de creacion/operacion)
  - `src/app/(app)/contracts/page.tsx:7` (modulo solo lista, sin alta/firma)
- Impacto: el embudo comercial no puede completarse end-to-end desde UI.
- Repro:
  1. Crear deal en CRM.
  2. Crear cotizacion (queda en `draft`).
  3. Intentar mover deal a `negotiation` o `won`.
  4. El backend bloquea por prerequisitos no operables en UI.
- Correccion propuesta: implementar ciclo de vida de cotizacion, flujo de aprobaciones y flujo de contrato/firma.
- Criterio de aceptacion: un usuario con permisos puede llevar un deal de `lead` a `won` sin SQL manual.

### F-002
- ID: `F-002`
- Severidad: `S0`
- Modulo: `Portal cliente`
- Evidencia (archivo:linea):
  - `src/app/(client-portal)/portal/[token]/page.tsx:76`
  - `src/app/(client-portal)/portal/[token]/page.tsx:82`
  - Solo existe `src/app/(client-portal)/portal/[token]/page.tsx` (no rutas hijas `/gallery`, `/quotes`, `/contracts`).
- Impacto: los CTAs principales del portal llevan a 404.
- Repro: abrir `/portal/{token}` y hacer click en cualquiera de las 3 tarjetas.
- Correccion propuesta: implementar rutas hijas o redirigir CTAs a vistas existentes.
- Criterio de aceptacion: cada CTA del portal responde `200` con contenido funcional.

### F-003
- ID: `F-003`
- Severidad: `S1`
- Modulo: `API / Seguridad`
- Evidencia (archivo:linea):
  - `src/app/api/quotes/[id]/pdf/route.tsx:2` (usa `supabaseAdmin`)
  - `src/app/api/quotes/[id]/pdf/route.tsx:41` (consulta con service role)
  - No hay validacion de usuario/rol en el handler.
- Impacto: bypass de RLS para datos de cotizaciones en endpoint PDF.
- Repro: consumir el endpoint con sesion autenticada de rol no previsto y `quoteId` valido.
- Correccion propuesta: migrar a `createClient()` con RLS o agregar autorizacion explicita por usuario/rol antes de consultar.
- Criterio de aceptacion: usuarios no autorizados reciben `401/403`; usuarios autorizados reciben PDF.

### F-004
- ID: `F-004`
- Severidad: `S1`
- Modulo: `Permisos UI / Navegacion`
- Evidencia (archivo:linea):
  - `src/lib/utils/permissions.ts:1` (contrato de permisos definido)
  - `src/components/layout/Sidebar.tsx:25` (menu estatico sin filtro por rol)
  - `middleware.ts:27` (solo valida auth/public, no rol/permiso)
  - Busqueda de uso de permisos: solo definiciones, sin consumo en UI/rutas.
- Impacto: incoherencia entre permisos definidos y experiencia real; rol `client` puede entrar al shell interno.
- Repro: autenticar usuario con rol `client`; observa modulos internos visibles.
- Correccion propuesta: aplicar permisos en `Sidebar`, `Topbar`, layout de app y guardas de ruta/API.
- Criterio de aceptacion: visibilidad y acceso coinciden con contrato de permisos por rol.

### F-005
- ID: `F-005`
- Severidad: `S1`
- Modulo: `Dashboard / Settings`
- Evidencia (archivo:linea):
  - `src/app/(app)/dashboard/page.tsx:11` (`profiles.select(...).single()` sin filtrar por usuario actual)
  - `src/app/(app)/settings/page.tsx:11` (mismo patron)
- Impacto: puede mostrarse perfil/rol incorrecto cuando hay multiples perfiles visibles por RLS.
- Repro: base con varios perfiles; cargar dashboard/settings.
- Correccion propuesta: resolver usuario actual (`auth.getUser`) y filtrar por `id = user.id`.
- Criterio de aceptacion: perfil mostrado siempre corresponde al usuario de sesion.

### F-006
- ID: `F-006`
- Severidad: `S1`
- Modulo: `Proyectos`
- Evidencia (archivo:linea):
  - `src/app/api/projects/route.ts:15` (POST disponible)
  - `src/app/api/projects/[id]/tasks/route.ts:21` (POST tasks disponible)
  - `src/app/(app)/projects/page.tsx:49` (UI solo tabla, sin acciones CRUD)
- Impacto: contrato API/UI incompleto; operacion de proyectos no ejecutable desde frontend.
- Repro: entrar a `/projects`; no existe alta de proyecto/tarea.
- Correccion propuesta: agregar UI minima para crear proyecto y tarea (o retirar endpoints no usados).
- Criterio de aceptacion: desde `/projects` se puede crear al menos una tarea asociada.

### F-007
- ID: `F-007`
- Severidad: `S2`
- Modulo: `Portal cliente / API`
- Evidencia (archivo:linea):
  - `src/app/api/portal/[token]/summary/route.ts:4` (API summary implementada)
  - `src/app/(client-portal)/portal/[token]/page.tsx:64` (landing no consume API summary)
- Impacto: inconsistencia entre capacidades backend y experiencia del portal.
- Repro: abrir portal; no hay indicadores agregados de progreso/estado.
- Correccion propuesta: consumir summary en landing y reflejar conteos operativos.
- Criterio de aceptacion: landing muestra conteos de albumes/cotizaciones/contratos/proyectos activos.

### F-008
- ID: `F-008`
- Severidad: `S2`
- Modulo: `Navegacion global`
- Evidencia (archivo:linea):
  - `src/components/layout/Topbar.tsx:72` (`Nuevo Deal` redirige a `/crm/kanban`, no crea)
  - `src/components/layout/Topbar.tsx:93` (`Ver Contratos` en modulo contratos es accion redundante)
- Impacto: CTAs no reflejan accion real; genera friccion y ambiguedad.
- Repro: usar CTAs primarios del topbar en CRM/Contratos.
- Correccion propuesta: alinear etiqueta con comportamiento o convertir CTA en accion real.
- Criterio de aceptacion: cada CTA principal cumple contrato `etiqueta == resultado`.

### F-009
- ID: `F-009`
- Severidad: `S2`
- Modulo: `Manejo de errores en paginas server`
- Evidencia (archivo:linea):
  - `src/app/(app)/contracts/page.tsx:10` (usa `data` sin manejar `error`)
  - `src/app/(app)/portfolios/page.tsx:9` (igual)
  - `src/app/(app)/approvals/page.tsx:9` (igual)
  - `src/app/(app)/projects/page.tsx:20` (igual en Promise.all)
- Impacto: fallas de consulta se perciben como estados vacios, no como error.
- Repro: forzar error de consulta/RLS; UI muestra tabla vacia sin mensaje de fallo.
- Correccion propuesta: manejar `error` y renderizar estado de error explicito.
- Criterio de aceptacion: cada modulo muestra estado de error diferenciado de estado vacio.

### F-010
- ID: `F-010`
- Severidad: `S3`
- Modulo: `Portafolios`
- Evidencia (archivo:linea):
  - `src/components/portfolios/AlbumGrid.tsx:28` (link a `/portfolios/{contact}/{album}`)
  - No hay rutas `src/app/(app)/portfolios/...` para esos paths.
  - `src/components/portfolios/MediaUploader.tsx:13` (componente no integrado en paginas activas).
- Impacto: deuda tecnica y confusion sobre flujo real de media.
- Repro: revisar modulo activo y rutas disponibles.
- Correccion propuesta: integrar componentes con rutas reales o removerlos del scope activo.
- Criterio de aceptacion: no existen componentes de flujo principal sin ruta/uso validado.

## Backlog Priorizado (Ejecutable)

### P0 (rompe flujo critico o seguridad)
1. Implementar flujo comercial completo para cumplir reglas de `0013`:
   - lifecycle de cotizacion (draft/sent/viewed/approved),
   - creacion/operacion de aprobaciones,
   - creacion/firma de contrato.
   - Aceptacion: un deal puede llegar a `won` desde UI sin SQL manual.
2. Corregir portal cliente:
   - implementar rutas `/portal/[token]/gallery|quotes|contracts` o ajustar CTAs.
   - Aceptacion: 0 enlaces rotos en landing de portal.

### P1 (incoherencia funcional de alto impacto)
1. Blindar `GET /api/quotes/[id]/pdf` con autorizacion real (sin bypass por service role).
2. Aplicar contrato de permisos en UI/rutas/APIs (`client` fuera del shell interno).
3. Corregir perfil actual en dashboard/settings (consulta por `auth.uid()`).
4. Conectar UI de proyectos con APIs POST existentes (al menos crear tarea).

### P2 (friccion UX/operativa)
1. Consumir `GET /api/portal/[token]/summary` en portal landing.
2. Normalizar CTAs de topbar para que accion y etiqueta coincidan.
3. Estandarizar manejo de errores en paginas server (estado vacio vs estado error).

### P3 (cosmetico/deuda)
1. Depurar o integrar componentes no usados de portafolios.
2. Limpieza de copy y consistencia de microtextos por modulo.

## Casos de Prueba (Definidos)

1. Pipeline CRM:
   - mover deal por etapas con y sin prerequisitos.
   - esperado: bloqueos/mensajes correctos y avance cuando se cumplen requisitos.
2. Provision de deal confirmado:
   - al pasar a `won`, validar creacion de proyecto, token de portal y album base.
3. Navegacion global:
   - validar que cada CTA de Sidebar/Topbar tenga destino funcional.
4. Roles:
   - validar `admin`, `project_manager`, `operator`, `client` en menu, paginas y APIs.
5. Portal:
   - validar token invalido/expirado y rutas hijas.
6. Estados UI:
   - por modulo validar `empty/loading/error/success`.

## Riesgos y Supuestos
- La auditoria fue de codigo/rutas/politicas; no incluye prueba E2E con datos multi-rol reales en entorno productivo.
- Se asume que las migraciones `0013` y `0014` estan activas en el entorno objetivo.

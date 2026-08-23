-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Sesión 0-A: Esquema SQL completo
-- Alcance: tipos, tablas, índices, RLS. NO incluye funciones/triggers de
--          negocio (eso va en sesiones posteriores) salvo los mínimos
--          necesarios para mantener updated_at y el vínculo con auth.users.
-- Motor: PostgreSQL (Supabase)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONES
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1. TIPOS (ENUMS)
-- ----------------------------------------------------------------------------

-- Roles de usuario (mismo patrón de 4 niveles usado en Capacitación KORE)
create type public.user_role as enum (
  'admin',              -- control total: estructura, usuarios, umbrales
  'director_tecnico',   -- lectura completa + reportes + gestión de alertas
  'operador_planta',    -- carga de lecturas de campo, sin tocar estructura
  'visor'               -- solo lectura (dashboards, reportes)
);

-- Estado operativo de un pozo de extracción
create type public.well_status as enum (
  'activo',
  'inactivo',
  'mantenimiento',
  'clausurado'
);

-- Categoría del parámetro monitoreado (agrupa para UI / reportes)
create type public.parameter_category as enum (
  'nivel',              -- nivel freático / nivel de pozo
  'calidad_fisicoquimica', -- conductividad, TDS, pH, temperatura
  'intrusion_salina',   -- cloruros, relación Cl-/HCO3-, SAR, etc.
  'caudal',             -- caudal de extracción
  'otro'
);

-- Origen del dato de una lectura
create type public.reading_source as enum (
  'manual',             -- digitado por operador
  'carga_masiva',       -- importación Excel/CSV
  'sensor',             -- telemetría (futuro)
  'laboratorio'         -- resultado de laboratorio externo
);

-- Severidad de una alerta
create type public.alert_severity as enum (
  'info',
  'atencion',
  'critica'
);

-- Estado de una alerta
create type public.alert_status as enum (
  'abierta',
  'reconocida',
  'resuelta',
  'descartada'
);

-- Acción registrada en auditoría
create type public.audit_action as enum (
  'insert',
  'update',
  'delete'
);

-- ----------------------------------------------------------------------------
-- 2. TABLA: profiles
-- Extiende auth.users con rol y datos de perfil. 1:1 con auth.users.
-- ----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null,
  role          public.user_role not null default 'visor',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Perfil y rol de cada usuario autenticado del spoke Pucusana.';

-- ----------------------------------------------------------------------------
-- 3. TABLA: wells (pozos de extracción)
-- ----------------------------------------------------------------------------
create table public.wells (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,        -- ej. 'PZ-01', 'POZO-PUC-03'
  name              text not null,
  status            public.well_status not null default 'activo',
  latitude          numeric(10, 6),
  longitude         numeric(10, 6),
  depth_m           numeric(8, 2),                -- profundidad del pozo (m)
  distance_to_sea_m numeric(10, 2),                -- relevante para intrusión salina
  aquifer_unit      text,                          -- unidad hidrogeológica
  commissioned_on   date,
  notes             text,
  created_by        uuid references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.wells is 'Pozos de extracción de la planta Pucusana.';

-- ----------------------------------------------------------------------------
-- 4. TABLA: parameters (catálogo de parámetros medibles)
-- ----------------------------------------------------------------------------
create table public.parameters (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,       -- ej. 'COND_EC', 'CL', 'NIVEL_ESTATICO'
  name          text not null,
  category      public.parameter_category not null,
  unit          text not null,              -- ej. 'µS/cm', 'mg/L', 'm'
  description   text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

comment on table public.parameters is 'Catálogo de parámetros medibles (calidad, nivel, intrusión salina, caudal).';

-- ----------------------------------------------------------------------------
-- 5. TABLA: well_parameters (qué parámetros se monitorean por pozo + umbrales)
-- ----------------------------------------------------------------------------
create table public.well_parameters (
  id                uuid primary key default gen_random_uuid(),
  well_id           uuid not null references public.wells (id) on delete cascade,
  parameter_id      uuid not null references public.parameters (id) on delete cascade,
  is_monitored      boolean not null default true,
  threshold_warning numeric,     -- umbral de atención
  threshold_critical numeric,    -- umbral crítico
  direction         text not null default 'above' check (direction in ('above', 'below')),
  created_at        timestamptz not null default now(),
  unique (well_id, parameter_id)
);

comment on table public.well_parameters is 'Relación pozo-parámetro con umbrales de alerta configurables.';

-- ----------------------------------------------------------------------------
-- 6. TABLA: readings (lecturas / serie temporal)
-- ----------------------------------------------------------------------------
create table public.readings (
  id            uuid primary key default gen_random_uuid(),
  well_id       uuid not null references public.wells (id) on delete cascade,
  parameter_id  uuid not null references public.parameters (id) on delete restrict,
  recorded_at   timestamptz not null,        -- momento de la medición en campo
  value         numeric not null,
  source        public.reading_source not null default 'manual',
  batch_id      uuid,                        -- agrupa lecturas de una misma carga masiva
  notes         text,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);

comment on table public.readings is 'Serie temporal de lecturas de campo/laboratorio por pozo y parámetro.';

-- ----------------------------------------------------------------------------
-- 7. TABLA: alerts (alertas generadas por umbrales)
-- ----------------------------------------------------------------------------
create table public.alerts (
  id              uuid primary key default gen_random_uuid(),
  well_id         uuid not null references public.wells (id) on delete cascade,
  parameter_id    uuid not null references public.parameters (id) on delete cascade,
  reading_id      uuid references public.readings (id) on delete set null,
  severity        public.alert_severity not null,
  status          public.alert_status not null default 'abierta',
  message         text not null,
  triggered_value numeric,
  acknowledged_by uuid references public.profiles (id),
  acknowledged_at timestamptz,
  resolved_by     uuid references public.profiles (id),
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

comment on table public.alerts is 'Alertas generadas cuando una lectura cruza un umbral configurado.';

-- ----------------------------------------------------------------------------
-- 8. TABLA: audit_log (auditoría de cambios sensibles)
-- ----------------------------------------------------------------------------
create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  table_name    text not null,
  record_id     uuid not null,
  action        public.audit_action not null,
  changed_by    uuid references public.profiles (id),
  old_data      jsonb,
  new_data      jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.audit_log is 'Registro de auditoría genérico para trazabilidad del modelo predictivo a 30 años.';

-- ----------------------------------------------------------------------------
-- 9. ÍNDICES
-- ----------------------------------------------------------------------------

-- Consultas de series temporales: por pozo+parámetro ordenadas por fecha (lo más usado)
create index idx_readings_well_param_time
  on public.readings (well_id, parameter_id, recorded_at desc);

-- Filtrado rápido por lote de carga masiva
create index idx_readings_batch
  on public.readings (batch_id)
  where batch_id is not null;

-- Alertas abiertas por pozo (dashboard principal)
create index idx_alerts_well_status
  on public.alerts (well_id, status)
  where status in ('abierta', 'reconocida');

-- Alertas por severidad (para conteos/paneles)
create index idx_alerts_severity_status
  on public.alerts (severity, status);

-- Búsqueda de parámetros monitoreados por pozo
create index idx_well_parameters_well
  on public.well_parameters (well_id);

-- Auditoría por tabla/registro
create index idx_audit_log_table_record
  on public.audit_log (table_name, record_id);

-- Pozos por estado (para filtros de dashboard)
create index idx_wells_status
  on public.wells (status);

-- ----------------------------------------------------------------------------
-- 10. FUNCIÓN Y TRIGGERS DE APOYO (mínimos, no de negocio)
-- ----------------------------------------------------------------------------

-- 10.1 updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_wells_updated_at
  before update on public.wells
  for each row execute function public.set_updated_at();

-- 10.2 Crear profile automáticamente al registrarse un usuario en auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), 'visor');
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 11. FUNCIÓN AUXILIAR PARA RLS: rol del usuario actual
-- ----------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin_or_director()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'director_tecnico') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.can_write_operational_data()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'director_tecnico', 'operador_planta') from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ----------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.wells           enable row level security;
alter table public.parameters      enable row level security;
alter table public.well_parameters enable row level security;
alter table public.readings        enable row level security;
alter table public.alerts          enable row level security;
alter table public.audit_log       enable row level security;

-- ---------------------------
-- 12.1 profiles
-- ---------------------------
-- Todo usuario autenticado puede ver todos los perfiles (necesario para
-- mostrar nombres en auditoría/alertas). Solo admin puede modificar roles.
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

create policy profiles_update_self_basic
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
  -- el propio usuario puede actualizar sus datos pero NO su rol

create policy profiles_admin_full
  on public.profiles for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- ---------------------------
-- 12.2 wells
-- ---------------------------
create policy wells_select_authenticated
  on public.wells for select
  to authenticated
  using (true);

create policy wells_write_admin_director
  on public.wells for insert
  to authenticated
  with check (public.is_admin_or_director());

create policy wells_update_admin_director
  on public.wells for update
  to authenticated
  using (public.is_admin_or_director())
  with check (public.is_admin_or_director());

create policy wells_delete_admin_only
  on public.wells for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- ---------------------------
-- 12.3 parameters (catálogo, cambia poco, solo admin/director lo mantiene)
-- ---------------------------
create policy parameters_select_authenticated
  on public.parameters for select
  to authenticated
  using (true);

create policy parameters_write_admin_director
  on public.parameters for insert
  to authenticated
  with check (public.is_admin_or_director());

create policy parameters_update_admin_director
  on public.parameters for update
  to authenticated
  using (public.is_admin_or_director())
  with check (public.is_admin_or_director());

create policy parameters_delete_admin_only
  on public.parameters for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- ---------------------------
-- 12.4 well_parameters (umbrales)
-- ---------------------------
create policy well_parameters_select_authenticated
  on public.well_parameters for select
  to authenticated
  using (true);

create policy well_parameters_write_admin_director
  on public.well_parameters for insert
  to authenticated
  with check (public.is_admin_or_director());

create policy well_parameters_update_admin_director
  on public.well_parameters for update
  to authenticated
  using (public.is_admin_or_director())
  with check (public.is_admin_or_director());

create policy well_parameters_delete_admin_only
  on public.well_parameters for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- ---------------------------
-- 12.5 readings (lecturas de campo)
-- ---------------------------
create policy readings_select_authenticated
  on public.readings for select
  to authenticated
  using (true);

-- admin, director y operador pueden insertar lecturas
create policy readings_insert_operational
  on public.readings for insert
  to authenticated
  with check (public.can_write_operational_data());

-- solo admin y director pueden corregir/eliminar lecturas ya cargadas
-- (el operador no debería editar datos históricos, solo cargar nuevos)
create policy readings_update_admin_director
  on public.readings for update
  to authenticated
  using (public.is_admin_or_director())
  with check (public.is_admin_or_director());

create policy readings_delete_admin_director
  on public.readings for delete
  to authenticated
  using (public.is_admin_or_director());

-- ---------------------------
-- 12.6 alerts
-- ---------------------------
create policy alerts_select_authenticated
  on public.alerts for select
  to authenticated
  using (true);

-- las alertas normalmente las genera un trigger/función con security definer,
-- pero se permite inserción manual a roles operativos por si se requiere
create policy alerts_insert_operational
  on public.alerts for insert
  to authenticated
  with check (public.can_write_operational_data());

-- reconocer/resolver alertas: admin, director, operador (no visor)
create policy alerts_update_operational
  on public.alerts for update
  to authenticated
  using (public.can_write_operational_data())
  with check (public.can_write_operational_data());

create policy alerts_delete_admin_only
  on public.alerts for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- ---------------------------
-- 12.7 audit_log (solo lectura para admin/director; nadie inserta manualmente)
-- ---------------------------
create policy audit_log_select_admin_director
  on public.audit_log for select
  to authenticated
  using (public.is_admin_or_director());

-- Sin policy de insert/update/delete para usuarios normales:
-- el registro de auditoría solo se escribe vía funciones security definer
-- (a implementar en sesión de triggers de negocio).

-- ============================================================================
-- FIN Sesión 0-A
-- Siguiente paso sugerido (Sesión 0-B): seed de datos iniciales
-- (parámetros del catálogo, pozos reales de Pucusana) + funciones de negocio
-- (trigger de evaluación de umbrales -> generación automática de alerts).
-- ============================================================================

-- ============================================================================
-- ACL GESTIÓN HÍDRICA — HUB CORPORATIVO
-- Sesión 0-B: Esquema SQL del Hub - plantas, planta_status, alarmas_activas
--             + función de agregación
-- Contexto: proyecto Supabase INDEPENDIENTE de los spokes (ej. Pucusana).
--           Los datos de cada planta llegan aquí vía sincronización
--           (Edge Function / job programado usando service_role),
--           no vía conexión directa entre bases.
-- Motor: PostgreSQL (Supabase)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONES
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TIPOS (ENUMS)
-- ----------------------------------------------------------------------------

-- Roles a nivel Hub (simplificado respecto al spoke: aquí es visualización
-- corporativa, no operación de campo)
create type public.hub_user_role as enum (
  'admin',   -- mantiene catálogo de plantas y configuración del Hub
  'visor'    -- dirección técnica / corporativo, solo lectura
);

-- Estado consolidado de una planta (calculado por agregación)
create type public.plant_status as enum (
  'operativo',   -- sin alertas abiertas
  'atencion',    -- alertas de severidad 'atencion' abiertas
  'critico',     -- al menos una alerta 'critica' abierta
  'sin_datos'    -- no ha sincronizado en la ventana esperada
);

-- Severidad espejada desde los spokes (mismos valores que alert_severity
-- del spoke, pero definida de forma independiente porque es otra base)
create type public.hub_alert_severity as enum (
  'info',
  'atencion',
  'critica'
);

-- Estado de alerta espejado desde los spokes
create type public.hub_alert_status as enum (
  'abierta',
  'reconocida',
  'resuelta',
  'descartada'
);

-- ----------------------------------------------------------------------------
-- 2. TABLA: profiles (usuarios del Hub)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  role        public.hub_user_role not null default 'visor',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Usuarios del Hub corporativo (dirección técnica / administración).';

-- ----------------------------------------------------------------------------
-- 3. TABLA: plantas (catálogo maestro de las 6 plantas ACL)
-- ----------------------------------------------------------------------------
create table public.plantas (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,   -- ej. 'PUC', 'ARE', 'CUS', 'ZAR' (Zárate/Lima)...
  name              text not null,          -- ej. 'Pucusana', 'Arequipa'
  region            text,
  spoke_project_ref text,                   -- referencia informativa al proyecto Supabase del spoke
  is_active         boolean not null default true,
  sync_enabled      boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.plantas is 'Catálogo maestro de las 6 plantas ACL Perú (incluye Pucusana).';

-- ----------------------------------------------------------------------------
-- 4. TABLA: planta_status (snapshot consolidado, 1 fila por planta)
-- ----------------------------------------------------------------------------
create table public.planta_status (
  plant_id              uuid primary key references public.plantas (id) on delete cascade,
  status                public.plant_status not null default 'sin_datos',
  active_alerts_count   integer not null default 0,
  critical_alerts_count integer not null default 0,
  warning_alerts_count  integer not null default 0,
  last_reading_at       timestamptz,          -- última lectura reportada por el spoke
  last_sync_at          timestamptz,          -- última vez que el Hub recibió datos de esa planta
  updated_at            timestamptz not null default now()
);

comment on table public.planta_status is 'Snapshot consolidado del estado de cada planta, recalculado por la función de agregación.';

-- ----------------------------------------------------------------------------
-- 5. TABLA: alarmas_activas (espejo de alertas abiertas de las 6 plantas)
-- ----------------------------------------------------------------------------
create table public.alarmas_activas (
  id               uuid primary key default gen_random_uuid(),
  plant_id         uuid not null references public.plantas (id) on delete cascade,
  source_alert_id  uuid not null,          -- id de la alerta en la tabla 'alerts' del spoke de origen
  well_code        text not null,          -- código de pozo (ej. 'PUC-PZ-01'), no FK: otra base
  parameter_code   text not null,          -- código de parámetro (ej. 'CL', 'COND_EC')
  severity         public.hub_alert_severity not null,
  status           public.hub_alert_status not null default 'abierta',
  message          text not null,
  triggered_value  numeric,
  triggered_at     timestamptz not null,   -- momento en que se generó en el spoke
  synced_at        timestamptz not null default now(),
  unique (plant_id, source_alert_id)
);

comment on table public.alarmas_activas is 'Espejo de alertas activas sincronizadas desde cada spoke. Se actualiza/borra vía proceso de sync.';

-- ----------------------------------------------------------------------------
-- 6. ÍNDICES
-- ----------------------------------------------------------------------------

-- Vista principal del Hub: alertas abiertas por planta
create index idx_alarmas_plant_status
  on public.alarmas_activas (plant_id, status)
  where status in ('abierta', 'reconocida');

-- Conteo/orden por severidad (panel de criticidad)
create index idx_alarmas_severity
  on public.alarmas_activas (severity, status);

-- Dashboard principal: estado por planta
create index idx_planta_status_status
  on public.planta_status (status);

-- Detectar plantas sin sincronizar (alerta operativa del propio Hub)
create index idx_planta_status_last_sync
  on public.planta_status (last_sync_at);

-- ----------------------------------------------------------------------------
-- 7. updated_at automático
-- ----------------------------------------------------------------------------
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

create trigger trg_plantas_updated_at
  before update on public.plantas
  for each row execute function public.set_updated_at();

-- Crear profile automáticamente al registrarse un usuario
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
-- 8. FUNCIÓN DE AGREGACIÓN: refresh_planta_status
-- Recalcula planta_status a partir de alarmas_activas.
-- Puede llamarse para una sola planta (p_plant_id) o para todas (null).
-- ----------------------------------------------------------------------------
create or replace function public.refresh_planta_status(p_plant_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.planta_status (
    plant_id, status, active_alerts_count, critical_alerts_count,
    warning_alerts_count, last_sync_at, updated_at
  )
  select
    p.id as plant_id,
    case
      when count(a.id) filter (where a.severity = 'critica' and a.status in ('abierta','reconocida')) > 0
        then 'critico'::public.plant_status
      when count(a.id) filter (where a.severity = 'atencion' and a.status in ('abierta','reconocida')) > 0
        then 'atencion'::public.plant_status
      else 'operativo'::public.plant_status
    end as status,
    count(a.id) filter (where a.status in ('abierta','reconocida')) as active_alerts_count,
    count(a.id) filter (where a.severity = 'critica' and a.status in ('abierta','reconocida')) as critical_alerts_count,
    count(a.id) filter (where a.severity = 'atencion' and a.status in ('abierta','reconocida')) as warning_alerts_count,
    now() as last_sync_at,
    now() as updated_at
  from public.plantas p
  left join public.alarmas_activas a on a.plant_id = p.id
  where p.is_active = true
    and (p_plant_id is null or p.id = p_plant_id)
  group by p.id
  on conflict (plant_id) do update set
    status                = excluded.status,
    active_alerts_count   = excluded.active_alerts_count,
    critical_alerts_count = excluded.critical_alerts_count,
    warning_alerts_count  = excluded.warning_alerts_count,
    last_sync_at          = excluded.last_sync_at,
    updated_at            = excluded.updated_at;
end;
$$;

comment on function public.refresh_planta_status is
  'Recalcula el snapshot de planta_status a partir de alarmas_activas. Se invoca tras cada sync o vía trigger.';

-- Trigger: recalcular automáticamente la planta afectada cuando
-- alarmas_activas cambia (insert/update/delete)
create or replace function public.trg_refresh_planta_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_planta_status(old.plant_id);
    return old;
  else
    perform public.refresh_planta_status(new.plant_id);
    return new;
  end if;
end;
$$;

create trigger trg_alarmas_activas_refresh
  after insert or update or delete on public.alarmas_activas
  for each row execute function public.trg_refresh_planta_status();

-- ----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.plantas         enable row level security;
alter table public.planta_status   enable row level security;
alter table public.alarmas_activas enable row level security;

-- Función auxiliar
create or replace function public.hub_current_user_role()
returns public.hub_user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- 9.1 profiles
create policy hub_profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

create policy hub_profiles_update_self_basic
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy hub_profiles_admin_full
  on public.profiles for all
  to authenticated
  using (public.hub_current_user_role() = 'admin')
  with check (public.hub_current_user_role() = 'admin');

-- 9.2 plantas: lectura para todo autenticado, escritura solo admin
create policy hub_plantas_select_authenticated
  on public.plantas for select
  to authenticated
  using (true);

create policy hub_plantas_write_admin
  on public.plantas for insert
  to authenticated
  with check (public.hub_current_user_role() = 'admin');

create policy hub_plantas_update_admin
  on public.plantas for update
  to authenticated
  using (public.hub_current_user_role() = 'admin')
  with check (public.hub_current_user_role() = 'admin');

create policy hub_plantas_delete_admin
  on public.plantas for delete
  to authenticated
  using (public.hub_current_user_role() = 'admin');

-- 9.3 planta_status: lectura para todo autenticado.
-- Sin policy de insert/update/delete para 'authenticated': solo se escribe
-- vía la función refresh_planta_status (security definer) o service_role.
create policy hub_planta_status_select_authenticated
  on public.planta_status for select
  to authenticated
  using (true);

-- 9.4 alarmas_activas: lectura para todo autenticado.
-- La escritura normal viene del proceso de sync (service_role, que
-- bypassa RLS). Se agrega policy de insert/update/delete solo para 'admin'
-- por si se requiere corrección manual puntual.
create policy hub_alarmas_select_authenticated
  on public.alarmas_activas for select
  to authenticated
  using (true);

create policy hub_alarmas_write_admin
  on public.alarmas_activas for insert
  to authenticated
  with check (public.hub_current_user_role() = 'admin');

create policy hub_alarmas_update_admin
  on public.alarmas_activas for update
  to authenticated
  using (public.hub_current_user_role() = 'admin')
  with check (public.hub_current_user_role() = 'admin');

create policy hub_alarmas_delete_admin
  on public.alarmas_activas for delete
  to authenticated
  using (public.hub_current_user_role() = 'admin');

-- ============================================================================
-- FIN Sesión 0-B (Hub corporativo)
-- Pendiente para próxima sesión del Hub: función/Edge Function de sincronización
-- que llama a la API de cada spoke, hace upsert en alarmas_activas y limpia
-- las que ya no están abiertas (delete o marca 'resuelta').
-- Pendiente aparte: retomar Sesión 0-B original del spoke Pucusana (seed de
-- pozos y parámetros) cuando corresponda.
-- ============================================================================

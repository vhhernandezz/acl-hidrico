-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0008: tabla 'dataloggers' — identidad de cada dispositivo físico
-- instalado en un pozo, con su propia API key (hasheada) para autenticarse
-- contra el endpoint de ingesta (Sesión 1-B).
--
-- El dispositivo NO usa Supabase Auth (no es un usuario humano). Se
-- autentica con un API key propio; el Edge Function valida ese key contra
-- api_key_hash y usa el service_role para insertar en 'readings',
-- bypassando RLS igual que hace el proceso de sync del Hub.
-- ============================================================================

create table public.dataloggers (
  id            uuid primary key default gen_random_uuid(),
  well_id       uuid not null references public.wells (id) on delete cascade,
  device_code   text not null unique,   -- ej. 'DL-POZO1-01'
  api_key_hash  text not null unique,   -- SHA-256 hex del API key (nunca se guarda el key en claro)
  is_active     boolean not null default true,
  last_seen_at  timestamptz,
  notes         text,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);

comment on table public.dataloggers is 'Dispositivos datalogger instalados por pozo, con API key propia para el endpoint de ingesta.';
comment on column public.dataloggers.api_key_hash is 'SHA-256 hex del API key del dispositivo. El key en claro solo existe una vez, al generarlo, y se graba en el propio datalogger.';

create index idx_dataloggers_well on public.dataloggers (well_id);

alter table public.dataloggers enable row level security;

-- Solo admin gestiona dataloggers (crear/editar/desactivar).
create policy dataloggers_admin_full
  on public.dataloggers for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Director técnico puede ver el estado de los dispositivos (last_seen_at, activo/inactivo)
-- para monitoreo operativo, pero no puede modificarlos.
create policy dataloggers_director_select
  on public.dataloggers for select
  to authenticated
  using (public.current_user_role() in ('admin', 'director_tecnico'));

-- Nota: el Edge Function de ingesta usa la service_role key, que bypassa RLS
-- por completo. Estas políticas solo gobiernan el acceso desde la app (usuarios
-- humanos autenticados), no el flujo del datalogger.

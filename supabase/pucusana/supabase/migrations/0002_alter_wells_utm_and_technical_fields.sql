-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0002: ajusta 'wells' para coordenadas UTM (en vez de lat/long)
-- y agrega campos técnicos de referencia tomados de la ficha AWS 1.1.1
-- (5.1 Abastecimiento privado de agua - Pozos).
-- ============================================================================

alter table public.wells
  drop column if exists latitude,
  drop column if exists longitude;

alter table public.wells
  add column utm_norte numeric(14, 3),
  add column utm_este numeric(14, 3),
  add column utm_zona text not null default '18S',
  add column utm_datum text not null default 'WGS84',
  add column nivel_estatico_referencia_m numeric(6, 2),   -- nivel estático de referencia (m bgl), medido en construcción/última prueba
  add column nivel_dinamico_referencia_m numeric(6, 2),   -- nivel dinámico de referencia (m bgl)
  add column caudal_habitual_m3h numeric(8, 2),            -- caudal habitual de bombeo declarado (m³/h), referencia de diseño
  add column capacidad_nominal_bomba_m3h numeric(8, 2),
  add column costo_agua_usd_m3 numeric(8, 3),
  add column ficha_tecnica jsonb;                          -- resto de atributos AWS (material, tipo de bomba, geología, etc.), flexible

comment on column public.wells.utm_norte is 'Coordenada UTM Norte (metros), zona indicada en utm_zona.';
comment on column public.wells.utm_este is 'Coordenada UTM Este (metros), zona indicada en utm_zona.';
comment on column public.wells.nivel_estatico_referencia_m is 'Nivel estático de referencia (m bgl) al momento de la última medición/prueba de bombeo. No reemplaza las lecturas periódicas en readings.';
comment on column public.wells.nivel_dinamico_referencia_m is 'Nivel dinámico de referencia (m bgl), asociado al caudal_habitual_m3h.';
comment on column public.wells.ficha_tecnica is 'Atributos adicionales de la ficha técnica AWS (material de construcción, tipo de bomba, geología, problemas de calidad, etc.), formato libre en JSON.';

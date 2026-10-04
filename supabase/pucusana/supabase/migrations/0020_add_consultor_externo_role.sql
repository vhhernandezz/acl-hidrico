-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0020: agrega el valor 'consultor_externo' al enum user_role.
-- Sesión 5-C.
--
-- IMPORTANTE: debe ejecutarse SOLA, como su propia migración — Postgres no
-- permite usar un valor de enum reción agregado en la misma transacción
-- que lo creó. Por eso las políticas que lo usan van en la migración 0021,
-- separada.
-- ============================================================================

alter type public.user_role add value 'consultor_externo';

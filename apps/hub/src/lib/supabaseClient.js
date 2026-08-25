import { createSupabaseClient } from '@acl-hidrico/core';

/**
 * Cliente Supabase de ESTA app (Hub corporativo). Usa las variables de
 * entorno propias de apps/hub/.env — un proyecto Supabase DISTINTO al de
 * Pucusana (arquitectura Hub & Spoke: bases físicamente separadas).
 */
export const supabase = createSupabaseClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

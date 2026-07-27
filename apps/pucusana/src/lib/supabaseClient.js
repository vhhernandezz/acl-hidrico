import { createSupabaseClient } from '@acl-hidrico/core';

/**
 * Cliente Supabase de ESTA app (Pucusana). Usa las variables de entorno
 * propias de apps/pucusana/.env (ver .env.example).
 */
export const supabase = createSupabaseClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

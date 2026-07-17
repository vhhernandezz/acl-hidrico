import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase configurable por planta.
 * Cada app (hub, pucusana, etc.) pasa sus propias credenciales
 * desde sus variables de entorno (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
 *
 * Uso en una app:
 *   import { createSupabaseClient } from '@acl-hidrico/core/lib/supabase-client';
 *   export const supabase = createSupabaseClient(
 *     import.meta.env.VITE_SUPABASE_URL,
 *     import.meta.env.VITE_SUPABASE_ANON_KEY
 *   );
 */
export function createSupabaseClient(url, anonKey) {
  if (!url || !anonKey) {
    throw new Error(
      '[@acl-hidrico/core] Faltan credenciales de Supabase. Revisa el .env de la app.'
    );
  }
  return createClient(url, anonKey);
}

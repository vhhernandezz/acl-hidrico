import { createAuthContext } from '@acl-hidrico/core';
import { supabase } from './lib/supabaseClient';

/**
 * Instancia de AuthProvider/useAuth ligada AL CLIENTE SUPABASE DEL HUB.
 * Proyecto distinto al de Pucusana — sesión independiente.
 */
export const { AuthProvider, useAuth } = createAuthContext(supabase);

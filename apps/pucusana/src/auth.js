import { createAuthContext } from '@acl-hidrico/core';
import { supabase } from './lib/supabaseClient';

/**
 * Instancia de AuthProvider/useAuth ligada AL CLIENTE SUPABASE DE PUCUSANA.
 * No compartir este módulo con el Hub — cada app tiene su propia sesión,
 * porque son proyectos Supabase distintos.
 */
export const { AuthProvider, useAuth } = createAuthContext(supabase);

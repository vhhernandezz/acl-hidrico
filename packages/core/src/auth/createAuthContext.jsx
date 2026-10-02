import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

/**
 * createAuthContext(supabaseClient)
 * Fábrica de un AuthProvider + useAuth ligados a UN cliente Supabase
 * específico. Cada app (Pucusana, Hub) tiene su propio proyecto Supabase,
 * así que cada una llama esto con SU cliente:
 *
 *   export const { AuthProvider, useAuth } = createAuthContext(supabase);
 *
 * Maneja la sesión de Supabase Auth y, además, trae el perfil (rol) desde
 * la tabla 'profiles' — el rol NUNCA se lee de user_metadata (ver
 * docs/AUTH.md, Sesión 5-A, sobre por qué eso sería inseguro).
 */
export function createAuthContext(supabaseClient) {
  const AuthContext = createContext(null);

  function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = useCallback(async (userId) => {
      if (!userId) {
        setProfile(null);
        return;
      }
      const { data } = await supabaseClient
        .from('profiles')
        .select('id, full_name, role, is_active')
        .eq('id', userId)
        .maybeSingle();
      setProfile(data ?? null);
    }, []);

    useEffect(() => {
      let isMounted = true;

      supabaseClient.auth.getSession().then(({ data }) => {
        if (!isMounted) return;
        setSession(data.session);
        fetchProfile(data.session?.user?.id).finally(() => {
          if (isMounted) setLoading(false);
        });
      });

      const { data: listener } = supabaseClient.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
        fetchProfile(newSession?.user?.id);
      });

      return () => {
        isMounted = false;
        listener.subscription.unsubscribe();
      };
    }, [fetchProfile]);

    const signIn = useCallback(async (email, password) => {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      return { error };
    }, []);

    const signOut = useCallback(async () => {
      await supabaseClient.auth.signOut();
    }, []);

    const value = {
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      loading,
      signIn,
      signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }

  function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
    return ctx;
  }

  return { AuthProvider, useAuth };
}

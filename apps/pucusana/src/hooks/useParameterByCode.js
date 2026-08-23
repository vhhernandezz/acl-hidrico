import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * useParameterByCode(code)
 * Versión genérica de la lógica que usa CaudalReadingForm (Sesión 1-A),
 * reutilizable para cualquier parámetro del catálogo.
 */
export function useParameterByCode(code) {
  const [parameter, setParameter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchParameter() {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('parameters')
        .select('id, code, name, unit, expected_frequency_hours')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
      } else if (!data) {
        setNotFound(true);
      } else {
        setParameter(data);
      }
      setLoading(false);
    }

    fetchParameter();
    return () => {
      isMounted = false;
    };
  }, [code]);

  return { parameter, loading, error, notFound };
}

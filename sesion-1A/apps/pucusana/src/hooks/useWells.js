import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * useWells()
 * Trae los pozos activos de la planta, ordenados por código, para
 * poblar el selector del formulario de ingreso manual.
 */
export function useWells() {
  const [wells, setWells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchWells() {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('wells')
        .select('id, code, name')
        .eq('status', 'activo')
        .order('code', { ascending: true });

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setWells(data ?? []);
        setError(null);
      }
      setLoading(false);
    }

    fetchWells();
    return () => {
      isMounted = false;
    };
  }, []);

  return { wells, loading, error };
}

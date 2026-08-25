import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * usePlantas()
 * Trae el catálogo de plantas activas, para poblar el filtro del panel
 * de alarmas y cualquier otro selector del Hub.
 */
export function usePlantas() {
  const [plantas, setPlantas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchPlantas() {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('plantas')
        .select('id, code, name, sync_enabled')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setPlantas(data ?? []);
        setError(null);
      }
      setLoading(false);
    }

    fetchPlantas();
    return () => {
      isMounted = false;
    };
  }, []);

  return { plantas, loading, error };
}

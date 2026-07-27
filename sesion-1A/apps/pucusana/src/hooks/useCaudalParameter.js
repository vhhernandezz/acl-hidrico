import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Código del parámetro de caudal en la tabla 'parameters'.
 * Debe existir en el catálogo (se crea en el seed de Pucusana).
 */
export const CAUDAL_PARAMETER_CODE = 'CAUDAL_EXTRACCION';

/**
 * useCaudalParameter()
 * Resuelve el id y la unidad del parámetro de caudal a partir de su
 * código. Si no existe en el catálogo (seed pendiente), retorna
 * notFound=true para que la UI lo comunique claramente.
 */
export function useCaudalParameter() {
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
        .select('id, code, name, unit')
        .eq('code', CAUDAL_PARAMETER_CODE)
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
  }, []);

  return { parameter, loading, error, notFound };
}

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * useModelNames(wellId, parameterId)
 * Lista los model_name distintos disponibles para este pozo+parámetro,
 * para poblar el selector de modelo (por si en el futuro hay más de uno).
 */
export function useModelNames(wellId, parameterId) {
  const [modelNames, setModelNames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wellId || !parameterId) return;
    let isMounted = true;

    async function fetchNames() {
      setLoading(true);
      const { data } = await supabase
        .from('model_projections')
        .select('model_name')
        .eq('well_id', wellId)
        .eq('parameter_id', parameterId);

      if (!isMounted) return;
      const unique = Array.from(new Set((data ?? []).map((r) => r.model_name)));
      setModelNames(unique);
      setLoading(false);
    }

    fetchNames();
    return () => {
      isMounted = false;
    };
  }, [wellId, parameterId]);

  return { modelNames, loading };
}

/**
 * useModelProjections(wellId, parameterId, modelName)
 * Trae las filas de proyección (los 3 escenarios) para un pozo+parámetro+
 * modelo, ya reorganizadas por fecha: { projection_date, optimista, base, pesimista }.
 */
export function useModelProjections(wellId, parameterId, modelName) {
  const [projections, setProjections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!wellId || !parameterId || !modelName) {
      setProjections([]);
      setLoading(false);
      return;
    }
    let isMounted = true;

    async function fetchProjections() {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('model_projections')
        .select('projection_date, scenario, projected_value')
        .eq('well_id', wellId)
        .eq('parameter_id', parameterId)
        .eq('model_name', modelName)
        .order('projection_date', { ascending: true });

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const byDate = new Map();
      for (const row of data ?? []) {
        const key = row.projection_date;
        const entry = byDate.get(key) ?? { projection_date: key };
        entry[row.scenario] = row.projected_value;
        byDate.set(key, entry);
      }

      setProjections(Array.from(byDate.values()).sort((a, b) => a.projection_date.localeCompare(b.projection_date)));
      setError(null);
      setLoading(false);
    }

    fetchProjections();
    return () => {
      isMounted = false;
    };
  }, [wellId, parameterId, modelName]);

  return { projections, loading, error };
}

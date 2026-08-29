import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * useWellParametersConfig(wellId)
 * Trae TODO el catálogo de parámetros activos, combinado con la fila de
 * 'well_parameters' del pozo dado (si existe). Para parámetros que nunca
 * se configuraron en este pozo, devuelve valores por defecto (no
 * monitoreado, sin umbrales) — el formulario permite crearlos desde cero.
 *
 * save(parameterId, values) hace upsert en well_parameters
 * (well_id, parameter_id) es la clave única del esquema original.
 */
export function useWellParametersConfig(wellId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchConfig = useCallback(async () => {
    if (!wellId) return;
    setLoading(true);

    const [{ data: parameters, error: paramsError }, { data: wellParams, error: wpError }] = await Promise.all([
      supabase
        .from('parameters')
        .select('id, code, name, unit, category')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('well_parameters')
        .select('id, parameter_id, is_monitored, threshold_warning, threshold_critical, direction')
        .eq('well_id', wellId),
    ]);

    if (paramsError || wpError) {
      setError((paramsError || wpError).message);
      setLoading(false);
      return;
    }

    const wpByParamId = new Map((wellParams ?? []).map((wp) => [wp.parameter_id, wp]));

    const merged = (parameters ?? []).map((p) => {
      const wp = wpByParamId.get(p.id);
      return {
        parameter_id: p.id,
        code: p.code,
        name: p.name,
        unit: p.unit,
        category: p.category,
        well_parameter_id: wp?.id ?? null,
        is_monitored: wp?.is_monitored ?? false,
        threshold_warning: wp?.threshold_warning ?? '',
        threshold_critical: wp?.threshold_critical ?? '',
        direction: wp?.direction ?? 'above',
      };
    });

    setRows(merged);
    setError(null);
    setLoading(false);
  }, [wellId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const save = useCallback(
    async (parameterId, values) => {
      const payload = {
        well_id: wellId,
        parameter_id: parameterId,
        is_monitored: values.is_monitored,
        threshold_warning: values.threshold_warning === '' ? null : Number(values.threshold_warning),
        threshold_critical: values.threshold_critical === '' ? null : Number(values.threshold_critical),
        direction: values.direction,
      };

      const { error: saveError } = await supabase
        .from('well_parameters')
        .upsert(payload, { onConflict: 'well_id,parameter_id' });

      if (saveError) throw saveError;

      await fetchConfig();
    },
    [wellId, fetchConfig]
  );

  return { rows, loading, error, save, refresh: fetchConfig };
}

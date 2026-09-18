import React, { useEffect, useMemo, useState } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useWells } from '../hooks/useWells';
import { useParameterByCode } from '../hooks/useParameterByCode';
import { useHistoricalReadings } from '../hooks/useHistoricalReadings';
import { useModelNames, useModelProjections } from '../hooks/useModelProjections';
import './ModelComparison.css';

const TDS_PARAMETER_CODE = 'TDS';

function toDateKey(iso) {
  return new Date(iso).toISOString().slice(0, 10); // YYYY-MM-DD, agrupa por día
}

function formatDateLabel(dateKey) {
  return new Date(dateKey).toLocaleDateString('es-PE', { month: 'short', year: 'numeric' });
}

function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="mc-tooltip">
      <div className="mc-tooltip-date">{new Date(label).toLocaleDateString('es-PE', { dateStyle: 'medium' })}</div>
      {payload.map((p) => (
        p.value != null && p.dataKey !== 'bandLow' && p.dataKey !== 'bandHeight' && (
          <div key={p.dataKey} className="mc-tooltip-row">
            <span className="mc-tooltip-dot" style={{ background: p.color }} />
            {p.name}: <strong>{Number(p.value).toLocaleString('es-PE')} {unit}</strong>
          </div>
        )
      ))}
    </div>
  );
}

export function ModelComparison() {
  const { wells, loading: loadingWells } = useWells();
  const [wellId, setWellId] = useState('');

  useEffect(() => {
    if (!wellId && wells.length > 0) setWellId(wells[0].id);
  }, [wells, wellId]);

  const { parameter: tdsParameter, loading: loadingParameter, notFound } = useParameterByCode(TDS_PARAMETER_CODE);

  const { modelNames, loading: loadingModelNames } = useModelNames(wellId, tdsParameter?.id);
  const [modelName, setModelName] = useState('');

  useEffect(() => {
    if (!modelName && modelNames.length > 0) setModelName(modelNames[0]);
  }, [modelNames, modelName]);

  const { readings, loading: loadingReadings } = useHistoricalReadings(wellId, tdsParameter?.id, {});
  const { projections, loading: loadingProjections } = useModelProjections(wellId, tdsParameter?.id, modelName);

  const chartData = useMemo(() => {
    const byDate = new Map();

    for (const r of readings) {
      const key = toDateKey(r.recorded_at);
      const entry = byDate.get(key) ?? { dateKey: key };
      entry.observado = r.value;
      byDate.set(key, entry);
    }

    for (const p of projections) {
      const key = p.projection_date;
      const entry = byDate.get(key) ?? { dateKey: key };
      if (p.optimista != null || p.pesimista != null) {
        const low = Math.min(p.optimista ?? p.pesimista, p.pesimista ?? p.optimista);
        const high = Math.max(p.optimista ?? p.pesimista, p.pesimista ?? p.optimista);
        entry.bandLow = low;
        entry.bandHeight = high - low;
      }
      if (p.base != null) entry.proyectado = p.base;
      byDate.set(key, entry);
    }

    return Array.from(byDate.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [readings, projections]);

  const todayKey = toDateKey(new Date().toISOString());
  const loading = loadingWells || loadingParameter || loadingModelNames || loadingReadings || loadingProjections;

  if (loadingWells || loadingParameter) {
    return <div className="mc-card"><p className="mc-status-text">Cargando…</p></div>;
  }

  if (notFound) {
    return (
      <div className="mc-card mc-card--error" role="alert">
        <p className="mc-status-text">El parámetro TDS no está en el catálogo.</p>
      </div>
    );
  }

  return (
    <section className="mc-card">
      <header className="mc-card-header">
        <div>
          <span className="mc-eyebrow">Análisis y modelo</span>
          <h2 className="mc-title">Observado vs. proyección — TDS</h2>
        </div>
      </header>

      <div className="mc-controls">
        <div className="mc-control-field">
          <label htmlFor="mc-well-select" className="mc-label">Pozo</label>
          <select id="mc-well-select" className="mc-select" value={wellId} onChange={(e) => setWellId(e.target.value)}>
            {wells.map((well) => (
              <option key={well.id} value={well.id}>{well.code} — {well.name}</option>
            ))}
          </select>
        </div>

        {modelNames.length > 0 && (
          <div className="mc-control-field">
            <label htmlFor="mc-model-select" className="mc-label">Modelo</label>
            <select id="mc-model-select" className="mc-select" value={modelName} onChange={(e) => setModelName(e.target.value)}>
              {modelNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!loadingModelNames && modelNames.length === 0 && (
        <p className="mc-banner mc-banner--info">
          Todavía no hay ninguna proyección de modelo cargada para este pozo — se muestra solo lo observado.
          Cuando el estudio hidrogeológico esté listo, se carga en <code>model_projections</code>.
        </p>
      )}

      {loading && <p className="mc-status-text">Cargando…</p>}

      {!loading && chartData.length === 0 && (
        <p className="mc-status-text">Sin datos (ni observados ni proyectados) para este pozo.</p>
      )}

      {!loading && chartData.length > 0 && (
        <div className="mc-plot">
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9e3d4" />
              <XAxis
                dataKey="dateKey"
                tickFormatter={formatDateLabel}
                tick={{ fontSize: 11, fill: '#5b6b6a' }}
                minTickGap={32}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#5b6b6a' }}
                label={{ value: tdsParameter?.unit ?? '', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#5b6b6a' }}
              />
              <Tooltip content={<CustomTooltip unit={tdsParameter?.unit ?? ''} />} />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />

              <Area dataKey="bandLow" stackId="banda" stroke="none" fill="transparent" legendType="none" isAnimationActive={false} />
              <Area
                dataKey="bandHeight"
                stackId="banda"
                stroke="none"
                fill="#4fb0ae"
                fillOpacity={0.18}
                name="Banda de incertidumbre"
                isAnimationActive={false}
              />

              <Line
                type="monotone"
                dataKey="proyectado"
                name="Proyectado (base)"
                stroke="#0f5c5a"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="observado"
                name="Observado"
                stroke="#1a1a1a"
                strokeWidth={2}
                dot={{ r: 2 }}
                isAnimationActive={false}
              />

              <ReferenceLine x={todayKey} stroke="#8a9291" strokeDasharray="2 2" label={{ value: 'Hoy', fontSize: 10, fill: '#8a9291', position: 'top' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

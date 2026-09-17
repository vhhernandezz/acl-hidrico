import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useWells } from '../hooks/useWells';
import { useParameterByCode } from '../hooks/useParameterByCode';
import { useHistoricalReadings, useWellParameterThreshold } from '../hooks/useHistoricalReadings';
import './HistoricalChart.css';

const TDS_PARAMETER_CODE = 'TDS';

const PRESETS = [
  { key: 'todo', label: 'Todo (2014-2025)' },
  { key: '5a', label: 'Últimos 5 años' },
  { key: '2a', label: 'Últimos 2 años' },
  { key: '1a', label: 'Último año' },
];

function presetToFrom(preset) {
  if (preset === 'todo') return null;
  const years = { '5a': 5, '2a': 2, '1a': 1 }[preset];
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString();
}

function formatDateLabel(iso) {
  return new Date(iso).toLocaleDateString('es-PE', { month: 'short', year: 'numeric' });
}

function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="hc-tooltip">
      <div className="hc-tooltip-date">{new Date(label).toLocaleDateString('es-PE', { dateStyle: 'medium' })}</div>
      <div className="hc-tooltip-value">{payload[0].value} {unit}</div>
    </div>
  );
}

export function HistoricalChart() {
  const { wells, loading: loadingWells } = useWells();
  const [wellId, setWellId] = useState('');
  const [preset, setPreset] = useState('todo');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    if (!wellId && wells.length > 0) setWellId(wells[0].id);
  }, [wells, wellId]);

  const { parameter: tdsParameter, loading: loadingParameter, notFound } = useParameterByCode(TDS_PARAMETER_CODE);

  const usingCustomRange = customFrom !== '' && customTo !== '';
  const range = usingCustomRange
    ? { from: new Date(customFrom).toISOString(), to: new Date(customTo).toISOString() }
    : { from: presetToFrom(preset), to: null };

  const { readings, loading: loadingReadings, error } = useHistoricalReadings(
    wellId,
    tdsParameter?.id,
    range
  );

  const { threshold } = useWellParameterThreshold(wellId, tdsParameter?.id);

  const chartData = useMemo(
    () => readings.map((r) => ({ dateIso: r.recorded_at, value: r.value })),
    [readings]
  );

  if (loadingWells || loadingParameter) {
    return (
      <div className="hc-card">
        <p className="hc-status-text">Cargando…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="hc-card hc-card--error" role="alert">
        <p className="hc-status-text">El parámetro TDS no está en el catálogo.</p>
      </div>
    );
  }

  return (
    <section className="hc-card">
      <header className="hc-card-header">
        <div>
          <span className="hc-eyebrow">Histórico</span>
          <h2 className="hc-title">TDS 2014-2025</h2>
        </div>
      </header>

      <div className="hc-controls">
        <div className="hc-control-field">
          <label htmlFor="hc-well-select" className="hc-label">Pozo</label>
          <select
            id="hc-well-select"
            className="hc-select"
            value={wellId}
            onChange={(e) => setWellId(e.target.value)}
          >
            {wells.map((well) => (
              <option key={well.id} value={well.id}>{well.code} — {well.name}</option>
            ))}
          </select>
        </div>

        <div className="hc-preset-group">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`hc-preset-btn ${!usingCustomRange && preset === p.key ? 'hc-preset-btn--active' : ''}`}
              onClick={() => { setPreset(p.key); setCustomFrom(''); setCustomTo(''); }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="hc-custom-range">
          <label className="hc-label" htmlFor="hc-from">Desde</label>
          <input id="hc-from" type="date" className="hc-date-input" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <label className="hc-label" htmlFor="hc-to">Hasta</label>
          <input id="hc-to" type="date" className="hc-date-input" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      </div>

      {error && <p className="hc-banner hc-banner--error" role="alert">No se pudo cargar: {error}</p>}
      {loadingReadings && <p className="hc-status-text">Cargando serie…</p>}

      {!loadingReadings && !error && chartData.length === 0 && (
        <p className="hc-status-text">Sin lecturas de TDS en el rango seleccionado.</p>
      )}

      {!loadingReadings && chartData.length > 0 && (
        <div className="hc-plot">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9e3d4" />
              <XAxis
                dataKey="dateIso"
                tickFormatter={formatDateLabel}
                tick={{ fontSize: 11, fill: '#5b6b6a' }}
                minTickGap={32}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#5b6b6a' }}
                label={{ value: tdsParameter?.unit ?? '', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#5b6b6a' }}
              />
              <Tooltip content={<CustomTooltip unit={tdsParameter?.unit ?? ''} />} />
              {threshold?.threshold_warning != null && (
                <ReferenceLine
                  y={threshold.threshold_warning}
                  stroke="#93690f"
                  strokeDasharray="4 4"
                  label={{ value: 'Atención', position: 'insideTopRight', fontSize: 10, fill: '#93690f' }}
                />
              )}
              {threshold?.threshold_critical != null && (
                <ReferenceLine
                  y={threshold.threshold_critical}
                  stroke="#b3422f"
                  strokeDasharray="4 4"
                  label={{ value: 'Crítico', position: 'insideTopRight', fontSize: 10, fill: '#b3422f' }}
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0f5c5a"
                strokeWidth={2}
                dot={{ r: 2, fill: '#0f5c5a' }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
